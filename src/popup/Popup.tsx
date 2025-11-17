// src/popup/Popup.tsx
import { useState } from "react";
import "../styles/common.css";
import "./Popup.css";
import { ImageList } from "../components/ImageList";
import { Controls } from "../components/Controls";
import { useCapturedImages } from "../hooks/useCapturedImages";
import { useDownload } from "../hooks/useDownload";

interface DownloadProgress {
  isDownloading: boolean;
  progress: number | null;
  currentChunk: number | null;
  totalChunks: number | null;
  message: string;
}

export const Popup = () => {
  const { images, imageCount, deleteImage, clearAllImages } =
    useCapturedImages();
  const { downloadAllImagesAsZip: downloadAll, isDownloading } = useDownload();
  const [zipProgress, setZipProgress] = useState<DownloadProgress | null>(null);
  const link = "https://github.com/vsolanogo/chrome-extension-images-download";

  console.log(
    "Popup - Images count:",
    imageCount,
    "Images array length:",
    images.length,
  );

  // Function to download all images as a zip
  const downloadAllImagesAsZip = async (
    onProgress?: (progress: DownloadProgress) => void,
  ) => {
    try {
      // Call the download function with placeholder array - background will load images from IndexedDB
      await downloadAll([], (progress) => {
        setZipProgress(progress);
        onProgress?.(progress);
      });
    } catch (error) {
      console.error("Error starting ZIP download:", error);
    }
  };

  return (
    <main className="popup">
      <h3>Image Capture Extension</h3>
      <Controls
        onClearAll={clearAllImages}
        onDownloadAll={downloadAllImagesAsZip}
        count={imageCount}
        downloadDisabled={isDownloading}
        isZipDownloading={isDownloading}
        progress={{
          isDownloading,
          progress: zipProgress?.progress || null,
          message: zipProgress?.message || "",
          currentChunk: null,
          totalChunks: null,
        }}
      />
      <div className="image-count">Captured Images: {imageCount}</div>
      <ImageList
        images={images}
        onDelete={deleteImage}
        itemClassName="popup-image-item"
        emptyMessage="No images captured yet. Browse the web to start capturing images."
      />
      <a href={link} target="_blank" className="footer-link" rel="noreferrer">
        Image Capture Extension
      </a>
    </main>
  );
};

export default Popup;
