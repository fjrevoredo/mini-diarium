# TODO Extra Detail

Implementation detail and structured notes for specific TODO items in [`TODO.md`](TODO.md). Each section uses a `TODO-XXXX-YY` ID linking back to its parent TODO entry (e.g. `TODO-0011-01` belongs to `TODO-0011`). Items without a parent TODO are not retained in this file.

---

## TODO-0050-01: Skill and CI updates for Nix npmDepsHash maintenance

Parent: [`TODO-0050: Update dep-update skills for Nix npmDepsHash step`](TODO.md)

**Context**: PR #159 added a Nix flake (`flake.nix`, `nix/package.nix`). The `npmDepsHash` field in the `frontend = buildNpmPackage { ... }` block of `nix/package.nix` is a SHA-256 hash of the npm dependency tree. It must be kept in sync with `package-lock.json` or `nix build .#default` fails with a hash mismatch. This can only be done on Linux with Nix installed — not from the Windows/WSL environment this project normally uses.

**Refresh command** (Linux+Nix only):
```bash
nix run nixpkgs#prefetch-npm-deps -- package-lock.json
# Or: copy the "got:" hash from the error output of a failing nix build .#default
```

---

### Part 1 — Update `sync-lockfiles` skill

File: `.agents/skills/sync-lockfiles/SKILL.md`

Add `nix/package.nix` as a fourth row to the lockfiles table:

| File | Used by |
|------|---------|
| `bun.lock` | Dev workflow |
| `package-lock.json` | Flathub `flatpak-node-generator` (offline Linux build) |
| `nix/package.nix` (`npmDepsHash`) | Nix flake build — Linux+Nix required to refresh |

Add a step 4 after the existing steps:

> **4. Refresh `npmDepsHash` in `nix/package.nix`** (Linux+Nix only): run `nix run nixpkgs#prefetch-npm-deps -- package-lock.json` and update the hash in the `frontend = buildNpmPackage { ... }` block. If working on Windows/WSL, note in the commit message that the Nix hash needs a follow-up from a Linux environment.

Add to the Gotcha section:

> If `package-lock.json` changes and `npmDepsHash` is not updated, `nix build .#default` will fail with a hash mismatch. This step cannot be done from Windows/WSL.

---

### Part 2 — Update `apply-dependency-prs` skill

File: `.agents/skills/runbooks/skills/apply-dependency-prs/procedures/npm.md`

**Status (2026-06-29):** Completed during the runbook refactor that moved the
npm procedure into `procedures/npm.md` (see
`docs/apply-dependency-prs-refactor-plan.md`). The three changes below were
applied to that file in the same commit.

**Phase 3 — add step after `npm install`:**

> **4. Refresh `npmDepsHash` in `nix/package.nix`** (Linux+Nix only): run `nix run nixpkgs#prefetch-npm-deps -- package-lock.json` and update the `npmDepsHash` field in the `frontend = buildNpmPackage { ... }` block. If in a Windows/WSL environment, skip and note in the commit message that the hash needs a Linux follow-up.

**Phase 4 Step 3 — change the file count assertion:**

Old: "Should show exactly three files: `package.json`, `bun.lock`, and `package-lock.json`."

New: "Should show 3 or 4 files: `package.json`, `bun.lock`, `package-lock.json`, and optionally `nix/package.nix` if the Nix hash was refreshed. Investigate any other additional files."

**Gotchas section — add:**

> **`npmDepsHash` in `nix/package.nix` must be refreshed on Linux.** Whenever `package-lock.json` changes, the `npmDepsHash` field in `nix/package.nix` (inside the `frontend = buildNpmPackage { ... }` block) must also be updated or the Nix build breaks. This requires Linux+Nix — it cannot be done from Windows/WSL. If operating on Windows, note the omission in the commit message so a Linux-capable maintainer can follow up.

---

### Part 3 — CI (optional but recommended)

Add a path-filtered GitHub Actions job that only runs when `package-lock.json` or `nix/package.nix` changes. This catches stale hashes from human contributors who bypass the skills.

Suggested workflow addition to `.github/workflows/ci.yml` or a new `nix.yml`:

