import { useState, useEffect, useRef } from 'react';
import { CapturedImage, loadAllImages, loadImageData } from '../utils/indexedDBUtils';

// Custom hook to manage captured images
export const useCapturedImages = () => {
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to load images directly from IndexedDB
  const loadImagesFromIndexedDB = async () => {
    try {
      const allImages = await loadAllImages();
      console.log('Loaded images from IndexedDB:', allImages.length);
      setImages(allImages);
      setImageCount(allImages.length);
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
  const downloadImage = async (image: CapturedImage) => {
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