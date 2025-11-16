import { useState } from "react";
import { CapturedImage } from "../utils/indexedDBUtils";
import JSZip from "jszip";

/* ---------- Constants ---------- */
const MAX_IMAGES_PER_ZIP = 500;
const ZIP_COMPRESSION_OPTIONS = {
  type: "blob" as const,
  compression: "DEFLATE" as const,
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
    url.lastIndexOf("/") + 1,
    url.lastIndexOf(".") || url.length
  );
  if (!name) name = "image";
  // replace characters that cause FS issues
  return name.replace(/[<>:"/\\|?*]/g, "_").substring(0, 50);
};

const extensionFromMime = (data: string): string | null => {
  if (!data.startsWith("data:image/")) return null;
  if (data.startsWith("data:image/jpeg") || data.startsWith("data:image/jpg"))
    return "jpg";
  if (data.startsWith("data:image/png")) return "png";
  if (data.startsWith("data:image/gif")) return "gif";
  if (data.startsWith("data:image/webp")) return "webp";
  if (data.startsWith("data:image/bmp")) return "bmp";
  if (data.startsWith("data:image/svg+xml")) return "svg";
  return null;
};

const getImageExtension = (url: string, data: string): string => {
  const urlExt = url.split(".").pop()?.toLowerCase();
  if (
    urlExt &&
    ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(urlExt)
  ) {
    // normalize jpeg -> jpg
    return urlExt === "jpeg" ? "jpg" : urlExt;
  }
  const mimeExt = extensionFromMime(data);
  return mimeExt ?? "png";
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
  const a = document.createElement("a");
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

const addImagesToZip = (zip: JSZip, images: CapturedImage[]) => {
  const usedFilenames = new Set<string>();
  let processedCount = 0;

  images.forEach((image, idx) => {
    if (!image.data) return;
    const ext = getImageExtension(image.url, image.data);
    const base = sanitizeBaseFilename(image.url) || "image";
    const initial = `image-${idx + 1}-${base || "image"}.${ext}`;
    const filename = ensureUniqueFilename(
      usedFilenames,
      initial,
      idx,
      base,
      ext
    );

    // if data is a data URL, split and use base64; otherwise try to accept direct data string
    const base64 = image.data.includes(",")
      ? image.data.split(",")[1]
      : image.data;
    zip.file(filename, base64, { base64: true });
    processedCount++;
  });

  return processedCount;
};

/* ---------- Hook ---------- */

export const useDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadAllImagesAsZip = async (images: CapturedImage[]) => {
    if (isDownloading) {
      console.info("Zip download is already in progress, please wait...");
      return;
    }
    setIsDownloading(true);

    try {
      const totalImages = images.length;
      console.info(`Starting to download ${totalImages} images...`);

      const chunks = chunkArray(images, MAX_IMAGES_PER_ZIP);
      console.info(`Will create ${chunks.length} ZIP file(s).`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.info(
          `Processing chunk ${i + 1} / ${chunks.length} (${chunk.length} images)`
        );

        try {
          const zip = new JSZip();
          const added = addImagesToZip(zip, chunk);

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

      console.info("All requested ZIP processing finished.");
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadImage = (image: CapturedImage) => {
    if (!image.data) return;

    const ext = getImageExtension(image.url, image.data);
    const base = sanitizeBaseFilename(image.url) || "image";
    const filename = `captured-image-${base || "image"}.${ext}`;

    // Use data URL as href so browser will download it as a file
    const a = document.createElement("a");
    a.href = image.data;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return {
    downloadAllImagesAsZip,
    downloadImage,
    isDownloading,
  };
};
