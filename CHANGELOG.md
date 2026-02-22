# Changelog

All notable changes to Mini Diarium are documented here. This project uses [Semantic Versioning](https://semver.org/).

## [0.4.0] — Unrealesed

### Added

### Fixed

- **Keyboard shortcuts overhauled**: bracket-key accelerators (`CmdOrCtrl+[`/`]` for previous/next day, `CmdOrCtrl+Shift+[`/`]` for previous/next month) replace the old arrow-key combos that conflicted with OS and TipTap text-navigation bindings. Removed the duplicate frontend `keydown` listener (`shortcuts.ts`) that caused every shortcut to fire twice. Removed accelerators from Statistics, Import, and Export that conflicted with TipTap italic (`Ctrl+I`) and Chromium DevTools (`Ctrl+Shift+I`). All shortcut definitions now live exclusively in `menu.rs` as OS-level menu accelerators.
- **CI diagram verification now detects stale outputs**: the "Verify diagrams are up-to-date" workflow step now compares each regenerated `*-check.svg` file with its committed SVG counterpart and fails with a clear remediation message when any diagram differs.
- **Flaky diagram CI diffs resolved**: diagram rendering/checking is now centralized in `scripts/render-diagrams.mjs` and `scripts/verify-diagrams.mjs`; Mermaid always renders with a consistent Puppeteer config in both local and CI runs; CI uses `bun run diagrams:check` (project-locked Mermaid CLI instead of `bun x mmdc`), workflow Bun installs now use `--frozen-lockfile`, Bun is pinned to `1.2`, and D2 is pinned/validated at `v0.7.1` to prevent toolchain drift.
- **Editor now scales better on large/fullscreen windows**: the main writing column keeps the existing compact behavior on smaller screens, but expands its max width on larger displays and increases the editor's default writing area height on tall viewports to reduce unused space below the editor.

### Changed


## [0.3.0] — 2026-02-21

### Added

- **macOS menu bar**: proper App menu (About, Preferences, Services, Hide, Quit), Edit menu (Undo/Redo, Cut/Copy/Paste/Select All for standard keyboard shortcuts), and Window menu (Minimize, Zoom, Close). The custom menu is now installed app-wide via Tauri `AppHandle::set_menu` (instead of `window.set_menu`, which is unsupported on macOS), so menu actions and shortcuts work correctly on macOS.
- **Lock-state menu enforcement**: Navigation and Diary menu items are disabled while the diary is locked and automatically re-enable on unlock, preventing spurious menu actions on the lock screen. File/Help items (Preferences, About, Quit) remain available at all times.
- **About from menu**: Help › About (Windows/Linux) and Mini Diarium › About (macOS) now open the About overlay.
- **Auto-lock on Windows session lock/suspend**: the app now listens for native Windows session/power events and auto-locks the diary when the session is locked/logged off or the system is suspending.
- **E2E test suite**: end-to-end tests using WebdriverIO + tauri-driver that exercise the full app stack (real binary, real SQLite). The core workflow test covers diary creation, writing an entry, locking, and verifying persistence after unlock. Run locally with `bun run test:e2e`; runs automatically in CI on Ubuntu after the build step.

### Security

- **Key material zeroized on all exit paths**: wrapping keys derived during `wrap_master_key` and `unwrap_master_key` are now explicitly zeroed before returning on both the success path and every error path (wrong password, wrong key file, decryption failure). Previously the wrapping key bytes could remain in memory whenever an incorrect credential was entered.
- **Auth structs zeroize on drop**: `PasswordMethod` and `PrivateKeyMethod` now implement `ZeroizeOnDrop`; memory is reliably overwritten when the struct is dropped, regardless of call site.
- **Keypair unlock buffer zeroized**: the intermediate `Vec<u8>` holding private key bytes decoded from the key file during `unlock_diary_with_keypair` is now explicitly zeroized immediately after copying into the stack array.
- **`SecretBytes` newtype for decrypted master key**: `unwrap_master_key` now returns `SecretBytes` (a `ZeroizeOnDrop` wrapper) instead of a bare `Vec<u8>`, enforcing automatic cleanup of master key material regardless of whether the caller remembers to call `.zeroize()`.
- **Mutex poisoning handled gracefully**: all Tauri command handlers now propagate a `"State lock poisoned"` error instead of panicking via `.unwrap()` if a thread panics while holding the diary state lock. Previously a single panicking thread could permanently crash the app for the user.
- **Diary directory config rejects relative paths**: `config.json` entries with relative paths (e.g. `../../etc/passwd`) are now silently rejected; only absolute paths are accepted.
- **`migrate_v3_to_v4` is now atomic**: the two-statement migration that drops the plaintext FTS table and bumps the schema version is now wrapped in a single `BEGIN IMMEDIATE`/`COMMIT` transaction, consistent with other migrations.

### Fixed

- **Ordered lists in Markdown export**: entries containing numbered lists (`<ol>`) now export as `1. First`, `2. Second`, etc. instead of being silently converted to unordered bullet lists.
- **Word counts inflated by HTML markup**: word counts for entries written in the rich-text editor were inflated because HTML tags (`<p>`, `<strong>`, `<em>`, etc.) were counted as word tokens. `count_words` now strips tags before counting. Existing stored word counts are not retroactively corrected, but new writes and updates are accurate.
- **Export JSON version always showed `0.1.0`**: the `metadata.version` field in JSON exports now reflects the actual app version instead of the hardcoded string `"0.1.0"`.
- **Startup directory errors are now logged**: failure to determine the system app-data directory or to create the app directory now emits a warning to the log instead of silently falling back or ignoring the error.
- **Export no longer does N+1 queries**: JSON and Markdown export previously fetched entry dates and then queried each entry individually. All entries are now fetched and decrypted in a single SQL query.
- E2E CI failure on Linux: `browserName: 'edge'` is now set only on Windows (required by msedgedriver/WebView2) and omitted entirely on Linux. WebKitWebDriver (webkit2gtk-driver) rejects both `'edge'` and an empty string `''`; omitting the key means no browser-name constraint is imposed, which satisfies WebKitWebDriver's W3C capability matching.
- E2E spec (`e2e/specs/diary-workflow.spec.ts`) is now excluded from the Vitest unit test run, preventing a `ReferenceError: browser is not defined` failure when running `bun run test:run`.
- macOS CI build failure with Tauri `2.10.x`: updated predefined menu item calls to the current API (`services/hide/hide_others/show_all` now pass `None` label argument, and Window menu `zoom` was replaced with `maximize`).
- Bundle identifier warning on macOS: changed app identifier from `com.minidiarium.app` to `com.minidiarium`, and added startup compatibility fallback so existing installs using the legacy `com.minidiarium.app` app-data directory continue to load their existing diary/config.
- **Auto-lock UI desync after OS lock**: backend lock operations now emit a `diary-locked` event so the frontend immediately transitions to the lock screen instead of remaining in an unusable unlocked layout.

- **Custom diary location**: choose where your diary file is stored (Preferences → Diary File → Change Location). The file is moved to the selected folder and the choice persists across restarts, enabling cloud sync via Dropbox, OneDrive, or any folder-based sync tool. The diary is automatically locked during the move; the app reloads so you can re-authenticate from the new location.
- **Website contact obfuscation**: footer email link now renders via `data-*` attributes plus inline script so the address is reconstructed in the browser and not present in the raw HTML.

### Changed

- **Documentation diagrams synced with codebase**: refreshed architecture/context diagrams to match the current SolidJS signal state model, command/backend layout, and security posture (no plaintext search index); updated stale `AGENTS.md`/`CLAUDE.md` diagram references and regeneration instructions; added light-theme `architecture.svg` generation and CI existence checks alongside `architecture-dark.svg`.



## [0.2.1] — 2026-02-19

### Added

- Public website at [mini-diarium.com](https://mini-diarium.com) (`website/` subfolder, served via nginx on Docker)
- Website SEO: canonical URL, author meta, JSON-LD `SoftwareApplication` structured data, `og:image` switched to GIF, `twitter:card` upgraded to `summary_large_image`, `<main>` landmark, `id="demo"` anchor, `robots.txt`, `sitemap.xml`

### Fixed

- Website: Proofreading, fixed corrupted Linux platform icon SVG path, added `width`/`height` to demo GIF to prevent layout shift
- macOS "damaged and can't be opened" error: added ad-hoc code signing (`signingIdentity: "-"`) and updated installation instructions to use `xattr -cr` workaround
- macOS release builds now correctly produce a universal binary (arm64 + x86_64) by passing `--target universal-apple-darwin` to the build step
- The entries_skipped field was declared but never used, it was added a condition in the for loop to skip and count entries that have no meaningful content rather than inserting empty records. by @Yujonpradhananga



## [0.2.0] — 2026-02-18

### Added

- **Key file authentication**: unlock your diary with an X25519 private key file instead of (or in addition to) your password
- **Multiple unlock methods**: register more than one key file alongside your password; all are listed and manageable in Preferences → Authentication Methods
- **Key file generation**: generate a new X25519 keypair and save the private key to a `.key` file directly from Preferences
- **Auth Methods section in Preferences**: view all registered unlock methods, add a new key file, or remove existing ones (the last remaining method is always protected)
- `verify_password` command for side-effect-free password validation, used internally before multi-step operations
- **Lock button**: lock the diary instantly from the header toolbar without closing the app
- **About dialog**: view app version, description, license, and a link to the GitHub repository via the Info button in the header

### Security

- Remove plaintext FTS search index (`entries_fts` table); existing databases are migrated to schema v4 which drops the table on first unlock. Search is disabled until a secure implementation is available.
- Key file now written with mode 0o600 (owner read/write only) on Unix; Windows relies on NTFS ACLs (H1)
- Import commands now reject files larger than 100 MB to prevent out-of-memory conditions (H2)
- Content Security Policy enabled in webview (M2)

### Fixed

- Password change now enforces 8-character minimum, consistent with diary creation (M1)
- Backup files now use `.db` extension instead of `.txt` (L1)
- Confirmation dialogs for removing an auth method and resetting the diary now use native Tauri dialogs instead of `window.confirm()`, which was silently returning `true` in WebView2 on Windows regardless of user input
- Add Password form now appears in Preferences → Authentication Methods when the password slot has been removed, allowing users to re-register a password via the `register_password` command (uses the master key already held in the unlocked session)

### Changed

- Clicking a day in the calendar sidebar now automatically collapses the sidebar so the selected entry is immediately visible
- Backend error messages mapped to user-friendly strings before display in the UI (M3)
- Export overlay now warns that exported files are unencrypted plaintext (L4)
- Database schema upgraded to v3: entries are now encrypted with a random master key, with each authentication method storing its own wrapped copy in a new `auth_slots` table (replaces the `password_hash` table)
- `change_password` now re-wraps the master key in O(1) — no entry re-encryption required regardless of diary size
- Existing v1 and v2 databases are automatically migrated to v3 then v4 on the first unlock
- App icon and logo updated across all platforms (Windows ICO, macOS ICNS, Linux PNG, Windows AppX, iOS, Android); logo also shown on the unlock and diary creation screens



## [0.1.0] — 2026-02-16

### Added

- Password-based diary creation and unlock with Argon2id hashing
- AES-256-GCM encryption for all diary entries at rest
- Rich text editor powered by TipTap (bold, italic, lists, headings, blockquotes, code blocks, links)
- Entry titles with optional hide-titles preference
- Auto-save with debounced writes and automatic deletion of empty entries
- Calendar sidebar with entry indicators and month navigation
- Full-text search via SQLite FTS5 with snippet highlighting
- Keyboard shortcuts and application menu for navigation (previous/next day, previous/next month, go to today, go to date)
- Import from Mini Diary JSON and Day One JSON formats with merge conflict resolution
- Export to JSON and Markdown formats
- Statistics overlay (total entries, total words, average words, longest/current streaks, entries per weekday)
- Preferences (theme selection, first day of week, allow future entries, hide titles, spellcheck toggle, password change, diary reset)
- Go to Date overlay with date picker
- Light and dark theme support
- Automatic database backups with rotation
- Live word count display
- Cross-platform support (Windows, macOS, Linux)
- CI/CD pipeline with lint, test, and build jobs across all three platforms
