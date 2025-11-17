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

// --- BADGE MANAGEMENT ---
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

// --- IMAGE CAPTURE ---
/**
 * Checks if an image with the given URL is already captured
 */
async function isImageAlreadyCaptured(url: string): Promise<boolean> {
  const existingImage = await loadImageByUrl(url);
  return existingImage !== undefined;
}

/**
 * Fetches image data from URL
 */
async function fetchImageData(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  return await response.blob();
}

/**
 * Creates a CapturedImage object from URL, tabId, and blob data
 */
async function createCapturedImage(
  url: string,
  tabId: number,
  blob: Blob,
): Promise<CapturedImage> {
  const thumbnail = await generateThumbnailFromBlob(blob);

  return {
    url,
    tabId,
    timestamp: Date.now(),
    fullData: blob, // Store as blob
    thumbnailData: thumbnail,
    fileSize: blob.size, // Store file size as metadata
    width: 0, // Will be populated later
    height: 0, // Will be populated later
  };
}

/**
 * Notifies other parts of the extension about a newly captured image
 */
function notifyImageCaptured(image: Partial<CapturedImage>) {
  chrome.runtime
    .sendMessage({
      type: "IMAGE_CAPTURED",
      image: {
        url: image.url,
        tabId: image.tabId,
        timestamp: image.timestamp,
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
}

/**
 * Main function to fetch and store image data
 */
async function fetchAndStoreImage(url: string, tabId: number): Promise<void> {
  try {
    // Check if image is already captured
    if (await isImageAlreadyCaptured(url)) {
      console.log("Image already captured:", url);
      return;
    }

    // Fetch image data
    const blob = await fetchImageData(url);

    const mimeType = blob.type;
    if (!mimeType.startsWith("image/") && mimeType !== "image/svg+xml") {
      console.warn("Skipping non-image blob", blob);
      return; // or return a placeholder thumbnail
    }

    // Create image object
    const imageObj = await createCapturedImage(url, tabId, blob);

    // Store in IndexedDB
    await saveImage(imageObj);

    // Update the badge after a new image is saved
    await updateBadge();

    // Send message to any open views that a new image was captured
    notifyImageCaptured(imageObj);
  } catch (error) {
    console.error("Error capturing image:", url, error);
  }
}

// --- ZIP DOWNLOAD ---
/**
 * Converts a Blob to a Data URL
 */
const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error("Failed to convert Blob to Data URL"));
    reader.readAsDataURL(blob);
  });
};

/**
 * Helper function to wait for download completion
 */
const waitForDownloadComplete = (downloadId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const listener = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== downloadId) return;

      if (delta.state?.current === "complete") {
        chrome.downloads.onChanged.removeListener(listener);
        resolve();
      } else if (delta.state?.current === "interrupted") {
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error("Download was interrupted"));
      }
    };

    chrome.downloads.onChanged.addListener(listener);
  });
};

/**
 * Downloads a single blob as a file with the given filename
 */
async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const dataUrl = await blobToDataURL(blob);

  return new Promise<void>((resolve, reject) => {
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
          return;
        }

        // Wait for download completion
        waitForDownloadComplete(downloadId)
          .then(() => resolve())
          .catch((error) => reject(error));
      },
    );
  });
}

/**
 * Downloads all ZIP blobs
 */
async function downloadZipBlobs(zipBlobs: Blob[]): Promise<void> {
  const datePart = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < zipBlobs.length; i++) {
    const blob = zipBlobs[i];
    if (!blob) continue; // ensures blob is not undefined

    const fileName =
      zipBlobs.length > 1
        ? `captured-images-${datePart}-part-${i + 1}.zip`
        : `captured-images-${datePart}.zip`;

    await downloadBlob(blob, fileName);
  }
}

/**
 * Notifies about ZIP download completion
 */
function notifyZipDownloadComplete(success: boolean, message?: string) {
  chrome.runtime
    .sendMessage({
      type: success ? "ZIP_DOWNLOAD_COMPLETE" : "ZIP_DOWNLOAD_ERROR",
      success,
      message:
        message ||
        (success ? "All ZIP files downloaded successfully" : undefined),
    })
    .catch(() => {
      // Ignore errors if no receivers are open
    });
}

/**
 * Main function to handle ZIP download in the background
 */
async function handleZipDownload() {
  try {
    const allImages = await loadAllImages();

    if (allImages.length === 0) {
      console.log("No images to download");
      return;
    }

    const zipBlobs = await createZipFromCapturedImages(
      JSZip,
      allImages,
      (progress: number, _message: string) => {
        chrome.action.setBadgeText({ text: `${progress}%` });
        chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // Green for progress
      },
    );

    await updateBadge();
    await downloadZipBlobs(zipBlobs);
    notifyZipDownloadComplete(true);
  } catch (error: any) {
    console.error("Error in handleZipDownload:", error);
    notifyZipDownloadComplete(
      false,
      error.message || "An unknown error occurred",
    );

    throw error;
  }
}