```yaml
nix-build:
  name: Nix build check
  runs-on: ubuntu-latest
  if: github.event_name == 'push' || github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
    - uses: cachix/install-nix-action@v27
      with:
        nix_path: nixpkgs=channel:nixos-unstable
    - name: Check flake and build
      run: nix build .#default --no-link
```

Add a path filter so it only triggers on:
- `package-lock.json`
- `nix/**`
- `flake.nix`
- `flake.lock`

Without a Cachix cache, this job will be slow (10–20 min) on first run. Consider adding `cachix/cachix-action` if build times become a problem. `nix flake check` alone is not sufficient — it evaluates the flake but does not verify the `npmDepsHash` against the actual deps.

---

## TODO-0038-01: Legacy `require_all_auth` Config Removal

Parent: [`TODO-0038: Remove legacy require_all_auth config migration`](TODO.md)

**Approval gate**: requires maintainer sign-off on the release boundary before any code is deleted. Do not execute this task speculatively.

**Background**: the `require_all_auth` setting was migrated from `config.json` (`JournalConfig.require_all_auth`) to `db_settings` in schema v6 (2026-05-settings-storage-taxonomy decision). The live DB-settings-backed path already works. The legacy config field and its migration function (`migrate_require_all_auth_to_db`) are kept until the release boundary is confirmed so users upgrading from older versions are not stranded.

**Steps**:

1. Get maintainer approval for the exact release boundary (which version this ships in) and the CHANGELOG wording.
2. **Red**: add a regression test that loads a legacy `config.json` containing `require_all_auth: true`, performs an unlock, and asserts the value was migrated to `db_settings` — confirm this test passes *before* any deletion.
3. Remove `JournalConfig.require_all_auth` and `JournalInfo.require_all_auth` from the Rust structs.
4. Remove `set_journal_require_all_auth` and its call sites.
5. Remove `migrate_require_all_auth_to_db` and its call sites (check all open paths in `schema/open.rs`).
6. Remove the corresponding frontend type field from `src/lib/tauri.ts` and any reference in `JournalPicker.test.tsx`.
7. Remove the temporary regression test from step 2 only if it is no longer meaningful after deletion; keep any replacement test that validates the DB-backed policy.
8. Update CHANGELOG with the cleanup note.

**Validation**:
```
cargo test auth
bun run test:run
bun run type-check
```

---

## TODO-0011-01: Deferred — Per-post OG Images (P4-F)

Parent: [`TODO-0011: Website SEO/GEO follow-up backlog`](TODO.md)

**Reference**: [`docs/seo-geo-implementation-plan.md`](../seo-geo-implementation-plan.md) — Task 4.4

Unique per-post OG images would require a design step and an image generation pipeline not present in the current static site. Out of scope for the current static website architecture.

---

## TODO-0012-01: PDF Export

Parent: [`TODO-0012: PDF export`](TODO.md)

**Priority**: Low | **Complexity**: High | **File**: `src-tauri/src/export/pdf.rs`

Export journal entries as PDF (A4 page size).

**Requirements**:
- Convert: HTML → PDF (entries are stored as HTML via TipTap)
- Library options: chromiumoxide or Tauri webview printing
- Command: `export_pdf()` in `src-tauri/src/commands/export.rs`
- UI: Add to ExportOverlay dropdown
- Menu: Include in Export menu

**Dependencies**: JSON/Markdown export (Tasks 40-41) ✅ Complete

**Testing**: Manual only (PDF generation hard to test automatically)

**Rationale for deferral**: Complex implementation, low user priority for v0.1.0

---

## TODO-0013-01: Text Input Extension Point

Parent: [`TODO-0013: Text input extension point`](TODO.md)

**Priority**: Medium | **Complexity**: High | **Files**: TBD (see `docs/text-input-extension-design.md`)

Allow users to augment text entry with pluggable text-generation sources: LLM endpoints (Ollama, OpenAI-compatible APIs), dictation (Web Speech API), and custom Rhai scripts.

**Design**: Fully documented in [`docs/text-input-extension-design.md`](../text-input-extension-design.md). Two-tier architecture: Tier 1 (Rhai scripts via existing plugin system, `@type: text-input`), Tier 2 (frontend JS built-ins for LLM endpoint + dictation).

**Deferred because**: Too large for current release; design work preserved for future implementation.

