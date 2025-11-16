// src/background/index.ts

console.log('Image Capture Extension - Background loaded');

import {
  saveImage,
  loadAllImages,
  deleteImage,
  clearAllImages,
  CapturedImage as IndexedCapturedImage,
  loadImageByUrl,
  countImages
} from '../utils/indexedDBUtils';

// Function to fetch and store image data
async function fetchAndStoreImage(url: string, tabId: number): Promise<void> {
  try {
    // Check if image is already captured by looking for the URL in the database
    const existingImage = await loadImageByUrl(url);
    if (existingImage) {
      console.log('Image already captured:', url);
      return;
    }

    // Fetch image data
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    // Convert blob to base64 for storage in IndexedDB
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Create image object
    const imageObj: IndexedCapturedImage = {
      url,
      tabId,
      timestamp: Date.now(),
      data: base64Data
    };

    // Store in IndexedDB
    await saveImage(imageObj);
    console.log('Image saved to IndexedDB:', 'URL:', imageObj.url);

    // Send message to any open views that a new image was captured (metadata only)
    // This is kept for immediate UI updates
    chrome.runtime.sendMessage({
      type: 'IMAGE_CAPTURED',
      image: {
        url: imageObj.url,
        tabId: imageObj.tabId,
        timestamp: imageObj.timestamp
      }
    }).catch((error) => {
      // It's okay if no receivers are open
      console.log('Error sending IMAGE_CAPTURED message (no receivers):', error);
    });

  } catch (error) {
    console.error('Error capturing image:', url, error);
  }
}

// Web request listener to capture images
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const contentType = details.responseHeaders?.find(header =>
      header.name.toLowerCase() === 'content-type'
    )?.value || '';

    const isImageByContentType = contentType.startsWith('image/');
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(details.url);

    if (details.statusCode === 200 && details.url && (isImageByContentType || hasImageExtension)) {
      console.log('Image request detected:', details.url, 'Content-Type:', contentType, 'Tab ID:', details.tabId);
      fetchAndStoreImage(details.url, details.tabId);
    }
  },
  {
    urls: ['<all_urls>'],
    types: ['image']
  },
  ['responseHeaders']
);

// Listen for messages from popup/side panel and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);

  // --- HANDLERS FOR DATA MODIFICATION (KEPT) ---
  if (message.type === 'CLEAR_CAPTURED_IMAGES') {
    clearAllImages()
      .then(() => sendResponse({ type: 'CLEAR_RESPONSE', success: true }))
      .catch(error => {
        console.error('Error clearing images:', error);
        sendResponse({ type: 'CLEAR_RESPONSE', success: false });
      });
    return true; // Keep async response
  } else if (message.type === 'DELETE_IMAGE') {
    const imageId = message.imageId;
    deleteImage(imageId)
      .then(() => sendResponse({ type: 'DELETE_RESPONSE', success: true }))
      .catch(error => {
        console.error('Error deleting image:', error);
        sendResponse({ type: 'DELETE_RESPONSE', success: false });
      });
    return true; // Keep async response
  } else if (message.type === 'CHECK_AND_CAPTURE_IMAGE') {
    // Capture image from content script
    const { url, tabId } = message;
    if (url) {
      fetchAndStoreImage(url, tabId).catch(error => {
        console.error('Error capturing image from content script:', url, error);
      });
    }
    sendResponse({ type: 'IMAGE_CHECKED', success: true });
    return true; // Keep async response
  }

});

// Log startup message after everything is set up
loadAllImages()
  .then(images => {
    console.log('Loaded', images.length, 'previously captured images from IndexedDB');
  })
  .catch(error => {
    console.error('Error loading images on startup:', error);
  });