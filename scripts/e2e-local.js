#!/usr/bin/env node
/**
 * Run E2E tests locally.
 *
 * Builds the Tauri release binary (which embeds the frontend) then launches
 * the WebdriverIO suite. Skips the build step when --skip-build is passed so
 * subsequent runs are fast when only test code changed.
 *
 * Usage:
 *   bun run test:e2e:local              # build + test
 *   bun run test:e2e:local --skip-build # test only (binary already built)
 */

import { execSync } from 'child_process';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function run(command, description) {
  log(`\n→ ${description}`, 'cyan');
  try {
    execSync(command, { stdio: 'inherit' });
  } catch {
    log(`\n✖ Failed: ${description}`, 'red');
    process.exit(1);
  }
}

const skipBuild = process.argv.includes('--skip-build');

log('\n╔══════════════════════════════╗', 'bold');
log('║   Mini Diarium — E2E Local   ║', 'bold');
log('╚══════════════════════════════╝\n', 'bold');

if (skipBuild) {
  log('Skipping build (--skip-build)', 'yellow');
} else {
  run('bun run tauri build', 'Building Tauri release binary (embeds frontend)');
}

run('bun run test:e2e', 'Running E2E suite');

log('\n✔ E2E tests passed\n', 'green');