**Privacy constraints**: All network calls are opt-in and user-configured; no implicit telemetry; LLM endpoint URL/key stored only in `localStorage` preferences.

**Key requirements**:
- Rhai tier: `fn generate(prompt)` / `fn generate(prompt, context)` → string; opt-in `@permissions: read-context`
- Built-in LLM tier: OpenAI-compatible HTTP POST to user-specified URL; supports Ollama and cloud APIs
- Built-in dictation tier: Web Speech API (no network)
- UI: Toolbar button in EditorToolbar → TextInputOverlay; Preferences section for LLM config
- 2 new Tauri commands: `list_text_input_plugins`, `run_text_input_plugin`

**Testing**: Rhai unit tests; frontend overlay tests; LLM tier mock tests; dictation manual-only

---

## TODO-0058-01: Pre-commit hook design

Parent: [`TODO-0058: Pre-commit hook for frontend and backend formatting`](TODO.md)

**File layout**

- `.githooks/pre-commit` — bash hook, executable. Activated by `core.hooksPath .githooks` (set by the install script).
- `scripts/install-hooks.js` — idempotent installer (no-op on CI or non-git context). Exposes a pure `computeInstallActions({ isCI, hasGitDir, hasHookFile, platform })` helper for tests.
- `scripts/install-hooks.test.js` — `node:test` unit tests for `computeInstallActions`.
- `package.json` — `postinstall` runs the installer; `hooks:install` is the manual escape hatch.

**Hook behavior** (`.githooks/pre-commit`)

- Reads staged paths via `git diff --cached --name-only --diff-filter=ACMR` (added, copied, modified, renamed — not deleted).
- **Frontend**: filters to `src/.*\.(ts|tsx|css)$`, runs `bunx prettier --write <files>`, then `git add <files>`.
- **Backend**: filters to `src-tauri/.*\.rs$`. When any match, runs `(cd src-tauri && cargo fmt)` and re-stages the Rust files. Cargo is invoked with `command -v` guard; missing cargo prints a warning to stderr and skips (commit still succeeds).
- Skips silently when no relevant files are staged.
- Always exits 0 on success; formatting failures propagate via `set -e`.

**Scoped-to-staged decision**

Prettier operates on working-tree files (not the staged blob) and re-stages via `git add`. If a file has both staged and unstaged changes, Prettier may format the entire file and the unstaged changes appear in the re-staged diff. This matches the behavior of husky/lefthook and is acceptable: the dev sees the diff before the commit completes. Stashing the unstaged changes was rejected as too complex for the speed budget.

**Cargo fmt scope**

`cargo fmt` formats the entire `src-tauri/` crate, even when only one staged file triggers it. Stable `cargo fmt -- <file>` is a no-op, so partial-scope formatting is not achievable without nightly. Whole-crate format takes ~1-2s and is acceptable.

**Auto-install via postinstall**

`scripts/install-hooks.js` runs on every `bun install` via `package.json#postinstall`. It sets `git config core.hooksPath .githooks` (writes to per-clone `.git/config`) and chmods the hook to `0o755` on non-Windows. CI is detected via `process.env.CI === 'true'` and skips all side effects; missing `.git` directory is detected via `existsSync('.git')` and skips too. Manual reinstall: `bun run hooks:install`.

**Bypass**

`git commit --no-verify` skips the hook for a single commit (standard Git behavior). Documented in `CLAUDE.md`, `CONTRIBUTING.md`, and `scripts/README.md`.

**Cross-platform**

The hook is a bash script. Git for Windows bundles bash and uses it for hook execution regardless of the developer's preferred shell. `chmodSync` is skipped on Windows because Git Bash executes hook scripts via shebang even without the executable bit.

**CI**

GitHub Actions does **not** run the local hook. `.github/workflows/ci.yml` already runs `bun run format:check` and `cargo fmt --check` on every push and PR — same checks, but read-only / fail-on-drift mode.

---

## TODO-0062-01: Statistics, Import, Export menu items

Parent: [`TODO-0062: Add Statistics, Import, Export to the header overflow menu`](TODO.md)

