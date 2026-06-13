import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8');

function buildPage(fragment: string): string {
  return (
    `<!DOCTYPE html><html><head><style>${CSS}</style></head>` +
    `<body><div id="mini-diarium-print-layer">${fragment}</div></body></html>`
  );
}

function makeDay(date: string, title: string, lines: number): string {
  const content = new Array(lines).fill('<p>Line of text for this entry.</p>').join('');
  return (
    `<div class="md-print-day">` +
    `<div class="md-print-day-date">${date}</div>` +
    `<div class="md-print-entry">` +
    `<div class="md-print-entry-title">${title}</div>` +
    `<div class="md-print-entry-content">${content}</div>` +
    `</div></div>`
  );
}

function pageCount(pdf: Buffer): number {
  const str = pdf.toString('binary');
  return (str.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

test('generates a valid non-empty PDF', async ({ page }) => {
  await page.setContent(buildPage(makeDay('January 1, 2024', 'Test', 3)));
  const pdf = Buffer.from(await page.pdf({ format: 'A4' }));
  expect(pdf.byteLength).toBeGreaterThan(5_000);
  expect(pdf.toString('ascii', 0, 4)).toBe('%PDF');
});

test('multi-day export produces one page per day', async ({ page }) => {
  const days = Array.from({ length: 15 }, (_, i) =>
    makeDay(`January ${i + 1}, 2024`, `Entry ${i + 1}`, 2),
  ).join('');
  await page.setContent(buildPage(days));
  const pdf = Buffer.from(await page.pdf({ format: 'A4' }));
  expect(pageCount(pdf)).toBeGreaterThanOrEqual(15);
});

test('long entry spans multiple pages', async ({ page }) => {
  await page.setContent(buildPage(makeDay('January 1, 2024', 'Long entry', 200)));
  const pdf = Buffer.from(await page.pdf({ format: 'A4' }));
  expect(pdf.byteLength).toBeGreaterThan(10_000);
  expect(pageCount(pdf)).toBeGreaterThanOrEqual(2);
});

test('print CSS hides app shell and shows only the print layer', async ({ page }) => {
  // Simulate the real app body: #root present alongside the print layer
  const html =
    `<!DOCTYPE html><html><head><style>${CSS}</style></head>` +
    `<body>` +
    `<div id="root"><p>App content</p></div>` +
    `<div id="mini-diarium-print-layer">${makeDay('January 1, 2024', 'Entry', 3)}</div>` +
    `</body></html>`;

  await page.setContent(html);
  // page.pdf() activates @media print automatically
  const pdf = Buffer.from(await page.pdf({ format: 'A4' }));

  // PDF must be valid
  expect(pdf.toString('ascii', 0, 4)).toBe('%PDF');
  expect(pdf.byteLength).toBeGreaterThan(5_000);

  // Verify CSS isolation via print-media emulation
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#root')).toBeHidden();
  await expect(page.locator('#mini-diarium-print-layer')).toBeVisible();
});

test('both images in a multi-image entry are visible in print mode', async ({ page }) => {
  const EDITOR_CSS = readFileSync(resolve(process.cwd(), 'src/styles/editor.css'), 'utf-8');
  // Replicates the inline <style> block in index.html that constrains the app shell
  const INDEX_HTML_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  #root { width: 100%; height: 100%; position: relative; }
`;

  // Generate large SVG images (1000×1400 each) so two of them push content height well
  // past one A4 page — necessary to expose any overflow/height clipping in print layout.
  const makeImgSrc = (fill: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400"><rect width="1000" height="1400" fill="${fill}"/></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  };

  const img1Src = makeImgSrc('#e74c3c');
  const img2Src = makeImgSrc('#2ecc71');

  // TipTap AlignableImage HTML format as produced by the backend resolve step
  const entryContent =
    `<p>Text before first image.</p>` +
    `<figure class="image-container" style="text-align: left;"><img src="${img1Src}" alt="image one"></figure>` +
    `<p>Text between images.</p>` +
    `<figure class="image-container" style="text-align: right;"><img src="${img2Src}" alt="image two"></figure>` +
    `<p>Text after second image.</p>`;

  // Full cascade: index.html inline reset + editor.css + index.css, plus app-shell
  // structure, to faithfully reproduce what the real app renders during window.print().
  const html =
    `<!DOCTYPE html><html><head>` +
    `<style>${INDEX_HTML_STYLES}</style>` +
    `<style>${EDITOR_CSS}</style>` +
    `<style>${CSS}</style>` +
    `</head>` +
    `<body>` +
    `<div id="root"><p>App content</p></div>` +
    `<div id="mini-diarium-print-layer">` +
    `<div class="md-print-day">` +
    `<div class="md-print-day-date">January 1, 2024</div>` +
    `<div class="md-print-entry">` +
    `<div class="md-print-entry-title">Multi-Image Entry</div>` +
    `<div class="md-print-entry-content">${entryContent}</div>` +
    `</div></div>` +
    `</div>` +
    `</body></html>`;

  await page.setContent(html);
  await page.emulateMedia({ media: 'print' });

  const imgs = page.locator('.md-print-entry-content img');
  await expect(imgs).toHaveCount(2);

  const box1 = await imgs.nth(0).boundingBox();
  const box2 = await imgs.nth(1).boundingBox();

  expect(box1, 'first image must have a bounding box').not.toBeNull();
  expect(box2, 'second image must have a bounding box').not.toBeNull();
  expect(box1!.height, 'first image must have non-zero height').toBeGreaterThan(0);
  expect(box2!.height, 'second image must have non-zero height').toBeGreaterThan(0);
  // Second image must be below the first — proves both are laid out at distinct positions
  expect(box2!.y, 'second image must be below the first').toBeGreaterThan(
    box1!.y + box1!.height / 2,
  );
});
