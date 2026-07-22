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

  // 4. UI error sanitization guard
  header('UI Error Sanitization');
  const uiErrors = run('bun run check:ui-errors', 'Checking raw error display patterns');
  if (uiErrors.success) {
    success('No raw UI error display patterns');
    results.passed.push('UI Error Sanitization');
  } else {
    error('Raw UI error display patterns found (wrap with mapTauriError)');
    results.failed.push('UI Error Sanitization');
  }

  // 4b. Stale pre-workspace build path guard
  header('Stale Build Paths');
  const buildPaths = run('bun run check:build-paths', 'Checking pre-workspace target/ paths');
  if (buildPaths.success) {
    success('No stale pre-workspace build paths');
    results.passed.push('Stale Build Paths');
  } else {
    error('Stale pre-workspace build paths found (the workspace root owns target/)');
    results.failed.push('Stale Build Paths');
  }

  // 4c. Donation address drift guard
  header('Donation Addresses');
  const donationAddresses = run(
    'bun run check:donation-addresses',
    'Checking published crypto addresses',
  );
  if (donationAddresses.success) {
    success('Donation addresses are valid and consistent');
    results.passed.push('Donation Addresses');
  } else {
    error('Donation address drift or invalid checksum (crypto sent to a wrong address is lost)');
    results.failed.push('Donation Addresses');
  }

  // 5. Frontend Tests (with coverage)
  header('Frontend Tests');
  const frontendTest = run('bun run test:coverage', 'Running tests with coverage');
  if (frontendTest.success) {
    success('All frontend tests passed');
    results.passed.push('Frontend Tests');
  } else {
    error('Frontend tests failed');
    results.failed.push('Frontend Tests');
  }

  // 6. Backend Tests (Rust) — with coverage when cargo-llvm-cov is available
  header('Backend Tests (Rust)');
  const cargoPath = 'src-tauri';
  if (existsSync(cargoPath)) {
    const hasCov = run('cargo llvm-cov --version', 'Checking cargo-llvm-cov', { silent: true });
    if (hasCov.success) {
      const backendCov = run(
        // --workspace covers the mini-diarium-core crate too; lcov lands at src-tauri/lcov.info.
        'cargo llvm-cov nextest --workspace --lcov --output-path lcov.info',
        'Running Rust tests with coverage',
        { cwd: cargoPath },
      );
      if (backendCov.success) {
        success('All backend tests passed (coverage written)');
        results.passed.push('Backend Tests');
      } else {
        error('Backend tests failed');
        results.failed.push('Backend Tests');
      }
    } else {
      warning('cargo-llvm-cov not installed — running plain cargo test (backend coverage skipped)');
      results.warnings.push('Backend coverage skipped (install cargo-llvm-cov for patch gating)');
      const backendTest = run('cargo test --workspace --quiet', 'Running Rust tests', { cwd: cargoPath });
      if (backendTest.success) {
        success('All backend tests passed');
        results.passed.push('Backend Tests');
      } else {
        error('Backend tests failed');
        results.failed.push('Backend Tests');
      }
    }
  } else {
    warning('Backend directory not found, skipping');
    results.warnings.push('Backend tests skipped');
  }

  // 7. Rust Clippy
  if (existsSync(cargoPath)) {
    header('Rust Clippy');
    const clippy = run('cargo clippy --workspace --all-targets --quiet -- -D warnings', 'Running clippy', { cwd: cargoPath });
    if (clippy.success) {
      success('No clippy warnings');
      results.passed.push('Rust Clippy');
    } else {
      error('Clippy warnings found');
      results.failed.push('Rust Clippy');
    }
  }

  // 8. Rust Format Check
  if (existsSync(cargoPath)) {
    header('Rust Format Check');
    const rustfmt = run('cargo fmt --all --check', 'Checking Rust formatting', { cwd: cargoPath });
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

  // 9. Patch Coverage (local Codecov mirror — fails if <80% of new/changed lines)
  header('Patch Coverage (Codecov mirror)');
  const hasFrontendCov = existsSync('coverage/lcov.info');
  const hasBackendCov = existsSync('src-tauri/lcov.info');
  if (!hasFrontendCov && !hasBackendCov) {
    warning('No lcov files found — skipping patch coverage gate');
    results.warnings.push('Patch coverage skipped (no lcov)');
  } else {
    const gate = run('node scripts/check-diff-coverage.mjs --working-tree', 'Diff coverage >= 80%');
    if (gate.success) {
      success('Patch coverage meets 80% threshold');
      results.passed.push('Patch Coverage');
    } else {
      error('Patch coverage below 80% — add tests for the uncovered new lines listed above');
      results.failed.push('Patch Coverage');
    }
  }

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