// --- MESSAGE HANDLERS ---
/**
 * Handles CLEAR_CAPTURED_IMAGES message
 */
async function handleClearCapturedImages(
  sendResponse: (response: any) => void,
) {
  try {
    await clearAllImages();
    await updateBadge();
    sendResponse({ type: "CLEAR_RESPONSE", success: true });
  } catch (error) {
    console.error("Error clearing images:", error);
    sendResponse({ type: "CLEAR_RESPONSE", success: false });
  }
}

/**
 * Handles DELETE_IMAGE message
 */
async function handleDeleteImage(
  message: any,
  sendResponse: (response: any) => void,
) {
  const imageId = message.imageId;
  try {
    await deleteImage(imageId);
    await updateBadge();
    sendResponse({ type: "DELETE_RESPONSE", success: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    sendResponse({ type: "DELETE_RESPONSE", success: false });
  }
}

/**
 * Handles CHECK_AND_CAPTURE_IMAGE message
 */
async function handleCheckAndCaptureImage(
  message: any,
  sendResponse: (response: any) => void,
) {
  const { url, tabId } = message;
  if (url) {
    try {
      await fetchAndStoreImage(url, tabId);
    } catch (error) {
      console.error("Error capturing image from content script:", url, error);
    }
  }
  sendResponse({ type: "IMAGE_CHECKED", success: true });
}

/**
 * Handles ZIP_AND_DOWNLOAD_ALL_IMAGES message
 */
async function handleZipAndDownloadAllImages(
  sendResponse: (response: any) => void,
) {
  if (isZipOperationRunning) {
    console.log("ZIP operation already in progress, ignoring request");
    sendResponse({
      type: "ZIP_DOWNLOAD_COMPLETE",
      success: false,
      error: "Zip operation already in progress",
    });
    return;
  }

  try {
    // Start the ZIP process in the background
    isZipOperationRunning = true;
    await handleZipDownload();
    isZipOperationRunning = false;
    sendResponse({ type: "ZIP_DOWNLOAD_COMPLETE", success: true });
  } catch (error: any) {
    console.error("Error during ZIP download:", error);
    isZipOperationRunning = false;
    sendResponse({
      type: "ZIP_DOWNLOAD_COMPLETE",
      success: false,
      error: error.message,
    });
  }
}

// --- LISTENERS (KEPT AS REQUESTED) ---
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
  switch (message.type) {
    case "CLEAR_CAPTURED_IMAGES":
      handleClearCapturedImages(sendResponse);
      return true; // Keep async response

    case "DELETE_IMAGE":
      handleDeleteImage(message, sendResponse);
      return true; // Keep async response

    case "CHECK_AND_CAPTURE_IMAGE":
      handleCheckAndCaptureImage(message, sendResponse);
      return true; // Keep async response

    case "ZIP_AND_DOWNLOAD_ALL_IMAGES":
      handleZipAndDownloadAllImages(sendResponse);
      return true; // Keep async response

    default:
      return false; // No async response
  }
});

// Clear all captured images on browser startup
chrome.runtime.onStartup.addListener(async () => {
  try {
    await clearAllImages();
    await updateBadge();
  } catch (error) {
    console.error("Error clearing images on startup:", error);
  }
});

// Set up context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing context menu items to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Create a context menu item for clearing all images
    chrome.contextMenus.create({
      id: "clearAllCapturedImages",
      title: "Clear All Captured Images",
      contexts: ["action"],
    });

    chrome.contextMenus.create({
      id: "downloadAllAsZip",
      title: "Download All Images as ZIP",
      contexts: ["action"],
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === "clearAllCapturedImages") {
    try {
      await clearAllImages();
      await updateBadge();
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
    // Check if ZIP operation is already running
    if (isZipOperationRunning) {
      return;
    }

    try {
      // Reuse the existing handleZipDownload functionality
      // Start the ZIP download process in the background
      isZipOperationRunning = true;
      await handleZipDownload();
      console.log("ZIP download completed from context menu");
      isZipOperationRunning = false;

      // Update badge to show completion temporarily
      chrome.action.setBadgeText({ text: "OK" });
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // Green for success

      // Restore the image count on the badge after a short delay
      setTimeout(async () => {
        await updateBadge(); // This will set the badge back to the image count
      }, 2000);
    } catch (error) {
      console.error("Error in context menu ZIP download:", error);
      isZipOperationRunning = false;

      // Update badge to show error temporarily
      chrome.action.setBadgeText({ text: "ERR" });
      chrome.action.setBadgeBackgroundColor({ color: "#f44336" }); // Red for error

      // Restore the image count on the badge after a short delay
      setTimeout(async () => {
        await updateBadge(); // This will set the badge back to the image count
      }, 2000);
    }
  }
});

// Initialize on load
(async () => {
  try {
    await loadAllImages();
    await updateBadge();
  } catch (error) {
    console.error("Error loading images on startup:", error);
  }
})();
