#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function header(message) {
  console.log();
  log(`━━━ ${message}`, 'bold');
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function run(command, description, options = {}) {
  const { cwd = process.cwd(), silent = false } = options;

  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit',
    });
    return { success: true, output };
  } catch (err) {
    return {
      success: false,
      output: err.stdout || err.stderr || err.message,
      error: err
    };
  }
}

const results = {
  passed: [],
  failed: [],
  warnings: [],
};

async function main() {
  log('🔍 Running pre-commit checks...', 'cyan');

  // 1. TypeScript type checking
  header('TypeScript Type Check');
  const typeCheck = run('bun run type-check', 'Type checking');
  if (typeCheck.success) {
    success('No type errors');
    results.passed.push('TypeScript');
  } else {
    error('Type errors found');
    results.failed.push('TypeScript');
  }

  // 2. ESLint
  header('ESLint');
  const lint = run('bun run lint', 'Linting');
  if (lint.success) {
    success('No linting errors');
    results.passed.push('ESLint');
  } else {
    error('Linting errors found');
    results.failed.push('ESLint');
  }

  // 3. Prettier
  header('Prettier Format Check');
  const format = run('bun run format:check', 'Format check');
  if (format.success) {
    success('All files properly formatted');
    results.passed.push('Prettier');
  } else {
    error('Formatting issues found (run: bun run format)');
    results.failed.push('Prettier');
  }

  // 4. Frontend Tests
  header('Frontend Tests');
  const frontendTest = run('bun run test:run', 'Running tests');
  if (frontendTest.success) {
    success('All frontend tests passed');
    results.passed.push('Frontend Tests');
  } else {
    error('Frontend tests failed');
    results.failed.push('Frontend Tests');
  }

  // 5. Backend Tests (Rust)
  header('Backend Tests (Rust)');
  const cargoPath = 'src-tauri';
  if (existsSync(cargoPath)) {
    const backendTest = run('cargo test --quiet', 'Running Rust tests', { cwd: cargoPath });
    if (backendTest.success) {
      success('All backend tests passed');
      results.passed.push('Backend Tests');
    } else {
      error('Backend tests failed');
      results.failed.push('Backend Tests');
    }
  } else {
    warning('Backend directory not found, skipping');
    results.warnings.push('Backend tests skipped');
  }

  // 6. Rust Clippy
  if (existsSync(cargoPath)) {
    header('Rust Clippy');
    const clippy = run('cargo clippy --lib --bins --quiet -- -D warnings', 'Running clippy', { cwd: cargoPath });
    if (clippy.success) {
      success('No clippy warnings');
      results.passed.push('Rust Clippy');
    } else {
      error('Clippy warnings found');
      results.failed.push('Rust Clippy');
    }
  }

  // 7. Rust Format Check
  if (existsSync(cargoPath)) {
    header('Rust Format Check');
    const rustfmt = run('cargo fmt --check', 'Checking Rust formatting', { cwd: cargoPath });
    if (rustfmt.success) {
      success('All Rust files properly formatted');
      results.passed.push('Rust Format');
    } else {
      error('Rust formatting issues found (run: cargo fmt)');
      results.failed.push('Rust Format');
    }
  }

  // 6. Build check (optional, can be slow)
  // Uncomment if you want to check if the build works
  // header('Build Check');
  // const build = run('bun run build', 'Building', { silent: true });
  // if (build.success) {
  //   success('Build successful');
  //   results.passed.push('Build');
  // } else {
  //   error('Build failed');
  //   results.failed.push('Build');
  // }

  // Summary
  console.log();
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bold');
  header('SUMMARY');

  if (results.passed.length > 0) {
    log(`\n✓ Passed (${results.passed.length}):`, 'green');
    results.passed.forEach(item => log(`  • ${item}`, 'green'));
  }

  if (results.failed.length > 0) {
    log(`\n✗ Failed (${results.failed.length}):`, 'red');
    results.failed.forEach(item => log(`  • ${item}`, 'red'));
  }

  if (results.warnings.length > 0) {
    log(`\n⚠ Warnings (${results.warnings.length}):`, 'yellow');
    results.warnings.forEach(item => log(`  • ${item}`, 'yellow'));
  }

  console.log();
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bold');

  if (results.failed.length === 0) {
    log('\n🎉 All checks passed! Ready to commit.', 'green');
    console.log();
    process.exit(0);
  } else {
    log('\n❌ Some checks failed. Please fix the issues before committing.', 'red');
    console.log();

    // Quick fix suggestions
    log('Quick fixes:', 'cyan');
    if (results.failed.includes('ESLint')) {
      log('  • Run: bun run lint:fix', 'cyan');
    }
    if (results.failed.includes('Prettier')) {
      log('  • Run: bun run format', 'cyan');
    }
    if (results.failed.includes('Rust Format')) {
      log('  • Run: cd src-tauri && cargo fmt', 'cyan');
    }
    console.log();

    process.exit(1);
  }
}

main().catch(err => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
