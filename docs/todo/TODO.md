# TODO

Open tasks and planned improvements. For full context and implementation notes on the original tasks, see [TODO_EXTRA.md](TODO_EXTRA.md).

TODO entry format:

- `- [ ] **TODO-XXXX: Task title** — concise requirement-style description with scope and constraints`
- Every top-level checkbox item must carry a unique `TODO-XXXX` ID (4-digit zero-padded, e.g. `TODO-0001`)
- Indented sub-items are free-form and do **not** carry IDs
- Write items as requirements/acceptance criteria (what must be true), not implementation plans (how to build it)
- Keep implementation details minimal in TODO entries; move deep implementation notes to [TODO_EXTRA.md](TODO_EXTRA.md) when needed
- New IDs are assigned by reading the `Latest TODO ID` marker near the top of this file and incrementing — never reuse IDs
- After creating a new TODO, update the `Latest TODO ID` marker to reflect the new highest ID
- Use the `todo-manager` skill (`.agents/skills/todo-manager/`) for creation, tracking, archival, and validation

**Latest TODO ID: TODO-0066** — next new TODO should be TODO-0067

---

## High Priority

---

- [ ] **TODO-0008: Cursor height too tall after Shift+Enter on macOS (#118)** — the text caret (cursor) height becomes extra long starting on the second line, but only when inserting a soft line break with Shift+Enter (Enter alone works fine); macOS-only (v0.4.20); likely a `line-height` or `font-family` mismatch in ProseMirror's `<br>` handling introduced with new editor fonts in v0.4.20; audit soft-break styling in `src/styles/editor.css` and the `--editor-font-family` / `--editor-font-size` CSS custom properties
- [ ] **TODO-0031: Port todo-manager skill to agent-skills repo** — create a repo-agnostic version of the todo-manager skill in `D:\Repos\agent-skills\todo-manager\SKILL.md`; remove Mini Diarium-specific file paths and conventions; match the structure and patterns of the existing `manual-planning` skill in that repo
---

## Website Priority

- [ ] **TODO-0011: Website SEO/GEO follow-up backlog** — remaining implementation items from the 2026 website SEO/GEO pass
  - **Fix:** replace `transition: all 0.2s` with explicit property lists that exclude layout properties — e.g. `transition: color 0.2s, background-color 0.2s, border-color 0.2s, opacity 0.2s, transform 0.2s`; edit `website/css/style.css` (the source file) and regenerate/copy the hashed output.
  - [ ] **Resolve Cloudflare-injected robots.txt Content-Signal directive** — Cloudflare automatically appends `Content-Signal: search=yes,ai-train=no` to the live robots.txt at the CDN layer; Lighthouse's robots.txt parser flags this as invalid (not part of RFC 9309), costing 8 SEO points (score 92 → 100); the repo `website/robots.txt` is clean — this is a Cloudflare dashboard setting (REPORT.md FIX 2.1)
    - **Fix:** in the Cloudflare dashboard → Security → Bots → Crawler Hints, disable "Content Signals" injection or switch to the HTTP-header equivalent (`X-Robots-Tag: ai-train=no`) if available. No code change in the repo is needed — AI bot blocking is already handled by explicit `User-agent` blocks in the live robots.txt.

---

## Medium Priority

- [ ] **TODO-0050: Update dep-update skills and CI for Nix npmDepsHash** — after PR #159 (Nix flake) merges, update `sync-lockfiles` and `apply-dependency-prs` skills to include the `npmDepsHash` refresh step in `nix/package.nix`, and consider adding a path-filtered CI job to catch stale hashes from contributors who bypass the skills; see [TODO-0050-01](TODO_EXTRA.md#todo-0050-01-skill-and-ci-updates-for-nix-npmdepshash-maintenance) for exact changes. **Part 2 (apply-dependency-prs update) completed 2026-06-29 during the runbook refactor; Parts 1 (sync-lockfiles) and 3 (CI) still pending.**

- [ ] **TODO-0062: Add Statistics, Import, Export to the header overflow menu** — extend the `HeaderMoreMenu` component from TODO-0061 with three more items, each wired to its existing overlay state setter (`setIsStatsOpen`, `setIsImportOpen`, `setIsExportOpen`); mirror the `menu.rs` "lockable" disabled-while-locked state for these three items (Preferences stays always-enabled); update `OnboardingOverlay.tsx`'s Import tour step, which currently points its arrow off-screen at the native OS menu bar, to target the new in-app control instead; see [TODO-0062-01](TODO_EXTRA.md#todo-0062-01-statistics-import-export-menu-items) for exact file/line references
- [ ] **TODO-0063: Add in-app day-navigation and go-to-date controls to the Header** — add `◀`/`▶` day-navigation buttons flanking the Header date title, reusing the existing `navigatePreviousDay`/`navigateNextDay` helpers (extract the logic currently inlined in `MainLayout.tsx`'s `menu-navigate-previous-day`/`next-day` listeners into a shared function called by both the listener and the new buttons); make the date title itself clickable to open the existing `GoToDateOverlay`; audit Header layout at the 800×660 E2E viewport width for overflow risk (`src/CLAUDE.md` gotcha #4, `e2e/CLAUDE.md` gotchas #2–3); see [TODO-0063-01](TODO_EXTRA.md#todo-0063-01-day-navigation-and-go-to-date-controls) for exact file/line references
- [ ] **TODO-0064: E2E coverage for newly in-app-reachable actions** — add/extend WebdriverIO specs in `e2e/specs/` exercising Preferences, Statistics, Import, Export (via the new overflow menu) and day-navigation/go-to-date (via the new Header controls), none of which have E2E coverage today since they were only reachable via the native OS menu bar (untestable through `tauri-driver`'s WebView-level automation); depends on TODO-0061–0063 shipping their `data-testid` hooks first; see [TODO-0064-01](TODO_EXTRA.md#todo-0064-01-e2e-coverage-for-newly-in-app-reachable-actions) for exact scope
- [ ] **TODO-0066: Fix `hover:bg-hover` UnoCSS utility never compiling** — the `hover:bg-hover` class used across the app (e.g. `Header.tsx`'s icon buttons) produces no CSS rule anywhere, because UnoCSS does not recognize `bg-hover` as one of its own theme utilities (it is a hand-authored plain-CSS class, not part of `uno.config.ts`); native `<button>` elements only appear to have a working hover state today because of an unrelated, accidental generic `button:hover { background-color: rgb(37, 99, 235); } ` fallback rule, while non-button elements (e.g. Kobalte menu/dialog items rendered as `<div>`) get no hover feedback at all; fix so `hover:bg-hover` (and any other broken `hover:`-prefixed custom-CSS-class combinations) actually compile to the intended subtle `--bg-hover` token, and audit the resulting visual change across every button currently relying on the accidental blue fallback; see [TODO-0066-01](TODO_EXTRA.md#todo-0066-01-hoverbg-hover-unocss-fix) for investigation notes and affected surface

---

## Low Priority / Future
- [ ] **TODO-0013: Text input extension point** — create a plugin/extension interface for alternative entry methods so official and user plugins can provide text input flows such as dictation, LLM-assisted drafting, and other future capture modes; define capability boundaries, permission model, and how plugins hand content into the editor without weakening the app's privacy guarantees
- [ ] **TODO-0014: Statistics extension point** — add a plugin/extension interface for writing statistics so official and user plugins can calculate custom metrics and surface them in the statistics UI; define the data contract, execution/sandbox constraints, and how custom statistics are registered and rendered without weakening the app's privacy-first local-only model
- [ ] **TODO-0015: Downgrade import path logging** — `commands/import.rs` logs the import file path at `info!` level (line 52 and other locations), leaking the full filesystem path in dev logs; downgrade all path logs to `debug!` level for all import functions
- [ ] **TODO-0017: Document keypair hex in JS heap** — `generate_keypair` returns `KeypairFiles` with `private_key_hex` as plain JSON so the frontend can write it to a file; add a comment on the struct in `auth/mod.rs` or `auth/keypair.rs` noting this is an accepted design tradeoff and that the private key briefly exists in the JS heap before the file is written
- [ ] **TODO-0018: Sync tool integration** — allow users to point their journal directory at a folder managed by Dropbox, Google Drive, Syncthing, or similar tools; the app should detect when `diary.db` is modified externally while locked (file-system watcher or mtime check on unlock) and prompt the user to reload; document the supported workflow in the UI and guard against opening a partially-synced (in-progress) file; note that the app never initiates any network calls — sync is entirely delegated to the external tool
- [ ] **TODO-0019: Mobile version** — Tauri v2 supports iOS and Android targets; evaluate porting the app to mobile: adapt the SolidJS UI for touch (larger tap targets, bottom navigation, swipe gestures for day navigation), handle mobile file-system sandboxing for the journal location, and assess whether the Argon2id parameters need tuning for mobile CPU/memory constraints
- [ ] **TODO-0038: Remove legacy `require_all_auth` config migration** — once the release boundary is agreed, remove the legacy `JournalConfig.require_all_auth` field, its migration function `migrate_require_all_auth_to_db`, and all call sites from backend and frontend; the DB-settings-backed implementation that replaced it stays untouched; requires maintainer approval before execution; see TODO-0038-01 for full steps
- [ ] **TODO-0065: Remove redundant native menu items once in-app equivalents ship** — after TODO-0061–0064 ship, remove the now-duplicated native menu entries from `menu.rs`: Previous/Next Day, Go to Date, Statistics, Import, Export; preserve their keyboard accelerators by converting them from native-menu-triggered to JS-level `keydown` listeners (same pattern as the existing `Cmd/Ctrl+F` search shortcut handled in `MainLayout.handleSearchShortcut`, not through the native menu) so power users keep `CmdOrCtrl+[`/`]`/`G` etc.; do **not** remove Quit, Services/Hide/Show All, Window management, the macOS Edit menu (Undo/Redo/Cut/Copy/Paste/Select All), or the Preferences native menu item (macOS convention expects `Cmd+,` under the App menu regardless of in-app access); requires maintainer approval before execution (same gate pattern as TODO-0038) since it changes native menu structure and removes a fallback access path; explicitly blocked on TODO-0061–0064; see [TODO-0065-01](TODO_EXTRA.md#todo-0065-01-native-menu-removal-scope) for exact removal scope
- [ ] **TODO-0039: Re-evaluate `glib` Dependabot alert when Tauri upgrades webkit2gtk bindings** — Dependabot alert #6 (`glib 0.18.5`, medium) was dismissed as a tolerated risk: the vulnerability is in `glib::VariantStrIter` (Linux-only, UB via unsound iterator impl), the app has zero direct `glib` usage, and upgrading requires `gtk 0.20` + `webkit2gtk 2.1.x` Rust bindings that do not yet exist in a Tauri-compatible release; re-evaluate when Tauri ships a `wry` version that pulls in `gtk-rs 0.20`-based webkit2gtk bindings
