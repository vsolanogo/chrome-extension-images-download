import { useState, useEffect } from "react";
import { loadImageBlob } from "../utils/indexedDBUtils";

/* ---------- Hook ---------- */

interface DownloadProgress {
  isDownloading: boolean;
  progress: number | null;
  currentChunk: number | null;
  totalChunks: number | null;
  message: string;
}

// Define the CapturedImage interface locally or import as needed
interface CapturedImage {
  url: string;
  tabId: number;
  timestamp: number;
  fullData?: Blob;
  thumbnailData?: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

export const useDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [onBackgroundProgressUpdate, setOnBackgroundProgressUpdate] =
    useState<(progress: DownloadProgress) => void>();

  // Listen for background ZIP completion updates
  useEffect(() => {
    const handleBackgroundMessage = (
      message: any,
      _: chrome.runtime.MessageSender,
    ) => {
      if (message.type === "ZIP_DOWNLOAD_COMPLETE") {
        if (message.success) {
          onBackgroundProgressUpdate?.({
            isDownloading: false,
            progress: 100,
            currentChunk: null,
            totalChunks: null,
            message: "Download completed!",
          });
          // Clear after a short delay
          setTimeout(() => {
            onBackgroundProgressUpdate?.({
              isDownloading: false,
              progress: null,
              currentChunk: null,
              totalChunks: null,
              message: "",
            });
          }, 2000);
        }
        setIsDownloading(false);
      } else if (message.type === "ZIP_DOWNLOAD_ERROR") {
        onBackgroundProgressUpdate?.({
          isDownloading: false,
          progress: 0,
          currentChunk: null,
          totalChunks: null,
          message: message.error || "Error occurred during download.",
        });
        setIsDownloading(false);
      }
    };

    chrome.runtime.onMessage.addListener(handleBackgroundMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleBackgroundMessage);
    };
  }, []);

  // Store the progress callback to access it in the useEffect

  const setProgressCallback = (
    callback: (progress: DownloadProgress) => void,
  ) => {
    setOnBackgroundProgressUpdate(() => callback);
  };

  const downloadAllImagesAsZip = async (
    _images: CapturedImage[], // We still need to keep the parameter signature for compatibility
    onProgress?: (progress: DownloadProgress) => void,
  ) => {
    if (isDownloading) {
      console.info("Zip download is already in progress, please wait...");
      return;
    }

    // Set the progress callback
    if (onProgress) {
      setProgressCallback(onProgress);
    }

    setIsDownloading(true);

    try {
      // Send message to background script to start ZIP process
      const response = await chrome.runtime.sendMessage({
        type: "ZIP_AND_DOWNLOAD_ALL_IMAGES",
      });

      if (!response) {
        // If no response, that's OK - the background process is async
        console.log("ZIP download started in background");
      } else if (response.success === false) {
        console.error("Error starting ZIP download:", response.error);
        onProgress?.({
          isDownloading: false,
          progress: 0,
          currentChunk: null,
          totalChunks: null,
          message: response.error || "Error occurred during download.",
        });
      }
    } catch (error: any) {
      console.error("Error sending ZIP download message to background:", error);
      onProgress?.({
        isDownloading: false,
        progress: 0,
        currentChunk: null,
        totalChunks: null,
        message: error.message || "Error occurred during download.",
      });
      setIsDownloading(false);
    }
  };

  const downloadImage = async (image: CapturedImage) => {
    console.log({ image });

    // For single image download, we can still do this in the popup context
    // since it's a quick operation
    if (image.fullData) {
      // Get the image type from the blob
      const imageType = image.fullData.type || "image/png";

      // Get extension from URL or use from image type
      let extension = "png"; // default
      if (imageType.includes("jpeg") || imageType.includes("jpg"))
        extension = "jpg";
      else if (imageType.includes("png")) extension = "png";
      else if (imageType.includes("gif")) extension = "gif";
      else if (imageType.includes("webp")) extension = "webp";
      else if (imageType.includes("bmp")) extension = "bmp";

      // Create a filename based on the URL
      const urlParts = image.url.split("/");
      const fileName = urlParts[urlParts.length - 1] || `image.${extension}`;

      // Create a temporary URL for the blob
      const imageUrl = URL.createObjectURL(image.fullData);

      // Create a temporary anchor element and trigger download
      const a = document.createElement("a");
      a.href = imageUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up the temporary URL
      URL.revokeObjectURL(imageUrl);
    } else {
      // Fallback to using thumbnail data if full data is not available
      // This would require loading from IndexedDB
      const imageData = await loadImageBlob(image.url);
      if (!imageData) {
        console.error("Could not retrieve image data for download:", image.url);
        return;
      }

      const urlParts = image.url.split("/");
      const fileName = urlParts[urlParts.length - 1] || "image.png";

      const a = document.createElement("a");
      a.href = imageData;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return {
    downloadAllImagesAsZip,
    downloadImage,
    isDownloading,
  };
};
