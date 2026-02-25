# AGENTS.md — Mini Diarium

**Mini Diarium** is an encrypted, local-first desktop journaling app (SolidJS + Rust/Tauri v2 + SQLite). All diary entries are AES-256-GCM encrypted at rest; plaintext never touches disk.

**Core principles:** privacy-first (no network), incremental dev, clean architecture, TypeScript strict + Rust type safety.

**Platforms:** Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+, Fedora, Arch).

**Status:** See `Current-implementation-plan.md` for task-level progress (55/58 tasks complete).

## Architecture

**Visual diagrams**:
- [System context](docs/diagrams/context.mmd) - High-level local-only data flow (Mermaid)
- [Unlock flow](docs/diagrams/unlock.mmd) - Password/key-file master-key unwrap sequence (Mermaid)
- [Save-entry flow](docs/diagrams/save-entry.mmd) - Editor to encrypted SQLite write path (Mermaid)
- [Layered architecture](docs/diagrams/architecture.svg) - Presentation/state/backend/data layers (D2)

**Regenerate diagrams**:
```bash
bun run diagrams
# Renders docs/diagrams/{unlock,unlock-dark,save-entry,save-entry-dark,context,context-dark}.mmd → *.svg (via mmdc)
# Renders docs/diagrams/architecture.d2      → docs/diagrams/architecture.svg      (via d2)
# Renders docs/diagrams/architecture-dark.d2 → docs/diagrams/architecture-dark.svg (via d2)
```

Quick reference (ASCII art):

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│                    (SolidJS Components)                          │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌───────────┐  │
│  │  Auth  │ │ Calendar │ │ Editor │ │ Search │ │  Overlays  │  │
│  └────────┘ └──────────┘ └────────┘ └────────┘ └───────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ Reactive Signals
┌────────────────────────────┴────────────────────────────────────┐
│                       STATE LAYER                               │
│    auth.ts · entries.ts · search.ts · ui.ts · preferences.ts    │
└────────────────────────────┬────────────────────────────────────┘
                             │ invoke() / listen()
┌────────────────────────────┴────────────────────────────────────┐
│                      BACKEND (Rust)                             │
│  Commands: auth · entries · search · navigation · stats · import│
│  Business: crypto/ · db/ · import/ · menu.rs                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                      ┌──────┴──────┐
                      │  SQLite DB  │
                      │ (encrypted) │
                      └─────────────┘
