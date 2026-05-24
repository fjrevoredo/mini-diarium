export interface ImageSources {
  dataUrls: string[];
  filePaths: string[];
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);

/**
 * Parses an HTML fragment (from dataTransfer.getData('text/html')) and returns
 * embeddable image sources found in <img> tags:
 *   - data:image/... URLs → embed directly via canvas resize
 *   - file:// URLs with image extensions → read from disk via readFileBytes
 * HTTP/HTTPS src values are intentionally skipped — no network fetches.
 */
export function extractImageSourcesFromHtml(html: string): ImageSources {
  if (!html) return { dataUrls: [], filePaths: [] };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const dataUrls: string[] = [];
  const filePaths: string[] = [];
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const src = img.src;
    if (src.startsWith('data:image/')) {
      dataUrls.push(src);
    } else if (src.startsWith('file:')) {
      const path = fileUrlToPath(src);
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      if (path && IMAGE_EXTS.has(ext)) filePaths.push(path);
    }
  }
  return { dataUrls, filePaths };
}

/**
 * Returns true if the HTML fragment contains any <img> tags, regardless of
 * whether their sources are embeddable. Used in handleDrop to consume the drop
 * event even when no image can be embedded — prevents TipTap from inserting
 * broken <img src="https://..."> tags as rich text.
 */
export function htmlHasImages(html: string): boolean {
  if (!html) return false;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.querySelectorAll('img').length > 0;
}

function fileUrlToPath(fileUrl: string): string {
  try {
    const pathname = new URL(fileUrl).pathname;
    // Windows: file:///C:/path/img.png → pathname /C:/path/img.png → C:/path/img.png
    return decodeURIComponent(pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  } catch {
    return '';
  }
}
