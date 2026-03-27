/**
 * validate-locales.ts — CI: check that every future locale JSON file in
 * src/i18n/locales/ has all the same keys as the canonical en.ts source.
 *
 * Usage:
 *   npx tsx scripts/validate-locales.ts
 *   bun run validate:locales
 *
 * Exit codes:
 *   0 — all locale files are complete (or only en.ts exists — nothing to validate)
 *   1 — one or more locale files have missing or extra keys
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(__dirname, '../src/i18n/locales');

// ─── Load canonical English keys ────────────────────────────────────────────

/**
 * Flatten a nested object into dot-notation keys.
 * Only string leaf values are included (same as flatten() from @solid-primitives/i18n).
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      keys.push(...flattenKeys(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

// Dynamic import of en.ts via require (tsx handles TypeScript)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let enModule: any;
try {
  enModule = await import('../src/i18n/locales/en.js');
} catch {
  // tsx resolves .ts directly; the .js extension is required for Node ESM resolution
  enModule = await import('../src/i18n/locales/en.ts');
}

const enDict = enModule.default as Record<string, unknown>;
const canonicalKeys = new Set(flattenKeys(enDict));

// ─── Find JSON locale files ──────────────────────────────────────────────────

const files = readdirSync(localesDir).filter(
  (f) => f.endsWith('.json') && f !== 'en.json',
);

if (files.length === 0) {
  console.log('validate-locales: no additional locale files found — nothing to validate.');
  process.exit(0);
}

// ─── Validate each locale file ───────────────────────────────────────────────

let hasErrors = false;

for (const file of files) {
  const path = resolve(localesDir, file);
  let locale: Record<string, unknown>;
  try {
    locale = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
  } catch (err) {
    console.error(`validate-locales: [${file}] Failed to parse JSON: ${String(err)}`);
    hasErrors = true;
    continue;
  }

  const localeKeys = new Set(flattenKeys(locale));

  const missing = [...canonicalKeys].filter((k) => !localeKeys.has(k));
  const extra = [...localeKeys].filter((k) => !canonicalKeys.has(k));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`validate-locales: [${file}] OK (${localeKeys.size} keys)`);
    continue;
  }

  hasErrors = true;
  if (missing.length > 0) {
    console.error(`validate-locales: [${file}] MISSING keys (${missing.length}):`);
    missing.forEach((k) => console.error(`  - ${k}`));
  }
  if (extra.length > 0) {
    console.warn(`validate-locales: [${file}] EXTRA keys not in en.ts (${extra.length}):`);
    extra.forEach((k) => console.warn(`  + ${k}`));
  }
}

process.exit(hasErrors ? 1 : 0);
