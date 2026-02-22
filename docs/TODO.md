# TODO

Open tasks and planned improvements. For full context and implementation notes on the original tasks, see [OPEN_TASKS.md](OPEN_TASKS.md).

---

## High Priority

- [x] **Fix keyboard shortcuts** — bracket-key accelerators replace arrow-key combos; removed duplicate frontend listener layer that caused double-firing; eliminated editor/DevTools conflicts
- [x] **Diary directory selection** — let users choose where their diary file lives; add `change_diary_directory` command and wire it into Preferences
- [ ] **Extension system** — plugin/extension API allowing third-party integrations (import formats, export targets, themes); architecture TBD

---

## Medium Priority

- [x] **CI diagram diffing** — the "Verify diagrams are up-to-date" step in `ci.yml` now compares each regenerated `*-check.svg` file against its committed counterpart and fails CI with an actionable message when any diagram is stale or mismatched
- [ ] **Modernize release workflow** — replace deprecated `actions/create-release@v1` with `softprops/action-gh-release`, add artifact verification
- [x] **Platform-specific menus** — macOS App menu (About, Preferences, Quit), Windows/Linux File menu; disable items when diary is locked
- [ ] **Auto-lock on screen lock (macOS parity)** — Windows implementation is done; add macOS native screen-lock hook so behavior matches across desktop platforms
- [ ] **Auto-update system** — in-app update notifications via `@tauri-apps/plugin-updater`
- [ ] **i18n framework** — detect OS locale, set up translation files (`en.json`, `es.json`), add `t()` helper
- [ ] **Translate all UI text** — replace hardcoded strings with translation keys (~145 keys); depends on i18n framework above
- [ ] **E2E tests for critical workflows** — first-time setup, unlock/lock, import/export, preferences, theme switching (8 scenarios); depends on E2E setup above
- [ ] **First-launch existing diary picker** — when no diary is found, offer “Open Existing Diary...” to select an existing `diary.db` location (cloud-synced folders, external locations) instead of only showing “create new diary”
- [ ] **Backup behavior docs** — explain backup trigger/rotation/path behavior and how it works with custom diary locations and moved/externally stored `diary.db` files
- [x] **Split `commands/auth.rs` into sub-modules** — the file is ~1100 lines covering core auth, auth-method management, and directory management; split into `auth_core.rs`, `auth_methods.rs`, `auth_directory.rs` without changing any public API. Pure refactor.
- [ ] **`screen_lock.rs` unit tests** — the Windows session-lock hook is untested because it calls Win32 APIs directly; extract `trigger_auto_lock` and test it with a mock `DiaryState`; requires Win32 API mocking strategy.

---

## Low Priority / Future

- [ ] **PDF export** — convert diary entries to PDF (A4); likely via Tauri webview printing
- [ ] **Release build profile** — add `[profile.release]` to `Cargo.toml` with `opt-level = 3` and `lto = true` for smaller, faster distribution binaries
- [ ] **Downgrade import path logging** — `commands/import.rs` logs the import file path at `info!` level, leaking the full filesystem path in dev logs; downgrade to `debug!`
- [ ] **Document `backup.rs` assumptions** — add comments explaining: (1) `fs::copy` on an open SQLite file is safe with the default journal mode but would produce inconsistent backups if WAL mode were ever adopted (prefer `sqlite3_backup_init` in that case); (2) backup filenames use ISO-8601-like format so lexicographic sort equals chronological sort
- [ ] **`DiaryEntry` clone efficiency** — `DiaryEntry` derives `Clone` and is heap-copied for each entry during import; pass references where possible to reduce allocations when importing thousands of entries
- [ ] **Document keypair hex in JS heap** — `generate_keypair` returns `KeypairFiles` with `private_key_hex` as plain JSON so the frontend can write it to a file; add a comment on the struct noting this is an accepted design tradeoff and that the private key briefly exists in the JS heap
- [ ] **Accessibility audit** — ARIA labels, focus trapping in overlays, keyboard calendar navigation, color contrast, screen reader testing (NVDA / VoiceOver)
- [ ] **Mobile version** — Tauri v2 supports iOS and Android targets; evaluate porting the app to mobile: adapt the SolidJS UI for touch (larger tap targets, bottom navigation, swipe gestures for day navigation), handle mobile file-system sandboxing for the diary DB location, and assess whether the Argon2id parameters need tuning for mobile CPU/memory constraints
