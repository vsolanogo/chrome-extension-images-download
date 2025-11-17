import { useEffect, useRef, useState } from "react";
import {
  CapturedImage,
  loadImageData,
  loadImageBlob,
} from "../utils/indexedDBUtils";

interface ImageItemProps {
  image: CapturedImage;
  onDelete: (url: string) => void;
  onDownload: (image: CapturedImage) => Promise<void>;
  showUrl?: boolean;
  urlLength?: number;
  className?: string;
}

export const ImageItem: React.FC<ImageItemProps> = ({
  image,
  onDelete,
  onDownload,
  showUrl = true,
  urlLength = 30,
  className = "",
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const fullImageRef = useRef<string | null>(null);

  const handleImageClick = async () => {
    // For single image download, always use the full image
    setIsLoading(true);
    try {
      // Load the full image for download - this ensures we get the full blob
      const blobUrl = await loadImageBlob(image.url);
      if (blobUrl) {
        // Extract proper filename and extension from URL
        let ext = "jpg"; // Default extension
        let base = "image"; // Default base name

        // Try to extract the extension from the URL
        const urlParts = image.url.split("/");
        const lastPart = urlParts[urlParts.length - 1].split("?")[0]; // Remove query parameters

        // Look for file extension after the last dot
        const lastDotIndex = lastPart.lastIndexOf(".");
        if (lastDotIndex > 0) {
          ext = lastPart.substring(lastDotIndex + 1).toLowerCase();
          base = lastPart.substring(0, lastDotIndex);
        } else {
          // If no extension found in filename, try to extract from URL parameters
          const formatMatch = image.url.match(/[?&]format=([^&]+)/i);
          if (formatMatch) {
            ext = formatMatch[1].toLowerCase();
          } else {
            // Default to jpg if no extension is found
            ext = "jpg";
          }
          base = lastPart;
        }

        // Clean the base name to remove query parameters and special characters
        base = base.replace(/[?&=]/g, "-").replace(/[<>:"/\\|?*]/g, "_");

        const filename = `captured-${base.substring(0, 40) || "image"}.${ext}`;

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error downloading full image:", error);
      // If blob download fails, try using the stored data as fallback
      try {
        const imageData = await loadImageData(image.url);
        if (imageData) {
          const a = document.createElement("a");
          a.href = imageData;

          // Extract extension from the data URL if possible
          let ext = "jpg";
          if (
            imageData.startsWith("data:image/jpeg") ||
            imageData.startsWith("data:image/jpg")
          ) {
            ext = "jpg";
          } else if (imageData.startsWith("data:image/png")) {
            ext = "png";
          } else if (imageData.startsWith("data:image/gif")) {
            ext = "gif";
          } else if (imageData.startsWith("data:image/webp")) {
            ext = "webp";
          }

          // Extract proper filename from the original image URL for the fallback
          let base = "image"; // Default base name

          // Try to extract the extension from the URL
          const urlParts = image.url.split("/");
          const lastPart = urlParts[urlParts.length - 1].split("?")[0]; // Remove query parameters

          // Look for file extension after the last dot
          const lastDotIndex = lastPart.lastIndexOf(".");
          if (lastDotIndex > 0) {
            base = lastPart.substring(0, lastDotIndex);
          } else {
            // If no extension found in filename, just use the last part
            base = lastPart;
          }

          // Clean the base name to remove query parameters and special characters
          base = base.replace(/[?&=]/g, "-").replace(/[<>:"/\\|?*]/g, "_");

          a.download = `captured-${base.substring(0, 40) || "image"}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (fallbackError) {
        console.error("Fallback download also failed:", fallbackError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (fullImageRef.current) {
        URL.revokeObjectURL(fullImageRef.current);
      }
    };
  }, []);

  const displayUrl =
    image.url.length > urlLength
      ? image.url.substring(0, urlLength) + "..."
      : image.url;

  return (
    <div className={`image-item ${className}`}>
      <div className="image-preview">
        {image.thumbnailData ? (
          <img
            src={image.thumbnailData}
            alt={`Captured from ${image.url}`}
            className={`captured-image ${showFullImage ? "full-image" : "thumbnail"}`}
            onClick={handleImageClick}
            title="Click to download image"
          />
        ) : (
          <div className="placeholder">Image not loaded</div>
        )}
      </div>
      <div className="image-info">
        <div className="image-url" title={image.url}>
          {displayUrl}
        </div>
        <div className="image-timestamp">
          {new Date(image.timestamp).toLocaleString()}
        </div>
        {image.fileSize && (
          <div className="image-size">
            {(image.fileSize / 1024).toFixed(2)} KB
          </div>
        )}
      </div>
      <div className="image-controls">
        <button
          className="delete-btn"
          onClick={() => onDelete(image.url)}
          title="Delete Image"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
