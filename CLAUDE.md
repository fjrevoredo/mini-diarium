# CLAUDE.md — Mini Diarium

**Mini Diarium** is an encrypted, local-first desktop journaling app (SolidJS + Rust/Tauri v2 + SQLite). All diary entries are AES-256-GCM encrypted at rest; plaintext never touches disk.

**Core principles:** privacy-first (no network), incremental dev, clean architecture, TypeScript strict + Rust type safety.

**Platforms:** Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+, Fedora, Arch).

**Status:** See `docs/OPEN_TASKS.md` for structured roadmap items and `docs/TODO.md` for the working backlog.

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

## File Structure

### Website (`website/`)

Static marketing site — plain HTML/CSS/JS, no build step. Deploy via Coolify using `website/docker-compose.yml`.
**Version sync:** `bump-version.sh` updates `<span class="app-version">` in `website/index.html`. Always commit it alongside version files.

### Frontend (`src/`)

```
src/
├── index.tsx                          # Entry point
├── App.tsx                            # Auth routing (Switch/Match on authState)
├── components/
│   ├── auth/
│   │   ├── JournalPicker.tsx          # Pre-auth journal selection + management (outermost layer)
│   │   ├── JournalPicker.test.tsx
│   │   ├── PasswordCreation.tsx       # New diary setup
│   │   ├── PasswordCreation.test.tsx
│   │   ├── PasswordPrompt.tsx         # Password + Key File unlock modes
│   │   └── PasswordPrompt.test.tsx
│   ├── calendar/
│   │   └── Calendar.tsx               # Monthly calendar with entry indicators
│   ├── editor/
│   │   ├── DiaryEditor.tsx            # TipTap rich-text editor
│   │   ├── EditorToolbar.tsx          # Formatting toolbar (basic + advanced; alignment in advanced)
│   │   ├── TitleEditor.tsx            # Entry title input
│   │   ├── WordCount.tsx              # Live word count display
│   │   ├── EntryNavBar.tsx            # Per-day entry counter/navigator (hidden when ≤1 entry)
│   │   ├── TitleEditor.test.tsx
│   │   ├── WordCount.test.tsx
│   │   ├── EntryNavBar.test.tsx
│   │   └── EditorToolbar.test.tsx
│   ├── layout/
│   │   ├── MainLayout.tsx             # App shell (sidebar + editor)
│   │   ├── Header.tsx                 # Top bar
│   │   ├── Sidebar.tsx                # Calendar panel (search removed; see "Implementing Search")
│   │   ├── EditorPanel.tsx            # Editor container
│   │   └── MainLayout-event-listeners.test.tsx
│   ├── overlays/
│   │   ├── GoToDateOverlay.tsx        # Date picker dialog
│   │   ├── PreferencesOverlay.tsx     # Settings dialog (includes Auth Methods section)
│   │   ├── StatsOverlay.tsx           # Statistics display
│   │   ├── ImportOverlay.tsx          # Import format selector + file picker
│   │   ├── ExportOverlay.tsx          # Export format selector + file picker
│   │   └── AboutOverlay.tsx           # App info, version, license, GitHub link
│   └── search/
│       ├── SearchBar.tsx              # Search input (not rendered; reserved for future secure search)
│       └── SearchResults.tsx          # Search result list
├── state/
│   ├── auth.ts                        # AuthState signal + authMethods + initializeAuth/create/unlock/lock/unlockWithKeypair
│   ├── entries.ts                     # currentEntry, entryDates, isLoading, isSaving
│   ├── journals.ts                    # journals, activeJournalId, isSwitching + loadJournals/switchJournal/addJournal/removeJournal/renameJournal
│   ├── search.ts                      # searchQuery, searchResults, isSearching
│   ├── session.ts                     # resetSessionState() — resets entries/search/UI on journal lock
│   ├── ui.ts                          # selectedDate, overlay open states, sidebar state
│   └── preferences.ts                 # Preferences interface, localStorage persistence
├── lib/
│   ├── tauri.ts                       # All Tauri invoke() wrappers (typed)
│   ├── dates.ts                       # Date formatting/arithmetic helpers
│   ├── debounce.ts                    # Generic debounce utility
│   ├── shortcuts.ts                   # Keyboard shortcut + menu event listeners
│   ├── logger.ts                      # createLogger(name) factory used throughout frontend
│   ├── errors.ts                      # mapTauriError() for user-facing error message mapping
│   ├── theme.ts                       # Theme signals + initializeTheme() / setTheme()
│   ├── theme-overrides.ts             # User CSS token overrides per theme
│   ├── dates.test.ts
│   ├── import.test.ts
│   ├── tauri-params.test.ts
│   └── theme-overrides.test.ts
├── test/
│   └── setup.ts                       # Vitest setup: Tauri API mocks, cleanup
├── styles/
│   ├── critical-auth.css
│   └── editor.css
└── index.css
```

