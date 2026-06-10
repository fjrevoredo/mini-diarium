import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8');

function buildPage(fragment: string): string {
  return (
    `<!DOCTYPE html><html><head><style>${CSS}</style></head>` +
    `<body><div id="mini-diarium-print-layer">${fragment}</div></body></html>`
  );
}

function makeDay(date: string, title: string, lines: number): string {
  const content = Array(lines).fill('<p>Line of text for this entry.</p>').join('');
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
