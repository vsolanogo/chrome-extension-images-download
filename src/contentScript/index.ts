// contentScript.ts
console.info('contentScript is running');

type CaptureMessage = {
  type: 'CHECK_AND_CAPTURE_IMAGE';
  url: string;
};

// Prevent sending the same URL repeatedly
const seenUrls = new Set<string>();

// Prevent re-processing the same DOM element (uses weak ref so elements can be GC'd)
const processedElements = new WeakSet<Element>();

/** Send a capture request to the background script (deduped by URL). */
function sendCaptureMessage(url: string) {
  if (!url) return;
  if (seenUrls.has(url)) return;
  seenUrls.add(url);

  const msg: CaptureMessage = { type: 'CHECK_AND_CAPTURE_IMAGE', url };
  chrome.runtime.sendMessage(msg);
}

/** Process a single <img> element (guard + dedupe). */
function processImageElement(img: HTMLImageElement) {
  // Skip if no src, or src refers to our extension resources
  if (!img?.src) return;
  if (img.src.includes(chrome.runtime.id)) return;
  if (processedElements.has(img)) return;

  processedElements.add(img);
  sendCaptureMessage(img.src);
}

/** Process a node that may itself be an <img> or may contain <img> children. */
function processNode(node: Node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;

  if (el.matches && el.matches('img')) {
    processImageElement(el as HTMLImageElement);
    return;
  }

  // Query contained images (fast for subtree scans)
  const imgs = el.querySelectorAll('img');
  for (const img of Array.from(imgs)) {
    processImageElement(img as HTMLImageElement);
  }
}

/** Capture all currently present images on the page. */
function capturePageImages() {
  const imgs = document.querySelectorAll('img');
  for (const img of Array.from(imgs)) {
    processImageElement(img as HTMLImageElement);
  }
}

/** Create a MutationObserver that watches for newly added images. */
function observeForNewImages() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;

      // process directly added nodes
      for (const node of Array.from(mutation.addedNodes)) {
        processNode(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Optional: disconnect observer on page unload to avoid leaks
  window.addEventListener('beforeunload', () => observer.disconnect());
}

/** Simple debounce helper for refresh requests. */
function debounce<T extends (...args: any[]) => void>(fn: T, wait = 200) {
  let timer: number | undefined;
  return (...args: Parameters<T>) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

const debouncedCapture = debounce(capturePageImages, 200);

// Start: capture current images and then observe for new ones
capturePageImages();
observeForNewImages();

// Listen for commands from the background script
chrome.runtime.onMessage.addListener((message: any, _sender, _sendResponse) => {
  if (message?.type === 'REFRESH_PAGE_IMAGES') {
    debouncedCapture();
  }
});
