#!/usr/bin/env node
/**
 * Checks that no component sets a user-visible error signal directly from a raw Tauri error.
 * All Tauri errors must go through mapTauriError() from src/lib/errors.ts first.
 *
 * Run: node scripts/check-ui-error-sanitization.js
 * Exit 0 = clean. Exit 1 = violations found.
 *
 * Patterns flagged:
 *   setError(String(err))         — raw error coercion
 *   setError(err.message)         — raw .message access
 *   set<X>Error(String(err))      — same patterns on named error setters
 *   set<X>Error(err.message)
 */

import { execSync } from 'child_process';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

const PATTERNS = [
  'setError\\(String\\(err',
  'setError\\(err\\.message',
  'set[A-Z][a-zA-Z]*Error\\(String\\(err',
  'set[A-Z][a-zA-Z]*Error\\(err\\.message',
];

let violations = 0;

for (const pattern of PATTERNS) {
  let output;
  try {
    output = execSync(`rg --color never -n "${pattern}" src/`, {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
    });
  } catch {
    // rg exits 1 when no matches — that's the desired outcome
    output = '';
  }

  const lines = output.trim().split('\n').filter(Boolean);
  if (lines.length > 0) {
    for (const line of lines) {
      console.error(`${COLORS.red}[ui-error-sanitization] ${line}${COLORS.reset}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(
    `\n${COLORS.red}✗ ${violations} raw UI error display pattern(s) found.${COLORS.reset}`,
  );
  console.error(
    `${COLORS.cyan}  Wrap the error with mapTauriError(err, t) from src/lib/errors.ts before calling set*Error.${COLORS.reset}\n`,
  );
  process.exit(1);
} else {
  console.log(`${COLORS.green}✓ No raw UI error display patterns found.${COLORS.reset}`);
  process.exit(0);
}
