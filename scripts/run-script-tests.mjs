#!/usr/bin/env node
/**
 * Runs every `node:test` suite for the build-tooling scripts (`bun run test:scripts`).
 *
 * Discovery: every file directly inside `scripts/` whose name ends in `.test.js`,
 * `.test.mjs`, or `.test.cjs`. The files are passed to `node --test` as an explicit list
 * because a directory or glob argument to `node --test` behaves differently across Node
 * versions (Node 20 recurses into a directory; Node 22+ treats arguments as globs), and
 * shells on Windows do not expand globs.
 *
 * Vitest excludes `scripts/**`, so this runner is the only gate for these files.
 * `scripts/check-test-runners.mjs` uses SCRIPT_TEST_FILE to prove that no test file is
 * outside every runner.
 *
 * Run: node scripts/run-script-tests.mjs
 * Exit 0 = all suites pass. Exit 1 = a suite failed, or no suite was found.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** File names (no directory part) that this runner executes. */
export const SCRIPT_TEST_FILE = /^[^/\\]+\.test\.[cm]?js$/;

const scriptsDir = dirname(fileURLToPath(import.meta.url));

/** Returns the sorted paths of the suites this runner executes. */
export function discoverScriptTests(dir = scriptsDir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && SCRIPT_TEST_FILE.test(entry.name))
    .map((entry) => join(dir, entry.name))
    .sort();
}

function main() {
  const files = discoverScriptTests();
  if (files.length === 0) {
    console.error('[test:scripts] no scripts/*.test.{js,mjs,cjs} files found');
    process.exit(1);
  }

  const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
  if (result.error) {
    console.error(`[test:scripts] could not start node --test: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