### E2E (`e2e/`)

End-to-end tests using WebdriverIO + tauri-driver. These run against the real compiled binary with a real SQLite database (temp directory in clean mode).

```
e2e/
├── specs/
│   └── diary-workflow.spec.ts  # Core workflow: create → write → lock → unlock → verify
└── tsconfig.json               # Separate TS config (node + webdriverio/async globals)
wdio.conf.ts                    # WebdriverIO config (root level)
```

**Prerequisites to run locally:**
```bash
cargo install tauri-driver   # once
bun run test:e2e:local       # builds binary + runs suite (use --skip-build on repeat runs)
```

### Backend (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs                            # Tauri bootstrap
├── lib.rs                             # Plugin init, state setup, command registration
├── menu.rs                            # App menu builder + event emitter
├── config.rs                          # Journal + diary directory config persistence
├── backup.rs                          # Automatic backups on unlock + rotation
├── screen_lock.rs                     # OS-level auto-lock listener (Windows WM_WTSSESSION_CHANGE/WM_POWERBROADCAST; macOS screen-sleep/lock notifications)
├── auth/
│   ├── mod.rs                             # AuthMethodInfo, KeypairFiles structs; re-exports
│   ├── password.rs                        # PasswordMethod: Argon2id wrap/unwrap
│   └── keypair.rs                         # KeypairMethod: X25519 ECIES wrap/unwrap
├── commands/
│   ├── mod.rs                         # Re-exports: auth, entries, search, navigation, stats, import, export, plugin, files
│   ├── auth/
│   │   ├── mod.rs                     # DiaryState struct; re-exports, auto_lock_diary_if_unlocked
│   │   ├── auth_core.rs               # create/unlock/lock/reset/change_password
│   │   ├── auth_directory.rs          # change_diary_directory with file move + sync to config
│   │   ├── auth_journals.rs           # list/add/remove/rename/switch journals, auto-lock guards
│   │   └── auth_methods.rs            # Password & keypair registration, unlock_with_keypair
│   ├── entries.rs                     # CRUD + delete-if-empty + delete (unconditional)
│   ├── search.rs                      # Search stub — returns empty results
│   ├── navigation.rs                  # Day/month navigation
│   ├── stats.rs                       # Aggregated statistics
│   ├── import.rs                      # Import orchestration
│   ├── export.rs                      # JSON + Markdown export commands
│   ├── plugin.rs                      # Plugin list/run commands
│   ├── debug.rs                       # Privacy-safe diagnostic dump
│   └── files.rs                       # Image file reading (jpg/jpeg/png/gif/webp/bmp only)
├── crypto/
│   ├── mod.rs                         # Re-exports
│   ├── password.rs                    # Argon2id hashing + verification
│   └── cipher.rs                      # AES-256-GCM encrypt/decrypt
├── db/
│   ├── mod.rs                         # Re-exports
│   ├── schema.rs                      # DB creation, migrations, password verification
│   └── queries.rs                     # All SQL: CRUD, dates, word count
├── export/
│   ├── mod.rs                         # Re-exports
│   ├── json.rs                        # Mini Diary-compatible JSON export
│   └── markdown.rs                    # HTML-to-Markdown conversion + export
├── plugin/
│   ├── mod.rs                         # ImportPlugin/ExportPlugin traits, PluginInfo struct
│   ├── builtins.rs                    # 6 unit structs wrapping built-in parsers/exporters
│   ├── registry.rs                    # PluginRegistry: register/find/list
│   └── rhai_loader.rs                 # Rhai engine, script discovery, sandbox, wrappers
└── import/
    ├── mod.rs                         # Re-exports + DiaryEntry conversion
    ├── minidiary.rs                   # Mini Diary JSON parser
    ├── dayone.rs                      # Day One JSON parser
    ├── dayone_txt.rs                  # Day One TXT parser
    └── jrnl.rs                        # jrnl JSON parser
