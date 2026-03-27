# CLAUDE.md — Mini Diarium

**Mini Diarium** is an encrypted, local-first desktop journaling app (SolidJS + Rust/Tauri v2 + SQLite). All diary entries are AES-256-GCM encrypted at rest; plaintext never touches disk.

**Core principles:** privacy-first (no network), incremental dev, clean architecture, TypeScript strict + Rust type safety.

**Platforms:** Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+, Fedora, Arch).

**Status:** See `docs/OPEN_TASKS.md` for structured roadmap items and `docs/TODO.md` for the working backlog.

## Domain Guides

For domain-specific conventions, gotchas, and checklists, see:
- [Frontend (src/)](src/CLAUDE.md) — SolidJS, state, i18n, testing, TipTap, theme
- [Backend (src-tauri/)](src-tauri/CLAUDE.md) — Tauri commands, Rust patterns, plugins, security, search implementation
- [E2E (e2e/)](e2e/CLAUDE.md) — WebdriverIO, tauri-driver, viewport rules, E2E mode contracts

## Architecture

**Visual diagrams**:
- [System context](docs/diagrams/context.mmd) - High-level local-only data flow (Mermaid)
- [Unlock flow](docs/diagrams/unlock.mmd) - Password/key-file unlock flow through DB open, backup rotation, and unlocked session (Mermaid)
- [Save-entry flow](docs/diagrams/save-entry.mmd) - Multi-entry editor persistence flow with create/save/delete and date refresh (Mermaid)
- [Layered architecture](docs/diagrams/architecture.svg) - Presentation/state/backend/data layers including journals, config, and plugins (D2)

**Regenerate diagrams:** `bun run diagrams` — regenerates all `docs/diagrams/` SVGs; `.mmd` sources via mmdc, `.d2` sources via d2.

Quick reference (ASCII art):

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                         │
│                    (SolidJS Components)                       │
│  ┌──────────┐ ┌────────┐ ┌────────────┐ ┌────────┐ ┌──────────┐ │
│  │ Journals │ │  Auth  │ │ MainLayout │ │ Search │ │ Overlays │ │
│  └──────────┘ └────────┘ └────────────┘ └────────┘ └──────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ Reactive Signals
┌────────────────────────────┴────────────────────────────────────┐
│                       STATE LAYER                               │
│ auth.ts · entries.ts · journals.ts · search.ts · ui.ts · preferences.ts │
└────────────────────────────┬────────────────────────────────────┘
                             │ invoke() / listen()
┌────────────────────────────┴────────────────────────────────────┐
│                      BACKEND (Rust)                             │
│ Cmds: auth · entries · search · nav · stats · import/export · plugin │
│ Biz: crypto/ · db/ · import/ · export/ · plugin/ · menu.rs · config.rs│
└────────────────────────────┬────────────────────────────────────┘
                             │
           ┌──────────┬──────────────┬─────────────┬──────────────┐
           │ diary.db │ config.json  │ backups/    │ plugins/     │
           │ encrypted│ journals     │ rotated     │ Rhai scripts │
           └──────────┴──────────────┴─────────────┴──────────────┘
