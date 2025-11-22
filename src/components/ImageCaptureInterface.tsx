// src/components/ImageCaptureInterface.tsx
import { useState } from "react";
import "../styles/common.css";
import { ImageList } from "./ImageList";
import { Controls } from "./Controls";
import { useCapturedImages } from "../hooks/useCapturedImages";
import { useDownload } from "../hooks/useDownload";
import type { DownloadProgress } from "../types";

interface ImageCaptureInterfaceProps {
  className?: string;
  urlLength?: number;
}

export const ImageCaptureInterface: React.FC<ImageCaptureInterfaceProps> = ({ className = "", urlLength = 30 }) => {
  const { images, imageCount, deleteImage, clearAllImages } = useCapturedImages();
  const { downloadAllImagesAsZip: downloadAll, isDownloading } = useDownload();
  const [zipProgress, setZipProgress] = useState<DownloadProgress | null>(null);
  const link = "https://github.com/vsolanogo/chrome-extension-images-download";

  const downloadAllImagesAsZip = async (
    onProgress?: (progress: DownloadProgress) => void,
  ) => {
    try {
      await downloadAll([], (progress) => {
        setZipProgress(progress);
        onProgress?.(progress);
      });
    } catch (error) {
      console.error("Error starting ZIP download:", error);
    }
  };

  // Determine if we are in side panel based on className
  const isInSidePanel = className.includes('sidepanel');
  const itemClassName = isInSidePanel ? "sidepanel-image-item" : "popup-image-item";
  const controlsClassName = isInSidePanel ? "sidepanel-controls" : undefined;

  return (
    <main className={className}>
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
        className={controlsClassName || ""}
      />
      <div className="image-count">Captured Images: {imageCount}</div>
      <ImageList
        images={images}
        onDelete={deleteImage}
        showUrls={urlLength > 0}
        urlLength={urlLength}
        itemClassName={itemClassName}
        emptyMessage="No images captured yet. Browse the web to start capturing images."
      />
      <a href={link} target="_blank" className="footer-link" rel="noreferrer">
        Image Capture Extension
      </a>
    </main>
  );
};