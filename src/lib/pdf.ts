// Mirrors @media print block in index.css — applied in screen mode so html2canvas
// captures the correct visual output (html2canvas ignores @media print rules).
const SCREEN_PRINT_STYLES = `
  #mini-diarium-print-layer {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 12pt;
    color: #1a1a1a;
    line-height: 1.6;
    background: #ffffff;
    width: 650px;
    padding: 20px 0;
  }
  #mini-diarium-print-layer .md-print-doc-header { border-bottom: 2px solid #333; padding-bottom: 0.5em; margin-bottom: 2em; }
  #mini-diarium-print-layer .md-print-doc-header h1 { font-size: 20pt; font-weight: bold; margin: 0 0 0.25em 0; }
  #mini-diarium-print-layer .md-print-generated { font-size: 9pt; color: #666; margin: 0; }
  #mini-diarium-print-layer .md-print-day { margin-bottom: 3em; }
  #mini-diarium-print-layer .md-print-day-date { font-size: 14pt; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 0.25em; margin-bottom: 1.5em; }
  #mini-diarium-print-layer .md-print-entry { margin-bottom: 2em; }
  #mini-diarium-print-layer .md-print-entry-title { font-size: 13pt; font-weight: bold; margin-bottom: 0.2em; }
  #mini-diarium-print-layer .md-print-entry-tags { font-size: 9pt; color: #666; font-style: italic; margin-bottom: 0.75em; }
  #mini-diarium-print-layer .md-print-entry-content { font-size: 11pt; }
  #mini-diarium-print-layer .md-print-entry-content p { margin: 0.5em 0; }
  #mini-diarium-print-layer .md-print-entry-content h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
  #mini-diarium-print-layer .md-print-entry-content h2 { font-size: 1.5em; font-weight: bold; margin: 0.83em 0; }
  #mini-diarium-print-layer .md-print-entry-content h3 { font-size: 1.17em; font-weight: bold; margin: 1em 0; }
  #mini-diarium-print-layer .md-print-entry-content h4,
  #mini-diarium-print-layer .md-print-entry-content h5,
  #mini-diarium-print-layer .md-print-entry-content h6 { font-weight: bold; margin: 1em 0; }
  #mini-diarium-print-layer .md-print-entry-content ul { list-style: disc outside; padding-left: 1.5em; margin: 0.5em 0; }
  #mini-diarium-print-layer .md-print-entry-content ol { list-style: decimal outside; padding-left: 1.5em; margin: 0.5em 0; }
  #mini-diarium-print-layer .md-print-entry-content li { margin: 0.25em 0; }
  #mini-diarium-print-layer .md-print-entry-content blockquote { border-left: 3px solid #aaa; padding-left: 1em; margin: 0.5em 0; }
  #mini-diarium-print-layer .md-print-entry-content pre { background: #f5f5f5; padding: 0.5em; margin: 0.5em 0; white-space: pre-wrap; overflow-wrap: break-word; font-family: monospace; font-size: 0.9em; }
  #mini-diarium-print-layer .md-print-entry-content code { font-family: monospace; font-size: 0.9em; background: #f0f0f0; padding: 0.1em 0.3em; }
  #mini-diarium-print-layer .md-print-entry-content figure { display: block; page-break-inside: avoid; break-inside: avoid; margin: 0.5em 0; }
  #mini-diarium-print-layer .md-print-entry-content img { max-width: 100%; height: auto; display: block; page-break-inside: avoid; break-inside: avoid; }
  #mini-diarium-print-layer .md-print-entry-content s { text-decoration: line-through; }
  #mini-diarium-print-layer .md-print-entry-content u { text-decoration: underline; }
  #mini-diarium-print-layer .md-print-entry-content a { color: #1a56db; }
`;

// A4 content area (mm). Margins: top/bottom 20mm, left/right 15mm.
const CONTENT_WIDTH_MM = 180; // 210 - 15 - 15
const CONTENT_HEIGHT_MM = 257; // 297 - 20 - 20
const MARGIN_LEFT_MM = 15;
const MARGIN_TOP_MM = 20;

// Render scale for html2canvas. At 2×, the canvas is 1300px wide → ~183 DPI on A4.
const CANVAS_SCALE = 2;

type ImageBounds = { topMm: number; bottomMm: number };
type RenderLayout = {
  elementHeightPx: number;
  elementWidthPx: number;
  imageBoundsMm: ImageBounds[];
};

const BLOCK_SELECTOR =
  '.md-print-entry-content p,' +
  '.md-print-entry-content h1,.md-print-entry-content h2,.md-print-entry-content h3,' +
  '.md-print-entry-content h4,.md-print-entry-content h5,.md-print-entry-content h6,' +
  '.md-print-entry-content li,' +
  '.md-print-entry-content blockquote,' +
  '.md-print-entry-content pre,' +
  '.md-print-entry-title,' +
  '.md-print-entry-tags,' +
  '.md-print-day-date';

