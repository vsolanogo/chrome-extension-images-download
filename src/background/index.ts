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
    // Convert blob to base64 for storage in IndexedDB (since IndexedDB can store binary data)
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

    // Send message to any open views that a new image was captured
    chrome.runtime.sendMessage({
      type: 'IMAGE_CAPTURED',
      image: imageObj
    }).catch((error) => {
      console.log('Error sending IMAGE_CAPTURED message:', error);
    });

  } catch (error) {
    console.error('Error capturing image:', url, error);
  }
}

// Web request listener to capture images
chrome.webRequest.onCompleted.addListener(
  (details) => {
    // Check if the request is for an image by looking at the content type header
    const contentType = details.responseHeaders?.find(header =>
      header.name.toLowerCase() === 'content-type'
    )?.value || '';

    // Check if content type indicates an image
    const isImageByContentType = contentType.startsWith('image/');

    // Also check URL for image extensions as fallback (for cases where headers might not be available)
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(details.url);

    if (details.statusCode === 200 && details.url && (isImageByContentType || hasImageExtension)) {
      console.log('Image request detected:', details.url, 'Content-Type:', contentType, 'Tab ID:', details.tabId);

      // Capture the image
      fetchAndStoreImage(details.url, details.tabId);
    } else {
      console.log('Non-image request detected:', details.url, 'Content-Type:', contentType, 'Status:', details.statusCode);
    }
  },
  {
    urls: ['<all_urls>'], // Monitor all URLs
    types: ['image'] // Only listen for image requests
  },
  ['responseHeaders'] // Request access to response headers
);

// Listen for messages from popup/side panel and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);
  if (message.type === 'GET_CAPTURED_IMAGES') {
    // Return all captured images
    loadAllImages()
      .then(images => {
        console.log('Background: Sending captured images response:', images.length, 'images');
        sendResponse({ type: 'CAPTURED_IMAGES_RESPONSE', images });
      })
      .catch(error => {
        console.error('Background: Error loading images:', error);
        sendResponse({ type: 'CAPTURED_IMAGES_RESPONSE', images: [] });
      });

    // Return true to indicate we want to send a response asynchronously
    return true;
  } else if (message.type === 'CLEAR_CAPTURED_IMAGES') {
    // Clear all captured images
    clearAllImages()
      .then(() => {
        sendResponse({ type: 'CLEAR_RESPONSE', success: true });
      })
      .catch(error => {
        console.error('Error clearing images:', error);
        sendResponse({ type: 'CLEAR_RESPONSE', success: false });
      });

    // Return true to indicate we want to send a response asynchronously
    return true;
  } else if (message.type === 'DELETE_IMAGE') {
    // Delete specific image
    const imageId = message.imageId;
    deleteImage(imageId)
      .then(() => {
        sendResponse({ type: 'DELETE_RESPONSE', success: true });
      })
      .catch(error => {
        console.error('Error deleting image:', error);
        sendResponse({ type: 'DELETE_RESPONSE', success: false });
      });

    // Return true to indicate we want to send a response asynchronously
    return true;
  } else if (message.type === 'DOWNLOAD_ALL_IMAGES') {
    // Prepare all images for download
    loadAllImages()
      .then(images => {
        console.log('Background: Sending download all images response:', images.length, 'images');
        sendResponse({ type: 'DOWNLOAD_ALL_IMAGES_RESPONSE', images });
      })
      .catch(error => {
        console.error('Error loading images for download:', error);
        sendResponse({ type: 'DOWNLOAD_ALL_IMAGES_RESPONSE', images: [] });
      });

    // Return true to indicate we want to send a response asynchronously
    return true;
  } else if (message.type === 'DOWNLOAD_IMAGES_AS_ZIP') {
    // Send all images for zip download
    loadAllImages()
      .then(images => {
        console.log('Background: Sending download zip response:', images.length, 'images');
        sendResponse({ type: 'DOWNLOAD_IMAGES_AS_ZIP_RESPONSE', images });
      })
      .catch(error => {
        console.error('Error loading images for zip download:', error);
        sendResponse({ type: 'DOWNLOAD_IMAGES_AS_ZIP_RESPONSE', images: [] });
      });

    // Return true to indicate we want to send a response asynchronously
    return true;
  } else if (message.type === 'CHECK_AND_CAPTURE_IMAGE') {
    // Capture image from content script
    const { url, tabId } = message;
    if (url) {
      fetchAndStoreImage(url, tabId).catch(error => {
        console.error('Error capturing image from content script:', url, error);
      });
    }
    sendResponse({ type: 'IMAGE_CHECKED', success: true });

    // Return true to indicate we want to send a response asynchronously
    return true;
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