```

**Key relationships:**
- Entries are stored encrypted in SQLite. Each entry has a unique integer `id` (PRIMARY KEY AUTOINCREMENT) and can have a unique date. Multiple entries per date are supported (schema v5). Full-text search is not currently implemented; `entries_fts` has been removed (schema v4). See `commands/search.rs` for the stub and interface contract.
- Menu events flow: Rust `app.emit("menu-*")` → frontend `listen()` in `shortcuts.ts` or overlay components.
- Preferences use `localStorage` (not Tauri store plugin).
- Multiple journals are tracked in `{app_data_dir}/config.json` via `JournalConfig` entries. Each journal maps to a directory containing its own `diary.db`. `DiaryState` holds a single connection; switching journals updates `db_path`/`backups_dir` and auto-locks. Legacy single-diary configs are auto-migrated on first `load_journals()` call.

## Website (`website/`)

Static marketing site — plain HTML/CSS/JS, no build step. Deploy via Coolify using `website/docker-compose.yml`.
**Version sync:** `bump-version.sh` updates `<span class="app-version">` in `website/index.html`. Always commit it alongside version files.

## Command Registry

All 49 registered Tauri commands (source: `lib.rs`). Rust names use `snake_case`; frontend wrappers in `src/lib/tauri.ts` use `camelCase`.

| Module | Rust Command | Frontend Wrapper | Description |
|--------|-------------|-----------------|-------------|
| auth | `create_diary` | `createJournal(password)` | Create new encrypted DB |
| auth | `unlock_diary` | `unlockJournal(password)` | Decrypt and open DB |
| auth | `lock_diary` | `lockJournal()` | Close DB connection |
| auth | `diary_exists` | `journalExists()` | Check if DB file exists |
| auth | `check_diary_path` | `checkJournalPath(dir)` | Stateless check: true if `{dir}/diary.db` exists |
| auth | `is_diary_unlocked` | `isJournalUnlocked()` | Check unlock state |
| auth | `get_diary_path` | `getJournalPath()` | Return journal file path |
| auth | `change_diary_directory` | `changeJournalDirectory(newDir)` | Change journal directory (locked state only) |
| auth | `change_password` | `changePassword(old, new)` | Re-encrypt with new password |
| auth | `reset_diary` | `resetJournal()` | Delete and recreate DB |
| auth | `verify_password` | `verifyPassword(password)` | Validate password without side effects |
| auth | `unlock_diary_with_keypair` | `unlockJournalWithKeypair(keyPath)` | Open DB via private key file |
| auth | `list_auth_methods` | `listAuthMethods()` | List all registered auth slots |
| auth | `generate_keypair` | `generateKeypair()` | Generate X25519 keypair, return hex |
| auth | `write_key_file` | `writeKeyFile(path, privateKeyHex)` | Write private key hex to file |
| auth | `register_password` | `registerPassword(newPassword)` | Register a password auth slot (requires journal unlocked) |
| auth | `register_keypair` | `registerKeypair(currentPassword, publicKeyHex, label)` | Add keypair auth slot |
| auth | `remove_auth_method` | `removeAuthMethod(slotId, currentPassword)` | Remove auth slot (guards last) |
| auth | `list_journals` | `listJournals()` | List configured journals from config.json |
| auth | `get_active_journal_id` | `getActiveJournalId()` | Get active journal ID |
| auth | `add_journal` | `addJournal(name, path)` | Add a new journal entry to config |
| auth | `remove_journal` | `removeJournal(id)` | Remove journal (guards last); auto-locks if active |
| auth | `rename_journal` | `renameJournal(id, name)` | Rename a journal |
| auth | `switch_journal` | `switchJournal(id)` | Auto-lock, switch db_path/backups_dir, persist active |
| entries | `create_entry` | `createEntry(date)` | Create blank entry, returns DiaryEntry with assigned id |
| entries | `save_entry` | `saveEntry(id, title, text)` | Update entry by id (encrypts) |
| entries | `get_entries_for_date` | `getEntriesForDate(date)` | Fetch all entries for a date (newest-first) |
| entries | `delete_entry_if_empty` | `deleteEntryIfEmpty(id, title, text)` | Remove entry by id if content is empty |
| entries | `delete_entry` | `deleteEntry(id)` | Delete entry by id unconditionally |
| entries | `get_all_entry_dates` | `getAllEntryDates()` | List all dates with entries |
| files | `read_file_bytes` | `readFileBytes(path)` | Read local image file bytes (jpg/jpeg/png/gif/webp/bmp) |
| search | `search_entries` | `searchEntries(query)` | Stub — always returns `[]`; interface preserved for future secure search |
| nav | `navigate_previous_day` | `navigatePreviousDay(currentDate)` | Previous day with entry |
| nav | `navigate_next_day` | `navigateNextDay(currentDate)` | Next day with entry |
| nav | `navigate_to_today` | `navigateToToday()` | Today's date string |
| nav | `navigate_previous_month` | `navigatePreviousMonth(currentDate)` | Same day, previous month |
| nav | `navigate_next_month` | `navigateNextMonth(currentDate)` | Same day, next month |
| stats | `get_statistics` | `getStatistics()` | Aggregate stats (streaks, counts, words) |
| import | `import_minidiary_json` | `importMiniDiaryJson(filePath)` | Parse + import Mini Diary format |
| import | `import_dayone_json` | `importDayOneJson(filePath)` | Parse + import Day One JSON format |
| import | `import_dayone_txt` | `importDayOneTxt(filePath)` | Parse + import Day One TXT format |
| import | `import_jrnl_json` | `importJrnlJson(filePath)` | Parse + import jrnl JSON format |
| export | `export_json` | `exportJson(filePath)` | Export all entries as JSON |
| export | `export_markdown` | `exportMarkdown(filePath)` | Export all entries as Markdown |
| plugin | `list_import_plugins` | `listImportPlugins()` | List all import plugins (built-in + Rhai) |
| plugin | `list_export_plugins` | `listExportPlugins()` | List all export plugins (built-in + Rhai) |
| plugin | `run_import_plugin` | `runImportPlugin(pluginId, filePath)` | Run import via plugin registry |
| plugin | `run_export_plugin` | `runExportPlugin(pluginId, filePath)` | Run export via plugin registry |
| debug | `generate_debug_dump` | `generateDebugDump(filePath, preferencesJson)` | Write privacy-safe diagnostic JSON to file |

## Conventions

### Error Handling (IPC Contract)

- Backend returns `Result<T, String>`; frontend wraps `invoke()` calls with `try/catch` and sets error signals.
- **Always sanitize raw Tauri error strings with `mapTauriError()` from `src/lib/errors.ts` before displaying to users** — it strips paths, OS codes, and crypto internals.

### Naming

| Context | Convention | Example |
|---------|-----------|---------|
| TS signals | `camelCase` + `set` prefix | `isLoading` / `setIsLoading` |
| CSS | UnoCSS utility classes | `class="flex items-center gap-2"` |
| Dates | `YYYY-MM-DD` string | `"2024-01-15"` |

### Menu Event Pattern

Rust emits → frontend listens (cross-layer coordination):
```
menu.rs:      app.emit("menu-navigate-previous-day", ())
shortcuts.ts: listen("menu-navigate-previous-day", handler)
```
All menu event names are prefixed `menu-`. See `menu.rs:78-107` for the full list.

## Verification Commands

```bash
# Backend
cd src-tauri && cargo test              # All backend tests
cd src-tauri && cargo test <module>     # Specific module