```

**Key relationships:**
- Entries are stored encrypted in SQLite. Full-text search is not currently implemented; `entries_fts` has been removed (schema v4). See `commands/search.rs` for the stub and interface contract.
- Menu events flow: Rust `app.emit("menu-*")` → frontend `listen()` in `shortcuts.ts` or overlay components.
- Preferences use `localStorage` (not Tauri store plugin).
- Multiple journals are tracked in `{app_data_dir}/config.json` via `JournalConfig` entries. Each journal maps to a directory containing its own `diary.db`. `DiaryState` holds a single connection; switching journals updates `db_path`/`backups_dir` and auto-locks. Legacy single-diary configs are auto-migrated on first `load_journals()` call.

## File Structure

### Website (`website/`)

Static marketing site for [mini-diarium.com](https://mini-diarium.com). Plain HTML + CSS + JS, no build step. Deployed via Docker / Coolify (compose file path: `website/docker-compose.yml`).

```
website/
├── index.html            # Single-page site (all content)
├── css/style.css         # All styles (CSS variables, grid, clamp())
├── js/main.js            # Mobile nav toggle + smooth scroll (~30 lines)
├── assets/
│   ├── logo.svg          # Copy of public/logo-transparent.svg
│   └── demo.gif          # Copy of public/demo.gif
├── nginx.conf            # Gzip, cache headers, security headers
├── Dockerfile            # FROM nginx:alpine
└── docker-compose.yml    # Single service, port 80
```

**Version sync:** `bump-version.sh` updates `<span class="app-version">X.Y.Z</span>` in `index.html` (step 5). Always commit `website/index.html` alongside the other version files.

**Coolify deploy:** In Coolify, set the compose file path to `website/docker-compose.yml`. The build context is the `website/` subfolder.

### Frontend (`src/`)

```
src/
├── index.tsx                          # Entry point
├── App.tsx                            # Auth routing (Switch/Match on authState)
├── components/
│   ├── auth/
│   │   ├── PasswordCreation.tsx       # New diary setup
│   │   └── PasswordPrompt.tsx         # Password + Key File unlock modes
│   ├── calendar/
│   │   └── Calendar.tsx               # Monthly calendar with entry indicators
│   ├── editor/
│   │   ├── DiaryEditor.tsx            # TipTap rich-text editor
│   │   ├── EditorToolbar.tsx          # Formatting toolbar
│   │   ├── TitleEditor.tsx            # Entry title input
│   │   ├── WordCount.tsx              # Live word count display
│   │   ├── TitleEditor.test.tsx       # 6 tests
│   │   └── WordCount.test.tsx         # 3 tests
│   ├── layout/
│   │   ├── MainLayout.tsx             # App shell (sidebar + editor)
│   │   ├── Header.tsx                 # Top bar
│   │   ├── Sidebar.tsx                # Calendar panel (search removed; see "Implementing Search")
│   │   ├── EditorPanel.tsx            # Editor container
│   │   └── MainLayout-event-listeners.test.tsx  # 4 tests
│   ├── overlays/
│   │   ├── GoToDateOverlay.tsx        # Date picker dialog
│   │   ├── PreferencesOverlay.tsx     # Settings dialog (includes Auth Methods section)
│   │   ├── StatsOverlay.tsx           # Statistics display
│   │   └── ImportOverlay.tsx          # Import format selector + file picker
│   └── search/
│       ├── SearchBar.tsx              # Search input (not rendered; reserved for future secure search)
│       └── SearchResults.tsx          # Search result list
├── state/
│   ├── auth.ts                        # AuthState signal + authMethods + initializeAuth/create/unlock/lock/unlockWithKeypair
│   ├── entries.ts                     # currentEntry, entryDates, isLoading, isSaving
│   ├── journals.ts                    # journals, activeJournalId, isSwitching + loadJournals/switchJournal/addJournal/removeJournal/renameJournal
│   ├── search.ts                      # searchQuery, searchResults, isSearching
│   ├── ui.ts                          # selectedDate, overlay open states, sidebar state
│   └── preferences.ts                 # Preferences interface, localStorage persistence
├── lib/
│   ├── tauri.ts                       # All Tauri invoke() wrappers (typed)
│   ├── dates.ts                       # Date formatting/arithmetic helpers
│   ├── debounce.ts                    # Generic debounce utility
│   ├── shortcuts.ts                   # Keyboard shortcut + menu event listeners
│   ├── dates.test.ts                  # 10 tests
│   ├── import.test.ts                 # 4 tests
│   └── tauri-params.test.ts           # 4 tests
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

**Test isolation modes:**
- Default `bun run test:e2e` runs in **clean-room mode** (`E2E_MODE=clean`): fresh temp diary directory (`MINI_DIARIUM_DATA_DIR`), explicit E2E app mode (`MINI_DIARIUM_E2E=1`), deterministic viewport (`800x660`), and on Windows a fresh WebView2 profile (`webviewOptions.userDataFolder`).
- Optional `bun run test:e2e:stateful` runs in **stateful mode** (`E2E_MODE=stateful`) and reuses a repo-local persistent root (`.e2e-stateful/`, configurable via `E2E_STATEFUL_ROOT`) for persistence-focused checks.

