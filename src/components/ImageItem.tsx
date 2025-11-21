import { CapturedImage, loadImageBlob } from "../utils/indexedDBUtils";

interface ImageItemProps {
  image: CapturedImage;
  onDelete: (url: string) => void;
  onDownload?: (image: CapturedImage) => Promise<void>;
  showUrl?: boolean;
  urlLength?: number;
  className?: string;
}

export const ImageItem: React.FC<ImageItemProps> = ({
  image,
  onDelete,
  showUrl = true,
  urlLength = 30,
  className = "",
}) => {
  const safeLastPart = (() => {
    try {
      const url = new URL(image.url);
      const path = url.pathname;
      const parts = path.split("/");
      const last = parts[parts.length - 1];
      return last || "image";
    } catch {
      // Fallback: manual split
      const parts = image.url.split("/");
      const last = parts[parts.length - 1];
      return last || "image";
    }
  })();

  const extractFilename = (
    originalLast: string,
  ): { base: string; ext: string } => {
    let base = "image";
    let ext = "jpg";

    if (originalLast.includes(".")) {
      const dot = originalLast.lastIndexOf(".");
      base = originalLast.slice(0, dot);
      ext = originalLast.slice(dot + 1) || "jpg";
    }

    base = base.replace(/[?&=]/g, "-").replace(/[<>:"/\\|?*]/g, "_");
    ext = ext.toLowerCase();

    return { base, ext };
  };

  const handleImageClick = async () => {
    try {
      const blobUrl = await loadImageBlob(image.url);

      if (blobUrl) {
        const { base, ext } = extractFilename(safeLastPart);
        const filename = `captured-${base.substring(0, 40)}.${ext}`;

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 500);
        return;
      }
    } catch (err) {
      console.error("Primary download failed", err);
    }
  };

  const displayUrl =
    image.url.length > urlLength
      ? image.url.slice(0, urlLength) + "..."
      : image.url;

  return (
    <div className={`image-item ${className}`}>
      <div className="image-preview">
        {image.thumbnailData ? (
          <img
            src={image.thumbnailData}
            alt={`Captured from ${image.url}`}
            className="captured-image thumbnail"
            onClick={handleImageClick}
            title="Click to download"
          />
        ) : (
          <div className="placeholder">Image not loaded</div>
        )}
      </div>

      <div className="image-info">
        {showUrl && (
          <div className="image-url" title={image.url}>
            {displayUrl}
          </div>
        )}
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