```

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

## State Management

Six signal-based state modules in `src/state/`:

| Module | Signals | Key Functions |
|--------|---------|---------------|
| `auth.ts` | `authState: AuthState`, `error`, `authMethods: AuthMethodInfo[]` | `initializeAuth()`, `createJournal()`, `unlockJournal()`, `lockJournal()`, `unlockWithKeypair()`, `goToJournalPicker()` |
| `entries.ts` | `currentEntry`, `entryDates`, `isLoading`, `isSaving` | Setters exported directly |
| `journals.ts` | `journals: JournalConfig[]`, `activeJournalId`, `isSwitching` | `loadJournals()`, `switchJournal()`, `addJournal()`, `removeJournal()`, `renameJournal()` |
| `search.ts` | `searchQuery`, `searchResults`, `isSearching` | Setters exported directly |
| `ui.ts` | `selectedDate`, `isSidebarCollapsed`, `isGoToDateOpen`, `isPreferencesOpen`, `isStatsOpen`, `isImportOpen`, `isExportOpen`, `isAboutOpen` | Setters exported directly; `resetUiState()` resets all |
| `preferences.ts` | `preferences: Preferences` | `setPreferences(Partial<Preferences>)`, `resetPreferences()` |

`Preferences` fields: `allowFutureEntries` (bool), `firstDayOfWeek` (number|null), `hideTitles` (bool), `enableSpellcheck` (bool), `escAction` (`'none'|'quit'`), `autoLockEnabled` (bool), `autoLockTimeout` (number, seconds), `advancedToolbar` (bool), `editorFontSize` (number, px), `showEntryTimestamps` (bool). Stored in `localStorage`.

## Conventions

### SolidJS Reactivity Gotchas

- **Never destructure props** — kills reactivity. Use `props.name` always.
- **Wrap async in components** — use `onMount` or `createResource`, never top-level `await`.
- **Event handlers** — use `on:click` (native) or `onClick` (SolidJS delegated). Wrap async handlers: `onClick={() => handleAsync()}`.
- **Conditional rendering** — use `<Show when={...}>`, not JS ternaries.
- **Lists** — use `<For each={...}>`, never `.map()`.

### Backend Command Pattern

```rust
#[tauri::command]
pub fn my_command(arg: String, state: State<DiaryState>) -> Result<ReturnType, String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or("Diary not unlocked")?;
    // ... business logic
    Ok(result)
}
```

All commands return `Result<T, String>`. Register in both `commands/mod.rs` and `generate_handler![]` in `lib.rs`.

**Two delete commands — use the right one:**
- `delete_entry_if_empty(id, title, text)` — soft delete: only removes the entry if both title and text are blank. Returns `bool`. Used by the editor on blur/navigation to silently clean up orphaned blank entries.
- `delete_entry(id)` — hard delete: unconditional removal, returns an error if the entry is not found. Used for explicit user-initiated "delete entry" actions.

### Error Handling

- Backend: `Result<T, String>` — map errors with `.map_err(|e| format!(...))`.
- Frontend: `try/catch` around `invoke()` calls; set error signals for UI display.
- **Always pass raw Tauri error strings through `mapTauriError()` from `src/lib/errors.ts` before displaying to users.** It strips filesystem paths, OS error codes, SQLite internals, and Argon2 details to prevent information disclosure.

### Naming

| Context | Convention | Example |
|---------|-----------|---------|
| TS signals | `camelCase` + `set` prefix | `isLoading` / `setIsLoading` |
| CSS | UnoCSS utility classes | `class="flex items-center gap-2"` |
| Dates | `YYYY-MM-DD` string | `"2024-01-15"` |

### Frontend Testing Pattern

Tests use **Vitest + @solidjs/testing-library**. Tauri APIs are mocked globally in `src/test/setup.ts`.

```tsx
import { render } from '@solidjs/testing-library';