**Extend `HeaderMoreMenu`** (from TODO-0061-01) with three more `DropdownMenu.Item`s, each calling the same setter its native-menu listener already calls in `src/components/layout/MainLayout.tsx`:
- Statistics → `setIsStatsOpen(true)` (listener ~line 165, mount `<StatsOverlay isOpen={isStatsOpen()} onClose={() => setIsStatsOpen(false)} />` at line 245)
- Import → `setIsImportOpen(true)` (listener ~line 172, mount around line 248)
- Export → `setIsExportOpen(true)` (listener ~line 179, mount `<ExportOverlay isOpen={isExportOpen()} onClose={() => setIsExportOpen(false)} />` at line 254)

**Lockable disabled state**: `src-tauri/src/menu.rs:104-114` defines the `lockable` vec — `navigate_prev_day`, `navigate_next_day`, `navigate_today`, `go_to_date`, `navigate_prev_month`, `navigate_next_month`, `statistics`, `import_item`, `export_item` — all disabled while the journal is locked (see `set_lockable_items_enabled` around line 266-268). Preferences (`menu.rs:98-100`, "Always enabled" comment) is explicitly excluded from this vec. Mirror this grouping in `HeaderMoreMenu`: Statistics/Import/Export items get `disabled={!isUnlocked()}` (or equivalent existing lock-state signal), Preferences does not.

**Onboarding tour fix**: `src/components/overlays/OnboardingOverlay.tsx:193-202` — the Import tour step currently has `targetSelector: null` and an `edgeHint: { side: 'top', offset: 125 }` with the comment `"Import" lives in the native menu bar just above the webview's top edge`. Once the in-app Import trigger exists, change this step to `targetSelector: '[data-tour-target="import"]'` (add that attribute to the new menu item or its trigger button) matching the pattern already used by the toolbar step (`targetSelector: '[data-tour-target="toolbar"]'`, line 191) and the about step (line 208). This removes the `edgeHint` branch usage for this step — check whether `edgeHint`/`computeEdgeHintPosition` (used at line 234-241) is still needed elsewhere before considering removal of that code path (out of scope for this TODO, just a note for whoever does it).

---

## TODO-0063-01: Day-navigation and go-to-date controls

Parent: [`TODO-0063: Add in-app day-navigation and go-to-date controls to the Header`](TODO.md)

**Existing logic to extract**: `src/components/layout/MainLayout.tsx` imports `navigatePreviousDay`/`navigateNextDay` (lines 42-43) and currently only calls them from native-menu listeners:
```
listen('menu-navigate-previous-day', ...)  // line 111, calls navigatePreviousDay(selectedDate()) at line 113
listen('menu-navigate-next-day', ...)      // line 123, calls navigateNextDay(selectedDate()) at line 125
```
Extract the body of each listener into a shared function (e.g. `handlePreviousDay`/`handleNextDay` or a single `handleDayNavigation(direction)`), call it from both the `listen(...)` handler and the new Header button `onClick`, so there is exactly one source of truth — do not duplicate the date-fetch/set logic.

**Go-to-date trigger**: `MainLayout.tsx` already calls `setIsGoToDateOpen(true)` from the `menu-go-to-date` listener (~line 151); `GoToDateOverlay` is mounted at line 240. Clicking the Header date title should call the same setter.

**Header changes**: `src/components/layout/Header.tsx:71` currently renders `<h1 class="text-lg font-semibold text-primary">{formattedDate()}</h1>` with no click handler, inside the left cluster (`div class="flex items-center gap-3"`, line 50) alongside the hamburger (line 51-62) and search button (line 63-70). Add `◀`/`▶` icon buttons flanking the date title, and make the title itself a clickable button/element (`onClick={() => setIsGoToDateOpen(true)}`).

