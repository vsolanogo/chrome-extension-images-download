/**
 * Generate thumbnail from blob
 */
export async function generateThumbnailFromBlob(
  blob: Blob,
  maxWidth = 50,
  maxHeight = 50
): Promise<string> {
  const imageBitmap = await createImageBitmap(blob);

  let { width: thumbWidth, height: thumbHeight } = imageBitmap;

  if (thumbWidth > thumbHeight) {
    if (thumbWidth > maxWidth) {
      thumbHeight = Math.round(thumbHeight * (maxWidth / thumbWidth));
      thumbWidth = maxWidth;
    }
  } else {
    if (thumbHeight > maxHeight) {
      thumbWidth = Math.round(thumbWidth * (maxHeight / thumbHeight));
      thumbHeight = maxHeight;
    }
  }

  const offscreen = new OffscreenCanvas(thumbWidth, thumbHeight);
  const ctx = offscreen.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get 2D rendering context from OffscreenCanvas.");
  }

  ctx.drawImage(imageBitmap, 0, 0, thumbWidth, thumbHeight);

  const thumbnailBlob = await offscreen.convertToBlob({
    type: "image/jpeg",
    quality: 0.8,
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error("Failed to read thumbnail blob as Data URL"));
    reader.readAsDataURL(thumbnailBlob);
  });
}
