import React from "react";

interface HeaderProps {
  onClearAll: () => void;
  onDownloadAll: () => void;
  count: number;
  clearDisabled?: boolean;
  downloadDisabled?: boolean;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onClearAll,
  onDownloadAll,
  count,
  clearDisabled = false,
  downloadDisabled = false,
  className = "",
}) => {
  return (
    <header className={`header ${className}`}>
      <div className="header-left">
        <button
          className="header-btn"
          onClick={onClearAll}
          disabled={clearDisabled}
        >
          Clear All
        </button>
        <button
          className="header-btn"
          onClick={onDownloadAll}
          disabled={downloadDisabled}
        >
          Download All
        </button>
      </div>
      <div className="header-right">{count}</div>
    </header>
  );
};
