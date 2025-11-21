import { CapturedImage } from "./indexedDBUtils";
import {
  ZIP_CONFIG,
  EXTENSION_CONFIG,
  FILE_CONFIG,
  DEFAULT_CONFIG,
} from "../constants";

/* ---------- Helpers (simplified for service worker compatibility) ---------- */

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Simplified filename creation to avoid complex logic that might cause type issues
const createFilename = (index: number, extension: string): string => {
  return `${DEFAULT_CONFIG.FILENAME_BASE}-${index + 1}.${extension || FILE_CONFIG.DEFAULT_EXTENSION}`;
};

export const createZipFromCapturedImages = async (
  JSZip: typeof import("jszip"),
  images: CapturedImage[],
  progressCallback?: (percent: number, message: string) => void,
): Promise<Blob[]> => {
  const totalImages = images.length;
  console.info(`Starting to create ZIP for ${totalImages} images...`);

  if (progressCallback) {
    progressCallback(0, `Preparing ${totalImages} images...`);
  }

  // Split into chunks if needed
  const chunks = chunkArray(images, ZIP_CONFIG.MAX_IMAGES_PER_ZIP);
  const zipBlobs: Blob[] = [];

  // Process each chunk separately to create individual ZIP files
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue; // Skip if chunk is undefined

    // Create a new JSZip instance for this chunk
    const chunkZip = new JSZip();

    // Add images from the current chunk to the zip
    for (let j = 0; j < chunk.length; j++) {
      const image = chunk[j];
      if (!image || !image.fullData) continue;

      // Progress update for each image processed
      if (
        progressCallback &&
        j % Math.max(1, Math.floor(chunk.length / 10)) === 0
      ) {
        // Update every 10% or so of this chunk
        const chunkProgress = Math.round((j / chunk.length) * 30); // Max 30% for processing
        const overallProgress = Math.round(
          (i * 100) / chunks.length + chunkProgress / chunks.length,
        );
        progressCallback(
          overallProgress,
          `Processing image ${j + 1} of ${chunk.length} in part ${i + 1}...`,
        );
      }

      // Convert blob for ZIP - using service worker safe approach
      const arrayBuffer = await image.fullData.arrayBuffer();

      // Add the image binary data directly to the zip file
      const contentType = (image.fullData as Blob).type || "image/png";

      // Extract extension from content type or URL
      let ext = "png"; // default
      if (contentType.includes("jpeg") || contentType.includes("jpg"))
        ext = "jpg";
      else if (contentType.includes("png")) ext = "png";
      else if (contentType.includes("gif")) ext = "gif";
      else if (contentType.includes("webp")) ext = "webp";
      else if (contentType.includes("bmp")) ext = "bmp";
      else if (contentType.includes("svg")) ext = "svg";

      // If not found in content type, try from URL
      if (ext === FILE_CONFIG.DEFAULT_EXTENSION) {
        const urlExt = image.url.split(".").pop()?.toLowerCase();
        if (
          urlExt &&
          EXTENSION_CONFIG.SUPPORTED_IMAGE_EXTENSIONS.includes(urlExt as any)
        ) {
          ext = urlExt === "jpeg" ? "jpg" : urlExt;
        }
      }

      const imageIndex: number = i * ZIP_CONFIG.MAX_IMAGES_PER_ZIP + j;
      const extension: string = ext;
      const filename = createFilename(imageIndex, extension);

      // Add the binary data directly to the zip without base64 encoding
      chunkZip.file(filename, new Uint8Array(arrayBuffer));
    }

    if (progressCallback) {
      progressCallback(
        Math.round(((i + 0.5) * 100) / chunks.length),
        `Packaging part ${i + 1}...`,
      );
    }

    const datePart = new Date().toISOString().slice(0, 10);
    const zipName =
      chunks.length > 1
        ? `captured-images-${datePart}-part-${i + 1}.zip`
        : `captured-images-${datePart}.zip`;

    // Generate ZIP with progress tracking using real JSZip progress
    const content = (await chunkZip.generateAsync(
      {
        type: "blob",
        compression: ZIP_CONFIG.COMPRESSION,
      },
      (metadata) => {
        // Report real progress from JSZip, scaled to overall operation
        if (progressCallback) {
          // Calculate overall progress: previous chunks + current chunk progress
          const progressForThisChunk = Math.round(metadata.percent);
          // Calculate overall progress: (completed chunks / total chunks) * 100 + (current chunk progress / total chunks)
          const overallProgress = Math.round(
            (i * 100 + progressForThisChunk) / chunks.length,
          );
          progressCallback(
            overallProgress,
            `Zipping part ${i + 1}: ${progressForThisChunk}%`,
          );
        }
      },
    )) as Blob;

    zipBlobs.push(content);
    console.log(`Created ZIP file part ${i + 1} as ${zipName}`);

    if (progressCallback) {
      // Calculate overall progress: after processing all chunks
      const overallProgress = Math.round(((i + 1) / chunks.length) * 100);
      progressCallback(overallProgress, `Zip part ${i + 1} created...`);
    }
  }

  return zipBlobs;
};

export interface ZipProgress {
  progress: number;
  message: string;
  totalImages: number;
  processedImages: number;
}