it('renders correctly', () => {
  const { getByText } = render(() => <MyComponent prop="value" />);
  expect(getByText('expected')).toBeInTheDocument();
});
```

Note the arrow wrapper `() => <Component />` — required for SolidJS test rendering.

### Import Parser Pattern (Built-in)

To add a new **built-in** import format (compiled Rust):
1. Create `src-tauri/src/import/FORMAT.rs` — parser returning `Vec<DiaryEntry>`
2. Add command in `src-tauri/src/commands/import.rs` — orchestrate parse → merge (see "Search index hook" comment for where to add reindex)
3. Register command in `commands/mod.rs` and `lib.rs` `generate_handler![]`
4. Add frontend wrapper in `src/lib/tauri.ts` and UI option in `ImportOverlay.tsx`
5. Add a builtin wrapper struct in `plugin/builtins.rs` implementing `ImportPlugin`, and register it in `register_all()`

For **user-scriptable** formats, users drop a `.rhai` file in `{diary_dir}/plugins/`. See `plugin/rhai_loader.rs` for the Rhai script contract and `docs/user-plugins/USER_PLUGIN_GUIDE.md` for the end-user plugin guide and templates.

### Menu Event Pattern

Rust emits → frontend listens:
```
menu.rs: app.emit("menu-navigate-previous-day", ())
shortcuts.ts: listen("menu-navigate-previous-day", handler)
```

All menu event names are prefixed `menu-`. See `menu.rs:78-107` for the full list.

## Testing

### Backend: 249 tests across 30 modules

Run: `cd src-tauri && cargo test`

### Frontend: 161 tests across 17 files

Run: `bun run test:run` (single run) or `bun run test` (watch mode)

Coverage: `bun run test:coverage`

### E2E: 1 spec (real binary, real SQLite)

Run: `bun run test:e2e` (requires release binary + `tauri-driver` installed)

| File | Description |
|------|-------------|
| `e2e/specs/diary-workflow.spec.ts` | 1 test: create diary → write entry → lock → unlock → verify persistence |
| `e2e/specs/multi-entry.spec.ts` | 1 test (3 scenarios): (A) 2 entries persist after lock/unlock; (B) "+" enabled after "←" navigation from blank entry (v0.4.9 Variant 1); (C) "+" enabled after day-switch with blank entry (v0.4.9 Variant 2) |

**data-testid attributes** used by E2E tests (do not remove):

| Component | Element | data-testid |
|-----------|---------|-------------|
| `PasswordCreation.tsx` | Password input | `password-create-input` |
| `PasswordCreation.tsx` | Confirm password input | `password-repeat-input` |
| `PasswordCreation.tsx` | Create button | `create-journal-button` |
| `PasswordPrompt.tsx` | Password input | `password-unlock-input` |
| `PasswordPrompt.tsx` | Unlock submit button | `unlock-journal-button` |
| `Header.tsx` | Sidebar toggle (hamburger) | `toggle-sidebar-button` |
| `Header.tsx` | Lock button | `lock-journal-button` |
| `TitleEditor.tsx` | Title input | `title-input` |
| `Calendar.tsx` | Each day button | `calendar-day-YYYY-MM-DD` |
| `EntryNavBar.tsx` | Nav bar container | `entry-nav-bar` |
| `EntryNavBar.tsx` | Previous entry button (`←`) | `entry-prev-button` |
| `EntryNavBar.tsx` | Entry position counter | `entry-counter` |
| `EntryNavBar.tsx` | Next entry button (`→`) | `entry-next-button` |
| `EntryNavBar.tsx` | Delete entry button (`−`) | `entry-delete-button` |
| `EntryNavBar.tsx` | Add entry button (`+`) | `entry-add-button` |

## Verification Commands

```bash
# Testing
cd src-tauri && cargo test                     # All backend tests
cd src-tauri && cargo test navigation          # Specific module
bun run test:run                               # All frontend tests
bun run test:run -- dates                      # Specific test file
bun run test:e2e:local                         # E2E tests: build binary + run suite
bun run test:e2e:local -- --skip-build         # E2E tests: skip build, run suite only
bun run test:e2e                               # Run suite only (binary must already exist)
bun run test:e2e:stateful                      # Stateful E2E mode (persistence-oriented lane)

# Code quality
bun run lint             # ESLint
bun run lint:fix         # ESLint autofix
bun run format:check     # Prettier check
bun run format           # Prettier fix
bun run type-check       # TypeScript type check
```

## Gotchas and Pitfalls

1. **No FTS table (schema v5)**: `entries_fts` was removed for security (it stored plaintext). The `entries` table now uses `id INTEGER PRIMARY KEY AUTOINCREMENT` for multi-entry-per-date support. `insert_entry`, `update_entry`, `delete_entry`, and all import commands have `// Search index hook:` comments marking where a future search module should be plugged in.