### Backend (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs                            # Tauri bootstrap
├── lib.rs                             # Plugin init, state setup, command registration
├── menu.rs                            # App menu builder + event emitter
├── config.rs                          # Journal + diary directory config persistence (11 tests)
├── backup.rs                          # Automatic backups on unlock + rotation (5 tests)
├── auth/
│   ├── mod.rs                             # AuthMethodInfo, KeypairFiles structs; re-exports
│   ├── password.rs                        # PasswordMethod: Argon2id wrap/unwrap (5 tests)
│   └── keypair.rs                         # KeypairMethod: X25519 ECIES wrap/unwrap (6 tests)
├── commands/
│   ├── mod.rs                         # Re-exports: auth, entries, search, navigation, stats, import, export, plugin
│   ├── auth/
│   │   ├── mod.rs                     # DiaryState struct; re-exports, auto_lock_diary_if_unlocked
│   │   ├── auth_core.rs               # create/unlock/lock/reset/change_password (5 tests)
│   │   ├── auth_directory.rs          # change_diary_directory with file move + sync to config (5 tests)
│   │   ├── auth_journals.rs           # list/add/remove/rename/switch journals, auto-lock guards (6 tests)
│   │   └── auth_methods.rs            # Password & keypair registration, unlock_with_keypair (7 tests)
│   ├── entries.rs                     # CRUD + delete-if-empty (4 tests)
│   ├── search.rs                      # Search stub — returns empty results (1 test)
│   ├── navigation.rs                  # Day/month navigation (5 tests)
│   ├── stats.rs                       # Aggregated statistics (9 tests)
│   ├── import.rs                      # Import orchestration (3 tests)
│   ├── export.rs                      # JSON + Markdown export commands (2 tests)
│   └── plugin.rs                      # Plugin list/run commands (4 tests)
├── crypto/
│   ├── mod.rs                         # Re-exports
│   ├── password.rs                    # Argon2id hashing + verification (10 tests)
│   └── cipher.rs                      # AES-256-GCM encrypt/decrypt (11 tests)
├── db/
│   ├── mod.rs                         # Re-exports
│   ├── schema.rs                      # DB creation, migrations, password verification (6 tests)
│   └── queries.rs                     # All SQL: CRUD, dates, word count (9 tests)
├── export/
│   ├── mod.rs                         # Re-exports
│   ├── json.rs                        # Mini Diary-compatible JSON export
│   └── markdown.rs                    # HTML-to-Markdown conversion + export
├── plugin/
│   ├── mod.rs                         # ImportPlugin/ExportPlugin traits, PluginInfo struct
│   ├── builtins.rs                    # 6 unit structs wrapping built-in parsers/exporters (3 tests)
│   ├── registry.rs                    # PluginRegistry: register/find/list (5 tests)
│   └── rhai_loader.rs                 # Rhai engine, script discovery, sandbox, wrappers (11 tests)
└── import/
    ├── mod.rs                         # Re-exports + DiaryEntry conversion
    ├── minidiary.rs                   # Mini Diary JSON parser (8 tests)
    ├── dayone.rs                      # Day One JSON parser (14 tests)
    ├── dayone_txt.rs                  # Day One TXT parser (16 tests)
    ├── jrnl.rs                        # jrnl JSON parser (12 tests)
    └── merge.rs                       # Entry merge logic for date conflicts (13 tests)
