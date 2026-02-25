# TODO

Open tasks and planned improvements. For full context and implementation notes on the original tasks, see [OPEN_TASKS.md](OPEN_TASKS.md).

---

## High Priority

- [x] **Fix keyboard shortcuts** (2026-02-25) — bracket-key accelerators replace arrow-key combos; removed duplicate frontend listener layer that caused double-firing; eliminated editor/DevTools conflicts
- [x] **Diary directory selection** (2026-02-21) — let users choose where their diary file lives; add `change_diary_directory` command and wire it into Preferences
- [x] **Multiple journals with login-time switching** (2026-02-25) — allow configuring multiple journals and selecting which one to unlock at login; keep all existing functionality working without regressions and implement it with minimal UI changes (no major redesign)
- [x] **Extension system** (2026-02-25) — plugin/extension API allowing third-party integrations (import formats, export targets, themes); architecture TBD; implemented with plugin registry, Rhai loader, and builtin parsers (see `src-tauri/src/plugin/`); wired into `ImportOverlay.tsx` and `ExportOverlay.tsx`

---

## Medium Priority

- [x] **CI diagram diffing** (2026-02-25) — diagram rendering/checking is centralized in `scripts/render-diagrams.mjs` + `scripts/verify-diagrams.mjs`; CI uses `bun run diagrams:check` (locked Mermaid dependency) and fails with actionable output when any diagram is stale or mismatched
- [ ] **Restore CI diagram content-diff check** — the byte-comparison check in `scripts/verify-diagrams.mjs` was reverted to existence-only because mmdc/d2 produce slightly different SVG bytes depending on version (local vs CI runners differ). The proper fix is to pin identical tool versions in both CI and local dev (e.g. lock `@mermaid-js/mermaid-cli` in `devDependencies` and `d2` via a specific release download in CI), then re-add the byte comparison. Until then, `diagrams:check` only verifies that all 8 `.svg` files are present.
- [x] **Modernize release workflow** (2026-02-21) — replace deprecated `actions/create-release@v1` with `softprops/action-gh-release@v2`; done in `.github/workflows/release.yml`
- [x] **Platform-specific menus** (2026-02-21) — macOS App menu (About, Preferences, Quit), Windows/Linux File menu; disable items when diary is locked
- [ ] **Auto-lock on screen lock (macOS parity)** — Windows implementation is done; add macOS native screen-lock hook so behavior matches across desktop platforms
- [ ] **Auto-update system** — in-app update notifications via `@tauri-apps/plugin-updater`
- [ ] **i18n framework** — detect OS locale, set up translation files (`en.json`, `es.json`), add `t()` helper
- [ ] **Translate all UI text** — replace hardcoded strings with translation keys (~145 keys); depends on i18n framework above
- [ ] **E2E tests for critical workflows** — expand beyond the single current test (`diary-workflow.spec.ts` with 1 test); add scenarios for: first-time setup, import/export, preferences, theme switching, auth methods (keypair), menu events, auto-lock, and backup verification (7 additional tests needed; E2E setup completed v0.3.0)
- [ ] **Frontend test coverage** — auth screens (`PasswordPrompt.tsx`, `PasswordCreation.tsx`), Calendar, and all overlays (GoToDateOverlay, PreferencesOverlay, StatsOverlay, ImportOverlay, ExportOverlay) have zero test coverage; add Vitest + @solidjs/testing-library tests for each; use existing pattern from `TitleEditor.test.tsx` and `WordCount.test.tsx`
- [ ] **First-launch existing diary picker** — when no diary is found, offer “Open Existing Diary...” to select an existing `diary.db` location (cloud-synced folders, external locations) instead of only showing “create new diary”
- [x] **Backup behavior docs** (2026-02-21) — explain backup trigger/rotation/path behavior and how it works with custom diary locations and moved/externally stored `diary.db` files
- [x] **Split `commands/auth.rs` into sub-modules** (2026-02-25) — the file is ~1100 lines covering core auth, auth-method management, and directory management; split into `auth_core.rs`, `auth_methods.rs`, `auth_directory.rs` without changing any public API. Pure refactor; completed as of v0.4.0 (files exist in `src-tauri/src/commands/auth/`)
- [ ] **`screen_lock.rs` unit tests** — the Windows session-lock hook is untested because it calls Win32 APIs directly; extract `trigger_auto_lock` and test it with a mock `DiaryState`; requires Win32 API mocking strategy.

---

## Low Priority / Future

- [ ] **PDF export** — convert diary entries to PDF (A4); likely via Tauri webview printing
- [ ] **Release build profile** — add `[profile.release]` to `Cargo.toml` with `opt-level = 3` and `lto = true` for smaller, faster distribution binaries
- [ ] **Downgrade import path logging** — `commands/import.rs` logs the import file path at `info!` level (line 52 and other locations), leaking the full filesystem path in dev logs; downgrade all path logs to `debug!` level for all import functions
- [x] **Document `backup.rs` assumptions** (2026-02-21) — add comments explaining: (1) `fs::copy` on an open SQLite file is safe with the default journal mode but would produce inconsistent backups if WAL mode were ever adopted (prefer `sqlite3_backup_init` in that case); (2) backup filenames use ISO-8601-like format so lexicographic sort equals chronological sort
- [ ] **`DiaryEntry` clone efficiency** — `DiaryEntry` in `db/queries.rs` derives `Clone` and is heap-copied for each entry during import (see `import/merge.rs` usage); pass references where possible to reduce allocations when importing thousands of entries; audit call sites in merge logic
- [ ] **Document keypair hex in JS heap** — `generate_keypair` returns `KeypairFiles` with `private_key_hex` as plain JSON so the frontend can write it to a file; add a comment on the struct in `auth/mod.rs` or `auth/keypair.rs` noting this is an accepted design tradeoff and that the private key briefly exists in the JS heap before the file is written
- [ ] **Accessibility audit** — Only 5 ARIA labels exist (Calendar nav buttons, EditorToolbar buttons); missing ARIA on: overlays, form inputs, dialogs, focus trapping, keyboard calendar navigation; add color contrast testing, screen reader testing (NVDA / VoiceOver)
- [ ] **Mobile version** — Tauri v2 supports iOS and Android targets; evaluate porting the app to mobile: adapt the SolidJS UI for touch (larger tap targets, bottom navigation, swipe gestures for day navigation), handle mobile file-system sandboxing for the diary DB location, and assess whether the Argon2id parameters need tuning for mobile CPU/memory constraints
