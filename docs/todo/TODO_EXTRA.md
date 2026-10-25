# TODO Extra Detail

Implementation detail and structured notes for specific TODO items in [`TODO.md`](TODO.md). Each section uses a `TODO-XXXX-YY` ID linking back to its parent TODO entry (e.g. `TODO-0011-01` belongs to `TODO-0011`). Items without a parent TODO are not retained in this file.

---

## TODO-0050-01: Skill and CI updates for Nix npmDepsHash maintenance

Parent: [`TODO-0050: Update dep-update skills for Nix npmDepsHash step`](TODO.md)

**Context**: PR #159 added a Nix flake (`flake.nix`, `nix/package.nix`). The `npmDepsHash` field in the `frontend = buildNpmPackage { ... }` block of `nix/package.nix` is a SHA-256 hash of the npm dependency tree. It must be kept in sync with `package-lock.json` or `nix build .#default` fails with a hash mismatch. Computing the hash locally needs Linux with Nix installed. On Windows/WSL, push the lockfile change and copy the hash from the error annotation of the failing Nix CI run (since TODO-0129). The Part 1–3 proposals below are historical; the shipped skill and workflow text supersede them.

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

**Status (2026-07-16):** Completed. `.github/workflows/nix.yml` implements this — a path-filtered job (triggers on `package-lock.json`, `nix/**`, `flake.nix`, `flake.lock`) that runs `nix build .#default --no-link` to verify `npmDepsHash`, and on `push` auto-refreshes the hash from the build's `got:` output and commits it. The original suggestion below is retained for context.

**Status (2026-10-10):** The auto-refresh was removed by TODO-0129. Branch protection rejected its push and the job still exited 0, so a stale hash stayed hidden behind a green run. The workflow now has `contents: read`, also runs when `nix.yml` itself changes (and on `workflow_dispatch`), and on a hash mismatch fails with an `::error` annotation and a job-summary entry that print the new hash. A human copies the hash into `nix/package.nix`.

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

**Reference**: [`docs/archive/seo-geo-implementation-plan.md`](../archive/seo-geo-implementation-plan.md) — Task 4.4

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

**Onboarding tour fix**: `src/components/overlays/OnboardingOverlay.tsx:193-202` — the Import tour step currently has `targetSelector: null` and an `edgeHint: { side: 'top', offset: 125 }` with the comment `"Import" lives in the native menu bar just above the webview's top edge`. Once the in-app Import trigger exists, change this step to `targetSelector: '[data-tour-target="import"]'` (add that attribute to the new menu item or its trigger button) matching the pattern already used by the toolbar step (`targetSelector: '[data-tour-target="toolbar"]'`, line 191) and the about step (line 208). This removes the `edgeHint` branch usage for this step — check whether `edgeHint`/`computeEdgeHintPosition` (used at line 234-241) is still needed elsewhere before considering removal of that code path (out of scope for this TODO, just a note for whoever does it). **Discharged 2026-07-25 (TODO-0065):** with the `⋮` menu now unconditional, the Import step keeps only `targetSelector` and its `edgeHint` was deleted — it was the sole consumer, so `EdgeHint`, `computeEdgeHintPosition`, the `activeEdgeHint` signal, its `measure()` branch, and the `EdgeDot` component were all removed from `OnboardingOverlay.tsx`. The card-arrow `<Show>` now keys on `spotlightRect()` alone. No test referenced any of these symbols.

---

## TODO-0063-01: Day-navigation and go-to-date controls

Parent: [`TODO-0063: Add in-app day-navigation and go-to-date controls to the Header`](TODO.md)

**Done (2026-07-20):** extracted the shared prev/next-day logic (including the future clamp) into `src/lib/day-navigation.ts` (`goToPreviousDay`/`goToNextDay`), which both the `MainLayout.tsx` menu listeners and the new Header buttons call — one source of truth. Added the always-on Header controls (`◀` `header-prev-day-button`, clickable date title `header-date-title` → `GoToDateOverlay`, `▶` `header-next-day-button`), the three `layout.header` i18n keys (`previousDay`/`nextDay`/`goToDate`), the three `data-testid` rows in `src/CLAUDE.md`, Vitest coverage in `Header.test.tsx` + `day-navigation.test.ts`, and E2E day-nav/go-to-date checks in `header-actions.spec.ts`. Controls ship un-gated (not behind `inAppMenu`, per the confirmed decision). Docs page `website/docs-src/02-navigating.md` updated. Verified no wrap/overflow at 800×660.

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

**Done (2026-07-25, maintainer-approved).** Two deviations from the scope written above, both deliberate:

1. **More was removed than listed.** `navigate_today`, `navigate_prev_month`, `navigate_next_month`, and `about` were removed as well, not just the six named items — the maintainer decision was that the native menu keeps *only* Preferences and Quit as a fallback access path. Today/month navigation already had Sidebar/Calendar equivalents, and About already had the Header ⓘ button, so nothing lost an access path. The Windows/Linux Help submenu disappeared with `about`, and `menu-about` now has no emitter (its `App.tsx` listener was deleted).
2. **The macOS `PredefinedMenuItem` keeps stand.** Services/Hide/Show All/Quit, the Edit submenu, and the Window submenu are untouched exactly as specified — they are OS text-editing and window behavior, not app features.

Knock-on removals the scope note did not anticipate: emptying `navigation_menu`/`diary_menu` emptied the `lockable` vec, so `LockableMenuItems`, `update_menu_lock_state`, the `app.manage(lockable)` wiring in `lib.rs`, and all eight call sites went too; that in turn left `AppHandle` unused in `perform_unlock`, `create_diary`, `unlock_diary`, `unlock_diary_with_keypair`, `unlock_diary_all_methods`, `create_diary_auto`, and `unlock_diary_auto`, whose parameters were dropped (`lock_diary`, `reset_diary`, `change_diary_directory`, and `auto_lock_diary_if_unlocked` keep theirs for `emit_diary_locked`). `MenuLabels`/`update_menu_locale` shrank to `preferences` + (non-macOS) `file_menu`.

**Accelerators: all six preserved**, in the new `src/lib/keyboard-shortcuts.ts` rather than inline in `MainLayout` as the reference pattern below suggested — one module so a future button and the shortcut share a source of truth. `MainLayout.handleSearchShortcut` was folded into it (`Mod+F`), and the three navigation bodies that lived in the removed listeners moved to `src/lib/day-navigation.ts` (`goToToday`, `goToPreviousMonth`, `goToNextMonth`, keeping the future-clamp). Two rules the module encodes that a naive port would get wrong: brackets must match `e.code` (`e.key` is `{`/`}` with Shift held, so the month shortcuts break silently on an `e.key` test) and `Alt` must be excluded (Windows AltGr reports `ctrlKey && altKey` and is how `[`/`]` are typed on several layouts). The duplicated overlay guard became `isAnyOverlayOpen()` in `src/state/ui.ts`.

