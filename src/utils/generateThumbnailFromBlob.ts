/**
 * Generate thumbnail from blob (handles raster images + SVG)
 */
export async function generateThumbnailFromBlob(
  blob: Blob,
  maxWidth = 50,
  maxHeight = 50,
): Promise<string> {
  // helper: check whether blob is SVG by MIME or by looking at the start of the text
  async function isProbablySvg(b: Blob): Promise<boolean> {
    if (b.type === "image/svg+xml") return true;
    try {
      const head = await b.slice(0, 200).text();
      return /^\s*<\?xml|^\s*<svg/i.test(head);
    } catch {
      return false;
    }
  }

  // Read SVG text safely for fallbacks
  async function readSvgText(b: Blob): Promise<string | null> {
    try {
      return await b.text();
    } catch {
      return null;
    }
  }

  // Convert Blob (or canvas) to a data URL string
  async function blobToDataURL(b: Blob): Promise<string> {
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(new Error("Failed to read blob as data URL"));
      fr.readAsDataURL(b);
    });
  }

  // Create a canvas (OffscreenCanvas if available, otherwise HTMLCanvasElement)
  function makeCanvas(
    w: number,
    h: number,
  ): {
    canvas: OffscreenCanvas | HTMLCanvasElement;
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  } {
    if (typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext("2d");
      return { canvas: c, ctx };
    } else {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      return { canvas: c, ctx };
    }
  }

  const svg = await isProbablySvg(blob);

  let imageBitmap: ImageBitmap | null = null;

  try {
    // Fast path: try createImageBitmap directly (works for most raster images and many SVGs)
    imageBitmap = await createImageBitmap(blob);
  } catch (firstErr) {
    if (!svg) {
      // non-svg and createImageBitmap failed -> rethrow
      throw firstErr;
    }

    // For SVG: fallback to loading via an Image element using a data: URL (avoids some createImageBitmap SVG issues)
    try {
      const svgText = await readSvgText(blob);
      if (!svgText) throw firstErr;

      const dataUrl =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);

      // Create HTMLImageElement and wait until loaded
      const img = new Image();
      // do not set crossOrigin - using data: URL keeps it same-origin (unless the SVG itself references external cross-origin resources)
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () =>
          reject(new Error("Failed to load SVG into Image element"));
      });

      // Normalize to ImageBitmap for consistent drawing
      imageBitmap = await createImageBitmap(img);
    } catch (secondErr) {
      // If rendering the SVG fails (often due to external resources / CORS causing tainted canvas),
      // return the raw SVG as a data URL (no thumbnail scaling) so the caller still has an image to show.
      // This is better than throwing in many UI scenarios.
      const rawSvg = await readSvgText(blob);
      if (rawSvg !== null) {
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(rawSvg);
      }
      // nothing we can do — rethrow original error
      throw secondErr;
    }
  }

  if (!imageBitmap) {
    throw new Error("Failed to obtain an ImageBitmap for the provided blob.");
  }

  // calculate thumbnail dimensions keeping aspect ratio
  let thumbWidth = imageBitmap.width;
  let thumbHeight = imageBitmap.height;

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

  // Draw to OffscreenCanvas or fallback canvas
  const { canvas, ctx } = makeCanvas(thumbWidth, thumbHeight);
  if (!ctx) {
    throw new Error("Could not get 2D rendering context from canvas.");
  }

  // If HTMLCanvasElement was returned, ensure its size matches (OffscreenCanvas set size in constructor)
  if ("width" in canvas && "height" in canvas) {
    // for HTMLCanvasElement set attributes
    (canvas as HTMLCanvasElement).width = thumbWidth;
    (canvas as HTMLCanvasElement).height = thumbHeight;
  }

  // draw
  ctx.drawImage(imageBitmap, 0, 0, thumbWidth, thumbHeight);

  // Convert canvas to JPEG blob (OffscreenCanvas has convertToBlob, HTMLCanvasElement has toDataURL)
  try {
    if (
      typeof OffscreenCanvas !== "undefined" &&
      canvas instanceof OffscreenCanvas
    ) {
      const thumbBlob = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: 0.8,
      });
      return await blobToDataURL(thumbBlob);
    } else {
      // HTMLCanvasElement case
      const htmlCanvas = canvas as HTMLCanvasElement;
      const dataUrl = htmlCanvas.toDataURL("image/jpeg", 0.8);
      return dataUrl;
    }
  } catch (finalErr) {
    console.error("Failed to generate thumbnail:", finalErr);

    if (svg) {
      try {
        const rawSvg = await readSvgText(blob);
        if (rawSvg !== null) {
          return (
            "data:image/svg+xml;charset=utf-8," + encodeURIComponent(rawSvg)
          );
        }
      } catch (svgErr) {
        console.error("SVG fallback also failed:", svgErr);
      }
    }

    // Return a placeholder instead of breaking everything
    return placeholder;
  }
}

const placeholder = `data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="100%" height="100%" fill="#ccc"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10">Error</text></svg>`;
