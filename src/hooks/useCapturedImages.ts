import { useState, useEffect, useCallback } from "react";
import { useIsMounted } from "./useIsMounted";
import { ImageMetadata } from "../types";
import { countImages, loadAllImagesMetadata } from "../utils/indexedDBUtils";

export const useCapturedImages = () => {
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const isMounted = useIsMounted();

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
    if (!isMounted.current) return;
    setImages(metadata);
    setImageCount(count);
  }, [fetchImages, isMounted]);

  useEffect(() => {
    let isMountedLocal = true;

    const initializeData = async () => {
      const { metadata, count } = await fetchImages();
      if (isMountedLocal) {
        setImages(metadata);
        setImageCount(count);
      }
    };

    initializeData();

    // Listener for runtime messages
    const messageListener = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      message: { type?: string; [key: string]: any },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _sender?: chrome.runtime.MessageSender,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
      _sendResponse?: (response?: any) => void,
    ) => {
      if (message?.type === "IMAGE_CAPTURED" && isMounted.current) {
        loadImagesFromIndexedDB();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      isMountedLocal = false;
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [fetchImages, loadImagesFromIndexedDB, isMounted]);

  // Function to delete an image (updates state locally, calls background)
  const deleteImage = async (imageUrl: string) => {
    try {
      chrome.runtime.sendMessage({ type: "DELETE_IMAGE", imageId: imageUrl });

      if (isMounted.current) {
        // Compute new images and count outside of a nested setState call
        setImages((prevImages) => {
          const updated = prevImages.filter((img) => img.url !== imageUrl);
          // update count separately (keeps updates clear and avoids nested setState)
          setImageCount(updated.length);
          return updated;
        });
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  const clearAllImages = async () => {
    try {
      chrome.runtime.sendMessage({ type: "CLEAR_CAPTURED_IMAGES" });
      if (isMounted.current) {
        setImages([]);
        setImageCount(0);
      }
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
