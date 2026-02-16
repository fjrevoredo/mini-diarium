# Plan: Tasks 54-57 — Production Launch Preparation

## Context

Mini Diarium is at 94% implementation (44/47 tasks). The app is feature-complete but has no CI/CD, no bundler configuration beyond defaults, no README, and no open-source community files. Tasks 54-57 prepare the project for public release by adding CI/CD, configuring platform builds, writing documentation, and creating community/open-source files.

**Current state:** No `.github/` directory, no README.md, no docs/, no CONTRIBUTING.md/SECURITY.md/CHANGELOG.md. LICENSE (MIT) exists. Icons are complete (16 files). Bundle config is minimal (`targets: "all"`). Version is 0.1.0.

## Implementation Order

1. **Task 55** — Configure Tauri bundler (modify 1 file)
2. **Task 54** — Set up CI/CD pipeline (create 1 file)
3. **Task 57** — Prepare open source release (create 7 files)
4. **Task 56** — Write end-user documentation (create 3 files)

Total: 11 files to create, 1 to modify.

---

## Task 55: Configure Tauri Bundler

### Modify: `src-tauri/tauri.conf.json`

Changes to the existing config:
- `productName`: `"mini-diarium"` → `"Mini Diarium"` (display name with space)
- Add `minWidth: 600`, `minHeight: 400` to window config
- `bundle.targets`: `"all"` → explicit list: `["dmg", "app", "msi", "nsis", "appimage", "deb"]`
- Add `bundle.copyright`: `"Copyright (c) 2026 Francisco J. Revoredo"`
- Add `bundle.category`: `"Productivity"`
- Add `bundle.shortDescription` and `bundle.longDescription`
- Add `bundle.licenseFile`: `"../LICENSE"`
- Add `bundle.macOS`: `{ "minimumSystemVersion": "10.15" }`
- Add `bundle.windows.nsis`: `{ "installMode": "currentUser" }` (no admin needed)
- Add `bundle.linux.deb.depends`: webkit2gtk and appindicator runtime deps
- Keep `security.csp: null` (changing it risks breaking TipTap/UnoCSS — tighten later)

---

## Task 54: Set up CI/CD Pipeline

### Create: `.github/workflows/ci.yml`

Single workflow with 3 jobs. Triggers on push to `master`/`initial-implementation` and PRs to `master`.

**Job 1: `lint`** (ubuntu-latest)
1. Checkout
2. Setup bun (`oven-sh/setup-bun@v2`)
3. Setup Rust stable with clippy + rustfmt (`dtolnay/rust-toolchain@stable`)
4. Cache bun + cargo deps
5. `bun install`
6. `bun run lint` + `bun run format:check` + `bun run type-check`
7. `cargo clippy --all-targets -- -D warnings` + `cargo fmt --check` (in src-tauri/)

