import { useState, useEffect } from "react";

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

  return {
    downloadAllImagesAsZip,
    isDownloading,
  };
};
