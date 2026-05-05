#!/usr/bin/env node

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
  try {
    execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    return { success: true };
  } catch (err) {
    return { success: false, output: err.stdout || err.stderr };
  }
}

const results = { passed: [], failed: [] };

log('⚡ Running quick checks (no tests)...', 'cyan');
console.log();

// Type check
process.stdout.write('TypeScript... ');
const typeCheck = run('bun run type-check');
if (typeCheck.success) {
  log('✓', 'green');
  results.passed.push('TypeScript');
} else {
  log('✗', 'red');
  results.failed.push('TypeScript');
}

// ESLint
process.stdout.write('ESLint... ');
const lint = run('bun run lint');
if (lint.success) {
  log('✓', 'green');
  results.passed.push('ESLint');
} else {
  log('✗', 'red');
  results.failed.push('ESLint');
}

// Prettier
process.stdout.write('Prettier... ');
const format = run('bun run format:check');
if (format.success) {
  log('✓', 'green');
  results.passed.push('Prettier');
} else {
  log('✗', 'red');
  results.failed.push('Prettier');
}

// Validate locales
process.stdout.write('Locales... ');
const locales = run('bun run validate:locales');
if (locales.success) {
  log('✓', 'green');
  results.passed.push('Locales');
} else {
  log('✗', 'red');
  results.failed.push('Locales');
}

// Summary
console.log();
if (results.failed.length === 0) {
  log('🎉 All checks passed!', 'green');
  log('Run "bun run pre-commit" for full checks including tests.', 'cyan');
} else {
  log(`❌ ${results.failed.length} check(s) failed: ${results.failed.join(', ')}`, 'red');
  if (results.failed.includes('ESLint')) log('  Fix: bun run lint:fix', 'yellow');
  if (results.failed.includes('Prettier')) log('  Fix: bun run format', 'yellow');
  if (results.failed.includes('Locales')) log('  Fix: add missing keys to src/i18n/locales/*.json', 'yellow');
  process.exit(1);
}
