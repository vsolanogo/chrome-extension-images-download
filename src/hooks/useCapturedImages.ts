import { useState, useEffect } from "react";
import { CapturedImage } from "../utils/indexedDBUtils";

// Custom hook to manage captured images
export const useCapturedImages = () => {
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [imageCount, setImageCount] = useState(0);

  // Load captured images from background
  useEffect(() => {
    console.log("useCapturedImages hook: Loading images from background");
    // Request captured images from background script
    chrome.runtime.sendMessage({ type: "GET_CAPTURED_IMAGES" }, (response) => {
      console.log(
        "useCapturedImages hook: Received response from background:",
        response
      );
      if (response && response.type === "CAPTURED_IMAGES_RESPONSE") {
        console.log(
          "useCapturedImages hook: Setting images, count:",
          response.images.length
        );
        setImages(response.images);
        setImageCount(response.images.length);
      } else {
        // Handle case where there might be an error
        console.error(
          "useCapturedImages hook: Error getting captured images:",
          response
        );
        setImages([]);
        setImageCount(0);
      }
    });

    // Listen for new images captured in real-time
    const messageListener = (message: any) => {
      if (message.type === "IMAGE_CAPTURED") {
        console.log(
          "useCapturedImages hook: New image received:",
          message.image
        );
        setImages((prevImages) => [message.image, ...prevImages]);
        setImageCount((prevCount) => prevCount + 1); // Update count when new image is added
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Clean up listener
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []); // Empty dependency array to run only once

  // Function to delete an image
  const deleteImage = (imageUrl: string) => {
    chrome.runtime.sendMessage({ type: "DELETE_IMAGE", imageId: imageUrl });
    setImages((prevImages) => {
      const updatedImages = prevImages.filter((img) => img.url !== imageUrl);
      setImageCount(updatedImages.length); // Update count when image is removed
      return updatedImages;
    });
  };

  // Function to clear all images
  const clearAllImages = () => {
    chrome.runtime.sendMessage({ type: "CLEAR_CAPTURED_IMAGES" });
    setImages([]);
    setImageCount(0); // Reset count when all images are cleared
  };

  // Function to download an image
  const downloadImage = (image: CapturedImage) => {
    if (image.data) {
      const a = document.createElement("a");
      a.href = image.data;
      const ext = image.url.split(".").pop()?.toLowerCase() || "png";
      a.download = `captured-image-${image.url.substring(image.url.lastIndexOf("/") + 1, image.url.lastIndexOf(".") || image.url.length) || "image"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Function to refresh images
  const refreshImages = () => {
    console.log("useCapturedImages hook: Refreshing images");
    chrome.runtime.sendMessage({ type: "GET_CAPTURED_IMAGES" }, (response) => {
      console.log(
        "useCapturedImages hook: Refresh response received:",
        response
      );
      if (response && response.type === "CAPTURED_IMAGES_RESPONSE") {
        console.log(
          "useCapturedImages hook: Refresh setting images, count:",
          response.images.length
        );
        setImages(response.images);
        setImageCount(response.images.length);
      } else {
        console.error(
          "useCapturedImages hook: Error getting captured images:",
          response
        );
        setImages([]);
        setImageCount(0);
      }
    });
  };

  return {
    images,
    imageCount,
    deleteImage,
    clearAllImages,
    downloadImage,
    refreshImages,
  };
};
