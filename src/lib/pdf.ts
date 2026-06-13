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
  #mini-diarium-print-layer .md-print-entry-content img { max-width: 100%; height: auto; display: block; }
  #mini-diarium-print-layer .md-print-entry-content s { text-decoration: line-through; }
  #mini-diarium-print-layer .md-print-entry-content u { text-decoration: underline; }
  #mini-diarium-print-layer .md-print-entry-content a { color: #1a56db; }
`;

export async function generatePdfFromElement(element: HTMLElement): Promise<number[]> {
  const tempStyle = document.createElement('style');
  tempStyle.textContent = SCREEN_PRINT_STYLES;
  document.head.appendChild(tempStyle);

  try {
    const { default: jsPDF } = await import('jspdf');
    await import('html2canvas'); // jsPDF.html() requires html2canvas at runtime

    const bytes = await new Promise<number[]>((resolve, reject) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.html(element, {
        callback: (pdf) => {
          try {
            resolve(Array.from(new Uint8Array(pdf.output('arraybuffer'))));
          } catch (e) {
            reject(e);
          }
        },
        margin: [20, 15, 20, 15],
        autoPaging: 'text',
        width: 180,
        windowWidth: 650,
        x: 0,
        y: 0,
      });
    });

    return bytes;
  } finally {
    // Runs after the Promise above resolves or rejects — safe to remove style here
    tempStyle.remove();
  }
}
