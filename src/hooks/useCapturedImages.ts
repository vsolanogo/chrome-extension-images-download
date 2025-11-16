import { useState, useEffect, useRef } from 'react';
import { CapturedImage, loadAllImages, loadImageData, countImages } from '../utils/indexedDBUtils';

// Define a type for the view state that excludes the full blob data
interface ImageMetadata {
  url: string;
  tabId: number;
  timestamp: number;
  thumbnailData?: string; // Only thumbnail for UI display
  fileSize?: number;
  width?: number;
  height?: number;
  // We keep data field for backward compatibility
  data?: string;
}

// Custom hook to manage captured images
export const useCapturedImages = () => {
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [imageCount, setImageCount] = useState(0);

  // Function to load images directly from IndexedDB
  const loadImagesFromIndexedDB = async () => {
    try {
      // First, get the count of images
      const count = await countImages();

      // Only fetch the full dataset if the count differs from current state
      if (count !== images.length) {
        const allImages = await loadAllImages();
        console.log('Loaded images from IndexedDB:', allImages.length);

        // Map to only include metadata and thumbnails (not full blobs) in state
        const imageMetadata = allImages.map(img => ({
          url: img.url,
          tabId: img.tabId,
          timestamp: img.timestamp,
          thumbnailData: img.thumbnailData,
          fileSize: img.fileSize,
          width: img.width,
          height: img.height,
          data: img.data // For backward compatibility
        }));

        setImages(imageMetadata);
        setImageCount(allImages.length);
      } else {
        // Update count in state in case it was zero initially
        setImageCount(count);
      }
    } catch (error) {
      console.error('Error loading images from IndexedDB:', error);
      setImages([]);
      setImageCount(0);
    }
  };

  // Load captured images on component mount
  useEffect(() => {
    loadImagesFromIndexedDB();

    // Listen for new images captured in real-time (optional, for immediate updates)
    const messageListener = (message: any) => {
      if (message.type === 'IMAGE_CAPTURED') {
        console.log('New image received:', message.image);
        loadImagesFromIndexedDB(); // Refresh immediately when new image is captured
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Clean up listener on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []); // Empty dependency array to run only once

  // Function to delete an image
  const deleteImage = async (imageUrl: string) => {
    try {
      // Call the background script to handle deletion
      chrome.runtime.sendMessage({ type: 'DELETE_IMAGE', imageId: imageUrl });
      // Also update local state immediately for better UX
      setImages((prevImages) => {
        const updatedImages = prevImages.filter((img) => img.url !== imageUrl);
        setImageCount(updatedImages.length);
        return updatedImages;
      });
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  // Function to clear all images
  const clearAllImages = async () => {
    try {
      // Call the background script to handle clearing
      chrome.runtime.sendMessage({ type: 'CLEAR_CAPTURED_IMAGES' });
      // Also update local state immediately for better UX
      setImages([]);
      setImageCount(0);
    } catch (error) {
      console.error('Error clearing images:', error);
    }
  };

  // Function to download an image
  const downloadImage = async (image: ImageMetadata) => {
    // Load the image data if not already present
    const imageData = image.data || await loadImageData(image.url);
    if (!imageData) return;

    const a = document.createElement('a');
    a.href = imageData;
    const ext = image.url.split('.').pop()?.toLowerCase() || 'png';
    a.download = `captured-image-${image.url.substring(image.url.lastIndexOf('/') + 1, image.url.lastIndexOf('.') || image.url.length) || 'image'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return {
    images,
    imageCount,
    deleteImage,
    clearAllImages,
    downloadImage,
  };
};