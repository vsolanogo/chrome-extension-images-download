import { CapturedImage } from '../utils/indexedDBUtils';

interface ImageItemProps {
  image: CapturedImage;
  onDelete: (url: string) => void;
  onDownload: (image: CapturedImage) => void;
  showUrl?: boolean;
  urlLength?: number;
  className?: string;
  layout?: 'grid' | 'list'; // Different layouts for popup vs sidepanel
}

export const ImageItem: React.FC<ImageItemProps> = ({
  image,
  onDelete,
  onDownload,
  showUrl = true,
  urlLength = 30,
  className = '',
  layout = 'grid'
}) => {
  const displayUrl = image.url.length > urlLength
    ? image.url.substring(0, urlLength) + '...'
    : image.url;

  if (layout === 'list') {
    // Side panel style with image preview, info, and controls in a row
    return (
      <div className={`image-item ${className}`}>
        <div className="image-preview">
          {image.data ? (
            <img
              src={image.data}
              alt={`Captured from ${image.url}`}
              className="captured-image"
              onClick={() => onDownload(image)}
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
    // Popup style with image and info stacked vertically
    return (
      <div className={`image-item ${className}`}>
        {image.data ? (
          <img
            src={image.data}
            alt={`Captured from ${image.url}`}
            className="captured-image"
            onClick={() => onDownload(image)}
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