**Job 2: `test`** (ubuntu-latest)
1. Checkout
2. Setup bun, Rust stable
3. Cache deps
4. Install Linux system deps (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`)
5. `bun install` + `bun run test:run`
6. `cd src-tauri && cargo test`

**Job 3: `build`** (matrix: ubuntu-latest, macos-latest, windows-latest; needs: [lint, test])
1. Checkout
2. Setup bun, Node 20, Rust stable
3. Cache deps
4. Install Linux deps (conditional on `runner.os == 'Linux'`)
5. `bun install`
6. Run `tauri-apps/tauri-action@v0` (builds frontend + backend)
   - Optional code signing via GitHub secrets (APPLE_CERTIFICATE, TAURI_SIGNING_PRIVATE_KEY, etc.)
   - No release creation — just build
7. Upload artifacts (`actions/upload-artifact@v4`)

**Concurrency:** Cancel in-progress runs for same branch.

---

## Task 57: Prepare Open Source Release

### Create 7 files:

**1. `CONTRIBUTING.md`**
- Prerequisites (Rust 1.75+, Bun 1.x, Tauri v2 system deps)
- Setup instructions (clone, install, dev)
- Development workflow (fork → branch → checks → PR)
- Full check list: lint, format, type-check, test:run, cargo test, clippy, cargo fmt
- Project structure overview (reference CLAUDE.md)
- Conventions summary (SolidJS, Rust, naming)
- Link to CODE_OF_CONDUCT.md and SECURITY.md

**2. `CODE_OF_CONDUCT.md`**
- Contributor Covenant v2.1 (standard boilerplate)
- Contact: project maintainer email

**3. `SECURITY.md`**
- Supported versions table (0.1.x)
- Vulnerability reporting process (email, NOT public issues)
- Response timeline (48h ack, 7d fix for critical)
- Security model summary (AES-256-GCM, Argon2id, no network)
- Known limitations (FTS plaintext index, memory during unlock)

**4. `CHANGELOG.md`**
- Keep a Changelog format + Semantic Versioning
- Single `[0.1.0]` entry with all implemented features under `### Added`

**5. `.github/ISSUE_TEMPLATE/bug_report.md`**
- YAML frontmatter (name, labels: bug)
- Sections: Describe, Steps to Reproduce, Expected/Actual, Environment, Context

**6. `.github/ISSUE_TEMPLATE/feature_request.md`**
- YAML frontmatter (name, labels: enhancement)
- Sections: Problem, Proposed Solution, Alternatives, Context

**7. `.github/dependabot.yml`**
- npm ecosystem (weekly, Monday, limit 10)
- cargo ecosystem in /src-tauri (weekly, Monday, limit 10)
- github-actions ecosystem (weekly, Monday, limit 5)
- Dependency grouping (dev vs prod for npm, minor+patch for cargo)

*Note: PR template (`.github/pull_request_template.md`) also created here — total 8 files.*

**8. `.github/pull_request_template.md`**
- Summary, Changes list, Testing checklist, Related Issues

---

## Task 56: Write End-User Documentation

### Create 3 files:

**1. `README.md`**
- Project tagline: "An encrypted, local-first desktop journaling app"
- Overview (2-3 sentences: what, privacy-first, cross-platform)
- Features list (encryption, rich text, search, calendar, import 4 formats, export 2 formats, themes, backups, stats, preferences, shortcuts)
- Installation (Windows MSI/EXE, macOS DMG, Linux AppImage/DEB)
- Quick Start (5 steps: launch → password → write → navigate → lock)
- Keyboard Shortcuts table (from menu.rs)
- Building from Source (prerequisites + commands)
- Tech Stack (Tauri 2.x, SolidJS, Rust, SQLite, TipTap, UnoCSS)
- Contributing (link to CONTRIBUTING.md)
- License (MIT, link to LICENSE)
- Security (link to SECURITY.md)

**2. `docs/USER_GUIDE.md`**
- Getting Started (first launch, password, lock/unlock concept, no recovery)
- Writing Entries (editor, titles, auto-save, empty deletion)
- Navigating (calendar, shortcuts, Go to Date, Go to Today)
- Searching (sidebar FTS, result navigation)
- Import (4 formats, merge behavior, preparation)
- Export (JSON + Markdown, round-trip compatibility)
- Preferences (theme, first day, future entries, hide titles, spellcheck, password change, reset)
- Statistics (metrics explained)
- Backups (automatic, location, rotation)
- FAQ (forgot password, data location, no network, sync, Mini Diary migration)

**3. `docs/PRIVACY.md`**
- Data Collection: none
- Network Access: none (no telemetry, analytics, updates)
- Data Storage: AES-256-GCM, local SQLite, localStorage for prefs, backup dir
- Password: Argon2id hash only, no recovery
- Third Parties: none
- Open Source: link to repo

---

## Verification

After all 4 tasks:

```bash
# Verify bundler config is valid JSON
cd src-tauri && cargo tauri info

# Verify CI workflow syntax (requires act or push to GitHub)
# Alternatively: validate YAML structure manually

# Verify all tests still pass (nothing should change functionally)
cd src-tauri && cargo test
bun run test:run
bun run type-check
bun run lint

# Verify build succeeds with new bundler config
bun run tauri build
```

After pushing to GitHub: verify CI workflow runs successfully on all 3 platforms.
