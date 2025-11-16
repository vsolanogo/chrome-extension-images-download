import { useEffect, useRef, useState } from 'react';
import { CapturedImage, loadImageData, loadImageBlob } from '../utils/indexedDBUtils';

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
  className = '',
}) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fullImageRef = useRef<string | null>(null);
  const [thumbnailGenerated, setThumbnailGenerated] = useState(!!image.thumbnailData);

  // Load thumbnail data when component mounts
  useEffect(() => {
    const loadImage = async () => {
      setIsLoading(true);
      try {
        const data = await loadImageData(image.url);
        setImageData(data || null);
        if (image.thumbnailData) {
          setThumbnailGenerated(true);
        }
      } catch (error) {
        console.error('Error loading image data:', error);
        setImageData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();
  }, [image.url, image.thumbnailData]);

  // Load full image when needed
  const loadFullImage = async () => {
    if (fullImageRef.current) {
      return fullImageRef.current;
    }

    setIsLoading(true);
    try {
      const blobUrl = await loadImageBlob(image.url);
      if (blobUrl) {
        fullImageRef.current = blobUrl;
        setImageData(blobUrl);
        return blobUrl;
      }
    } catch (error) {
      console.error('Error loading full image:', error);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const handleImageClick = async () => {
    if (showFullImage) {
      // Show thumbnail again
      setIsLoading(true);
      const thumbnailData = await loadImageData(image.url);
      setImageData(thumbnailData || null);
      setShowFullImage(false);
      setIsLoading(false);
    } else {
      // Load and show full image
      const fullImageUrl = await loadFullImage();
      if (fullImageUrl) {
        setShowFullImage(true);
      }
    }
  };

  const handleDownload = async () => {
    try {
      // For download, ensure we have the full image data
      if (!showFullImage) {
        await loadFullImage();
      }
      await onDownload({ ...image, data: fullImageRef.current || image.thumbnailData || image.data });
    } catch (error) {
      console.error('Error downloading image:', error);
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
      ? image.url.substring(0, urlLength) + '...'
      : image.url;

  return (
    <div ref={containerRef} className={`image-item ${className}`}>
      <div className="image-preview">
        {isLoading ? (
          <div className="placeholder">Loading...</div>
        ) : imageData ? (
          <img
            src={imageData}
            alt={`Captured from ${image.url}`}
            className={`captured-image ${showFullImage ? 'full-image' : 'thumbnail'}`}
            onClick={handleImageClick}
            title={showFullImage ? "Click to show thumbnail" : "Click to show full image"}
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
