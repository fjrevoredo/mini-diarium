# Changelog

All notable changes to Mini Diarium are documented here. This project uses [Semantic Versioning](https://semver.org/).

## [0.2.1] — 2026-02-19

### Fixed

- macOS "damaged and can't be opened" error: added ad-hoc code signing (`signingIdentity: "-"`) and updated installation instructions to use `xattr -cr` workaround
- macOS release builds now correctly produce a universal binary (arm64 + x86_64) by passing `--target universal-apple-darwin` to the build step

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