```

## Command Registry

All 44 registered Tauri commands (source: `lib.rs`). Rust names use `snake_case`; frontend wrappers in `src/lib/tauri.ts` use `camelCase`.

| Module | Rust Command | Frontend Wrapper | Description |
|--------|-------------|-----------------|-------------|
| auth | `create_diary` | `createDiary(password)` | Create new encrypted DB |
| auth | `unlock_diary` | `unlockDiary(password)` | Decrypt and open DB |
| auth | `lock_diary` | `lockDiary()` | Close DB connection |
| auth | `diary_exists` | `diaryExists()` | Check if DB file exists |
| auth | `is_diary_unlocked` | `isDiaryUnlocked()` | Check unlock state |
| auth | `get_diary_path` | `getDiaryPath()` | Return diary file path |
| auth | `change_diary_directory` | `changeDiaryDirectory(newDir)` | Change diary directory (locked state only) |
| auth | `change_password` | `changePassword(old, new)` | Re-encrypt with new password |
| auth | `reset_diary` | `resetDiary()` | Delete and recreate DB |
| auth | `verify_password` | `verifyPassword(password)` | Validate password without side effects |
| auth | `unlock_diary_with_keypair` | `unlockDiaryWithKeypair(keyPath)` | Open DB via private key file |
| auth | `list_auth_methods` | `listAuthMethods()` | List all registered auth slots |
| auth | `generate_keypair` | `generateKeypair()` | Generate X25519 keypair, return hex |
| auth | `write_key_file` | `writeKeyFile(path, privateKeyHex)` | Write private key hex to file |
| auth | `register_password` | `registerPassword(newPassword)` | Register a password auth slot (requires diary unlocked) |
| auth | `register_keypair` | `registerKeypair(currentPassword, publicKeyHex, label)` | Add keypair auth slot |
| auth | `remove_auth_method` | `removeAuthMethod(slotId, currentPassword)` | Remove auth slot (guards last) |
| auth | `list_journals` | `listJournals()` | List configured journals from config.json |
| auth | `get_active_journal_id` | `getActiveJournalId()` | Get active journal ID |
| auth | `add_journal` | `addJournal(name, path)` | Add a new journal entry to config |
| auth | `remove_journal` | `removeJournal(id)` | Remove journal (guards last); auto-locks if active |
| auth | `rename_journal` | `renameJournal(id, name)` | Rename a journal |
| auth | `switch_journal` | `switchJournal(id)` | Auto-lock, switch db_path/backups_dir, persist active |
| entries | `save_entry` | `saveEntry(date, title, text)` | Upsert entry (encrypts) |
| entries | `get_entry` | `getEntry(date)` | Fetch + decrypt single entry |
| entries | `delete_entry_if_empty` | `deleteEntryIfEmpty(date, title, text)` | Remove entry if content is empty |
| entries | `get_all_entry_dates` | `getAllEntryDates()` | List all dates with entries |
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

## State Management

Six signal-based state modules in `src/state/`:

| Module | Signals | Key Functions |
|--------|---------|---------------|
| `auth.ts` | `authState: AuthState`, `error`, `authMethods: AuthMethodInfo[]` | `initializeAuth()`, `createDiary()`, `unlockDiary()`, `lockDiary()`, `unlockWithKeypair()` |
| `entries.ts` | `currentEntry`, `entryDates`, `isLoading`, `isSaving` | Setters exported directly |
| `journals.ts` | `journals: JournalConfig[]`, `activeJournalId`, `isSwitching` | `loadJournals()`, `switchJournal()`, `addJournal()`, `removeJournal()`, `renameJournal()` |
| `search.ts` | `searchQuery`, `searchResults`, `isSearching` | Setters exported directly |
| `ui.ts` | `selectedDate`, `isSidebarCollapsed`, `isGoToDateOpen`, `isPreferencesOpen`, `isStatsOpen`, `isImportOpen` | Setters exported directly |
| `preferences.ts` | `preferences: Preferences` | `setPreferences(Partial<Preferences>)`, `resetPreferences()` |

`Preferences` fields: `allowFutureEntries` (bool), `firstDayOfWeek` (number|null), `hideTitles` (bool), `enableSpellcheck` (bool). Stored in `localStorage`.

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

### Error Handling

- Backend: `Result<T, String>` — map errors with `.map_err(|e| format!(...))`.
- Frontend: `try/catch` around `invoke()` calls; set error signals for UI display.

### Naming

| Context | Convention | Example |
|---------|-----------|---------|
| Rust functions/vars | `snake_case` | `get_entry`, `db_path` |
| Rust types/structs | `PascalCase` | `DiaryState`, `ImportResult` |
| TS functions/vars | `camelCase` | `getEntry`, `selectedDate` |
| TS components | `PascalCase` | `DiaryEditor`, `SearchBar` |
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

For **user-scriptable** formats, users drop a `.rhai` file in `{diary_dir}/plugins/`. See `plugin/rhai_loader.rs` for the Rhai script contract and `docs/USER_GUIDE.md` for the end-user documentation.

### Menu Event Pattern

Rust emits → frontend listens:
```
menu.rs: app.emit("menu-navigate-previous-day", ())
shortcuts.ts: listen("menu-navigate-previous-day", handler)
```

All menu event names are prefixed `menu-`. See `menu.rs:78-107` for the full list.

## Testing

### Backend: 195 tests across 29 modules

Run: `cd src-tauri && cargo test`

| Module | Tests | File |
|--------|-------|------|
| auth/password | 5 | `auth/password.rs` |
| auth/keypair | 6 | `auth/keypair.rs` |
| password | 10 | `crypto/password.rs` |
| cipher | 11 | `crypto/cipher.rs` |
| schema | 11 | `db/schema.rs` |
| queries | 12 | `db/queries.rs` |
| auth-core | 5 | `commands/auth/auth_core.rs` |
| auth-directory | 5 | `commands/auth/auth_directory.rs` |
| auth-journals | 6 | `commands/auth/auth_journals.rs` |
| auth-methods | 7 | `commands/auth/auth_methods.rs` |
| entries | 4 | `commands/entries.rs` |
| search | 1 | `commands/search.rs` |
| navigation | 5 | `commands/navigation.rs` |
| stats | 9 | `commands/stats.rs` |
| import-cmd | 3 | `commands/import.rs` |
| export-cmd | 2 | `commands/export.rs` |
| plugin-cmd | 4 | `commands/plugin.rs` |
| minidiary | 8 | `import/minidiary.rs` |
| dayone | 14 | `import/dayone.rs` |
| dayone_txt | 16 | `import/dayone_txt.rs` |
| jrnl | 12 | `import/jrnl.rs` |
| merge | 13 | `import/merge.rs` |
| json-export | 6 | `export/json.rs` |
| md-export | 12 | `export/markdown.rs` |
| backup | 5 | `backup.rs` |
| plugin/builtins | 3 | `plugin/builtins.rs` |
| plugin/registry | 5 | `plugin/registry.rs` |
| plugin/rhai_loader | 11 | `plugin/rhai_loader.rs` |
| config | 11 | `config.rs` |

### Frontend: 31 tests across 6 files

Run: `bun run test:run` (single run) or `bun run test` (watch mode)

| File | Tests |
|------|-------|
| `src/lib/dates.test.ts` | 10 |
| `src/lib/import.test.ts` | 4 |
| `src/lib/tauri-params.test.ts` | 4 |
| `src/components/editor/TitleEditor.test.tsx` | 6 |
| `src/components/editor/WordCount.test.tsx` | 3 |
| `src/components/layout/MainLayout-event-listeners.test.tsx` | 4 |

Coverage: `bun run test:coverage`

### E2E: 1 spec (real binary, real SQLite)

Run: `bun run test:e2e` (requires release binary + `tauri-driver` installed)

| File | Description |
|------|-------------|
| `e2e/specs/diary-workflow.spec.ts` | 2 tests: (1) create diary → write entry → lock → unlock → verify persistence; (2) multi-date calendar navigation → write second entry → lock/unlock → verify both entries persist |

**data-testid attributes** used by E2E tests (do not remove):

| Component | Element | data-testid |
|-----------|---------|-------------|
| `PasswordCreation.tsx` | Password input | `password-create-input` |
| `PasswordCreation.tsx` | Confirm password input | `password-repeat-input` |
| `PasswordCreation.tsx` | Create button | `create-diary-button` |
| `PasswordPrompt.tsx` | Password input | `password-unlock-input` |
| `PasswordPrompt.tsx` | Unlock submit button | `unlock-diary-button` |
| `Header.tsx` | Sidebar toggle (hamburger) | `toggle-sidebar-button` |
| `Header.tsx` | Lock button | `lock-diary-button` |
| `TitleEditor.tsx` | Title input | `title-input` |
| `Calendar.tsx` | Each day button | `calendar-day-YYYY-MM-DD` |

## Verification Commands

```bash
# Development
bun run dev              # Vite dev server (frontend only)
bun run tauri dev        # Full Tauri dev (frontend + backend)

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

