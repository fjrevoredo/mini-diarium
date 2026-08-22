# Post-Task Completion Best Practices

The single source of truth for what every coding task must verify before being reported as complete. Applies to features, fixes, refactors, and chores.

Run this checklist after every task. Present the result using the [summary template](#summary-template) at the bottom of this file.

## The Checklist

Six checks. Each item names the canonical owner for its detailed steps; this file does not duplicate them.

### 1. Assess task scope

Identify what kind of change this task made. The scope decides which checks below are mandatory and which test suites to run. State the scope in the summary.

| Scope | Mandatory |
|-------|-----------|
| **Frontend-only** (`src/**/*.{ts,tsx,css}`) | type-check, `test:run`, lint, Prettier |
| **Backend-only** (`src-tauri/**/*.rs`) | `cargo test`, clippy, `cargo fmt` |
| **Full-stack** (both layers) | All frontend + backend checks |
| **Dependency update** (`package.json`, `Cargo.toml`, lockfiles) | Full test suite + type-check + lint |
| **CI/build config** (`.github/`, `vite.config.ts`, `tauri.conf.json`) | Run the affected pipeline once (CI workflow or `bun run build`) |
| **Docs-only** (`*.md`, `docs/`, `CLAUDE.md`) | Proofread; verify any new links resolve |
| **Refactor** (no behavior change) | All tests still pass |

Anything not listed as Mandatory for your scope can be skipped. If the task crossed scopes (e.g. backend Rust change plus a CI workflow tweak), take the union of mandatory checks from each row.

**E2E rule**: `cmd.exe /c bun run test:e2e:local` is slow (builds binary + runs full WebdriverIO suite). Run it locally when ANY of these apply:
- Scope is full-stack or dependency update
- Change touches cross-layer user flows: auth, entry save/load, search, import/export
- Change touches window/viewport code
- Change uses `#[cfg(windows)]` or `#[cfg(target_os = "macos")]` (CI E2E runs Linux/WebKitGTK only — see [e2e/CLAUDE.md](../../e2e/CLAUDE.md))

Otherwise, CI will run E2E on the PR; a green local E2E run is not required to report the task done.

### 2. Close the originating TODO (if any)

If the task came from a TODO entry in `docs/todo/TODO.md`, mark its top-level checkbox as `[x]` and archive it using the `todo-manager` skill. Never assign TODO IDs by hand.

- **Owner**: [`.agents/skills/todo-manager/SKILL.md`](../../.agents/skills/todo-manager/SKILL.md) — format rules and archive workflow.
- **Skip condition**: task did not originate from a TODO entry (ad-hoc fix). Say so explicitly in the summary.

### 3. Add a CHANGELOG entry (if user-visible)

Add a bullet under `## [Unreleased]` (the current unreleased version block) in [`CHANGELOG.md`](../../CHANGELOG.md), under the correct sub-section:

| Section | Use for |
|---------|---------|
| `### Added` | New user-visible feature |
| `### Fixed` | Bug fix the user would notice |
| `### Changed` | Changed behavior |
| `### Removed` | Removed feature or behavior |
| `### Internal` | Internal-only change with no user impact (tests, refactors, build, CI) |
| `### Security` | Security-relevant change |

Entry style: `- **Bold title** (TODO-XXXX): one-paragraph description.` Cross-link the GitHub issue/PR when relevant.

Selection and consolidation rules:

- **Apply the audience test before picking a section.** A published section (`Added` / `Fixed` / `Changed` / `Removed`) is for content a user of the released app would act on. If only developers care, use `Internal`. Most changelog consumers do not publish `Internal`, so that is where developer-facing material belongs.
- **Pre-release findings are not standalone `Fixed` entries.** A defect found and fixed inside the current unreleased cycle never reached a released build. Fold it into the feature's own entry or an `Internal` hardening point that cites the review, keeping milestone or finding tags as compact suffixes.
- **One subsystem, one point.** Related entries about the same subsystem merge into a single bold-titled point with sub-bullets. A shared explanation (root cause, mechanism) is written once, not repeated per bullet. Every fact survives: inline, or via a pointer to its durable record (archived plan, RCA doc, gotcha list).
- **Same audience test for `Security`.** A security-labeled change with no user-facing surface (for example a dev-only script flagged by a scanner) goes under `Internal` with the finding ID cited.
- **Prose follows the style guide.** Changelog text obeys [Writing Style Guide](WRITING_STYLE.md): no em dashes as sentence connectors, active voice, varied sentence length, concrete wording.

- **Owner**: [`CHANGELOG.md`](../../CHANGELOG.md) — the template block at the top shows the exact format. The `pre-release` runbook owns the date-stamping workflow at release time.
- **Skip condition**: change is truly trivial (typo, formatting-only). Say so explicitly with a reason. If it shipped, it gets an entry.

### 4. Verify tests and lints pass

Run the test suites, type checker, and linters you identified as mandatory in step 1.

The comprehensive path is `bun run pre-commit` (~40-60 s), which runs type-check, ESLint, Prettier, locale validation, UI-error sanitization, frontend tests with coverage, backend tests with coverage, clippy, rustfmt, and the patch-coverage gate in one command — and generates the lcov files the coverage gate consumes.

Or run individual checks for faster iteration:

```bash
# Frontend
cmd.exe /c bun run type-check
cmd.exe /c bun run lint
cmd.exe /c bun run test:run

# Backend (workspace: app crate + mini-diarium-core; --workspace is required so
# the core crate's tests actually run)
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

If a previously-passing test now fails for an unrelated reason, surface it — do not silently disable it.

- **Owner**: `package.json` `scripts` section for the canonical script names. [`scripts/pre-commit.js`](../../scripts/pre-commit.js) orchestrates the comprehensive local gate. Domain-specific extensions (E2E modes, benchmarks, frontend coverage workflow) live in each domain `CLAUDE.md`.
- **Coverage gate** (recommended before push): `cmd.exe /c bun run coverage:diff` mirrors the Codecov patch check. See [CI Best Practices → Coverage Gating](CI_BEST_PRACTICES.md#coverage-gating).

### 5. Verify formatting is clean

Two layers, both must pass:

- **Frontend** — Prettier: `cmd.exe /c bun run format:check` (auto-fix with `bun run format`).
- **Backend** — rustfmt: `cargo fmt --all --check` (formats every workspace member; auto-fix by dropping `--check`).

The `.githooks/pre-commit` hook auto-formats **staged files only** on every `commit`. It is intentionally fast and scoped; it is not the full quality gate. For a full-tree sweep after a refactor, run the two commands above without `--check`.

- **Owner**: [`.githooks/pre-commit`](../../.githooks/pre-commit) (the hook itself) and `package.json` (`format` / `format:check` scripts).

### 6. Report using the summary template

Present the result to the user using the [summary template](#summary-template) below. Copy it verbatim and fill the placeholders. Do not paraphrase the headers.

## Summary Template

Copy this block verbatim and fill the placeholders. Omit no field; if a check does not apply, write `n/a` with a one-line reason.

````
---
**Task complete:** <one-line description>

- **Scope**: <frontend-only | backend-only | full-stack | dependency-update | CI/build | docs-only | refactor>
- **TODO**: <TODO-XXXX marked done + archived, or `n/a — not from a todo`>
- **Changelog**: <`Section` entry added under `[X.Y.Z] - Unreleased`, or `n/a — <reason>`>
- **Tests**: <for each suite identified as mandatory in step 1: `cmd` ✓ (N passed); for skipped suites: `n/a — <reason>`>
- **Format**: <`pre-commit hook ran on staged files` | `format + cargo fmt clean (full sweep)` | `n/a — docs-only`>
- **Files**: <comma-separated list of files touched>
---
````

## What This Checklist Does Not Cover

- **Releasing** — `pre-release` runbook + [`docs/RELEASING.md`](../RELEASING.md), runs at release time, not per-task.
- **Opening a PR** — [`.github/pull_request_template.md`](../../.github/pull_request_template.md) is the pre-merge gate; this doc is the pre-report gate.
- **Domain-specific review rules** — see [Rust](RUST_BEST_PRACTICES.md), [Tauri](TAURI_BEST_PRACTICES.md), [Frontend](FRONTEND_BEST_PRACTICES.md), [CI](CI_BEST_PRACTICES.md) best practices when changing that layer.
- **Plan creation and step-by-step procedures** — those belong in skills (`manual-planning`, `todo-manager`, `runbooks`).
