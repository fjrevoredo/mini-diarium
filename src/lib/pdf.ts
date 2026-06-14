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

// Explicit CSS width of the print layer element (matches SCREEN_PRINT_STYLES above).
const CSS_LAYER_WIDTH_PX = 650;

// Render scale for html2canvas. At 2×, the canvas is 1300px wide → ~183 DPI on A4.
// Blink's canvas height cap is 16 384px per side, so at 2× the max content height
// before truncation is ~8 192 CSS pixels (~320 lines at 12pt/1.6). Exports spanning
// many years may exceed this; use date-range filtering for very large exports.
const CANVAS_SCALE = 2;

export async function generatePdfFromElement(element: HTMLElement): Promise<number[]> {
  const tempStyle = document.createElement('style');
  tempStyle.textContent = SCREEN_PRINT_STYLES;
  document.head.appendChild(tempStyle);

  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');

    // Measure image/figure positions NOW — getBoundingClientRect forces a layout
    // flush so the values reflect the injected print styles above.
    const elementRect = element.getBoundingClientRect();
    // 1 CSS pixel → mm conversion (element is CSS_LAYER_WIDTH_PX wide → CONTENT_WIDTH_MM mm).
    const cssToMm = CONTENT_WIDTH_MM / CSS_LAYER_WIDTH_PX;

    // Capture top/bottom of every image and figure in mm relative to element top.
    // These are used to find safe page-split points that don't bisect an image.
    const imageBoundsMm = [...element.querySelectorAll<HTMLElement>('img, figure')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        topMm: (r.top - elementRect.top) * cssToMm,
        bottomMm: (r.bottom - elementRect.top) * cssToMm,
      };
    });

    // Render the entire element to a single canvas.
    const canvas = await html2canvas(element, {
      scale: CANVAS_SCALE,
      useCORS: true,
      logging: false,
      windowWidth: CSS_LAYER_WIDTH_PX,
    });

    // canvas pixels → mm (canvas is CANVAS_SCALE× the CSS pixel dimensions).
    const canvasToMm = CONTENT_WIDTH_MM / canvas.width;
    const totalHeightMm = canvas.height * canvasToMm;

    // Build page split positions (in mm) that avoid bisecting any image.
    // doc.html() + autoPaging rasterizes the content THEN slices at fixed intervals,
    // so CSS page-break-inside is never consulted. We replicate the split logic here.
    const splitsMm: number[] = [0];
    let cursor = 0;
    while (cursor < totalHeightMm) {
      let nextSplit = cursor + CONTENT_HEIGHT_MM;
      if (nextSplit >= totalHeightMm) break;

      // If an image straddles the proposed cut, retreat the cut to just before it.
      for (const img of imageBoundsMm) {
        if (img.topMm < nextSplit && img.bottomMm > nextSplit) {
          nextSplit = img.topMm;
          break;
        }
      }

      // Safety: if an image is taller than a full page we cannot avoid cutting it;
      // proceed at the normal page boundary so we don't loop forever.
      if (nextSplit <= cursor) nextSplit = cursor + CONTENT_HEIGHT_MM;

      splitsMm.push(nextSplit);
      cursor = nextSplit;
    }
    splitsMm.push(totalHeightMm);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let i = 0; i < splitsMm.length - 1; i++) {
      if (i > 0) doc.addPage();

      const pageTopMm = splitsMm[i];
      const pageHeightMm = splitsMm[i + 1] - pageTopMm;
      if (pageHeightMm <= 0) continue;

      // Slice the full canvas to a page-sized strip.
      const sliceTopPx = Math.round(pageTopMm / canvasToMm);
      const sliceHeightPx = Math.round(pageHeightMm / canvasToMm);

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      sliceCanvas
        .getContext('2d')!
        .drawImage(
          canvas,
          0,
          sliceTopPx,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx,
        );

      doc.addImage(
        sliceCanvas.toDataURL('image/jpeg', 0.92),
        'JPEG',
        MARGIN_LEFT_MM,
        MARGIN_TOP_MM,
        CONTENT_WIDTH_MM,
        pageHeightMm,
      );
    }

    return Array.from(new Uint8Array(doc.output('arraybuffer')));
  } finally {
    tempStyle.remove();
  }
}