2. **Search interface preserved**: `SearchResult`, `search_entries` (Rust), `searchEntries` (TS), `SearchBar.tsx`, `SearchResults.tsx`, and `src/state/search.ts` are all kept intact as the interface contract for future secure search — do not remove them.

3. **Date format is always `YYYY-MM-DD`**: The `T00:00:00` suffix is appended in `dates.ts` functions (`new Date(dateStr + 'T00:00:00')`) to avoid timezone-related date shifts.

4. **Command registration is two places**: New commands must be added to both `commands/mod.rs` (module declaration) and `generate_handler![]` in `lib.rs`. Missing either causes silent failures or compile errors.

5. **TipTap stores HTML**: The editor content is stored as HTML strings, not Markdown. This is intentional — the `text` field in `DiaryEntry` is HTML.

6. **Import behavior (no merge)**: Parsers in `import/*.rs` return `Vec<DiaryEntry>`. Imports always create new entries; there is no date-conflict merging. Re-importing the same file creates duplicate entries. The old merge path has been removed from the current codebase.

7. **Auth slots (v3 schema):** Each auth method stores its own wrapped copy of the master key in `auth_slots`. `remove_auth_method` refuses to delete the last slot (minimum one required). `change_password` re-wraps the master key in O(1) — no entry re-encryption needed. `verify_password` exists as a side-effect-free check used before multi-step operations.

8. **E2E mode contracts:** Default E2E uses clean-room mode (`E2E_MODE=clean`) and sets both `MINI_DIARIUM_DATA_DIR` (fresh temp diary path) and `MINI_DIARIUM_E2E=1` (backend disables `tauri-plugin-window-state` so host window geometry does not leak into tests). Stateful lane (`bun run test:e2e:stateful`) uses a repo-local persistent root (`.e2e-stateful/`, optionally overridden by `E2E_STATEFUL_ROOT`) for persistence-specific checks.

9. **Plugin registry is initialized once at startup** in `lib.rs` `.setup()`. It reads `{diary_dir}/plugins/` for `.rhai` scripts. The registry is stored as `State<Mutex<PluginRegistry>>`. If the user changes the diary directory, plugins are not reloaded until app restart (consistent with existing behavior).

10. **Rhai's `export` keyword is reserved**: Export plugin scripts must use `fn format_entries(entries)` instead of `fn export(entries)`. The `RhaiExportPlugin` wrapper calls `"format_entries"` internally.

11. **Rhai AST requires `unsafe impl Send + Sync`**: The `rhai::AST` type does not implement `Send + Sync` in the current version. The `unsafe` impls on `RhaiImportPlugin` and `RhaiExportPlugin` are required and justified: AST is immutable after compilation, and Engine is created fresh per invocation.

12. **Old import/export commands are preserved**: The original `import_minidiary_json`, `import_dayone_json`, etc. commands remain registered for backward compatibility. The Import/Export overlays now use the plugin system (`runImportPlugin`/`runExportPlugin`) but the legacy commands still work.

13. **Default E2E clean mode runs at 800×660 px — below the `lg` breakpoint (1024 px)**: The sidebar uses `lg:relative lg:translate-x-0`, so in default clean E2E mode it is always in mobile/overlay behavior. Any change to `isSidebarCollapsed` default or `resetUiState()` affects whether calendar day elements are reachable in E2E tests. **Planning rule**: when changing the default value of any UI visibility signal (`isSidebarCollapsed`, overlay open states, etc.), explicitly audit `e2e/specs/` for interactions that depend on the affected element being visible and update the test accordingly.

14. **JSON export format (breaking change in v0.5.0)**: JSON export now outputs an array under the `"entries"` key with each entry including its `id` field, instead of a date-keyed object. Example: `{ "entries": [{ "id": 1, "date": "2024-01-15", "title": "...", "text": "...", "word_count": 0, "date_created": "...", "date_updated": "..." }] }`.

