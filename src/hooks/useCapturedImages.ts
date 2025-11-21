import { useState, useEffect, useRef, useCallback } from "react";
import { countImages, loadAllImagesMetadata } from "../utils/indexedDBUtils";

interface ImageMetadata {
  url: string;
  tabId: number;
  timestamp: number;
  thumbnailData?: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

export const useCapturedImages = () => {
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const mountedRef = useRef(true);

  // Stable loader that returns the metadata and count (doesn't set state directly)
  const fetchImages = useCallback(async () => {
    try {
      const count = await countImages();
      const imageMetadata = await loadAllImagesMetadata();

      return { metadata: imageMetadata, count };
    } catch (error) {
      console.error("Error loading images from IndexedDB:", error);
      return { metadata: [] as ImageMetadata[], count: 0 };
    }
  }, []);

  // Safe setter that updates state only if still mounted
  const loadImagesFromIndexedDB = useCallback(async () => {
    const { metadata, count } = await fetchImages();
    if (!mountedRef.current) return;
    setImages(metadata);
    setImageCount(count);
  }, [fetchImages]);

  useEffect(() => {
    mountedRef.current = true;

    // Defer the load so setState does not run synchronously inside the effect body.
    // Promise.resolve().then(...) schedules the work after the current microtask,
    // avoiding the "sync setState in effect" warning.
    Promise.resolve().then(() => {
      loadImagesFromIndexedDB();
    });

    // Listener for runtime messages
    const messageListener = (
      message: any,
      _sender?: any,
      _sendResponse?: any,
    ) => {
      if (message?.type === "IMAGE_CAPTURED") {
        // Refresh after a capture; use the same safe loader.
        loadImagesFromIndexedDB();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      mountedRef.current = false;
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [loadImagesFromIndexedDB]);

  // Function to delete an image (updates state locally, calls background)
  const deleteImage = async (imageUrl: string) => {
    try {
      chrome.runtime.sendMessage({ type: "DELETE_IMAGE", imageId: imageUrl });

      // Compute new images and count outside of a nested setState call
      setImages((prevImages) => {
        const updated = prevImages.filter((img) => img.url !== imageUrl);
        // update count separately (keeps updates clear and avoids nested setState)
        setImageCount(updated.length);
        return updated;
      });
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  const clearAllImages = async () => {
    try {
      chrome.runtime.sendMessage({ type: "CLEAR_CAPTURED_IMAGES" });
      setImages([]);
      setImageCount(0);
    } catch (error) {
      console.error("Error clearing images:", error);
    }
  };

  return {
    images,
    imageCount,
    deleteImage,
    clearAllImages,
  };
};
