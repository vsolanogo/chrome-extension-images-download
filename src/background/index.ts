// src/background/index.ts

console.log("Image Capture Extension - Background loaded");

import JSZip from "jszip";
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
import { createZipFromCapturedImages } from "../utils/zipUtils";

// Add a global flag to track if a ZIP operation is currently running
let isZipOperationRunning = false;

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

  // Handle ZIP download request from popup
  if (message.type === "ZIP_AND_DOWNLOAD_ALL_IMAGES") {
    if (isZipOperationRunning) {
      console.log("ZIP operation already in progress, ignoring request");
      sendResponse({
        type: "ZIP_DOWNLOAD_COMPLETE",
        success: false,
        error: "Zip operation already in progress",
      });
      return false;
    }

    // Start the ZIP process in the background
    isZipOperationRunning = true;
    handleZipDownload()
      .then(() => {
        console.log("ZIP download completed");
        isZipOperationRunning = false;
        sendResponse({ type: "ZIP_DOWNLOAD_COMPLETE", success: true });
      })
      .catch((error) => {
        console.error("Error during ZIP download:", error);
        isZipOperationRunning = false;
        sendResponse({
          type: "ZIP_DOWNLOAD_COMPLETE",
          success: false,
          error: error.message,
        });
      });
    return true; // Keep async response
  }

  return false; // No async response
});

// Function to handle ZIP download in the background
async function handleZipDownload() {
  try {
    console.log("Starting ZIP download in background...");

    // Load all images from IndexedDB
    const allImages = await loadAllImages();
    console.log(`Loaded ${allImages.length} images for ZIP download`);

    if (allImages.length === 0) {
      console.log("No images to download");
      return;
    }

    // Create ZIP files from images with progress tracking
    const zipBlobs = await createZipFromCapturedImages(
      JSZip,
      allImages,
      (progress: number, _message: string) => {
        // Update badge with progress percentage
        chrome.action.setBadgeText({ text: `${progress}%` });
        chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // Green for progress
      },
    );

    // Restore the image count on the badge after completion
    await updateBadge();

    console.log(`Created ${zipBlobs.length} ZIP files`);

    // Create a function to convert Blob to Data URL
    const blobToDataURL = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () =>
          reject(new Error("Failed to convert Blob to Data URL"));
        reader.readAsDataURL(blob);
      });
    };

    // Download each ZIP blob using the chrome.downloads API
    for (let i = 0; i < zipBlobs.length; i++) {
      const blob = zipBlobs[i];
      const datePart = new Date().toISOString().slice(0, 10);
      const fileName =
        zipBlobs.length > 1
          ? `captured-images-${datePart}-part-${i + 1}.zip`
          : `captured-images-${datePart}.zip`;

      // Convert blob to data URL for download (using service worker compatible approach)
      const dataUrl = await blobToDataURL(blob!); // Use ! since we know it's not undefined here

      // Use chrome.downloads API to download the file
      await new Promise<void>((resolve, reject) => {
        chrome.downloads.download(
          {
            url: dataUrl,
            filename: fileName,
            saveAs: false,
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error("Download error:", chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              console.log(`Download started with ID: ${downloadId}`);
              // Listen for download completion
              chrome.downloads.onChanged.addListener(function listener(delta) {
                if (
                  delta.id === downloadId &&
                  delta.state &&
                  delta.state.current === "complete"
                ) {
                  chrome.downloads.onChanged.removeListener(listener);
                  // Note: No need to revoke Data URLs (unlike Object URLs)
                  resolve();
                } else if (
                  delta.id === downloadId &&
                  delta.state &&
                  delta.state.current === "interrupted"
                ) {
                  chrome.downloads.onChanged.removeListener(listener);
                  reject(new Error("Download was interrupted"));
                }
              });
            }
          },
        );
      });
    }

    console.log("All ZIP files downloaded successfully");

    // Send completion message
    chrome.runtime
      .sendMessage({
        type: "ZIP_DOWNLOAD_COMPLETE",
        success: true,
        message: "All ZIP files downloaded successfully",
      })
      .catch(() => {
        // Ignore errors if no receivers are open
      });
  } catch (error: any) {
    console.error("Error in handleZipDownload:", error);

    // Send error message
    chrome.runtime
      .sendMessage({
        type: "ZIP_DOWNLOAD_ERROR",
        success: false,
        error: error.message || "An unknown error occurred",
      })
      .catch(() => {
        // Ignore errors if no receivers are open
      });

    throw error;
  }
}

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

// Set up context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing context menu items to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Create a context menu item for clearing all images
    chrome.contextMenus.create(
      {
        id: "clearAllCapturedImages",
        title: "Clear All Captured Images",
        contexts: ["action"], // Shows in the extension's action button context menu
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error creating clear all context menu:",
            chrome.runtime.lastError,
          );
        } else {
          console.log("Clear all context menu created successfully");
        }
      },
    );

    // Create a context menu item for downloading all images as ZIP
    chrome.contextMenus.create(
      {
        id: "downloadAllAsZip",
        title: "Download All Images as ZIP",
        contexts: ["action"], // Shows in the extension's action button context menu
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error creating download ZIP context menu:",
            chrome.runtime.lastError,
          );
        } else {
          console.log("Download ZIP context menu created successfully");
        }
      },
    );
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === "clearAllCapturedImages") {
    console.log("Context menu: Clear all captured images selected");

    try {
      // Clear all images from IndexedDB
      await clearAllImages();
      console.log("All captured images cleared from IndexedDB");

      // Update the badge to reflect the change
      await updateBadge();

      // Send message to any open views that images were cleared (for UI updates)
      chrome.runtime
        .sendMessage({
          type: "IMAGES_CLEARED",
          success: true,
        })
        .catch((error) => {
          // It's okay if no receivers are open
          console.log("No receivers for IMAGES_CLEARED message:", error);
        });
    } catch (error) {
      console.error("Error clearing all images:", error);

      // Send error message
      chrome.runtime
        .sendMessage({
          type: "IMAGES_CLEARED",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
        .catch((error) => {
          console.log("No receivers for IMAGES_CLEARED error message:", error);
        });
    }
  } else if (info.menuItemId === "downloadAllAsZip") {
    console.log("Context menu: Download all images as ZIP selected");

    // Check if ZIP operation is already running
    if (isZipOperationRunning) {
      console.log("ZIP operation already in progress, ignoring request");
      return;
    }

    // Reuse the existing handleZipDownload functionality
    // Start the ZIP download process in the background
    isZipOperationRunning = true;
    handleZipDownload()
      .then(() => {
        console.log("ZIP download completed from context menu");
        isZipOperationRunning = false;

        // Update badge to show completion temporarily
        chrome.action.setBadgeText({ text: "OK" });
        chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // Green for success

        // Restore the image count on the badge after a short delay
        setTimeout(async () => {
          await updateBadge(); // This will set the badge back to the image count
        }, 2000);
      })
      .catch((error) => {
        console.error("Error in context menu ZIP download:", error);
        isZipOperationRunning = false;

        // Update badge to show error temporarily
        chrome.action.setBadgeText({ text: "ERR" });
        chrome.action.setBadgeBackgroundColor({ color: "#f44336" }); // Red for error

        // Restore the image count on the badge after a short delay
        setTimeout(async () => {
          await updateBadge(); // This will set the badge back to the image count
        }, 2000);
      });
  }
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