---

## TODO-0064-01: E2E coverage for in-app-reachable actions (right-sized)

Parent: [`TODO-0064: E2E coverage for in-app-reachable actions (right-sized)`](TODO.md)

**Why these actions historically had no E2E coverage**: Preferences, Statistics, Import, Export, Previous/Next Day, and Go to Date were reachable only through the native OS menu bar (menu items defined in `src-tauri/src/menu.rs`). WebdriverIO drives the app via `tauri-driver` at the WebView level (`e2e/CLAUDE.md` "Test Runners") — it cannot interact with OS-native menu bars. As TODO-0061–0063 surface these actions inside the WebView (`HeaderMoreMenu` + Header controls), they become WebDriver-reachable. This is the concrete "improved E2E testability" payoff named in the original TODO-0041.

**Scope discipline (why this is right-sized, not exhaustive)**: E2E runs the real Tauri binary through `tauri-driver` and is slow/serial (`maxInstances: 1`, one shared journal DB per run). It should cover representative full-stack user paths, not re-test every menu item. Overlay open/close logic without DB effects belongs in Vitest component tests; deep import/export behavior belongs in Rust tests. E2E overlay-open checks here are **shallow smoke checks** against the real WebView (portal rendering), not feature tests.

**Done in this task**: extracted the duplicated auth/onboarding boilerplate into `e2e/specs/helpers.ts` (`connectToApp`, `authenticate`, `dismissOnboardingTour`) and refactored `diary-workflow`, `search`, `multi-entry` to use it; added `e2e/specs/header-actions.spec.ts` covering `⋮` → Preferences (the one path reachable today via TODO-0061). Added `data-testid="preferences-overlay"` to `PreferencesOverlay.tsx` and the canonical table row.

