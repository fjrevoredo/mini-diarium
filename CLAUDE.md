# AGENTS.md — Mini Diarium

**Mini Diarium** is an encrypted, local-first desktop journaling app (SolidJS + Rust/Tauri v2 + SQLite). All diary entries are AES-256-GCM encrypted at rest; plaintext never touches disk except via the FTS index.

**Core principles:** privacy-first (no network), incremental dev, clean architecture, TypeScript strict + Rust type safety.

**Platforms:** Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+, Fedora, Arch).

**Status:** See `Current-implementation-plan.md` for task-level progress (55/58 tasks complete).

## Architecture

**Visual diagrams**:
- [Simple overview](docs/architecture-simple.svg) - High-level 6-layer view (for README)
- [Full diagram](docs/architecture-full.svg) - Detailed components and data flows

**Regenerate diagrams**:
```bash
bun run diagrams
# or individually:
# d2 docs/architecture-simple.d2 docs/architecture-simple.svg
# d2 docs/architecture-full.d2 docs/architecture-full.svg
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
- Entries are stored encrypted in SQLite; FTS index (`entries_fts`) stores plaintext for search. Any operation that writes entries must update both.
- Menu events flow: Rust `app.emit("menu-*")` → frontend `listen()` in `shortcuts.ts` or overlay components.
- Preferences use `localStorage` (not Tauri store plugin).

## File Structure

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
│   │   ├── Sidebar.tsx                # Calendar + search panel
│   │   ├── EditorPanel.tsx            # Editor container
│   │   └── MainLayout-event-listeners.test.tsx  # 4 tests
│   ├── overlays/
│   │   ├── GoToDateOverlay.tsx        # Date picker dialog
│   │   ├── PreferencesOverlay.tsx     # Settings dialog (includes Auth Methods section)
│   │   ├── StatsOverlay.tsx           # Statistics display
│   │   └── ImportOverlay.tsx          # Import format selector + file picker
│   └── search/
│       ├── SearchBar.tsx              # FTS search input
│       └── SearchResults.tsx          # Search result list
├── state/
│   ├── auth.ts                        # AuthState signal + authMethods + initializeAuth/create/unlock/lock/unlockWithKeypair
│   ├── entries.ts                     # currentEntry, entryDates, isLoading, isSaving
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

### Backend (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs                            # Tauri bootstrap
├── lib.rs                             # Plugin init, state setup, command registration
├── menu.rs                            # App menu builder + event emitter
├── backup.rs                          # Automatic backups on unlock + rotation (5 tests)
├── auth/
│   ├── mod.rs                             # AuthMethodInfo, KeypairFiles structs; re-exports
│   ├── password.rs                        # PasswordMethod: Argon2id wrap/unwrap (5 tests)
│   └── keypair.rs                         # KeypairMethod: X25519 ECIES wrap/unwrap (6 tests)
├── commands/
│   ├── mod.rs                         # Re-exports: auth, entries, search, navigation, stats, import, export
│   ├── auth.rs                        # DiaryState, create/unlock/lock/reset/change_password (6 tests)
│   ├── entries.rs                     # CRUD + delete-if-empty (4 tests)
│   ├── search.rs                      # FTS5 search (1 test)
│   ├── navigation.rs                  # Day/month navigation (5 tests)
│   ├── stats.rs                       # Aggregated statistics (9 tests)
│   ├── import.rs                      # Import orchestration + FTS rebuild (4 tests)
│   └── export.rs                      # JSON + Markdown export commands (2 tests)
├── crypto/
│   ├── mod.rs                         # Re-exports
│   ├── password.rs                    # Argon2id hashing + verification (10 tests)
│   └── cipher.rs                      # AES-256-GCM encrypt/decrypt (11 tests)
├── db/
│   ├── mod.rs                         # Re-exports
│   ├── schema.rs                      # DB creation, migrations, password verification (6 tests)
│   └── queries.rs                     # All SQL: CRUD, FTS, dates, word count (9 tests)
├── export/
│   ├── mod.rs                         # Re-exports
│   ├── json.rs                        # Mini Diary-compatible JSON export
│   └── markdown.rs                    # HTML-to-Markdown conversion + export
└── import/
    ├── mod.rs                         # Re-exports + DiaryEntry conversion
    ├── minidiary.rs                   # Mini Diary JSON parser (8 tests)
    ├── dayone.rs                      # Day One JSON parser (14 tests)
    ├── dayone_txt.rs                  # Day One TXT parser (16 tests)
    ├── jrnl.rs                        # jrnl JSON parser (12 tests)
    └── merge.rs                       # Entry merge logic for date conflicts (13 tests)
```

