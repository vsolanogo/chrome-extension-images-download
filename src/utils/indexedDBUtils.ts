import { generateThumbnailFromBlob } from "./generateThumbnailFromBlob";
const DB_NAME = "CapturedImagesDB" as const;
const DB_VERSION = 2 as const;
const STORE_NAME = "capturedImages" as const;

export interface CapturedImage {
  url: string; // Now the primary key
  tabId: number;
  timestamp: number;
  fullData?: Blob; // Store the full image as a Blob
  thumbnailData?: string; // Store thumbnail as base64 for easy display
  // Optional: metadata about the image
  width?: number;
  height?: number;
  fileSize?: number;
}

/**
 * Load image data for a specific URL
 */
export async function loadImageThumbnailData(
  url: string,
): Promise<string | undefined> {
  const db = await initDB();
  return new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
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
        generateThumbnailFromBlob(image.fullData)
          .then((thumbnailData) => {
            // Update the image record with the generated thumbnail
            const updatedImage: CapturedImage = {
              ...image,
              thumbnailData,
            };
            saveImage(updatedImage)
              .then(() => {
                resolve(thumbnailData);
              })
              .catch((error) => {
                console.error("Failed to save thumbnail to IndexedDB:", error);
                resolve(thumbnailData); // Still resolve with thumbnail even if save fails
              });
          })
          .catch((error) => {
            console.error("Failed to generate thumbnail:", error);
          });
      }
    };

    req.onerror = () => {
      reject(req.error ?? new Error("Failed to load image data"));
    };
  });
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
      if (
        oldVersion !== null &&
        oldVersion < 2 &&
        db.objectStoreNames.contains(STORE_NAME)
      ) {
        // If upgrading from version 1, delete the old store and create a new one
        db.deleteObjectStore(STORE_NAME);
      }

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Use 'url' as the primary key instead of 'key'
        db.createObjectStore(STORE_NAME, { keyPath: "url" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB"));
    };
  });
}

/**
 * Save a single image to IndexedDB
 */
export async function saveImage(image: CapturedImage): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const req = store.put(image);

    req.onsuccess = () => resolve();
    req.onerror = () => {
      reject(req.error ?? new Error("Failed to save image"));
    };
  });
}

/**
 * Load a single image from IndexedDB by URL
 */
export async function loadImageByUrl(
  url: string,
): Promise<CapturedImage | undefined> {
  const db = await initDB();
  return new Promise<CapturedImage | undefined>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(url);

    req.onsuccess = () => {
      resolve((req.result as CapturedImage) || undefined);
    };

    req.onerror = () => {
      reject(req.error ?? new Error("Failed to load image"));
    };
  });
}

/**
 * Load all saved images from the object store.
 */
export async function loadAllImages(): Promise<CapturedImage[]> {
  const db = await initDB();
  return new Promise<CapturedImage[]>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      resolve((req.result as CapturedImage[]) ?? []);
    };

    req.onerror = () => {
      reject(req.error ?? new Error("Failed to read from object store"));
    };
  });
}

/**
 * Load all images metadata (without fullData) from the object store.
 */
export async function loadAllImagesMetadata(): Promise<
  Omit<CapturedImage, "fullData">[]
> {
  const db = await initDB();
  return new Promise<Omit<CapturedImage, "fullData">[]>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const allImages = (req.result as CapturedImage[]) ?? [];
      // Map to exclude fullData to only return metadata
      const metadataOnly = allImages.map((img) => {
        const { fullData, ...metadata } = img;
        return metadata;
      });
      resolve(metadataOnly);
    };

    req.onerror = () => {
      reject(req.error ?? new Error("Failed to read from object store"));
    };
  });
}

/**
 * Delete a specific image by URL
 */
export async function deleteImage(url: string): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(url);

    req.onsuccess = () => resolve();
    req.onerror = () => {
      reject(req.error ?? new Error("Failed to delete image"));
    };
  });
}

/**
 * Clear all stored images.
 */
export async function clearAllImages(): Promise<void> {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(req.error ?? new Error("Failed to clear object store"));
  });
}

/**
 * Count the number of stored images.
 */
export async function countImages(): Promise<number> {
  const db = await initDB();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();

    req.onsuccess = () => {
      resolve(req.result);
    };

    req.onerror = () => {
      reject(req.error ?? new Error("Failed to count images"));
    };
  });
}

/**
 * Load full image as blob URL for download/display
 */
export async function loadImageBlob(url: string): Promise<string | undefined> {
  const db = await initDB();
  return new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(url);

    req.onsuccess = () => {
      const image = req.result as CapturedImage;
      if (image?.fullData) {
        const blobUrl = URL.createObjectURL(image.fullData);
        resolve(blobUrl);
      } else {
        resolve(undefined);
      }
    };

    req.onerror = () => {
      reject(req.error ?? new Error("Failed to load image blob"));
    };
  });
}
