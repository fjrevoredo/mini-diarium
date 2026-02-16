# Pre-commit Scripts

Automated code quality checks for Mini Diarium.

## Available Scripts

### Quick Check (Fast)
```bash
bun run check
```

**Duration:** ~5-10 seconds
**Checks:**
- ✓ TypeScript type checking
- ✓ ESLint (no errors allowed, warnings OK)
- ✓ Prettier formatting

**Use when:** You want fast feedback during development before committing.

---

### Pre-commit (Complete)
```bash
bun run pre-commit
```

**Duration:** ~40-60 seconds
**Checks:**
- ✓ TypeScript type checking
- ✓ ESLint (no errors allowed, warnings OK)
- ✓ Prettier formatting
- ✓ Frontend tests (23 tests)
- ✓ Backend tests (160 Rust tests)
- ✓ Rust Clippy (with -D warnings)
- ✓ Rust formatting

**Use when:** Before committing to ensure everything works correctly.

---

## Quick Fix Commands

If checks fail, use these commands to auto-fix common issues:

```bash
# Fix ESLint errors
bun run lint:fix

# Fix Prettier formatting
bun run format

# Fix Rust formatting
cd src-tauri && cargo fmt

# Run tests in watch mode to debug failures
bun run test              # Frontend
cd src-tauri && cargo test  # Backend
```

## Exit Codes

- **0** - All checks passed
- **1** - One or more checks failed

## CI/CD Integration

These scripts are designed to be used in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run pre-commit checks
  run: bun run pre-commit
```

## Understanding the Output

### Success Example
```
🎉 All checks passed! Ready to commit.

✓ Passed (5):
  • TypeScript
  • ESLint
  • Prettier
  • Frontend Tests
  • Backend Tests
```

### Failure Example
```
❌ Some checks failed. Please fix the issues before committing.

✗ Failed (2):
  • ESLint
  • Frontend Tests

Quick fixes:
  • Run: bun run lint:fix
  • Run: bun run format
```

## Notes

- **ESLint warnings** are allowed and won't fail the build (only errors fail)
- **Tests** must all pass - no failures allowed
- **Formatting** must be consistent with Prettier config
- Scripts use colored output for better readability