15. **Block alignment uses a container model (not per-node)**: Alignment is applied via `TextAlign` on a wrapping container (`<figure>`, `<div>`), not on the content element itself. This means:
    - `ProseMirror-selectednode` is added to the **container**, not the inner element
    - CSS must use `display: inline-block` on the inner element for `text-align` to work
    - To align a new block type, extend its node to use a wrapper and add its name to the TextAlign `types` array — see "Adding an Alignable Editor Block Node" in Common Task Checklists

16. **Auto-lock fires from two independent paths** — any change to the lock/unlock flow must account for both:
    - **Frontend idle timer** (`App.tsx`): tracks user activity events (mousemove, keydown, click, scroll, touchstart). After `autoLockTimeout` seconds of inactivity, calls `lockJournal()`. Controlled by `autoLockEnabled` + `autoLockTimeout` preferences.
    - **Backend OS events** (`screen_lock.rs`): listens for OS-level session lock, logoff, or system suspend (Windows: `WM_WTSSESSION_CHANGE`, `WM_POWERBROADCAST`; macOS: screen-sleep and `com.apple.screenIsLocked` notifications). Immediately calls `auto_lock_diary_if_unlocked()` and emits `'journal-locked'` event. Fires even when the app is in the background.

17. **Images are stored as base64 in the encrypted HTML `text` field** — there is no separate media storage. Users can drag-drop, paste, or pick images; they are auto-resized to max 1200×1200 px and embedded as base64 data URLs. Backend `read_file_bytes()` reads disk images for drag-drop paths (Tauri drag-drop gives file paths, not `File` objects). Large images significantly increase encrypted entry size.

18. **Theme preference and CSS token overrides are separate localStorage keys**, independent of the main `'preferences'` key. Any code that resets or exports user settings must handle all three keys:
    - `'preferences'` — the `Preferences` interface (autoLockEnabled, hideTitles, etc.)
    - `'theme-preference'` — `'auto'|'light'|'dark'` (managed by `src/lib/theme.ts`)
    - `'theme-overrides'` — JSON object of CSS token overrides (managed by `src/lib/theme-overrides.ts`)

19. **E2E viewport sizing — three rules that must hold:**
    - **Why this keeps breaking:** WebView2 captures CSS viewport values (`100vh`, `window.innerHeight`) at first paint. Any resize after `win.show()` leaves those values stale, producing a white gap above vertically-centred content. This has broken three times (v0.4.3, v0.4.9 ×2); the root cause is always the same pattern.
    - **Rust** (`lib.rs`): call `win.set_size(LogicalSize::new(800, 660))` **before** `win.show()` in E2E mode. Never move it after. This is the single source of truth for E2E viewport size. Production window: `800×780` (`tauri.conf.json`).
    - **CSS**: all screen-filling containers (`JournalPicker`, `PasswordCreation`, `PasswordPrompt`, `App` checking state, `MainLayout`) use `h-full` (`height: 100%` via `html → body → #root` chain from `index.html`). **Never** use `h-screen`/`min-h-screen` (`100vh`) — it may report the full Tauri inner-window height (including the native app menu bar) rather than the WebView viewport, making containers taller than the visible area.
    - **wdio** (`wdio.conf.ts`): the `before` hook must NOT call `browser.setWindowSize()`. WebDriver `setWindowRect` fires after first paint and uses different size semantics than Tauri's `LogicalSize` — see "why this keeps breaking" above.
    - **uno.config.ts**: `h-screen` and `min-h-screen` are intentionally **absent** from the safelist. Do not add them back.

20. **TipTap inline styles require `dangerousDisableAssetCspModification: ["style-src"]`**: Tauri injects a random nonce into all CSP directives at runtime. Per the CSP spec, when a nonce is present in `style-src`, `'unsafe-inline'` is **ignored** — so TipTap's `style="text-align: X"` node-attribute rendering is silently blocked by the browser. The `tauri.conf.json` security section uses `"dangerousDisableAssetCspModification": ["style-src"]` to prevent nonce injection into `style-src` only (leaving `script-src` nonce-protected). **Do not remove this line or restructure the CSP string without verifying alignment still works** — the failure is silent (no console error in dev mode, only in production builds where the nonce is active). See issue #63.

## Security Rules