type LineBounds = { top: number; bottom: number };

function collectBetweenLinePoints(lineRects: DOMRectList, elementTopPx: number): number[] {
  const lines: LineBounds[] = [];
  const rects = [...lineRects]
    .filter((rect) => rect.height > 0)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  for (const rect of rects) {
    const current = lines[lines.length - 1];
    if (current && rect.top < current.bottom && rect.bottom > current.top) {
      current.top = Math.min(current.top, rect.top);
      current.bottom = Math.max(current.bottom, rect.bottom);
    } else {
      lines.push({ top: rect.top, bottom: rect.bottom });
    }
  }

  const points: number[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const current = lines[i];
    const next = lines[i + 1];
    if (next.top > current.bottom) {
      points.push((current.bottom + next.top) / 2 - elementTopPx);
    }
  }
  return points;
}

// Collects safe page-cut positions (mm from elementTopPx) for every block element.
// Range rects describe inline fragments, so overlapping fragments must first be grouped
// into visual lines. Only whitespace between those lines is safe to cut.
export function collectSnapPoints(
  element: HTMLElement,
  elementTopPx: number,
  cssToMm: number,
): number[] {
  const points: number[] = [];
  const range = document.createRange();
  for (const el of element.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    const rect = el.getBoundingClientRect();
    const topPx = rect.top - elementTopPx;
    const heightPx = rect.height > 0 ? rect.height : el.offsetHeight;
    const bottomPx = topPx + heightPx;
    if (bottomPx <= 0) continue;
    points.push(bottomPx * cssToMm);
    range.selectNodeContents(el);
    const lineRects = range.getClientRects();
    if (lineRects.length > 0 && rect.height > 0) {
      for (const linePointPx of collectBetweenLinePoints(lineRects, elementTopPx)) {
        if (linePointPx > 0) points.push(linePointPx * cssToMm);
      }
    } else if (heightPx > 0) {
      const style = window.getComputedStyle(el);
      const lhPx = parseFloat(style.lineHeight);
      const paddingTopPx = parseFloat(style.paddingTop) || 0;
      const paddingBottomPx = parseFloat(style.paddingBottom) || 0;
      const contentBottomPx = bottomPx - paddingBottomPx;
      if (!isNaN(lhPx) && lhPx > 0) {
        for (let y = topPx + paddingTopPx + lhPx; y < contentBottomPx; y += lhPx) {
          points.push(y * cssToMm);
        }
      }
    }
  }
  return [...new Set(points.filter((point) => point > 0))].sort((a, b) => a - b);
}

// Calculates page-split positions (mm from content top) that never bisect an image or
// text line. doc.html() + autoPaging slices at fixed intervals ignoring CSS
// page-break-inside, so we do the geometry ourselves here.
export function computePageSplits(
  totalHeightMm: number,
  imageBoundsMm: ImageBounds[],
  snapPointsMm: number[],
): number[] {
  const splits = [0];
  let cursor = 0;
  while (cursor < totalHeightMm) {
    let next = cursor + CONTENT_HEIGHT_MM;
    if (next >= totalHeightMm) break;

    const straddling = imageBoundsMm.find((img) => img.topMm < next && img.bottomMm > next);
    if (straddling) next = straddling.topMm;

    // Image taller than a full page — can't avoid cutting it; advance normally.
    if (next <= cursor) next = cursor + CONTENT_HEIGHT_MM;

    // Snap to the last safe cut point that fits before `next` (avoids mid-line cuts).
    let snapped = -1;
    for (const sp of snapPointsMm) {
      if (sp > cursor && sp <= next) snapped = sp;
      else if (sp > next) break;
    }
    if (snapped > cursor) next = snapped;

    splits.push(next);
    cursor = next;
  }
  splits.push(totalHeightMm);
  return splits;
}

function measureRenderLayout(element: HTMLElement): RenderLayout {
  const elementRect = element.getBoundingClientRect();
  const cssToMm = CONTENT_WIDTH_MM / elementRect.width;
  const imageBoundsMm = [...element.querySelectorAll<HTMLElement>('img, figure')].map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      topMm: (rect.top - elementRect.top) * cssToMm,
      bottomMm: (rect.bottom - elementRect.top) * cssToMm,
    };
  });

  return {
    elementHeightPx: elementRect.height,
    elementWidthPx: elementRect.width,
    imageBoundsMm,
  };
}

