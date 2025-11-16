interface ControlsProps {
  onClearAll: () => void;
  onDownloadAll: () => void;
  onRefresh: () => void;
  count: number;
  clearDisabled?: boolean;
  downloadDisabled?: boolean;
  className?: string;
  showZipInfo?: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  onClearAll,
  onDownloadAll,
  onRefresh,
  count,
  clearDisabled = false,
  downloadDisabled = false,
  className = '',
  showZipInfo = false
}) => {
  const MAX_IMAGES_PER_ZIP = 500;
  const needsSplit = count > MAX_IMAGES_PER_ZIP;
  const numZips = needsSplit ? Math.ceil(count / MAX_IMAGES_PER_ZIP) : 1;

  return (
    <div className={`controls ${className}`}>
      <button
        onClick={onRefresh}
        title="Refresh images"
        className="refresh-btn"
      >
        ↻ Refresh
      </button>
      <button
        onClick={onClearAll}
        disabled={clearDisabled || count === 0}
      >
        Clear All Images
      </button>
      <button
        onClick={onDownloadAll}
        disabled={downloadDisabled || count === 0}
      >
        Download All as ZIP
      </button>
      {showZipInfo && count > 0 && (
        <div className="zip-info">
          {needsSplit ? (
            <span className="zip-warning">
              ⚠️ {count} images will be split into {numZips} ZIP file{numZips > 1 ? 's' : ''}
              (max {MAX_IMAGES_PER_ZIP} per ZIP)
            </span>
          ) : (
            <span>
              {count} image{count !== 1 ? 's' : ''} in single ZIP
            </span>
          )}
        </div>
      )}
    </div>
  );
};