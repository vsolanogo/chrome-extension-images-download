import { useEffect, useRef, useState } from 'react';
import { CapturedImage, loadImageData } from '../utils/indexedDBUtils';

interface ImageItemProps {
  image: CapturedImage;
  onDelete: (url: string) => void;
  onDownload: (image: CapturedImage) => Promise<void>;
  showUrl?: boolean;
  urlLength?: number;
  className?: string;
  layout?: 'grid' | 'list';
}

export const ImageItem: React.FC<ImageItemProps> = ({
  image,
  onDelete,
  onDownload,
  showUrl = true,
  urlLength = 30,
  className = '',
  layout = 'list',
}) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load image data when component mounts
  useEffect(() => {
    const loadImage = async () => {
      try {
        const data = await loadImageData(image.url);
        setImageData(data || null);
      } catch (error) {
        console.error('Error loading image data:', error);
        setImageData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();
  }, [image.url]);

  const displayUrl =
    image.url.length > urlLength
      ? image.url.substring(0, urlLength) + '...'
      : image.url;

  const handleDownload = () => {
    if (imageData) {
      // Wrap the async function call
      (async () => {
        try {
          await onDownload({ ...image, data: imageData });
        } catch (error) {
          console.error('Error downloading image:', error);
        }
      })();
    } else {
      console.error('Image data not available for download');
    }
  };

  if (layout === 'list') {
    return (
      <div ref={containerRef} className={`image-item ${className}`}>
        <div className="image-preview">
          {isLoading ? (
            <div className="placeholder">Loading...</div>
          ) : imageData ? (
            <img
              src={imageData}
              alt={`Captured from ${image.url}`}
              className="captured-image"
              onClick={handleDownload}
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
  } else {
    return (
      <div ref={containerRef} className={`image-item ${className}`}>
        {isLoading ? (
          <div className="placeholder">Loading...</div>
        ) : imageData ? (
          <img
            src={imageData}
            alt={`Captured from ${image.url}`}
            className="captured-image"
            onClick={handleDownload}
          />
        ) : (
          <div className="placeholder">Image not loaded</div>
        )}
        <div className="image-controls">
          <button
            className="delete-btn"
            onClick={() => onDelete(image.url)}
            title="Delete Image"
          >
            ✕
          </button>
        </div>
        {showUrl && (
          <div className="image-url" title={image.url}>
            {displayUrl}
          </div>
        )}
      </div>
    );
  }
};