export function findSafeRasterSplit(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  minRow: number,
  forbiddenRows: Array<{ top: number; bottom: number }>,
): number | undefined {
  const isForbidden = (row: number) =>
    forbiddenRows.some(({ top, bottom }) => row >= top && row <= bottom);
  const isBlank = (row: number) => {
    const start = row * width * 4;
    const end = start + width * 4;
    for (let i = start; i < end; i += 4) {
      if (pixels[i + 3] > 0 && (pixels[i] < 245 || pixels[i + 1] < 245 || pixels[i + 2] < 245)) {
        return false;
      }
    }
    return true;
  };

  let blankRunEnd: number | undefined;
  for (let row = height - 1; row >= Math.max(0, minRow); row--) {
    if (!isForbidden(row) && isBlank(row)) {
      blankRunEnd ??= row;
      continue;
    }
    if (blankRunEnd !== undefined) return Math.floor((row + 1 + blankRunEnd) / 2);
  }
  if (blankRunEnd !== undefined) return Math.floor((Math.max(0, minRow) + blankRunEnd) / 2);
  return undefined;
}

export async function generatePdfFromElement(element: HTMLElement): Promise<number[]> {
  const tempStyle = document.createElement('style');
  tempStyle.textContent = SCREEN_PRINT_STYLES;
  document.head.appendChild(tempStyle);

  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');

    const windowWidth = Math.max(1, Math.ceil(element.scrollWidth));
    const windowHeight = Math.max(1, Math.ceil(element.scrollHeight));
    const prepareClone = (clonedElement: HTMLElement) => {
      clonedElement.style.position = 'absolute';
      clonedElement.style.top = '0';
      clonedElement.style.left = '0';
    };

    let renderLayout: RenderLayout | undefined;
    // html2canvas's documented onclone hook runs after clone fonts/images are ready
    // and before that clone is parsed. Render only a 1px measurement canvas here;
    // each PDF page is rendered separately below to avoid browser canvas-size limits.
    await html2canvas(element, {
      scale: 1,
      useCORS: true,
      logging: false,
      windowWidth,
      windowHeight,
      scrollX: 0,
      scrollY: 0,
      width: 1,
      height: 1,
      onclone: (_document, clonedElement) => {
        prepareClone(clonedElement);
        renderLayout = measureRenderLayout(clonedElement);
      },
    });
    if (!renderLayout) throw new Error('Unable to measure PDF render layout');

    const cssToMm = CONTENT_WIDTH_MM / renderLayout.elementWidthPx;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const contentHeightPx = CONTENT_HEIGHT_MM / cssToMm;
    let pageTopPx = 0;
    let pageIndex = 0;

    while (pageTopPx < renderLayout.elementHeightPx) {
      const nominalBottomPx = Math.min(pageTopPx + contentHeightPx, renderLayout.elementHeightPx);
      const renderHeightPx = nominalBottomPx - pageTopPx;
      if (renderHeightPx <= 0) break;

      const candidateCanvas = await html2canvas(element, {
        scale: CANVAS_SCALE,
        useCORS: true,
        logging: false,
        windowWidth,
        windowHeight,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: pageTopPx,
        width: renderLayout.elementWidthPx,
        height: renderHeightPx,
        onclone: (_document, clonedElement) => prepareClone(clonedElement),
      });
      const isLastPage = nominalBottomPx >= renderLayout.elementHeightPx;
      let pageBottomPx = nominalBottomPx;
      let outputCanvas = candidateCanvas;

      if (!isLastPage) {
        const forbiddenRows = renderLayout.imageBoundsMm
          .map(({ topMm, bottomMm }) => ({
            top: Math.floor((topMm / cssToMm - pageTopPx) * CANVAS_SCALE),
            bottom: Math.ceil((bottomMm / cssToMm - pageTopPx) * CANVAS_SCALE),
          }))
          .filter(({ top, bottom }) => bottom >= 0 && top < candidateCanvas.height);
        const context = candidateCanvas.getContext('2d')!;
        const safeRow = findSafeRasterSplit(
          context.getImageData(0, 0, candidateCanvas.width, candidateCanvas.height).data,
          candidateCanvas.width,
          candidateCanvas.height,
          Math.floor(candidateCanvas.height / 2),
          forbiddenRows,
        );

        if (safeRow !== undefined) {
          pageBottomPx = pageTopPx + safeRow / CANVAS_SCALE;
          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = candidateCanvas.width;
          croppedCanvas.height = safeRow;
          croppedCanvas
            .getContext('2d')!
            .drawImage(
              candidateCanvas,
              0,
              0,
              candidateCanvas.width,
              safeRow,
              0,
              0,
              candidateCanvas.width,
              safeRow,
            );
          outputCanvas = croppedCanvas;
        }
      }

      if (pageIndex > 0) doc.addPage();
      const pageHeightMm = (pageBottomPx - pageTopPx) * cssToMm;

      doc.addImage(
        outputCanvas.toDataURL('image/jpeg', 0.92),
        'JPEG',
        MARGIN_LEFT_MM,
        MARGIN_TOP_MM,
        CONTENT_WIDTH_MM,
        pageHeightMm,
      );
      pageTopPx = pageBottomPx;
      pageIndex++;
    }

    return Array.from(new Uint8Array(doc.output('arraybuffer')));
  } finally {
    tempStyle.remove();
  }
}