# Build
bun run build            # Frontend production build
bun run tauri build      # Full app bundle
```

## Gotchas and Pitfalls

1. **No FTS table (schema v4)**: `entries_fts` was removed for security (it stored plaintext). `insert_entry`, `update_entry`, `delete_entry`, and all import commands have `// Search index hook:` comments marking where a future search module should be plugged in.

2. **Search interface preserved**: `SearchResult`, `search_entries` (Rust), `searchEntries` (TS), `SearchBar.tsx`, `SearchResults.tsx`, and `src/state/search.ts` are all kept intact as the interface contract for future secure search — do not remove them.

3. **SolidJS test render wrapper**: Tests must use `render(() => <Component />)` with the arrow function. `render(<Component />)` will fail silently or error.

4. **Date format is always `YYYY-MM-DD`**: The `T00:00:00` suffix is appended in `dates.ts` functions (`new Date(dateStr + 'T00:00:00')`) to avoid timezone-related date shifts.

5. **Command registration is two places**: New commands must be added to both `commands/mod.rs` (module declaration) and `generate_handler![]` in `lib.rs`. Missing either causes silent failures or compile errors.

6. **Menu events**: Rust `app.emit("menu-*")` → frontend `listen()`. The menu items are defined in `menu.rs`; keyboard shortcut listeners are in `shortcuts.ts` and individual overlay components.

