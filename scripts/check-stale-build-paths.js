#!/usr/bin/env node
/**
 * Checks that no active document points at the pre-workspace build output location.
 *
 * The backend became a Cargo workspace in open-core M1 (TODO-0076): `target/` now lives at
 * the repo root, so `src-tauri/target/release/...` no longer exists after a normal build.
 * Following such an instruction silently fails to find the artifacts.
 *
 * Run: node scripts/check-stale-build-paths.js
 * Exit 0 = clean. Exit 1 = violations found (or the scan itself could not run).
 *
 * The pattern is deliberately narrow — only `src-tauri/target/release`:
 *   - CHANGELOG's historical "`src-tauri/target/` → repo-root `target/`" note is legitimate;
 *   - `src-tauri/Cargo.lock` must NOT be guarded — the dependency runbook correctly tells
 *     readers that path is dead.
 * Historical records under docs/reports/ and any archive/ directory are exempt.
 *
 * Scanning is done over `git ls-files` in pure Node rather than with `rg`: ripgrep is not
 * installed on every machine that runs `bun run pre-commit`, and a guard that silently
 * exits 0 when its scanner is missing is not a guard. `git ls-files` also gives exactly the
 * intended corpus (tracked files only, dot-directories like `.claude/` included, generated
 * and ignored output excluded).
 */

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

const PATTERN = 'src-tauri/target/release';

/** Paths exempt from the guard. */
const isExempt = (file) =>
  file.startsWith('docs/reports/') || // historical reviews quote the stale path as evidence
  file.split('/').includes('archive') || // superseded plans/reviews
  file === 'scripts/check-stale-build-paths.js'; // this file

const repoRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

let tracked;
try {
  tracked = execFileSync('git', ['ls-files'], {
    encoding: 'utf8',
    cwd: repoRoot,
    maxBuffer: 32 * 1024 * 1024,
  });
} catch (err) {
  console.error(`${COLORS.red}[stale-build-path] could not list tracked files: ${err.message}${COLORS.reset}`);
  process.exit(1);
}

const violations = [];

for (const file of tracked.split('\n').filter(Boolean)) {
  if (isExempt(file)) continue;

  let content;
  try {
    content = readFileSync(join(repoRoot, file), 'utf8');
  } catch {
    continue; // binary, deleted, or unreadable — nothing to match
  }
  if (!content.includes(PATTERN)) continue;

  content.split('\n').forEach((line, i) => {
    if (line.includes(PATTERN)) violations.push(`${file}:${i + 1}:${line.trim()}`);
  });
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`${COLORS.red}[stale-build-path] ${violation}${COLORS.reset}`);
  }
  console.error(
    `\n${COLORS.red}✗ ${violations.length} stale pre-workspace build path(s) found.${COLORS.reset}`,
  );
  console.error(
    `${COLORS.cyan}  The Cargo workspace root owns target/ — use "target/release/..." instead.${COLORS.reset}\n`,
  );
  process.exit(1);
} else {
  console.log(`${COLORS.green}✓ No stale pre-workspace build paths found.${COLORS.reset}`);
  process.exit(0);
}
