import { useState } from 'react';
import { CapturedImage, loadImageData } from '../utils/indexedDBUtils';
import JSZip from 'jszip';

/* ---------- Constants ---------- */
const MAX_IMAGES_PER_ZIP = 10000; // Set to high number to effectively disable chunking
const ZIP_COMPRESSION_OPTIONS = {
  type: 'blob' as const,
  compression: 'DEFLATE' as const,
  compressionOptions: { level: 0 },
};

/* ---------- Helpers (small, testable) ---------- */

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const sanitizeBaseFilename = (url: string): string => {
  let name = url.substring(
    url.lastIndexOf('/') + 1,
    url.lastIndexOf('.') || url.length
  );
  if (!name) name = 'image';
  // replace characters that cause FS issues
  return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
};

const extensionFromMime = (data: string): string | null => {
  if (!data.startsWith('data:image/')) return null;
  if (data.startsWith('data:image/jpeg') || data.startsWith('data:image/jpg'))
    return 'jpg';
  if (data.startsWith('data:image/png')) return 'png';
  if (data.startsWith('data:image/gif')) return 'gif';
  if (data.startsWith('data:image/webp')) return 'webp';
  if (data.startsWith('data:image/bmp')) return 'bmp';
  if (data.startsWith('data:image/svg+xml')) return 'svg';
  return null;
};

const getImageExtension = (url: string, data: string): string => {
  const urlExt = url.split('.').pop()?.toLowerCase();
  if (
    urlExt &&
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(urlExt)
  ) {
    // normalize jpeg -> jpg
    return urlExt === 'jpeg' ? 'jpg' : urlExt;
  }
  const mimeExt = extensionFromMime(data);
  return mimeExt ?? 'png';
};

const ensureUniqueFilename = (
  used: Set<string>,
  candidate: string,
  index: number,
  base: string,
  ext: string
) => {
  let final = candidate;
  let counter = 1;
  while (used.has(final)) {
    const namePart = `image-${index + 1}-${base.substring(0, 40)}_${counter}`;
    final = `${namePart}.${ext}`;
    counter++;
  }
  used.add(final);
  return final;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const generateAndDownloadZip = async (zip: JSZip, downloadName: string) => {
  const content = await zip.generateAsync(ZIP_COMPRESSION_OPTIONS);
  downloadBlob(content, downloadName);
};

const addImagesToZip = async (zip: JSZip, images: CapturedImage[]): Promise<number> => {
  const usedFilenames = new Set<string>();
  let processedCount = 0;

  for (let idx = 0; idx < images.length; idx++) {
    const image = images[idx];

    // Load full image data for the zip - prioritize fullData blob over thumbnail data
    let imageData: string | undefined;
    if (image.fullData) {
      // Convert blob to base64 for ZIP
      const reader = new FileReader();
      imageData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image blob'));
        reader.readAsDataURL(image.fullData!); // Use ! since we checked above
      });
    } else {
      // Fallback to stored data or thumbnail
      imageData = image.data || image.thumbnailData;
    }

    if (!imageData) continue;

    const ext = getImageExtension(image.url, imageData);
    const base = sanitizeBaseFilename(image.url) || 'image';
    const initial = `image-${idx + 1}-${base || 'image'}.${ext}`;
    const filename = ensureUniqueFilename(
      usedFilenames,
      initial,
      idx,
      base,
      ext
    );

    // if data is a data URL, split and use base64; otherwise try to accept direct data string
    const base64 = imageData.includes(',')
      ? imageData.split(',')[1]
      : imageData;
    zip.file(filename, base64, { base64: true });
    processedCount++;
  }

  return processedCount;
};
/* ---------- Hook ---------- */

export const useDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadAllImagesAsZip = async (images: CapturedImage[]) => {
    if (isDownloading) {
      console.info('Zip download is already in progress, please wait...');
      return;
    }
    setIsDownloading(true);

    try {
      const totalImages = images.length;
      console.info(`Starting to download ${totalImages} images...`);

      // Load image data for each image
      const imagesWithData = await Promise.all(
        images.map(async (image) => {
          const data = await loadImageData(image.url);
          return { ...image, data };
        })
      );

      // Filter out any images that couldn't be loaded
      const validImages = imagesWithData.filter(img => img.data !== undefined);

      const chunks = chunkArray(validImages, MAX_IMAGES_PER_ZIP);
      console.info(`Will create ${chunks.length} ZIP file(s).`, chunks.length > 1 ? '(chunked due to size)' : '(single zip)');

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.info(
          `Processing chunk ${i + 1} / ${chunks.length} (${chunk.length} images)`
        );

        try {
          const zip = new JSZip();
          const added = await addImagesToZip(zip, chunk);

          console.info(
            `Added ${added} images to ZIP part ${i + 1}, generating...`
          );

          const datePart = new Date().toISOString().slice(0, 10);
          const downloadName =
            chunks.length > 1
              ? `captured-images-${datePart}-part-${i + 1}.zip`
              : `captured-images-${datePart}.zip`;

          await generateAndDownloadZip(zip, downloadName);

          console.info(`Download of ZIP part ${i + 1} completed successfully!`);
        } catch (err) {
          console.error(`Error creating ZIP file part ${i + 1}:`, err);
          // mirror original behavior: stop processing on first error
          alert(
            `An error occurred while creating ZIP file part ${i + 1}. Please try again.`
          );
          break;
        }
      }

      console.info('All requested ZIP processing finished.');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadImage = async (image: CapturedImage) => {
    // Check if we have full blob data first, since it's higher quality than thumbnail
    if (image.fullData) {
      // Extract proper filename and extension from URL
      let ext = 'jpg'; // Default extension
      let base = 'image'; // Default base name

      // Try to extract the extension from the URL
      const urlParts = image.url.split('/');
      const lastPart = urlParts[urlParts.length - 1].split('?')[0]; // Remove query parameters

      // Look for file extension after the last dot
      const lastDotIndex = lastPart.lastIndexOf('.');
      if (lastDotIndex > 0) {
        ext = lastPart.substring(lastDotIndex + 1).toLowerCase();
        base = lastPart.substring(0, lastDotIndex);
      } else {
        // If no extension found in filename, try to extract from URL parameters
        const formatMatch = image.url.match(/[?&]format=([^&]+)/i);
        if (formatMatch) {
          ext = formatMatch[1].toLowerCase();
        } else {
          // Default to jpg if no extension is found
          ext = 'jpg';
        }
        base = lastPart;
      }

      // Clean the base name to remove query parameters and special characters
      base = base.replace(/[?&=]/g, '-').replace(/[<>:"/\\|?*]/g, '_');

      const filename = `captured-image-${base.substring(0, 40) || 'image'}.${ext}`;

      // Create a URL from the blob and trigger download
      const blobUrl = URL.createObjectURL(image.fullData);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } else {
      // Fallback to using stored data or loading it
      const imageData = image.data || await loadImageData(image.url);
      if (!imageData) return;

      const ext = getImageExtension(image.url, imageData);
      const base = sanitizeBaseFilename(image.url) || 'image';
      const filename = `captured-image-${base || 'image'}.${ext}`;

      // Use data URL as href so browser will download it as a file
      const a = document.createElement('a');
      a.href = imageData;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return {
    downloadAllImagesAsZip,
    downloadImage: downloadImage,
    isDownloading,
  };
};
