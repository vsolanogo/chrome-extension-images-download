// ZIP-related constants
export const ZIP_CONFIG = {
  MAX_IMAGES_PER_ZIP: 10000,
  COMPRESSION: "STORE" as const,
  FILE_NAME_PATTERN: "captured-images-{date}-part-{index}.zip",
  DEFAULT_FILE_NAME: "captured-images-{date}.zip",
} as const;

// Badge-related constants
export const BADGE_COLORS = {
  PROGRESS: "#4CAF50", // Green for progress
  DOWNLOAD: "#2196F3", // Blue for download
  ERROR: "#f44336", // Red for error
  DEFAULT: "#4688F1", // Blue for default badge
} as const;

// Extension-related constants
export const EXTENSION_CONFIG = {
  SUPPORTED_IMAGE_EXTENSIONS: [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "svg",
  ] as const,
  CONTENT_TYPE_PREFIX: "data:image/",
} as const;

// File-related constants
export const FILE_CONFIG = {
  MAX_FILENAME_LENGTH: 50,
  DEFAULT_EXTENSION: "png",
  IMAGE_EXTENSIONS_REGEX: /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i,
} as const;

// Message types
export const MESSAGE_TYPES = {
  IMAGE_CAPTURED: "IMAGE_CAPTURED",
  CLEAR_CAPTURED_IMAGES: "CLEAR_CAPTURED_IMAGES",
  DELETE_IMAGE: "DELETE_IMAGE",
  CHECK_AND_CAPTURE_IMAGE: "CHECK_AND_CAPTURE_IMAGE",
  CLEAR_RESPONSE: "CLEAR_RESPONSE",
  DELETE_RESPONSE: "DELETE_RESPONSE",
  IMAGE_CHECKED: "IMAGE_CHECKED",
  ZIP_AND_DOWNLOAD_ALL_IMAGES: "ZIP_AND_DOWNLOAD_ALL_IMAGES",
  ZIP_PROGRESS_UPDATE: "ZIP_PROGRESS_UPDATE",
  ZIP_DOWNLOAD_COMPLETE: "ZIP_DOWNLOAD_COMPLETE",
  ZIP_DOWNLOAD_ERROR: "ZIP_DOWNLOAD_ERROR",
  IMAGES_CLEARED: "IMAGES_CLEARED",
} as const;

// Context menu IDs
export const CONTEXT_MENU_IDS = {
  CLEAR_ALL_CAPTURED_IMAGES: "clearAllCapturedImages",
  DOWNLOAD_ALL_AS_ZIP: "downloadAllAsZip",
} as const;

// Context menu constants
export const CONTEXT_MENU_CONTEXTS = ["action"] as const;

// IndexedDB constants
export const INDEXEDDB_CONFIG = {
  DB_NAME: "CapturedImagesDB",
  DB_VERSION: 2,
  STORE_NAME: "capturedImages",
} as const;

// Progress status messages
export const PROGRESS_MESSAGES = {
  STARTING_DOWNLOAD: (count: number) =>
    `Starting download of ${count} images...`,
  PREPARING: "Preparing ZIP...",
  PREPARING_IMAGE: (index: number, total: number) =>
    `Processing image ${index + 1} of ${total}...`,
  ZIPPING: (progress: number) => `Zipping: ${progress}%`,
  ZIPPING_PART: (index: number, progress: number) =>
    `Zipping part ${index + 1}: ${progress}%`,
  DOWNLOADED: "Downloaded...",
  COMPLETED: "Download completed!",
  ERROR_OCCURRED: "Error occurred during download.",
} as const;

// Default configurations
export const DEFAULT_CONFIG = {
  FILENAME_BASE: "image",
  FILENAME_SEPARATOR: "_",
} as const;
