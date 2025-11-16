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
    // For single image download, always use the full image
    setIsLoading(true);
    try {
      // Load the full image for download - this ensures we get the full blob
      const blobUrl = await loadImageBlob(image.url);
      if (blobUrl) {
        // Create download link
        const ext = image.url.split('.').pop()?.toLowerCase() || 'jpg';
        const base = image.url.substring(image.url.lastIndexOf('/') + 1, image.url.lastIndexOf('.')) || 'image';
        const filename = `captured-${base.substring(0, 40) || 'image'}.${ext}`;

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading full image:', error);
      // If blob download fails, try using the stored data as fallback
      try {
        const imageData = await loadImageData(image.url);
        if (imageData) {
          const a = document.createElement('a');
          a.href = imageData;
          const ext = imageData.includes('jpeg') || imageData.includes('jpg') ? 'jpg' :
                     imageData.includes('png') ? 'png' :
                     imageData.includes('gif') ? 'gif' : 'jpg';
          const base = image.url.substring(image.url.lastIndexOf('/') + 1, image.url.lastIndexOf('.')) || 'image';
          a.download = `captured-${base.substring(0, 40) || 'image'}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (fallbackError) {
        console.error('Fallback download also failed:', fallbackError);
      }
    } finally {
      setIsLoading(false);
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