- **Never** log, print, or serialize passwords or encryption keys
- **Never** store plaintext diary content in any unencrypted form on disk
- **Never** send data over the network — no analytics, no telemetry, no update checks
- Auth: A random master key is wrapped per auth slot in `auth_slots` (schema v3). Password slots use Argon2id + AES-256-GCM wrapping; keypair slots use X25519 ECIES. The master key is never stored in plaintext.
- The `DiaryState` holds `Mutex<Option<DatabaseConnection>>` — `None` when locked, `Some` when unlocked
- All commands that access entries must check `db_state.as_ref().ok_or("Diary not unlocked")?`

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

---

### Adding a New Tauri Command

1. Write the function in the appropriate `src-tauri/src/commands/*.rs` file (or create a new module and add it to `commands/mod.rs`)
2. Register in `lib.rs` `generate_handler![]` macro
3. Add typed wrapper in `src/lib/tauri.ts`

### Adding a New Import/Export Format

**Option A: Built-in (compiled Rust)**

1. Create `src-tauri/src/import/FORMAT.rs` with a `parse_FORMAT(content: &str) -> Result<Vec<DiaryEntry>, String>` function
2. Add `pub mod FORMAT;` to `src-tauri/src/import/mod.rs`
3. Add command in `commands/import.rs` (follow existing pattern: parse → `import_entries()`; add search reindex call at the `// Search index hook:` comment when a search module exists)
4. Register command, add frontend wrapper in `tauri.ts` (legacy commands are preserved for backward compatibility)
5. Add a builtin wrapper struct in `plugin/builtins.rs` implementing `ImportPlugin` (or `ExportPlugin`), register in `register_all()`

**Option B: User-scriptable (Rhai)**

Users drop a `.rhai` file in `{diary_dir}/plugins/`. The file must have a `// @name`, `// @type`, and optionally `// @extensions` comment header. Import scripts define `fn parse(content)` returning an array of entry maps; export scripts define `fn format_entries(entries)` returning a string. See `docs/user-plugins/USER_PLUGIN_GUIDE.md` for templates and `plugin/rhai_loader.rs` for the runtime.

### Adding an Alignable Editor Block Node

Wrap the node in a `<figure class="X-container">` container, register it in `TextAlign.configure({ types: [..., 'yourNodeName'] })`, and add CSS: `figure.X-container { display: block }` + `.inner-element { display: inline-block }` (container's `text-align` propagates). `ProseMirror-selectednode` lands on the container, not the inner element. See Gotcha #15 and `AlignableImage` in `DiaryEditor.tsx` as the reference implementation.

### Implementing Search

Full-text search was removed in schema v4 (v0.2.0) because the SQLite FTS5 table stored
diary content in plaintext, defeating the AES-256-GCM encryption. The backend stub and the
complete frontend/backend interface are preserved so search can be re-added without mass
refactoring.

**What is already in place (do not remove):**

| Layer | File | What it provides |
|-------|------|-----------------|
| Rust command | `src-tauri/src/commands/search.rs` | `SearchResult` struct + `search_entries` command (stub returning `[]`) |
| Frontend wrapper | `src/lib/tauri.ts` | `SearchResult` interface + `searchEntries(query)` async function |
| Frontend state | `src/state/search.ts` | `searchQuery`, `searchResults`, `isSearching` signals |
| Frontend components | `src/components/search/SearchBar.tsx` | Search input component (not rendered) |
| | `src/components/search/SearchResults.tsx` | Results list component (not rendered) |

**Hook points in the backend (search for `// Search index hook:`):**

- `db/queries.rs` — `insert_entry()`, `update_entry()`, `delete_entry()` — index/remove individual entries
- `commands/import.rs` — all four import commands — bulk reindex after import

**Design constraints for any future implementation:**

1. **No plaintext on disk** — the index must be encrypted or derived in a way that does not expose entry content to raw file access. Options to evaluate: encrypted FTS (e.g. SQLCipher), client-side trigram index stored encrypted alongside entries, or an in-memory index rebuilt at unlock time.
2. **Schema migration required** — bump `SCHEMA_VERSION` in `db/schema.rs` and add a migration step.
3. **UI placement is undecided** — `SearchBar` and `SearchResults` exist but where they appear (sidebar, overlay, command palette, etc.) should be designed fresh. Wire them into `Sidebar.tsx` or a new component; do not assume the old sidebar layout.
4. **State is ready** — `src/state/search.ts` signals can be used as-is or extended.

### Creating a Release

See [RELEASING.md](RELEASING.md) for the full process. Version bump script: `./bump-version.sh X.Y.Z`.