## Command Registry

All 33 registered Tauri commands (source: `lib.rs`). Rust names use `snake_case`; frontend wrappers in `src/lib/tauri.ts` use `camelCase`.

| Module | Rust Command | Frontend Wrapper | Description |
|--------|-------------|-----------------|-------------|
| auth | `create_diary` | `createDiary(password)` | Create new encrypted DB |
| auth | `unlock_diary` | `unlockDiary(password)` | Decrypt and open DB |
| auth | `lock_diary` | `lockDiary()` | Close DB connection |
| auth | `diary_exists` | `diaryExists()` | Check if DB file exists |
| auth | `is_diary_unlocked` | `isDiaryUnlocked()` | Check unlock state |
| auth | `get_diary_path` | `getDiaryPath()` | Return diary file path |
| auth | `change_password` | `changePassword(old, new)` | Re-encrypt with new password |
| auth | `reset_diary` | `resetDiary()` | Delete and recreate DB |
| auth | `verify_password` | `verifyPassword(password)` | Validate password without side effects |
| auth | `unlock_diary_with_keypair` | `unlockDiaryWithKeypair(keyPath)` | Open DB via private key file |
| auth | `list_auth_methods` | `listAuthMethods()` | List all registered auth slots |
| auth | `generate_keypair` | `generateKeypair()` | Generate X25519 keypair, return hex |
| auth | `write_key_file` | `writeKeyFile(path, privateKeyHex)` | Write private key hex to file |
| auth | `register_keypair` | `registerKeypair(password, pubKeyHex, label)` | Add keypair auth slot |
| auth | `remove_auth_method` | `removeAuthMethod(slotId, password)` | Remove auth slot (guards last) |
| entries | `save_entry` | `saveEntry(date, title, text)` | Upsert entry (encrypts + updates FTS) |
| entries | `get_entry` | `getEntry(date)` | Fetch + decrypt single entry |
| entries | `delete_entry_if_empty` | `deleteEntryIfEmpty(date, title, text)` | Remove entry if content is empty |
| entries | `get_all_entry_dates` | `getAllEntryDates()` | List all dates with entries |
| search | `search_entries` | `searchEntries(query)` | FTS5 search, returns snippets |
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

## State Management

Five signal-based state modules in `src/state/`:

| Module | Signals | Key Functions |
|--------|---------|---------------|
| `auth.ts` | `authState: AuthState`, `error`, `authMethods: AuthMethodInfo[]` | `initializeAuth()`, `createDiary()`, `unlockDiary()`, `lockDiary()`, `unlockWithKeypair()` |
| `entries.ts` | `currentEntry`, `entryDates`, `isLoading`, `isSaving` | Setters exported directly |
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

### Import Parser Pattern

To add a new import format:
1. Create `src-tauri/src/import/FORMAT.rs` — parser returning `Vec<DiaryEntry>`
2. Add command in `src-tauri/src/commands/import.rs` — orchestrate parse → merge → FTS rebuild
3. Register command in `commands/mod.rs` and `lib.rs` `generate_handler![]`
4. Add frontend wrapper in `src/lib/tauri.ts` and UI option in `ImportOverlay.tsx`

### Menu Event Pattern

Rust emits → frontend listens:
```
menu.rs: app.emit("menu-navigate-previous-day", ())
shortcuts.ts: listen("menu-navigate-previous-day", handler)
```

All menu event names are prefixed `menu-`. See `menu.rs:78-107` for the full list.

## Testing

### Backend: 176 tests across 20 modules

Run: `cd src-tauri && cargo test`

| Module | Tests | File |
|--------|-------|------|
| auth/password | 5 | `auth/password.rs` |
| auth/keypair | 6 | `auth/keypair.rs` |
| password | 10 | `crypto/password.rs` |
| cipher | 11 | `crypto/cipher.rs` |
| schema | 11 | `db/schema.rs` |
| queries | 12 | `db/queries.rs` |
| auth | 6 | `commands/auth.rs` |
| entries | 4 | `commands/entries.rs` |
| search | 1 | `commands/search.rs` |
| navigation | 5 | `commands/navigation.rs` |
| stats | 9 | `commands/stats.rs` |
| import-cmd | 4 | `commands/import.rs` |
| export-cmd | 2 | `commands/export.rs` |
| minidiary | 8 | `import/minidiary.rs` |
| dayone | 14 | `import/dayone.rs` |
| dayone_txt | 16 | `import/dayone_txt.rs` |
| jrnl | 12 | `import/jrnl.rs` |
| merge | 13 | `import/merge.rs` |
| json-export | 6 | `export/json.rs` |
| md-export | 12 | `export/markdown.rs` |
| backup | 5 | `backup.rs` |

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

