# Backend (src-tauri/) — Mini Diarium

> For project architecture, command registry, and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).

## File Structure

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

## Conventions

### Command Pattern

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

- `Result<T, String>` — map errors with `.map_err(|e| format!(...))`.
- All commands that access entries must check `db_state.as_ref().ok_or("Diary not unlocked")?`

### Menu Event Pattern — Backend

Emit events in `menu.rs`; the frontend listens in `shortcuts.ts` or overlay components:

```rust
app.emit("menu-navigate-previous-day", ())
```

All menu event names are prefixed `menu-`. See `menu.rs:78-107` for the full list. See root CLAUDE.md for the full cross-layer pattern.

### Import Parser Pattern (Built-in)

To add a new **built-in** import format (compiled Rust):
1. Create `src-tauri/src/import/FORMAT.rs` — parser returning `Vec<DiaryEntry>`
2. Add command in `src-tauri/src/commands/import.rs` — orchestrate parse → merge (see "Search index hook" comment for where to add reindex)
3. Register command in `commands/mod.rs` and `lib.rs` `generate_handler![]`
4. Add frontend wrapper in `src/lib/tauri.ts` and UI option in `ImportOverlay.tsx`
5. Add a builtin wrapper struct in `plugin/builtins.rs` implementing `ImportPlugin`, and register it in `register_all()`

For **user-scriptable** formats, users drop a `.rhai` file in `{diary_dir}/plugins/`. See `plugin/rhai_loader.rs` for the Rhai script contract and `docs/user-plugins/USER_PLUGIN_GUIDE.md` for the end-user plugin guide and templates.

## Verification Commands

```bash
cd src-tauri && cargo test                  # All backend tests
cd src-tauri && cargo test <module>         # Specific module (e.g., cargo test navigation)
```

## Security Rules

- **Never** log, print, or serialize passwords or encryption keys
- **Never** store plaintext diary content in any unencrypted form on disk
- **Never** send data over the network — no analytics, no telemetry, no update checks
- Auth: A random master key is wrapped per auth slot in `auth_slots` (schema v3). Password slots use Argon2id + AES-256-GCM wrapping; keypair slots use X25519 ECIES. The master key is never stored in plaintext.
- The `DiaryState` holds `Mutex<Option<DatabaseConnection>>` — `None` when locked, `Some` when unlocked
- All commands that access entries must check `db_state.as_ref().ok_or("Diary not unlocked")?`

## Gotchas and Pitfalls

1. **No FTS table (schema v5)**: `entries_fts` was removed for security (it stored plaintext). The `entries` table now uses `id INTEGER PRIMARY KEY AUTOINCREMENT` for multi-entry-per-date support. `insert_entry`, `update_entry`, `delete_entry`, and all import commands have `// Search index hook:` comments marking where a future search module should be plugged in.

2. **Command registration is two places**: New commands must be added to both `commands/mod.rs` (module declaration) and `generate_handler![]` in `lib.rs`. Missing either causes silent failures or compile errors.

3. **Import behavior (no merge)**: Parsers in `import/*.rs` return `Vec<DiaryEntry>`. Imports always create new entries; there is no date-conflict merging. Re-importing the same file creates duplicate entries. The old merge path has been removed from the current codebase.

4. **Auth slots (v3 schema):** Each auth method stores its own wrapped copy of the master key in `auth_slots`. `remove_auth_method` refuses to delete the last slot (minimum one required). `change_password` re-wraps the master key in O(1) — no entry re-encryption needed. `verify_password` exists as a side-effect-free check used before multi-step operations.

5. **Plugin registry is initialized once at startup** in `lib.rs` `.setup()`. It reads `{diary_dir}/plugins/` for `.rhai` scripts. The registry is stored as `State<Mutex<PluginRegistry>>`. If the user changes the diary directory, plugins are not reloaded until app restart (consistent with existing behavior).

6. **Rhai's `export` keyword is reserved**: Export plugin scripts must use `fn format_entries(entries)` instead of `fn export(entries)`. The `RhaiExportPlugin` wrapper calls `"format_entries"` internally.

7. **Rhai AST requires `unsafe impl Send + Sync`**: The `rhai::AST` type does not implement `Send + Sync` in the current version. The `unsafe` impls on `RhaiImportPlugin` and `RhaiExportPlugin` are required and justified: AST is immutable after compilation, and Engine is created fresh per invocation.

8. **Old import/export commands are preserved**: The original `import_minidiary_json`, `import_dayone_json`, etc. commands remain registered for backward compatibility. The Import/Export overlays now use the plugin system (`runImportPlugin`/`runExportPlugin`) but the legacy commands still work.

## Common Task Checklists

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