# Frontend
bun run test:run                        # All frontend tests (single run)
bun run type-check                      # TypeScript type check

# E2E
bun run test:e2e:local                  # Build binary + run suite
bun run test:e2e:local -- --skip-build  # Skip build, run suite only

# Diagrams
bun run diagrams                        # Regenerate all docs/diagrams/ SVGs
```

## Gotchas and Pitfalls

1. **Search interface preserved**: `SearchResult`, `search_entries` (Rust), `searchEntries` (TS), `SearchBar.tsx`, `SearchResults.tsx`, and `src/state/search.ts` are all kept intact as the interface contract for future secure search — do not remove them.

2. **JSON export format (breaking change in v0.5.0)**: JSON export now outputs an array under the `"entries"` key with each entry including its `id` field, instead of a date-keyed object. Example: `{ "entries": [{ "id": 1, "date": "2024-01-15", "title": "...", "text": "...", "word_count": 0, "date_created": "...", "date_updated": "..." }] }`.

3. **Auto-lock fires from two independent paths** — any change to the lock/unlock flow must account for both:
   - **Frontend idle timer** (`App.tsx`): tracks user activity events (mousemove, keydown, click, scroll, touchstart). After `autoLockTimeout` seconds of inactivity, calls `lockJournal()`. Controlled by `autoLockEnabled` + `autoLockTimeout` preferences.
   - **Backend OS events** (`screen_lock.rs`): listens for OS-level session lock, logoff, or system suspend (Windows: `WM_WTSSESSION_CHANGE`, `WM_POWERBROADCAST`; macOS: screen-sleep and `com.apple.screenIsLocked` notifications). Immediately calls `auto_lock_diary_if_unlocked()` and emits `'journal-locked'` event. Fires even when the app is in the background.

## Security Rules

- **Never** log, print, or serialize passwords or encryption keys
- **Never** store plaintext diary content in any unencrypted form on disk
- **Never** send data over the network — no analytics, no telemetry, no update checks

See [Backend guide](src-tauri/CLAUDE.md) for the full auth architecture and per-command security requirements.

## Known Issues / Technical Debt

- **Frontend test coverage is still incomplete**: coverage has improved substantially, but `Calendar.tsx`, `Sidebar.tsx`, most overlays, and broader editor workflows still lack direct tests.
- **No Tauri integration tests**: All backend tests use direct DB connections, not the Tauri command layer.
- **No error boundary components**: Unhandled errors in components crash the app.

## Common Task Checklists

### Updating the App Logo / Icons

The source logo lives at `public/logo-transparent.svg` (1024×1024, dark background). It is used in two places:

**1. Frontend auth screens** — referenced as `/logo-transparent.svg` in:
- `src/components/auth/PasswordPrompt.tsx`
- `src/components/auth/PasswordCreation.tsx`

Replace the file and the change takes effect immediately on the next build.

**2. Tauri app icons** — all platform icon sizes in `src-tauri/icons/` are derived from the same SVG. Regenerate them with:
```bash
bun run tauri icon public/logo-transparent.svg
```
This overwrites every icon variant (ICO, ICNS, PNG at all sizes, Windows AppX, iOS, Android) in one command. Commit the updated `src-tauri/icons/` directory alongside any change to the source SVG.

### Creating a Release

See [RELEASING.md](RELEASING.md) for the full process. Version bump script: `./bump-version.sh X.Y.Z`.
