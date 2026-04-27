/**
 * sync-languages.ts — rewrites the supported-language list in README.md and
 * website/index.html based on AVAILABLE_LOCALES from src/i18n/locales/index.ts.
 *
 * Usage:
 *   npx tsx scripts/sync-languages.ts
 *   bun run sync-languages
 *
 * Exit codes:
 *   0 — all marker regions found and files updated (or already up to date)
 *   1 — one or more marker regions missing (CI-safe)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load AVAILABLE_LOCALES ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localesModule: any;
try {
  localesModule = await import('../src/i18n/locales/index.js');
} catch {
  // tsx resolves .ts directly; the .js extension is required for Node ESM resolution
  localesModule = await import('../src/i18n/locales/index.ts');
}

interface LocaleInfo {
  code: string;
  name: string;
  nativeName: string;
}

const locales: LocaleInfo[] = localesModule.AVAILABLE_LOCALES;

// ─── Marker constants ────────────────────────────────────────────────────────

const START = '<!-- supported-languages-start -->';
const END = '<!-- supported-languages-end -->';

// ─── Region rewriter ─────────────────────────────────────────────────────────

function rewriteRegion(
  content: string,
  newBlock: string,
): { result: string; found: boolean } {
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);

  if (startIdx === -1 || endIdx === -1) {
    return { result: content, found: false };
  }

  // Slice from the start of the END marker's line so its leading indentation is preserved
  const lineStart = content.lastIndexOf('\n', endIdx) + 1;
  const before = content.slice(0, startIdx + START.length);
  const after = content.slice(lineStart);
  return { result: before + '\n' + newBlock + '\n' + after, found: true };
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatMarkdown(items: LocaleInfo[]): string {
  return items
    .map((l) =>
      l.name === l.nativeName ? `- ${l.name}` : `- ${l.name} (${l.nativeName})`,
    )
    .join('\n');
}

function formatHtml(items: LocaleInfo[]): string {
  const list = items
    .map((l) => (l.name === l.nativeName ? l.name : `${l.name} (${l.nativeName})`))
    .join(', ');
  return `      <p class="section-body">Available in: ${list}.</p>`;
}

// ─── Update files ────────────────────────────────────────────────────────────

let hasErrors = false;

function updateFile(
  filePath: string,
  newBlock: string,
  label: string,
): void {
  const content = readFileSync(filePath, 'utf-8');
  const { result, found } = rewriteRegion(content, newBlock);

  if (!found) {
    console.error(
      `sync-languages: [${label}] ERROR — markers not found. Add ${START} / ${END} to the file.`,
    );
    hasErrors = true;
    return;
  }

  if (result === content) {
    console.log(`sync-languages: [${label}] already up to date.`);
    return;
  }

  writeFileSync(filePath, result, 'utf-8');
  console.log(`sync-languages: [${label}] updated.`);
}

updateFile(
  resolve(__dirname, '../README.md'),
  formatMarkdown(locales),
  'README.md',
);

updateFile(
  resolve(__dirname, '../website/index.html'),
  formatHtml(locales),
  'website/index.html',
);

process.exit(hasErrors ? 1 : 0);
