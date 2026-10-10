# Pre-commit Scripts

Automated code quality checks for Mini Diarium.

The full task-completion checklist (tests, formatting, CHANGELOG, TODO closure, summary template) lives in [`docs/best-practices/POST_TASK_BEST_PRACTICES.md`](../docs/best-practices/POST_TASK_BEST_PRACTICES.md). The scripts below are the mechanics that checklist relies on.

## Available Scripts

| Script | Purpose | Duration |
|--------|---------|----------|
| `bun run check` | Type-check + ESLint + Prettier + locale validation + repo guards (no tests) | ~5-10 s |
| `bun run pre-commit` | The above + frontend tests + script tests + backend tests + clippy + rustfmt + patch-coverage gate | ~40-60 s |
| `bun run test:scripts` | `node:test` suites for the build-tooling scripts (`scripts/*.test.{js,mjs,cjs}`) | ~1 s |
| `bun run check:test-runners` | Fails when a tracked `*.test.*` / `*.spec.*` file is outside every runner below | <1 s |

Use `bun run check` for fast feedback during development; use `bun run pre-commit` before pushing.

## Test Runners

Every test file must belong to a runner that a gate executes (rule: [CI Best Practices → Test Runner Ownership](../docs/best-practices/CI_BEST_PRACTICES.md#test-runner-ownership)). `scripts/check-test-runners.mjs` enforces this mapping in `bun run check`, `bun run pre-commit`, and the CI `lint` job:

| Files | Runner | Gate |
|-------|--------|------|
| `*.{test,spec}.*` outside `e2e/`, `tests/`, `scripts/` (mostly `src/**`) | Vitest (`bun run test:coverage`) | `pre-commit`, CI `test` job |
| `scripts/*.test.{js,mjs,cjs}` (top level only, plain JS) | `node:test` (`bun run test:scripts`) | `pre-commit`, CI `test` job |
| `tests/print/**` | Playwright (`bun run test:print`) | CI `test` job |
| `e2e/specs/**/*.spec.ts`, no hidden (`.`-prefixed) file or folder | WebdriverIO (`bun run test:e2e`) | CI `e2e` job |

Script tests use `node:test` + `node:assert/strict`, not Vitest: Vitest and coverage exclude `scripts/**`, so these suites have no effect on the Codecov patch gate. When you change a runner's include or exclude list, change the matching rule in `scripts/check-test-runners.mjs` in the same commit; the guard parses the configs and fails when the two disagree.

## Local Git Hook (auto-installed)

`scripts/install-hooks.js` runs as the `postinstall` step of `bun install` and sets `core.hooksPath` to `.githooks/`. This activates `.githooks/pre-commit`, which on every commit:

- Runs `bunx prettier --write` on staged `src/**/*.{ts,tsx,css}` files, then re-stages them.
- Runs `cargo fmt` in `src-tauri/` when any `src-tauri/**/*.rs` file is staged, then re-stages them.
- Skips silently when no relevant files are staged.
- Skips Rust formatting with a warning if `cargo` is not in `PATH`.

The hook is intentionally fast (formatting only, scoped to staged files). The full check suite (type-check, lint, locale validation, tests, clippy, patch coverage) lives in `bun run pre-commit` and is meant to run before pushing.

**Manual install** (escape hatch): `bun run hooks:install` (or `node scripts/install-hooks.js`).

**Bypass** for a single commit: `git commit --no-verify`.

**CI behavior**: GitHub Actions does not run the hook; `.github/workflows/ci.yml` already runs `bun run format:check` and `cargo fmt --check` on every push and PR.

**Reinstall**: run `bun install` again, or `git config core.hooksPath .githooks` manually.

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