**Viewport risk**: default E2E clean mode runs at 800×660 px, below the `lg` (1024px) breakpoint — the hamburger menu button is visible at this width (`src/CLAUDE.md` gotcha #4). Adding 2 new icon buttons plus a click affordance to the left cluster at this width needs a manual/E2E check for wrapping or overflow; see `e2e/CLAUDE.md` gotchas #2–3 for the existing viewport constraints this must not break.

---

## TODO-0065-01: Native menu removal scope

Parent: [`TODO-0065: Remove redundant native menu items once in-app equivalents ship`](TODO.md)

**Items to remove** from `src-tauri/src/menu.rs` once TODO-0061–0064 ship: `navigate_prev_day`, `navigate_next_day`, `go_to_date`, `statistics`, `import_item`, `export_item` — all currently built in the `build_menu`-equivalent function (`menu.rs:53-263`) and wired into the `navigation_menu` (lines 117-126) and `diary_menu` (lines 128-133) submenus, with event handling in the `on_menu_event` match block (lines 200-238).

**Items to explicitly keep untouched**: `navigate_today` (already has a Sidebar equivalent), `navigate_prev_month`/`navigate_next_month` (already have Calendar chevron equivalents), `preferences` (macOS convention expects `Cmd+,` under the App menu regardless of in-app access — `menu.rs:98-100`), `about`, all macOS `PredefinedMenuItem`s (Services/Hide/Show All/Quit at lines 142-148, Edit menu Undo/Redo/Cut/Copy/Paste/Select All at lines 150-159, Window menu at lines 160-165) — these back standard OS behavior including right-click text-editing context menus and must not be removed.

**Accelerator preservation pattern**: the existing `Cmd/Ctrl+F` search shortcut is handled as a JS-level `keydown` listener in `MainLayout.handleSearchShortcut` (`src/components/layout/MainLayout.tsx:88`, registered at line 108), not through the native menu — use this as the reference pattern when converting `CmdOrCtrl+[`/`]` (day nav) and other removed items' accelerators to JS-level listeners so power users keep the shortcuts after the native menu items are removed.

**Gate**: requires maintainer approval before execution, same pattern as `TODO-0038` (see `TODO-0038-01` above) — file as Medium/Low priority, explicitly blocked on TODO-0061–0064 landing first.

---

## TODO-0064-01: E2E coverage for in-app-reachable actions (right-sized)

Parent: [`TODO-0064: E2E coverage for in-app-reachable actions (right-sized)`](TODO.md)

**Why these actions historically had no E2E coverage**: Preferences, Statistics, Import, Export, Previous/Next Day, and Go to Date were reachable only through the native OS menu bar (menu items defined in `src-tauri/src/menu.rs`). WebdriverIO drives the app via `tauri-driver` at the WebView level (`e2e/CLAUDE.md` "Test Runners") — it cannot interact with OS-native menu bars. As TODO-0061–0063 surface these actions inside the WebView (`HeaderMoreMenu` + Header controls), they become WebDriver-reachable. This is the concrete "improved E2E testability" payoff named in the original TODO-0041.

**Scope discipline (why this is right-sized, not exhaustive)**: E2E runs the real Tauri binary through `tauri-driver` and is slow/serial (`maxInstances: 1`, one shared journal DB per run). It should cover representative full-stack user paths, not re-test every menu item. Overlay open/close logic without DB effects belongs in Vitest component tests; deep import/export behavior belongs in Rust tests. E2E overlay-open checks here are **shallow smoke checks** against the real WebView (portal rendering), not feature tests.

**Done in this task**: extracted the duplicated auth/onboarding boilerplate into `e2e/specs/helpers.ts` (`connectToApp`, `authenticate`, `dismissOnboardingTour`) and refactored `diary-workflow`, `search`, `multi-entry` to use it; added `e2e/specs/header-actions.spec.ts` covering `⋮` → Preferences (the one path reachable today via TODO-0061). Added `data-testid="preferences-overlay"` to `PreferencesOverlay.tsx` and the canonical table row.

**Deferred, non-blocking (incrementally extended as controls land, not gated on them)**:
- When **TODO-0062** lands, extend `header-actions.spec.ts` with a *single* assertion per new overlay — `⋮` → Statistics/Import/Export each *opens*, nothing more.
- When **TODO-0063** lands, add day-nav (`◀`/`▶` changes the Header date title) and date-title → `GoToDateOverlay` opens.

**Explicit non-goal**: no exhaustive per-item feature flows in E2E.

**Constraints**: each new spec selector must exist in the canonical `data-testid` table (`src/CLAUDE.md`) first (`e2e/CLAUDE.md` data-testid section). Follow the viewport constraints (`e2e/CLAUDE.md` gotchas #2–3, 800×660 clean-mode default) — no new `browser.setWindowSize()` calls.

---