1. **FTS rebuild after bulk import**: Import commands call `rebuild_fts_index()` which uses `'delete-all'` then re-indexes all entries. This is O(n) over all entries, not just imported ones.

2. **Dual storage: encrypted entries + plaintext FTS**: Any operation that creates/updates/deletes entries must handle both the encrypted `entries` table and the plaintext `entries_fts` table.

3. **SolidJS test render wrapper**: Tests must use `render(() => <Component />)` with the arrow function. `render(<Component />)` will fail silently or error.

4. **Date format is always `YYYY-MM-DD`**: The `T00:00:00` suffix is appended in `dates.ts` functions (`new Date(dateStr + 'T00:00:00')`) to avoid timezone-related date shifts.

5. **Command registration is two places**: New commands must be added to both `commands/mod.rs` (module declaration) and `generate_handler![]` in `lib.rs`. Missing either causes silent failures or compile errors.

6. **Menu events**: Rust `app.emit("menu-*")` → frontend `listen()`. The menu items are defined in `menu.rs`; keyboard shortcut listeners are in `shortcuts.ts` and individual overlay components.

7. **Preferences use localStorage**: Not Tauri's store plugin. See `state/preferences.ts`.

8. **TipTap stores HTML**: The editor content is stored as HTML strings, not Markdown. This is intentional — the `text` field in `DiaryEntry` is HTML.

9. **Import parser contract**: Parsers in `import/*.rs` return `Vec<DiaryEntry>`. All DB interaction, merge logic, and FTS rebuild happen in `commands/import.rs`, not in the parsers.

10. **Auth slots (v3 schema):** Each auth method stores its own wrapped copy of the master key in `auth_slots`. `remove_auth_method` refuses to delete the last slot (minimum one required). `change_password` re-wraps the master key in O(1) — no entry re-encryption needed. `verify_password` exists as a side-effect-free check used before multi-step operations.

## Security Rules

- **Never** log, print, or serialize passwords or encryption keys
- **Never** store plaintext diary content outside the FTS index (which is inside the encrypted DB file)
- **Never** send data over the network — no analytics, no telemetry, no update checks
- Auth: A random master key is wrapped per auth slot in `auth_slots` (schema v3). Password slots use Argon2id + AES-256-GCM wrapping; keypair slots use X25519 ECIES. The master key is never stored in plaintext.
- The `DiaryState` holds `Mutex<Option<DatabaseConnection>>` — `None` when locked, `Some` when unlocked
- All commands that access entries must check `db_state.as_ref().ok_or("Diary not unlocked")?`

## Known Issues / Technical Debt

- **Low frontend test coverage**: Only 4 test files (editor + lib). Auth screens, Calendar, Sidebar, all overlays, and MainLayout lack tests.
- **No Tauri integration tests**: All backend tests use direct DB connections, not the Tauri command layer.
- **Import FTS rebuild is O(n)**: Rebuilds full index on every import, regardless of import size.
- **No error boundary components**: Unhandled errors in components crash the app.
- **Search FTS5 coverage gap**: Only 1 test for search; edge cases (special characters, empty queries) untested.
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

### Adding a New Import Format

1. Create `src-tauri/src/import/FORMAT.rs` with a `parse_FORMAT(json: &str) -> Result<Vec<DiaryEntry>, String>` function
2. Add `pub mod FORMAT;` to `src-tauri/src/import/mod.rs`
3. Add command in `commands/import.rs` (follow existing pattern: parse → `import_entries()` → `rebuild_fts_index()`)
4. Register command, add frontend wrapper in `tauri.ts`, add UI option in `ImportOverlay.tsx`

### Creating a Release

See [RELEASING.md](RELEASING.md) for complete step-by-step instructions.

**Quick summary:**
1. Create release branch: `git checkout -b release-X.Y.Z`
2. Bump version: `./bump-version.sh X.Y.Z` (updates all version files)
3. Commit and push branch: `git add ... && git commit -m "chore: bump version to X.Y.Z" && git push origin release-X.Y.Z`
4. Create PR to merge release branch → master
5. After PR merged, tag on master: `git checkout master && git pull && git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push origin vX.Y.Z`
6. Wait for GitHub Actions to build and create draft release
7. Publish the draft release on GitHub