7. **Preferences use localStorage**: Not Tauri's store plugin. See `state/preferences.ts`.

8. **TipTap stores HTML**: The editor content is stored as HTML strings, not Markdown. This is intentional — the `text` field in `DiaryEntry` is HTML.

9. **Import parser contract**: Parsers in `import/*.rs` return `Vec<DiaryEntry>`. All DB interaction and merge logic happen in `commands/import.rs`, not in the parsers.

10. **Auth slots (v3 schema):** Each auth method stores its own wrapped copy of the master key in `auth_slots`. `remove_auth_method` refuses to delete the last slot (minimum one required). `change_password` re-wraps the master key in O(1) — no entry re-encryption needed. `verify_password` exists as a side-effect-free check used before multi-step operations.

11. **E2E mode contracts:** Default E2E uses clean-room mode (`E2E_MODE=clean`) and sets both `MINI_DIARIUM_DATA_DIR` (fresh temp diary path) and `MINI_DIARIUM_E2E=1` (backend disables `tauri-plugin-window-state` so host window geometry does not leak into tests). Stateful lane (`bun run test:e2e:stateful`) uses a repo-local persistent root (`.e2e-stateful/`, optionally overridden by `E2E_STATEFUL_ROOT`) for persistence-specific checks.

12. **Plugin registry is initialized once at startup** in `lib.rs` `.setup()`. It reads `{diary_dir}/plugins/` for `.rhai` scripts. The registry is stored as `State<Mutex<PluginRegistry>>`. If the user changes the diary directory, plugins are not reloaded until app restart (consistent with existing behavior).

13. **Rhai's `export` keyword is reserved**: Export plugin scripts must use `fn format_entries(entries)` instead of `fn export(entries)`. The `RhaiExportPlugin` wrapper calls `"format_entries"` internally.

