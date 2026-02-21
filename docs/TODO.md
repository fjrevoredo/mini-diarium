# TODO

Open tasks and planned improvements. For full context and implementation notes on the original tasks, see [OPEN_TASKS.md](OPEN_TASKS.md).

---

## High Priority

- [ ] **Fix keyboard shortcuts** — most shortcuts are currently broken; audit and restore all bindings in `shortcuts.ts` and `menu.rs`
- [x] **Diary directory selection** — let users choose where their diary file lives; add `change_diary_directory` command and wire it into Preferences
- [ ] **Accessibility audit** — ARIA labels, focus trapping in overlays, keyboard calendar navigation, color contrast, screen reader testing (NVDA / VoiceOver)
- [ ] **Final QA pass** — comprehensive manual test run on Windows, macOS, and Linux before each release

---

## Medium Priority

- [ ] **CI diagram diffing** — the "Verify diagrams are up-to-date" step in `ci.yml` regenerates `*-check.svg` files but only checks that the committed SVGs exist, then deletes the check files without comparing them; stale or wrong diagrams pass CI undetected. Fix: diff each `-check.svg` against its committed counterpart (e.g. `diff` or pixel-compare) and fail if they differ
- [ ] **Modernize release workflow** — replace deprecated `actions/create-release@v1` with `softprops/action-gh-release`, add artifact verification
- [x] **Platform-specific menus** — macOS App menu (About, Preferences, Quit), Windows/Linux File menu; disable items when diary is locked
- [ ] **Auto-lock on screen lock (macOS parity)** — Windows implementation is done; add macOS native screen-lock hook so behavior matches across desktop platforms
- [ ] **Auto-update system** — in-app update notifications via `@tauri-apps/plugin-updater`
- [ ] **i18n framework** — detect OS locale, set up translation files (`en.json`, `es.json`), add `t()` helper
- [ ] **Translate all UI text** — replace hardcoded strings with translation keys (~145 keys); depends on i18n framework above
- [ ] **E2E test setup** — configure Playwright for Tauri, add fixtures and helpers under `tests/e2e/`
- [ ] **E2E tests for critical workflows** — first-time setup, unlock/lock, import/export, preferences, theme switching (8 scenarios); depends on E2E setup above
- [ ] **First-launch existing diary picker** — when no diary is found, offer “Open Existing Diary...” to select an existing `diary.db` location (cloud-synced folders, external locations) instead of only showing “create new diary”
- [ ] **Backup behavior docs** — explain backup trigger/rotation/path behavior and how it works with custom diary locations and moved/externally stored `diary.db` files

---

## Low Priority / Future

- [ ] **PDF export** — convert diary entries to PDF (A4); likely via Tauri webview printing
- [ ] **Extension system** — plugin/extension API allowing third-party integrations (import formats, export targets, themes); architecture TBD
