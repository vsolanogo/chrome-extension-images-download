// src/types/index.ts

export interface CapturedImage {
  url: string;
  tabId: number;
  timestamp: number;
  fullData?: Blob;
  thumbnailData?: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

export interface DownloadProgress {
  isDownloading: boolean;
  progress: number | null;
  currentChunk: number | null;
  totalChunks: number | null;
  message: string;
}

export interface ImageMetadata {
  url: string;
  tabId: number;
  timestamp: number;
  thumbnailData?: string;
  fileSize?: number;
  width?: number;
  height?: number;
}