14. **Rhai AST requires `unsafe impl Send + Sync`**: The `rhai::AST` type does not implement `Send + Sync` in the current version. The `unsafe` impls on `RhaiImportPlugin` and `RhaiExportPlugin` are required and justified: AST is immutable after compilation, and Engine is created fresh per invocation.

15. **Old import/export commands are preserved**: The original `import_minidiary_json`, `import_dayone_json`, etc. commands remain registered for backward compatibility. The Import/Export overlays now use the plugin system (`runImportPlugin`/`runExportPlugin`) but the legacy commands still work.

16. **Default E2E clean mode runs at 800×660 px — below the `lg` breakpoint (1024 px)**: The sidebar uses `lg:relative lg:translate-x-0`, so in default clean E2E mode it is always in mobile/overlay behavior. Any change to `isSidebarCollapsed` default or `resetUiState()` affects whether calendar day elements are reachable in E2E tests. **Planning rule**: when changing the default value of any UI visibility signal (`isSidebarCollapsed`, overlay open states, etc.), explicitly audit `e2e/specs/` for interactions that depend on the affected element being visible and update the test accordingly.

## Security Rules

- **Never** log, print, or serialize passwords or encryption keys
- **Never** store plaintext diary content in any unencrypted form on disk
- **Never** send data over the network — no analytics, no telemetry, no update checks
- Auth: A random master key is wrapped per auth slot in `auth_slots` (schema v3). Password slots use Argon2id + AES-256-GCM wrapping; keypair slots use X25519 ECIES. The master key is never stored in plaintext.
- The `DiaryState` holds `Mutex<Option<DatabaseConnection>>` — `None` when locked, `Some` when unlocked
- All commands that access entries must check `db_state.as_ref().ok_or("Diary not unlocked")?`

## Known Issues / Technical Debt

- **Low frontend test coverage**: Only 4 test files (editor + lib). Auth screens, Calendar, Sidebar, all overlays, and MainLayout lack tests.
- **No Tauri integration tests**: All backend tests use direct DB connections, not the Tauri command layer.
- **No error boundary components**: Unhandled errors in components crash the app.
- **Search not implemented**: `search_entries` is a stub returning `[]`. A secure search backend needs to be designed and implemented.
- **SolidJS reactivity warnings**: ~5 non-critical warnings in dev mode from signal access patterns.
- See `Current-implementation-plan.md` for remaining planned features (tasks 38-47).

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

Users drop a `.rhai` file in `{diary_dir}/plugins/`. The file must have a `// @name`, `// @type`, and optionally `// @extensions` comment header. Import scripts define `fn parse(content)` returning an array of entry maps; export scripts define `fn format_entries(entries)` returning a string. See `docs/USER_GUIDE.md` for templates and `plugin/rhai_loader.rs` for the runtime.

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

**Steps to implement:**

1. Design and build the secure index in `src-tauri/src/db/` (new file, e.g. `search_index.rs`)
2. Replace the stub body in `commands/search.rs` — keep the `SearchResult` struct and command signature
3. Call index write/delete at the `// Search index hook:` sites in `queries.rs` and `import.rs`
4. Bump `SCHEMA_VERSION`, add migration in `db/schema.rs`
5. Decide on UI placement; render `SearchBar` + `SearchResults` (or new components) in the chosen location
6. Update `CLAUDE.md` and `CHANGELOG.md`

### Creating a Release

See [RELEASING.md](RELEASING.md) for complete step-by-step instructions.

**Quick summary:**
1. Create release branch: `git checkout -b release-X.Y.Z`
2. Bump version: `./bump-version.sh X.Y.Z` (updates `package.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`, and `website/index.html`)
3. Commit and push branch: `git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock website/index.html && git commit -m "chore: bump version to X.Y.Z" && git push origin release-X.Y.Z`
4. Create PR to merge release branch → master
5. After PR merged, tag on master: `git checkout master && git pull && git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push origin vX.Y.Z`
6. Wait for GitHub Actions to build and create draft release
7. Publish the draft release on GitHub
