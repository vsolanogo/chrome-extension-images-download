// src/background/index.ts

console.log("Image Capture Extension - Background loaded");

import { generateThumbnailFromBlob } from "../utils/generateThumbnailFromBlob";
import {
  saveImage,
  loadAllImages,
  deleteImage,
  clearAllImages,
  CapturedImage,
  loadImageByUrl,
  countImages,
} from "../utils/indexedDBUtils";

// --- NEW: Function to update the badge text ---
/**
 * Updates the extension's badge with the current number of captured images.
 * If the count is 0, the badge is hidden.
 */
async function updateBadge() {
  try {
    const imageCount = await countImages();
    // Set the badge text. If count is 0, use an empty string to hide it.
    chrome.action.setBadgeText({
      text: imageCount > 0 ? imageCount.toString() : "",
    });
    // Set a background color for the badge for better visibility.
    chrome.action.setBadgeBackgroundColor({ color: "#4688F1" }); // A nice blue color
  } catch (error) {
    console.error("Failed to update badge:", error);
    // Optionally, show an error indicator on the badge
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "red" });
  }
}

// Function to fetch and store image data
async function fetchAndStoreImage(url: string, tabId: number): Promise<void> {
  try {
    // Check if image is already captured by looking for the URL in the database
    const existingImage = await loadImageByUrl(url);
    if (existingImage) {
      console.log("Image already captured:", url);
      return;
    }

    // Fetch image data as Blob
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    const thumbnail = await generateThumbnailFromBlob(blob);

    // Create image object with full blob (thumbnail will be generated in UI)
    const imageObj: CapturedImage = {
      url,
      tabId,
      timestamp: Date.now(),
      fullData: blob, // Store as blob
      thumbnailData: thumbnail,
      fileSize: blob.size, // Store file size as metadata
      width: 0, // Will be populated later
      height: 0, // Will be populated later
    };

    // Store in IndexedDB
    await saveImage(imageObj);
    console.log("Image saved to IndexedDB:", "URL:", imageObj.url);

    // --- NEW: Update the badge after a new image is saved ---
    await updateBadge();

    // Send message to any open views that a new image was captured (metadata only)
    // This is kept for immediate UI updates
    chrome.runtime
      .sendMessage({
        type: "IMAGE_CAPTURED",
        image: {
          url: imageObj.url,
          tabId: imageObj.tabId,
          timestamp: imageObj.timestamp,
          // Do not send thumbnailData from background since we're not generating it here
        },
      })
      .catch((error) => {
        // It's okay if no receivers are open
        console.log(
          "Error sending IMAGE_CAPTURED message (no receivers):",
          error,
        );
      });
  } catch (error) {
    console.error("Error capturing image:", url, error);
  }
}

// Web request listener to capture images
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const contentType =
      details.responseHeaders?.find(
        (header) => header.name.toLowerCase() === "content-type",
      )?.value || "";

    const isImageByContentType = contentType.startsWith("image/");
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(
      details.url,
    );

    if (
      details.statusCode === 200 &&
      details.url &&
      (isImageByContentType || hasImageExtension)
    ) {
      console.log(
        "Image request detected:",
        details.url,
        "Content-Type:",
        contentType,
        "Tab ID:",
        details.tabId,
      );
      fetchAndStoreImage(details.url, details.tabId);
    }
  },
  {
    urls: ["<all_urls>"],
    types: ["image"],
  },
  ["responseHeaders"],
);

// Listen for messages from popup/side panel and content scripts
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  console.log("Background received message:", message.type);

  // --- HANDLERS FOR DATA MODIFICATION (KEPT) ---
  if (message.type === "CLEAR_CAPTURED_IMAGES") {
    clearAllImages()
      .then(async () => {
        // Made callback async to use await
        // --- NEW: Update the badge after clearing all images ---
        await updateBadge();
        sendResponse({ type: "CLEAR_RESPONSE", success: true });
      })
      .catch((error) => {
        console.error("Error clearing images:", error);
        sendResponse({ type: "CLEAR_RESPONSE", success: false });
      });
    return true; // Keep async response
  } else if (message.type === "DELETE_IMAGE") {
    const imageId = message.imageId;
    deleteImage(imageId)
      .then(async () => {
        // Made callback async to use await
        // --- NEW: Update the badge after deleting an image ---
        await updateBadge();
        sendResponse({ type: "DELETE_RESPONSE", success: true });
      })
      .catch((error) => {
        console.error("Error deleting image:", error);
        sendResponse({ type: "DELETE_RESPONSE", success: false });
      });
    return true; // Keep async response
  } else if (message.type === "CHECK_AND_CAPTURE_IMAGE") {
    // Capture image from content script
    const { url, tabId } = message;
    if (url) {
      fetchAndStoreImage(url, tabId).catch((error) => {
        console.error("Error capturing image from content script:", url, error);
      });
    }
    sendResponse({ type: "IMAGE_CHECKED", success: true });
    return true; // Keep async response
  }

  return false; // No async response
});

// Clear all captured images on browser startup
chrome.runtime.onStartup.addListener(() => {
  console.log(
    "Browser started up, clearing all captured images from IndexedDB",
  );
  clearAllImages()
    .then(async () => {
      // Made callback async to use await
      // --- NEW: Update the badge after clearing on startup ---
      await updateBadge();
      console.log("All images cleared on startup");
    })
    .catch((error) => {
      console.error("Error clearing images on startup:", error);
    });
});

// Log startup message after everything is set up
loadAllImages()
  .then(async (images) => {
    // Made callback async to use await
    console.log(
      "Loaded",
      images.length,
      "previously captured images from IndexedDB",
    );
    // --- NEW: Set the initial badge count when the background script loads ---
    await updateBadge();
  })
  .catch((error) => {
    console.error("Error loading images on startup:", error);
  });