**Extended as controls landed (both now done)**:
- **TODO-0062 (done 2026-07-20)**: `header-actions.spec.ts` extended with a shallow "opens" smoke check for each of `⋮` → Statistics/Import/Export — one `it` per overlay, nothing more. The three near-identical bodies share a local `assertMenuItemOpensOverlay(itemTestId, overlayTestId)` helper (the existing Preferences check was refactored onto it too) to stay under the SonarCloud `new_duplicated_lines_density` gate (root CLAUDE.md Gotcha #5). Required `data-testid`s (`stats-overlay`, `import-overlay`, `export-overlay`) added to the three `Dialog.Content`s and the canonical table (`src/CLAUDE.md`).
- **TODO-0063 (done)**: day-nav (`◀`/`▶` changes the Header date title) and date-title → `GoToDateOverlay` open checks landed with TODO-0063.

**Closed 2026-07-25 (TODO-0065)**: `setFeatureFlag('inAppMenu', true)` seeding removed from `header-actions.spec.ts` — the `⋮` menu is unconditional now — and one keyboard-shortcut smoke check added: `browser.keys([Key.Ctrl, '['])` must change `header-date-title`, with `Ctrl+]` restoring it so the shared session is left where later checks expect. That check is the point at which this coverage becomes genuinely complete: the JS `keydown` layer replacing the OS accelerators is only observable in a real WebView. Still shallow, still within the 800×660 viewport rules, no new `browser.setWindowSize()`.

**Explicit non-goal**: no exhaustive per-item feature flows in E2E.

**Constraints**: each new spec selector must exist in the canonical `data-testid` table (`src/CLAUDE.md`) first (`e2e/CLAUDE.md` data-testid section). Follow the viewport constraints (`e2e/CLAUDE.md` gotchas #2–3, 800×660 clean-mode default) — no new `browser.setWindowSize()` calls.

---

## TODO-0096-01: macOS Mojave support feasibility evidence

Parent: [`TODO-0096: Analyze feasibility of macOS Mojave (10.14) support`](TODO.md)

**Origin**: [issue #241](https://github.com/fjrevoredo/mini-diarium/issues/241). The reporter runs Mojave and notes others use even older releases (Mavericks) on Macs kept as writing machines. The documentation half of that issue (publishing the minimum supported version) was completed separately; this item covers only the "can we actually support Mojave" question.

**Current declared floor**: `src-tauri/tauri.conf.json` sets `bundle.macOS.minimumSystemVersion` to `10.15`. That becomes `LSMinimumSystemVersion` in `Info.plist`, so macOS refuses to launch the app below Catalina rather than starting and failing partway.

### What is NOT a blocker (verified)

- **Rust toolchain**: the platform support doc states the minimum is macOS 10.12 Sierra on x86_64 and 11.0 Big Sur on ARM64. Mojave (10.14) is inside the x86_64 floor.
- **Tauri's stated 10.15**: that is the *build machine* requirement on the prerequisites page, not a runtime guarantee. It is not evidence that the runtime fails below 10.15.
- **`wry` 0.55.1 / `tao` 0.35.3**: `src/wkwebview/mod.rs:1077` and `:373` perform *runtime* OS version checks before touching 10.15+ and 10.14+ APIs. The changelog documents fixes specifically for 10.13/10.14 (`Symbol not found: _NSHTTPCookieSameSite`, the `drawsBackground` KVC crash). The contributor on [wry#1668](https://github.com/tauri-apps/wry/pull/1668) reports testing on 10.13.6. The single 10.15-only call (`setAllowsContentJavaScript`) is behind `javascript_disabled`, which this app never sets.
- **Regex lookbehind in the bundle**: `(?<=` / `(?<!` appear in the built output and would be a *parse* error on Safari < 16.4 (white screen). They come from `marked`, which feature-detects lookbehind in a `try`/`catch` and falls back. Not a blocker.

### What IS the blocker

Mojave caps at Safari 14.1.2, and WKWebView uses the system WebKit, so the frontend baseline is Safari 14.1. Meanwhile `vite.config.ts` sets `build.target: 'esnext'`, so esbuild downlevels nothing. Scanning `dist/assets/*.js` found:

| Symbol | Requires | Source | Impact |
|--------|----------|--------|--------|
| `Array.prototype.at(-1)` | Safari 15.4 | `marked` (~20 uses) | Markdown import/export throws |
| `findLast` | Safari 15.4 | `vendor-tiptap`, `onUpdate` path | **Editor breaks on every update** |
| `color-mix()` | Safari 16.2 | `src/styles/editor.css:177` | Cosmetic (focus ring) |
| `100dvh` | Safari 15.4 | `ImagePickerOverlay.tsx:179` | Cosmetic, behind `sm:` breakpoint |
| `Object.hasOwn` | Safari 15.4 | bundled with a built-in fallback | None |

These are runtime `TypeError`s in specific features, not a dead-on-arrival bundle, so they are polyfillable — but only after a full audit, and the list will drift with every dependency bump.

### Cost of actually shipping it

- Change `build.target` to `safari14` (or add a browserslist) and add the polyfills.
- **A separate x86_64-only DMG.** `.github/workflows/release.yml:152` builds `--target universal-apple-darwin`; arm64 requires macOS 11.0, so a 10.14 artifact cannot be universal. New matrix entry, new artifact name, new checksum line, new download-page row.
- Lower `minimumSystemVersion` and pin an Xcode whose SDK still permits a 10.14 deployment target (Xcode 16.4 still allows 10.13; `macos-latest` on GitHub Actions may not).
- **No way to test it.** GitHub Actions has no Mojave runner. Every release would ship that artifact blind without a physical Mojave machine.

### Open questions for the analysis

1. Is there measurable demand beyond this one issue?
2. Is there a Mojave machine (maintainer or trusted contributor) willing to smoke-test each release? Without one, shipping an untestable artifact for an encryption-heavy app is hard to justify — a silent webview failure can look like data loss to a user.
3. Would a downlevelled `safari14` build target regress bundle size or performance enough to matter for the supported platforms? If the cost is near zero, lowering the target repo-wide is defensible on its own merits regardless of the Mojave decision.
4. Mavericks (10.9) is out of scope permanently — no stable Rust toolchain produces binaries that run there. Say so plainly when replying to the issue.
5. **Does the planned MiniDiarium+ web tier make this moot?** Mostly no, and the reasoning should not be re-derived later. (a) The browser tiers are the *paid* separate product ([`OPEN_CORE_STRATEGY.md` §2](../OPEN_CORE_STRATEGY.md)), so pointing a free-app user at them is not a real answer. (b) On Mojave, Safari caps at 14.1.2 and WKWebView *is* that engine, so opening a web tier in Safari on the same machine hits the identical Safari 14 wall — the gain only exists if the user installs a third-party browser. (c) That escape hatch is closing: Firefox ESR 115 is the last Firefox for macOS 10.12–10.14 (extended to March 2026, re-evaluated February 2026) and Chrome dropped 10.14 at Chrome 117. A user on an unpatched browser typing a decryption password is a worse position than a native binary, and the served-code caveat (§6) means we would have to document the web tier as a *downgrade* from the desktop guarantee, not an upgrade. (d) The WASM SQLite substitute is explicitly deferred out of the open-core roadmap (§10), so the timeline does not fit either. The genuine structural insight still holds for other old hardware: WKWebView is welded to the OS version, and a user-installed browser breaks that coupling — it just does not rescue Mojave.

---

## TODO-0110-01: CJK word count and search min-length implementation notes

Parent: [`TODO-0110: Fix CJK (Chinese/Japanese) word count and search usability (issue #275)`](TODO.md)

**Context**: Reported in [issue #275](https://github.com/fjrevoredo/mini-diarium/issues/275) by a Chinese-text user. The reporter's own "proposed by AI" fix (frontend-only `Intl.Segmenter`, plus a claim that search matching/snippets rely on regex `\b` word-boundary anchors) was independently investigated rather than taken at face value — see the decisions below for what actually holds up.

### Word count — algorithm decision

- **Do not use `Intl.Segmenter` on the frontend.** It needs a per-platform WebView runtime check before it can be relied on: WebView2 (Windows) and Safari 14.1+ (macOS 10.15+) are fine, but the Linux floor this project supports (`webkit2gtk` on Ubuntu 20.04) ships a JavaScriptCore that may predate `Intl.Segmenter` with no bundled fallback. Per root `CLAUDE.md` agent rule #5 (verify third-party/WebView assumptions before relying on them), this would need confirming against the actual bundled webkit2gtk version — the chosen approach below sidesteps the question by not depending on the API at all.
- **Do not fix only the Rust side with the `unicode-segmentation` crate either**, even though it is a cheap add (already resolves transitively in `Cargo.lock` at 1.13.3). Its `unicode_words()` follows UAX #29, which merges consecutive **Katakana** characters into one word while still splitting Han/Hiragana per character. The TS live-typing counter cannot pull in the same crate, so a hand-rolled TS approximation would disagree with the Rust output specifically on Katakana runs — a visible live-count-vs-saved-count mismatch while typing Japanese.
- **Chosen approach**: extend the existing single-pass state machine identically in both `count_words` (`crates/mini-diarium-core/src/db/queries/entries/mod.rs`) and `countWordsInHtml`/`countWordsFromText` (`src/lib/wordcount.ts`) — no new dependency, no ICU/WebView reliance, both sides trivially auditable side by side. Add one rule: a character in the ranges below always closes the current word and counts as one word by itself, and never merges with an adjacent character from these ranges (deliberately simpler than UAX #29 — no Katakana-run merging — chosen specifically so the two hand-written implementations stay in lockstep):
  - Han: U+4E00–U+9FFF, U+3400–U+4DBF, U+F900–U+FAFF
  - Hiragana: U+3040–U+309F
  - Katakana: U+30A0–U+30FF, U+31F0–U+31FF
- **Korean is explicitly out of scope.** Hangul is written with spaces between words, like Latin text, so the existing whitespace-delimited counting already produces a correct word count for it. Do not add Hangul syllable ranges (U+AC00–U+D7A3) to the per-character rule — that would inflate Korean counts by splitting every syllable block into its own "word."
- **Acceptance**: a shared fixture list (pure Chinese, pure Japanese with mixed kanji/hiragana/katakana, mixed CJK+Latin, Korean-with-spaces as a control, plus the existing HTML-tag and base64-image edge cases) produces identical counts from `count_words` and from `countWordsInHtml`/`countWordsFromText`. Add the fixtures to the Rust test module in `crates/mini-diarium-core/src/db/queries/entries/mod.rs` (or its `test_support`) and to `src/lib/wordcount.test.ts`.

### Search — the `\b` claim (no fix needed)

- `crates/mini-diarium-core/src/search/text.rs` (`matches_all`, `build_snippet`) matches terms with plain `str::contains` / `str::find` on case/accent-folded strings — there is no regex anywhere in this module, so no `\b` word-boundary anchors to break on. A CJK query like "你好" matches as a plain substring wherever it occurs in the decrypted title/text, with no word-boundary assumption involved. Verified by reading the implementation end to end; no code change needed here. Recording this so a future pass doesn't go hunting for a regex that isn't there.

### Search — `MIN_QUERY_LENGTH`

- `src/state/search.ts` defines `MIN_QUERY_LENGTH = 3`, gating `SearchBar.tsx`'s search-trigger effect (`query.trim().length >= MIN_QUERY_LENGTH`). Many complete CJK words/phrases are 1–2 characters (e.g. "你好", "我"), so the fixed threshold of 3 silently blocks legitimate short searches for CJK users, while 3 remains a reasonable noise filter for Latin-script queries (avoids firing a search on every single keystroke of a longer word).
- **Fix**: lower the effective minimum to 1 when the trimmed query contains at least one character in the CJK ranges listed above; keep 3 otherwise. `crates/mini-diarium-core/src/search/mod.rs` has no length gate today (verified — `search_entries` only checks `terms.is_empty()`), so this is a frontend-only change confined to `src/state/search.ts` / `SearchBar.tsx`.

---

## TODO-0127-01: Editor-local dialogs and the global Escape guard

Parent: [`TODO-0127: Global Escape and app shortcuts must not fire underneath editor-local dialogs and popups`](TODO.md)

**Context**: Found while exploring TODO-0125 (2026-10-08). **Reproduced 2026-10-08 in the real app**: ESC action = Quit → Ctrl+K (Insert Link) → Escape closes the app. The timestamp-dialog, tag-dropdown, and IME cases follow from the same code path but were not reproduced separately.

### How the guard works today

```
keydown on document
  ├─ MainLayout.handleGlobalEsc          (src/components/layout/MainLayout.tsx:47)
  │    onboarding tour? → minimize · minimized? → stop
  │    isAnyOverlayOpen()? → stop
  │    escAction === 'quit' → getCurrentWindow().close()
  └─ handleAppShortcut                    (src/lib/keyboard-shortcuts.ts:40)
       isAnyOverlayOpen()? → stop
```

- `isAnyOverlayOpen()` (`src/state/ui.ts:72`) ORs the overlay signals that `ui.ts` owns. Its doc comment says: "Every overlay signal in this module belongs here." The two editor dialogs break this rule only because their signals live outside the module.
- `MainLayout` adds its listener in `onMount`, before any editor dialog opens. Kobalte's `DismissableLayer` adds its own `document` keydown listener only when a dialog opens. Both listeners are on `document`, so `handleGlobalEsc` runs **first**. When it runs, the dialog is still open, but the guard cannot see it.
- No dialog handler calls `stopPropagation()`. The one exception is `ImagePickerOverlay.tsx:114`, and its signal is in `ui.ts` already.

### Gaps

| Element | Open state | Escape handler | Covered by guard? |
|---|---|---|---|
| `LinkOverlay` (Kobalte Dialog) | `isLinkOpen`, local signal, `EditorToolbar.tsx:85` | `LinkOverlay.tsx:161` + Kobalte | **No** |
| `TimestampOverlay` (Kobalte Dialog) | `isTimestampOpen`, local signal, `EditorToolbar.tsx:84` | `TimestampOverlay.tsx:29` + Kobalte | **No** |
| `EntryTags` suggestion dropdown (not modal) | `isDropdownOpen`, local, `EntryTags.tsx` | `EntryTags.tsx:117` | **No** |
| IME composition (any text field or the editor) | n/a | browser cancels composition | **No** (no `e.isComposing` check) |

Already safe (checked): every overlay that `ui.ts` owns; `NotificationDetailDialog` (it opens only inside `NotificationsOverlay`); `BackupInspectDialog` (it opens only inside Preferences); `ConfirmDialog` (`isConfirmDialogOpen`, and Escape is inert); the native `<select>`s in the toolbar (the OS popup consumes Escape); the onboarding tour (handled explicitly).

### Recommended fix

1. **Lift the two dialog signals into `src/state/ui.ts`.** Add `isLinkDialogOpen` / `isTimestampDialogOpen` (with setters) next to `isImagePickerOpen`, and add both to `isAnyOverlayOpen()`. `EditorToolbar.tsx` then uses them instead of its local signals. The LinkWithDialog `openLinkDialog` storage callback (`EditorToolbar.tsx:153-163`) calls the new setter. **You must also reset both in `resetUiState()` (`ui.ts:123`)**. The local signals died when the editor unmounted on lock. A module-level signal survives the lock. If an auto-lock fires while the link dialog is open and the signal is not reset, `isAnyOverlayOpen()` stays `true` after the unlock, and Escape and every app shortcut stop working. Add a test for this case. This follows the pattern that `isImagePickerOpen` already set, and it also blocks the app shortcuts behind the dialogs. A registry such as "dialogs register themselves" would be more general, but it adds a new mechanism for two call sites. Do not add it.
2. **The tag dropdown must claim its Escape.** In `EntryTags.tsx:117`, call `e.preventDefault()` when the dropdown is open, and make `handleGlobalEsc` return early on `e.defaultPrevented`. This is more general than `stopPropagation()`: any future component can mark an Escape as handled without knowing about the global handler. **Check first**: Solid delegates `onKeyDown` through a `document` listener, so the order against `MainLayout`'s native listener matters. Delegation registers when the first JSX event is created, which is usually before `MainLayout` mounts, so the delegated handler runs first and sets `defaultPrevented` in time. Confirm this with a test that dispatches a real `keydown` from inside the input. If the order is wrong, register `handleGlobalEsc` in the bubble phase on `window` instead of `document`, so it always runs after `document`-level handlers.
3. **Ignore IME composition.** Add `if (e.isComposing) return;` at the top of `handleGlobalEsc`. Optionally add it to `handleAppShortcut` too.
4. **Do not change**: `ConfirmDialog` stays outside `src/lib/dialog.ts` (`src/CLAUDE.md` gotcha #12). This fix does not touch focus-lock.

### Tests

- `src/components/layout/MainLayout.test.tsx` (it already has 2 `quit` cases with `setPreferences({ escAction: 'quit' })`): add cases. With `setIsLinkDialogOpen(true)` / `setIsTimestampDialogOpen(true)`, Escape does not call `close()`. A keydown with `isComposing: true` does not call `close()`. An Escape with `defaultPrevented` does not call `close()`.
- `src/state/ui.test.ts` (or the existing `isAnyOverlayOpen` tests): each new signal makes `isAnyOverlayOpen()` true.
- `EditorToolbar` / `LinkOverlay` tests: opening the dialog sets the shared signal, and closing it clears the signal.
- `EntryTags` test: Escape in the tag input with the dropdown open calls `preventDefault()` and closes the dropdown.
- `keyboard-shortcuts` test: Ctrl+F is inert while the link dialog is open.
- E2E is optional. `header-actions.spec.ts` already presses Escape to close overlays, so a link-dialog Escape case with `quit` set would be the strongest guard. Seed `escAction` through `localStorage['preferences']`.

### Docs

- `src/CLAUDE.md` → *Keyboard Shortcuts*: state that every modal's open signal must live in `ui.ts` and be part of `isAnyOverlayOpen()`, and that a non-modal popup must `preventDefault()` the Escape it handles.
- `CHANGELOG.md` → Fixed: "Pressing Escape to close the Insert Link or Insert Timestamp dialog, or the tag suggestions, no longer also quits the app when the ESC key action is set to Quit."
- No `website/docs-src` change is needed. The documented behavior ("while no dialog is open") becomes true.

### Implementation outcome (2026-10-08)

Steps 1–3 shipped as written, but step 1 alone did **not** fix the Ctrl+K → Escape repro. "How the guard works today" misses one handler: `LinkOverlay` and `TimestampOverlay` (and `StatsOverlay`, `GoToDateOverlay`, `ExportOverlay`, `ImportOverlay`) close themselves from an `onKeyDown` on `Dialog.Content`. Solid delegates that handler to `document`, and delegation registers at import time, before `MainLayout` mounts. So the dialog closes itself before `handleGlobalEsc` runs, and `isAnyOverlayOpen()` is already `false` there. A self-check reproduced this in jsdom by registering delegation first (`delegateEvents(['keydown'])`).

Fix: `MainLayout` adds a `window` capture-phase keydown listener. It runs before every other handler and records, in a `WeakSet`, each Escape event that arrives while `isAnyOverlayOpen()` is true. `handleGlobalEsc` skips a recorded event. `MainLayout.test.tsx` covers this with the real `LinkOverlay` / `TimestampOverlay`; the tests fail without the snapshot. `handleAppShortcut` needs no snapshot, because no dialog closes on a modifier shortcut.

### Relation to TODO-0125

After TODO-0125, the same gap would **lock the journal** in place of quitting the app. Ship this TODO first. TODO-0125's Escape branch then needs only its own guards: skip unless `authState() === 'unlocked'` (this also blocks key-repeat re-entry during the 700 ms lock animation), and use `void lockJournal().catch(...)`.

---

## TODO-0125-01: Lock journal ESC action

Parent: [`TODO-0125: Add a "Lock journal" option to the ESC key action (#313)`](TODO.md)

**Status (2026-10-11):** Completed as designed below. `handleGlobalEsc` branches on `escAction` after all guards, and the `'lock'` branch runs only while `authState() === 'unlocked'`. The optional E2E was skipped. Unit tests cover the guard order with the real Insert Link dialog and a real TipTap editor. The self-check found a related gap, fixed in a separate commit: with `prefers-reduced-motion` the `.lock-backdrop` is hidden, so a Header Lock click during the 700 ms lock (from Escape, the idle timer, or a focus loss) could start a second `lockJournal()`. The Header button now reads `authState() === 'locking'` in place of a local flag.

**Context**: Explored 2026-10-08. **Prerequisite: TODO-0127 must ship first.** Without it, Escape pressed to close the Insert Link or Insert Timestamp dialog, or the tag dropdown, would also lock the journal. See [TODO-0127-01](#todo-0127-01-editor-local-dialogs-and-the-global-escape-guard). This section assumes that TODO-0127's guards are in place: the dialog signals are in `isAnyOverlayOpen()`, there is an `isEscapeClaimed(e)` early return (`src/lib/escape-claim.ts`, TODO-0150; it replaced the `e.defaultPrevented` check), and there is an `e.isComposing` early return.

### Current flow and where the change goes

```
keydown "Escape" ──▶ MainLayout.handleGlobalEsc   (src/components/layout/MainLayout.tsx:47)
                       ├─ onboarding tour?        → minimizeOnboarding(), stop
                       ├─ onboarding minimized?   → stop
                       ├─ (TODO-0127 guards: composing / claimed, TODO-0150)
                       ├─ isAnyOverlayOpen()?     → stop
                       └─ escAction
                            'quit' → getCurrentWindow().close()
                            'lock' → lockJournal()   ← new branch
```

### The lock path: reuse it, do not copy it

- `lockJournal()` in `src/state/auth.ts:242` is the shared lock path. The Header button, the idle timer (`App.tsx:53`) and focus-loss (`App.tsx:83`) all call it. It sets `authState('locking')` **synchronously**, then runs `executeCleanupCallbacks()`, which flushes the open entry, then `tauri.lockJournal()`. In parallel, it waits `LOCK_ANIMATION_MS = 700`. After that it calls `resetForLockedSession()`. On failure it goes back to `'unlocked'`, sets the auth error signal and **throws**.
- The Header (`Header.tsx:56`) adds only a local `isLocking` signal, which disables the button. So the Escape branch gets the same lock and the same animation when it calls `lockJournal()` directly. Do not copy the Header's local signal.
- `App.tsx:130` keeps `MainLayout` mounted while `authState` is `'locking'`. So the Escape listener stays active during the 700 ms animation. Key repeat sends many `keydown` events, and each one would call `lockJournal()` again. This repeats the cleanup flush and the `lock_diary` IPC call.

### Implementation steps

1. **`src/state/preferences.ts:11`**: `export type EscAction = 'none' | 'quit' | 'lock';`. No migration is needed. `loadPreferences()` spreads stored values over the defaults, and the default stays `'none'`.
2. **`MainLayout.tsx` `handleGlobalEsc`**: add the branch.
   - Guard it with `authState() === 'unlocked'`. This stops key-repeat re-entry, because `lockJournal` changes the state to `'locking'` synchronously. It also makes Escape do nothing during the animation. Import `authState` from `src/state/auth`. Also checking `e.repeat` is optional; the state guard is enough on its own.
   - Call it as `void lockJournal().catch((err) => log.error('Failed to lock journal:', err))`. `lockJournal` already shows the sanitized error through the auth error signal, so the catch only stops an unhandled rejection.
   - Keep the `quit` branch as it is. Use `if / else if`, or a `switch` over `escAction`.
3. **`src/components/overlays/preferences/PreferencesGeneralTab.tsx:70`**: add `<option value="lock">{t('prefs.general.escLock')}</option>` after `quit`. The `as EscAction` cast already covers the new value.
4. **i18n**: add `prefs.general.escLock` and rewrite `prefs.general.escHint` in `src/i18n/locales/en.ts:386-388` and in all 6 JSON locales (`es`, `de`, `fr`, `it`, `pt-BR`, `hi`, line ~317-319 in each). Suggested English:
   - `escLock: 'Lock the journal'`
   - `escHint: 'Pressing Escape quits the app or locks the journal, depending on this setting. It has no effect while a dialog is open.'`
   - The current hint names only "Quit", so it must change. Run `cmd.exe /c bun run validate:locales`.
5. **Docs**:
   - `website/docs-src/07-preferences.md:22`: change the row to "Do nothing, quit the app, or lock the journal when pressing Escape". Then run `bun run website:build-static` from the PowerShell tool.
   - `docs/decisions/2026-05-settings-storage-taxonomy.md:80`: change the type to `'none'|'quit'|'lock'`.
   - `CHANGELOG.md` → Added, with a reference to #313.

### Behavior decisions (already settled)

- **Escape inside the editor body locks.** This is intended: the user asked for a quick lock key. Nothing is lost, because `executeCleanupCallbacks()` flushes the open entry before the backend lock, as it does for the Header button.
- **No confirmation dialog.** The Header button has none, and locking is not destructive.
- **No new keyboard shortcut.** This is a setting for the existing Escape behavior only. Do not add anything to `src/lib/keyboard-shortcuts.ts`.
- The onboarding tour, overlays and dialogs keep priority, so Escape is unchanged while any of them is open.

### Tests

- `src/components/layout/MainLayout.test.tsx` (existing `quit` cases at ~line 72/82 use `setPreferences({ escAction: 'quit' })`). Mock `lockJournal` from `src/state/auth` and add these cases:
  - With `escAction: 'lock'` and the journal unlocked, Escape calls `lockJournal` once and does **not** call `close()`.
  - With `'lock'` and an overlay open, for example `setIsPreferencesOpen(true)`, Escape does not call `lockJournal`.
  - With `'lock'` and the onboarding tour active, Escape minimizes the tour and does not lock.
  - With `'lock'` and `authState` set to `'locking'`, Escape does not call `lockJournal`. This is the key-repeat guard.
  - A rejected `lockJournal` does not cause an unhandled rejection.
  - With `'none'`, Escape calls neither function. With `'quit'`, the behavior is the same as today.
- `PreferencesOverlay.integration.test.tsx` (it already asserts `stored.escAction === 'quit'` at ~line 72): add a case where selecting "Lock the journal" persists `'lock'` to `localStorage['preferences']`.
- Fixtures that list full `Preferences` objects (`EditorToolbar.test.tsx:78`, `PreferencesOverlay.integration.test.tsx:43`) need no change, because the default is still `'none'`.
- E2E is optional. A clean-mode spec could seed `escAction: 'lock'` in `localStorage['preferences']`, press Escape, and wait for the unlock screen (`password-unlock-input`). This would confirm the full lock path, including the backend call.

### Manual check (real app)

ESC action = Lock → type in an entry → Escape → the lock animation plays, then the unlock screen shows → unlock → the text is saved. Then: open Ctrl+K → Escape closes only the dialog, and the journal stays unlocked (this is the TODO-0127 regression). Hold Escape down → only one lock happens, with no errors in the log.

---

## TODO-0150-01: Escape in the editor body

Parent: [`TODO-0150: Escape must run the ESC key action while the cursor is in the entry body (#329)`](TODO.md)

**Context**: Explored 2026-10-11 from [issue #329](https://github.com/fjrevoredo/mini-diarium/issues/329) (macOS 26.6.2, v0.7.4, DMG). Reporter: Escape quits from the title field or with no focus, but not from the entry body. Root cause found by reading the code and the installed library source. It is not reproduced in the real app yet.

### Root cause

```
keydown "Escape", target = editor body (.ProseMirror)
  1. window capture   recordOverlayOnEsc         → no overlay, nothing recorded
  2. target phase     prosemirror-view keydown   → captureKeyDown(): code 27 → true
                                                 → event.preventDefault()      ◀── here
  3. document bubble  MainLayout.handleGlobalEsc → e.defaultPrevented → return  ◀── skipped
```

- `node_modules/prosemirror-view/dist/index.js` (v1.42.3), `captureKeyDown`: `else if (code == 13 || code == 27) { // Enter, Esc  return true; }`. `editHandlers.keydown` then calls `event.preventDefault()`. This is unconditional ProseMirror behavior. No TipTap extension or app code binds Escape.
- `src/components/layout/MainLayout.tsx` `handleGlobalEsc`: `if (e.isComposing || e.defaultPrevented) return;`. Commit `d85996b` (TODO-0127, first in `v0.7.4`) added the `defaultPrevented` check so the `EntryTags` dropdown can claim its Escape. Before v0.7.4 the handler did not check it, so Escape in the body quit the app. This matches the report ("I think it used to before this latest release").
- The bug is on all platforms, not only macOS.
- The title field works because `TitleEditor` does not call `preventDefault()` on Escape.
- A **locked** entry (read-only editor) is not affected: ProseMirror runs its edit handlers (`keydown` among them) only when `view.editable` is true (`index.js:3136`/`3186`).
- The existing test `does not quit on Escape that a component already handled (defaultPrevented)` (`MainLayout.test.tsx:160`) passes a synthetic event. No test sends Escape through a real editor, so CI did not catch this.

### Who relies on `defaultPrevented` today

| Source of `preventDefault()` on Escape | Needs the global action skipped? | Notes |
|---|---|---|
| `EntryTags` dropdown (`EntryTags.tsx:119`) | **Yes** | The only intended user of the rule. |
| ProseMirror, editor body | **No** | The cause of this bug. |
| `LinkOverlay`, `ImagePickerOverlay` | Yes | Already covered by the overlay snapshot (`escWhileOverlayOpen`). |
| Kobalte `DismissableLayer` (`@kobalte/core` 0.13.14) | n/a | Adds its own `document` listener when a layer opens, so it runs **after** `handleGlobalEsc`. Its `preventDefault()` is too late to matter. The more menu is guarded by `isMoreMenuOpen` in `isAnyOverlayOpen()`. |

So `defaultPrevented` is a signal that a library can set for its own reasons. The global handler cannot tell "a popup used this Escape" from "ProseMirror always does this".

### Fix options

| Option | Change | For | Against |
|---|---|---|---|
| **A. Explicit claim (recommended)** | A small helper, for example `claimEscape(e)` / `isEscapeClaimed(e)` backed by a module-level `WeakSet<KeyboardEvent>` (same pattern as `escWhileOverlayOpen`). `EntryTags` calls `claimEscape(e)`. `handleGlobalEsc` checks `isEscapeClaimed(e)` and no longer reads `e.defaultPrevented`. | Only app code can claim Escape, so no library can turn the global action off by accident. One call site to migrate. | One more small mechanism. A future third-party popup that handles Escape must call the helper itself. |
| B. Exempt the editor | Keep the `defaultPrevented` check, but ignore it when `e.target` is inside `.ProseMirror`. | Smallest change. | Depends on ProseMirror DOM details. A future TipTap popup in the editor (for example a suggestion menu) that handles Escape would be indistinguishable, so Escape would then also quit or lock. |
| C. Undo in TipTap | A TipTap extension that handles Escape first. | — | Does not work: ProseMirror calls `preventDefault()` whenever any handler returns `true`, and `captureKeyDown` returns `true` anyway. |

Recommendation: **A**. Put the helper next to the overlay guard (in `src/state/ui.ts` or a small `src/lib/escape-claim.ts`). The `EntryTags` handler can keep its `preventDefault()` (harmless), but the comment must name the claim helper as the reason the global action skips it.

### Tests

- `MainLayout.test.tsx`: mount a real TipTap `Editor` (StarterKit is enough) on an element in `document`, render `MainLayout` with `escAction: 'quit'`, and dispatch `new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true })` on `editor.view.dom`. Assert that `close()` is called. ProseMirror reads `keyCode`, so the test must set it. First assert that the event is `defaultPrevented`, so the test proves the ProseMirror path. This test must fail before the fix.
- Change the existing `defaultPrevented` test: a plain `preventDefault()` no longer blocks the action, and a claimed event does.
- `EntryTags` test: Escape with the dropdown open claims the event (the `MainLayout` integration case with the real `EntryTags`, if one exists, must stay green).
- Keep all TODO-0127 cases green: link and timestamp dialogs, `isComposing`, the overlay snapshot.
- E2E is optional: seed `escAction: 'quit'` in `localStorage['preferences']`, type in the editor, press Escape, and check that the app closes. This is hard to assert in WDIO, so a unit test is the main guard.

### Docs

- `src/CLAUDE.md` → *Keyboard Shortcuts*: replace "must call `e.preventDefault()`; the global Escape handler skips `defaultPrevented` events" with the claim-helper rule, and add why: ProseMirror calls `preventDefault()` on every Escape in the editor.
- `docs/best-practices/FRONTEND_BEST_PRACTICES.md`: add the rule only if it has a keyboard section.
- `CHANGELOG.md` → Fixed: "Pressing Escape while writing in the entry body runs the ESC key action again (for example Quit). This stopped working in v0.7.4. (#329)"
- No `website/docs-src` change. The documented behavior does not change.

### Relation to TODO-0125

TODO-0125 adds a "Lock the journal" ESC action through the same `handleGlobalEsc`. Without this fix, Escape in the body would not lock either. Its notes (TODO-0125-01) said "there is an `e.defaultPrevented` early return". That line now names the `isEscapeClaimed(e)` check (updated with this fix).

### Manual check (real app)

ESC action = Quit → type in the body → Escape → the app quits. Then: tag input with suggestions open → Escape closes only the dropdown. Ctrl+K → Escape closes only the dialog. Title field → Escape quits. Locked entry, click in the body → Escape quits.

### Open questions

- Was the user's DMG build v0.7.4 the first version with the bug? `git tag --contains d85996b` shows only `v0.7.4`, so yes.
- Should Escape in the body ever do something editor-local first (for example clear a selection) before the global action? Nothing does this today. This fix keeps "the global action runs".

---

## TODO-0151-01: Russian locale integration checklist

Parent: [`TODO-0151: Wire the Russian locale and complete its integration`](TODO.md)

**Status (2026-10-21):** Completed as listed below, for 0.7.6. The self-check also fixed two double spaces (`prefs.backups.viewingEntriesFor`, `notifications.readMoreAria`) and two ASCII-quoted values (`timeline.emptyForTag`, `search.noResults`, now `«»`), and aligned `common.browseDotDotDot` with `Обзор`. The `customFontsNote` key below is `prefs.writing.fontFamilyCustomFontsNote`. The known plural limitation moved to TODO-0153.

**Context**: PR #344 merged `src/i18n/locales/ru.json` with all 733 keys. The file validates against `en.ts`, but no code imports it. The contributor was told that the maintainer will do the integration and the corrections.

### Wiring

- `src/i18n/index.ts`: add `import ruLocale from './locales/ru.json';` and `ru: flatten(ruLocale as unknown as typeof en) as FlatEn,` to `localeMap`.
- `src/i18n/locales/index.ts`: add `{ code: 'ru', name: 'Russian', nativeName: 'Русский' }` between `pt-BR` and `es`.
- `src-tauri/src/commands/menu.rs`: add this arm before the `_ =>` fallback:

  ```rust
  "ru" => MenuLabels {
      preferences: "Настройки...",
      #[cfg(not(target_os = "macos"))]
      file_menu: "Файл",
  },
  ```

### Linux spellcheck

- `src-tauri/src/spellcheck.rs`: add `("ru", "RU")` to `DEFAULT_REGIONS`.
- `flatpak/io.github.fjrevoredo.mini-diarium.yml`: install `ru_RU/ru_RU.aff` and `ru_RU/ru_RU.dic` to `/app/share/hunspell/`, and `ru_RU/README_ru_RU.txt` to `/app/share/licenses/io.github.fjrevoredo.mini-diarium/hunspell-dicts/ru/`. All three files are in the pinned `libreoffice-26.2.5.2` archive.

### String corrections in `ru.json`

- `common.cancel`: change `Выход` to `Отмена`.
- `prefs.writing.fontFamilyHint`: retranslate from the current `en.ts`, not from `it.json`. The Italian file still has an old English value for this key. The current meaning is: the app-wide default font for new and existing entries, and individual entries can override it from the toolbar.
- Remove double spaces in `editor.goToEntry`, `timeline.openEntry`, `prefs.backups.confirmRestore`, and `prefs.security.autoLockTimeoutTooLow`.
- Remove double periods in `prefs.backups.loadError`, `prefs.writing.spellcheckDictionaryMissing`, and `prefs.security.autoLockTimeoutTooLow`.
- Remove the double colon in `prefs.data.backupsStayedAlert`.
- Replace the parentheses around the suggested search phrase in `prefs.writing.spellcheckDictionaryMissing` with Russian quotation marks.
- Add the missing closing period in `prefs.backups.confirmRestore`, `prefs.writing.customFontsNote`, and `prefs.advanced.recalculateSummary_one` / `_other`.
- Optional style change: `common.browse` could be `Обзор` or `Выбрать` instead of `Просмотреть`.

### Docs and release

- Run `bun run sync-languages` to update `README.md` and `website/index.html`.
- Update the shipped-language sentence in `docs/TRANSLATIONS.md` line 9.
- Update the language table and the "all seven interface languages" sentence in `website/docs-src/07-preferences.md` to eight languages, and add Russian to the list.
- Run `bun run website:build-static` to rebuild `website/docs/`, `website/docs/preferences/index.html`, and `website/llms-full.txt`.
- Add a CHANGELOG entry under `## [0.7.6] - Unreleased` in `### Added`, and credit d1nch and #344.

### Validation

- `bun run validate:locales` shows `validate-locales: [ru.json] OK (733 keys)`.
- `bun run type-check` and `bun run lint` pass.
- `bun run test:run` passes. The `prosemirror-dedup` timeout is a known load-related flake and passes when run alone.
- `cargo test --workspace` passes if the Rust menu or spellcheck tests change.
- Select Russian in Preferences > General > Language and check the UI, the native menu bar, and the spellcheck warning state. The native menu needs a restart or a language switch to refresh.

### Known limitation

The app selects `_one` only when `count === 1` and `_other` for every other count. Russian needs three plural forms, so counts 2 through 4 are grammatically wrong. For example, `stats.day_other` renders "2 дней" instead of "2 дня". This is a limitation of the i18n key scheme and needs a separate decision if the project wants full Russian plural support.

---

## TODO-0154-01: Simplified Chinese locale integration checklist

Parent: [`TODO-0154: Integrate the Simplified Chinese locale from PR #354 after the contributor's revision`](TODO.md)

**Status (2026-10-25):** Waiting on the contributor. The review comment asks for three changes: delete line 11 of `src/i18n/index.ts`, change `prefs.security.autoLockRange` to `（5-999）`, and change `prefs.data.moveBackupsConfirmMessage` to `此日记已有备份。`. Do not start the integration until the PR branch contains those fixes and `bun run type-check` passes on it.

**Context**: PR #354 adds `src/i18n/locales/zh-CN.json` with all 733 keys. The file validates against `en.ts`, every placeholder and keyboard shortcut matches, and all ten `_one` / `_other` pairs are identical, which is correct for Chinese. The contributor also added one import line that redeclares `ruLocale`; it fails `tsc --noEmit` with `TS2300` and prevents 50 of 117 test files from loading. The contributor was told that the maintainer will do the registration after merge, following the Russian locale in TODO-0151. Local review report (untracked): `docs/pr-354-analysis.md`. Posted comment (local copy, untracked): `docs/pr-354-response-draft.md`. Review comment: [PR #354 comment](https://github.com/fjrevoredo/mini-diarium/pull/354#issuecomment-6400481628).

### Step 0: confirm the revision

- Fetch the branch again with `git fetch origin pull/354/head:pr-354 --force` and check the head.
- `src/i18n/index.ts` no longer contains `import ruLocale from './locales/zh-CN.json';`.
- `prefs.security.autoLockRange` is `（5-999）`.
- `prefs.data.moveBackupsConfirmMessage` starts with `此日记已有备份。`.
- On the PR branch, `bun run type-check` and `bun run test:run` pass. Clean `master` ran 117 files and 1310 tests at the time of review.

### Wiring

- `src/i18n/index.ts`: add `import zhCNLocale from './locales/zh-CN.json';` and `'zh-CN': flatten(zhCNLocale as unknown as typeof en) as FlatEn,` to `localeMap`. Keep the quoted key because `zh-CN` is a BCP 47 region tag, like `pt-BR`.
- `src/i18n/locales/index.ts`: add `{ code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' }` before English, in alphabetical order.
- `src-tauri/src/commands/menu.rs`: add this arm before the `_ =>` fallback, and add the locale to the test loop:

  ```rust
  "zh-CN" => MenuLabels {
      preferences: "首选项...",
      #[cfg(not(target_os = "macos"))]
      file_menu: "文件",
  },
  ```

### Linux spellcheck

- `src-tauri/src/spellcheck.rs`: add `("zh", "CN")` to `DEFAULT_REGIONS` and a `chinese_default_region` test that asserts `resolve_languages("zh", None) == vec!["zh_CN"]`.
- `flatpak/io.github.fjrevoredo.mini-diarium.yml`: the pinned `libreoffice-26.2.5.2` archive has no `zh_CN` directory, so the `ru_RU` pattern cannot be copied. Decide one of these before changing the manifest:
  - Bundle a third-party Hunspell `zh_CN` dictionary from a pinned archive with a checksum and its licence files, then update the module comment and the Flatpak list in `website/docs-src/07-preferences.md` from eight to nine languages.
  - Record Chinese as a spellcheck exception in the same files. The interface language still works; the Linux warning remains.
- Do not ship a half-configured mapping. Either the dictionary is present, or the exception is written down.

### Docs and release

- Run `bun run sync-languages` to update `README.md` and `website/index.html`.
- Update the shipped-language sentence in `docs/TRANSLATIONS.md` line 9.
- Update the language table and the Flatpak dictionary sentence in `website/docs-src/07-preferences.md` lines 21 and 63.
- Run `bun run website:build-static` to rebuild `website/docs/`, `website/docs/preferences/index.html`, and `website/llms-full.txt`.
- Add a CHANGELOG entry and credit wcxu21 and #354.

### Validation

- `bun run validate:locales` shows `validate-locales: [zh-CN.json] OK (733 keys)`.
- `bun run type-check`, `bun run lint`, and `bun run test:run` pass.
- `cargo test --workspace` passes because the menu and spellcheck tests change.
- Select Chinese in Preferences > General > Language and check the UI, the native menu bar, and the spellcheck state. The native menu needs a language switch or a restart to refresh.

### Open translation notes

- Optional: `prefs.tabWriting` currently uses `记录` for "Writing", which collides with `记录` for "entry". `写作` keeps them distinct; if changed, update `calendar.futureDisabledHint` and `onboarding.tip_toolbar_body` too.
- Optional: the file mixes `...` (12 strings) and `…` (18 strings). English mixes them in the same places, so this is cosmetic.
- Keep the 11 values that are identical to English (`Mini Diarium`, `GitHub`, `URL`, `px`, `12 px`, `24 px`, and date-only templates). They are intentional.
