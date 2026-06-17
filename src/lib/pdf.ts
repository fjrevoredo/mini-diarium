// Applied temporarily while html2canvas renders the hidden export layer.
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
  #mini-diarium-print-layer .md-print-entry-content img { max-width: 100%; max-height: 900px; width: auto; height: auto; object-fit: contain; display: block; page-break-inside: avoid; break-inside: avoid; }
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

type ImageBounds = { topPx: number; bottomPx: number };
type RowBounds = { top: number; bottom: number };
type RenderLayout = {
  elementHeightPx: number;
  elementWidthPx: number;
  imageBounds: ImageBounds[];
};

function measureRenderLayout(element: HTMLElement): RenderLayout {
  const elementRect = element.getBoundingClientRect();
  const imageBounds = [...element.querySelectorAll<HTMLElement>('img, figure')].map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      topPx: rect.top - elementRect.top,
      bottomPx: rect.bottom - elementRect.top,
    };
  });

  return {
    elementHeightPx: elementRect.height,
    elementWidthPx: elementRect.width,
    imageBounds,
  };
}

export function findSafeRasterSplit(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  minRow: number,
  forbiddenRows: RowBounds[],
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
    if (blankRunEnd !== undefined) return Math.ceil((row + 2 + blankRunEnd) / 2);
  }
  if (blankRunEnd !== undefined) return Math.ceil((Math.max(0, minRow) + blankRunEnd + 1) / 2);
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
      clonedElement.style.visibility = 'visible';
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

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
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
        const forbiddenRows = renderLayout.imageBounds
          .map(({ topPx, bottomPx }) => ({
            top: Math.floor((topPx - pageTopPx) * CANVAS_SCALE),
            bottom: Math.ceil((bottomPx - pageTopPx) * CANVAS_SCALE),
          }))
          .filter(({ top, bottom }) => bottom >= 0 && top < candidateCanvas.height);
        const context = candidateCanvas.getContext('2d')!;
        const safeRow = findSafeRasterSplit(
          context.getImageData(0, 0, candidateCanvas.width, candidateCanvas.height).data,
          candidateCanvas.width,
          candidateCanvas.height,
          0,
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
