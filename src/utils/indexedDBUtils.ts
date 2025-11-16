const DB_NAME = 'CapturedImagesDB' as const;
const DB_VERSION = 2 as const;
const STORE_NAME = 'capturedImages' as const;

export interface CapturedImage {
  url: string; // Now the primary key
  tabId: number;
  timestamp: number;
  data?: string; // Keep for backwards compatibility but we'll store as base64 in the database
  fullData?: Blob; // Store the full image as a Blob
  thumbnailData?: string; // Store thumbnail as base64 for easy display
  // Optional: metadata about the image
  width?: number;
  height?: number;
  fileSize?: number;
}

/**
 * Open (and create/upgrade) the IndexedDB database
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      // The database version upgrade logic
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      if (oldVersion !== null && oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
        // If upgrading from version 1, delete the old store and create a new one
        db.deleteObjectStore(STORE_NAME);
      }

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Use 'url' as the primary key instead of 'key'
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Save a single image to IndexedDB
 */
export async function saveImage(image: CapturedImage): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const req = store.put(image);

    req.onsuccess = () => resolve();
    req.onerror = () => {
      reject(req.error ?? new Error('Failed to save image'));
    };
  });
}

/**
 * Load a single image from IndexedDB by URL
 */
export async function loadImageByUrl(url: string): Promise<CapturedImage | undefined> {
  const db = await initDB();
  return new Promise<CapturedImage | undefined>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(url);

    req.onsuccess = () => {
      resolve(req.result as CapturedImage || undefined);
    };

    req.onerror = () => {
      reject(req.error ?? new Error('Failed to load image'));
    };
  });
}

/**
 * Load all saved images from the object store.
 */
export async function loadAllImages(): Promise<CapturedImage[]> {
  const db = await initDB();
  return new Promise<CapturedImage[]>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      resolve((req.result as CapturedImage[]) ?? []);
    };

    req.onerror = () => {
      reject(req.error ?? new Error('Failed to read from object store'));
    };
  });
}

/**
 * Delete a specific image by URL
 */
export async function deleteImage(url: string): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(url);

    req.onsuccess = () => resolve();
    req.onerror = () => {
      reject(req.error ?? new Error('Failed to delete image'));
    };
  });
}

/**
 * Clear all stored images.
 */
export async function clearAllImages(): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('Failed to clear object store'));
  });
}

/**
 * Count the number of stored images.
 */
export async function countImages(): Promise<number> {
  const db = await initDB();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();

    req.onsuccess = () => {
      resolve(req.result);
    };

    req.onerror = () => {
      reject(req.error ?? new Error('Failed to count images'));
    };
  });
}

/**
 * Generate thumbnail from blob
 */
export async function generateThumbnailFromBlob(blob: Blob, maxWidth = 150, maxHeight = 150): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      // Calculate thumbnail dimensions maintaining aspect ratio
      let thumbWidth = img.width;
      let thumbHeight = img.height;

      if (thumbWidth > thumbHeight) {
        if (thumbWidth > maxWidth) {
          thumbHeight = thumbHeight * (maxWidth / thumbWidth);
          thumbWidth = maxWidth;
        }
      } else {
        if (thumbHeight > maxHeight) {
          thumbWidth = thumbWidth * (maxHeight / thumbHeight);
          thumbHeight = maxHeight;
        }
      }

      canvas.width = thumbWidth;
      canvas.height = thumbHeight;

      // Draw and get thumbnail as base64
      ctx?.drawImage(img, 0, 0, thumbWidth, thumbHeight);
      const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8); // JPEG with 80% quality
      URL.revokeObjectURL(img.src); // Clean up
      resolve(thumbnailDataUrl);
    };

    img.onerror = () => reject(new Error('Failed to load image for thumbnail generation'));

    // Load the blob as an image
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Load image data for a specific URL
 */
export async function loadImageData(url: string): Promise<string | undefined> {
  const db = await initDB();
  return new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(url);

    req.onsuccess = () => {
      const image = req.result as CapturedImage;

      // If we already have thumbnailData, return it
      if (image?.thumbnailData) {
        resolve(image.thumbnailData);
      }
      // If we have fullData but no thumbnail, generate one on the fly
      else if (image?.fullData) {
        generateThumbnailFromBlob(image.fullData).then(thumbnailData => {
          // Update the image record with the generated thumbnail
          const updatedImage: CapturedImage = {
            ...image,
            thumbnailData
          };
          saveImage(updatedImage).then(() => {
            resolve(thumbnailData);
          }).catch(error => {
            console.error('Failed to save thumbnail to IndexedDB:', error);
            resolve(thumbnailData); // Still resolve with thumbnail even if save fails
          });
        }).catch(error => {
          console.error('Failed to generate thumbnail:', error);
          // Fallback to legacy data if available
          resolve(image?.data);
        });
      }
      // Fallback to legacy data
      else {
        resolve(image?.data);
      }
    };

    req.onerror = () => {
      reject(req.error ?? new Error('Failed to load image data'));
    };
  });
}

/**
 * Load full image as blob URL for download/display
 */
export async function loadImageBlob(url: string): Promise<string | undefined> {
  const db = await initDB();
  return new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(url);

    req.onsuccess = () => {
      const image = req.result as CapturedImage;
      if (image?.fullData) {
        const blobUrl = URL.createObjectURL(image.fullData);
        resolve(blobUrl);
      } else if (image?.data) {
        // Fallback for legacy images stored as base64
        try {
          const byteCharacters = atob(image.data.split(',')[1] || '');
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' }); // Default to jpeg, could be updated to detect actual type
          const blobUrl = URL.createObjectURL(blob);
          resolve(blobUrl);
        } catch (error) {
          console.error('Error converting base64 data to blob:', error);
          resolve(undefined);
        }
      } else {
        resolve(undefined);
      }
    };

    req.onerror = () => {
      reject(req.error ?? new Error('Failed to load image blob'));
    };
  });
}