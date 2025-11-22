// src/components/ImageCaptureInterface.tsx
import "../styles/common.css";
import { ImageList } from "./ImageList";
import { Header } from "./Header";
import { useCapturedImages } from "../hooks/useCapturedImages";
import { useDownload } from "../hooks/useDownload";

interface ImageCaptureInterfaceProps {
  className?: string;
  urlLength?: number;
}

export const ImageCaptureInterface: React.FC<ImageCaptureInterfaceProps> = ({
  className = "",
  urlLength = 30,
}) => {
  const { images, imageCount, deleteImage, clearAllImages } =
    useCapturedImages();
  const { downloadAllImagesAsZip: downloadAll, isDownloading } = useDownload();
  const link = "https://github.com/vsolanogo/chrome-extension-images-download";

  const downloadAllImagesAsZip = async () => {
    try {
      await downloadAll([]);
    } catch (error) {
      console.error("Error starting ZIP download:", error);
    }
  };

  // Determine if we are in side panel based on className
  const isInSidePanel = className.includes("sidepanel");
  const itemClassName = isInSidePanel
    ? "sidepanel-image-item"
    : "popup-image-item";

  return (
    <main className={className}>
      <Header
        onClearAll={clearAllImages}
        onDownloadAll={downloadAllImagesAsZip}
        count={imageCount}
        clearDisabled={isDownloading || imageCount === 0}
        downloadDisabled={isDownloading || imageCount === 0}
      />
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
