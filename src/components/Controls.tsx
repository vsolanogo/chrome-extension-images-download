interface DownloadProgress {
  isDownloading: boolean;
  progress: number | null;
  currentChunk: number | null;
  totalChunks: number | null;
  message: string;
}

interface ControlsProps {
  onClearAll: () => void;
  onDownloadAll: (onProgress?: (progress: DownloadProgress) => void) => void;
  count: number;
  clearDisabled?: boolean;
  downloadDisabled?: boolean;
  isZipDownloading?: boolean;
  progress?: DownloadProgress;
  className?: string;
}

export const Controls: React.FC<ControlsProps> = ({
  onClearAll,
  onDownloadAll,
  count,
  clearDisabled = false,
  downloadDisabled = false,
  isZipDownloading = false,
  progress,
  className = "",
}) => {
  const handleDownloadAll = () => {
    onDownloadAll();
  };

  return (
    <div className={`controls ${className}`}>
      <button onClick={onClearAll} disabled={clearDisabled || count === 0}>
        Clear All Images
      </button>
      <button
        onClick={handleDownloadAll}
        disabled={downloadDisabled || count === 0 || isZipDownloading}
      >
        {isZipDownloading ? (
          <span>
            <span className="spinner">⏳</span>{" "}
            {progress?.message || "Processing..."}{" "}
            {progress &&
              progress.progress !== null &&
              progress.progress > 0 &&
              `(${progress.progress}%)`}
          </span>
        ) : (
          "Download All as ZIP"
        )}
      </button>
    </div>
  );
};
