# Backend (src-tauri/) — Mini Diarium

> For project architecture, command registry, and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).
> For durable backend rules, use [Rust best practices](../docs/best-practices/RUST_BEST_PRACTICES.md) and [Tauri best practices](../docs/best-practices/TAURI_BEST_PRACTICES.md) before changing commands, auth policy, migrations, encrypted storage, IPC, or WebView security.

## File Structure

```
src-tauri/src/
├── main.rs                            # Tauri bootstrap
├── lib.rs                             # Plugin init, state setup, command registration
├── menu.rs                            # App menu builder + event emitter
├── config.rs                          # Journal + diary directory config persistence
├── backup.rs                          # Automatic backups on unlock + rotation
├── screen_lock.rs                     # OS-level auto-lock listener (Windows WM_WTSSESSION_CHANGE/WM_POWERBROADCAST; macOS screen-sleep/lock notifications)
├── webview_security/
│   ├── mod.rs                         # install_platform_handlers(&win) — dispatches to platform impl
│   ├── windows.rs                     # WebView2 WebResourceRequested COM handler (blocks external HTTP(S))
│   └── macos.rs                       # WKContentRuleList rule compiler (blocks external HTTP(S))
├── auth/
│   ├── mod.rs                             # AuthMethodInfo, KeypairFiles structs; re-exports
│   ├── password.rs                        # PasswordMethod: Argon2id wrap/unwrap
│   ├── keypair.rs                         # KeypairMethod: X25519 ECIES wrap/unwrap
│   └── auto_key.rs                        # AutoKeyMethod: device-bound random key wrap/unwrap (local-only journals)
├── commands/
│   ├── mod.rs                         # Re-exports: auth, entries, search, navigation, stats, import, export, plugin, files
│   ├── auth/
│   │   ├── mod.rs                     # DiaryState struct; re-exports, auto_lock_diary_if_unlocked
│   │   ├── auth_core.rs               # create/unlock/lock/reset/change_password
│   │   ├── auth_directory.rs          # change_diary_directory with file move + sync to config
│   │   ├── auth_identity.rs           # verify_password, list_auth_methods, peek_auth_slot_types + JournalPeek/AuthSlotPeek
│   │   ├── auth_journals.rs           # list/add/remove/rename/switch journals, auto-lock guards
│   │   ├── auth_policy.rs             # set_require_all_auth (db_settings flag + MAC)
│   │   └── auth_slots.rs              # generate_keypair, write_key_file, register_password/keypair, remove_auth_method
│   ├── entries.rs                     # CRUD + delete-if-empty + delete (unconditional)
│   ├── search.rs                      # Search stub — returns empty results
│   ├── navigation.rs                  # Day/month navigation
│   ├── stats.rs                       # Aggregated statistics
│   ├── import.rs                      # Shared import helpers (read_import_file, import_entries, ImportResult) — used by the plugin runner
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
│   ├── schema/
│   │   ├── mod.rs                     # DatabaseConnection, SCHEMA_VERSION
│   │   ├── create.rs                  # DB creation + schema DDL
│   │   ├── open.rs                    # Password/keypair/auto open paths
│   │   ├── legacy.rs                  # Legacy metadata/hash helpers
│   │   └── migrations/                # v1_to_v2 … v6_to_v7 + apply_pending
│   └── queries/
│       ├── mod.rs                     # encrypt_for_storage, decrypt_utf8
│       ├── entries.rs                 # ENTRY_SELECT, row_to_entry, CRUD
│       ├── tags.rs                    # Tag CRUD + entry_tags associations
│       ├── auth_slots.rs              # Auth slot CRUD + list
│       └── db_settings.rs             # get/set/delete_db_setting, require_all_auth MAC
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
    with_unlocked_db(&state, |db| {
        // ... business logic
        Ok(result)
    })
}
```

`with_unlocked_db` acquires the DB lock and checks that the journal is unlocked, returning canonical error strings (`"Journal state lock failed"` / `"Journal must be unlocked"`). Use it for any command that only needs the DB connection. For commands that also access other `DiaryState` fields (e.g. `app_data_dir`, `db_path`) alongside the DB lock, open-code the preamble to avoid restructuring the borrow.

All commands return `Result<T, String>`. Register in both `commands/mod.rs` and `generate_handler![]` in `lib.rs`.

For command design rules that should not regress, see:

- [Tauri best practices](../docs/best-practices/TAURI_BEST_PRACTICES.md) for command registration, IPC validation, mapped error strings, and testable command cores.
- [Rust best practices](../docs/best-practices/RUST_BEST_PRACTICES.md) for backend-owned invariants, lock scope, encrypted row helpers, migrations, and compatibility shims.

**Two delete commands — use the right one:**
- `delete_entry_if_empty(id, title, text)` — soft delete: only removes the entry if both title and text are blank. Returns `bool`. Used by the editor on blur/navigation to silently clean up orphaned blank entries.
- `delete_entry(id)` — hard delete: unconditional removal, returns an error if the entry is not found. Used for explicit user-initiated "delete entry" actions.

### Error Handling

- `Result<T, String>` — map errors with `.map_err(|e| format!(...))`.
- All commands that access entries must ensure the journal is unlocked. Use `with_unlocked_db` (canonical error strings: `"Journal state lock failed"` and `"Journal must be unlocked"`) wherever the command only needs the DB handle. Canonical strings are matched by `mapTauriError` on the frontend.
- Security-sensitive command input must be validated in Rust even when the frontend already shapes the UI. Collections representing auth slots, credentials, or policy requirements need duplicate and coverage checks where identity matters.

### Menu Event Pattern — Backend

Emit events in `menu.rs`; the frontend listens in `shortcuts.ts` or overlay components:

```rust
app.emit("menu-navigate-previous-day", ())
```

All menu event names are prefixed `menu-`. See `menu.rs:78-107` for the full list. See root CLAUDE.md for the full cross-layer pattern.

### Import Parser Pattern (Built-in)

To add a new **built-in** import format (compiled Rust):
1. Create `src-tauri/src/import/FORMAT.rs` — parser returning `Vec<DiaryEntry>`
2. Add `pub mod FORMAT;` to `src-tauri/src/import/mod.rs`
3. Add a builtin wrapper struct in `plugin/builtins.rs` implementing `ImportPlugin`, and register it in `register_all()`

The plugin system (`run_import_plugin`) is the single entry point; no per-format Tauri command is needed. The search reindex hook lives in `commands::import::import_entries` (see `// Search index hook:` comment).

For **user-scriptable** formats, users drop a `.rhai` file in `{app_data_dir}/plugins/`. See `plugin/rhai_loader.rs` for the Rhai script contract and `docs/user-plugins/USER_PLUGIN_GUIDE.md` for the end-user plugin guide and templates.

## Verification Commands

```bash
cd src-tauri && cargo test                  # All backend tests
cd src-tauri && cargo test <module>         # Specific module (e.g., cargo test navigation)
cd src-tauri && cargo bench                       # All Rust benchmarks (criterion)
cd src-tauri && cargo bench --bench cipher_bench  # Specific benchmark
```

## Security Rules

- **Never** log, print, or serialize passwords or encryption keys
- **Never** store plaintext diary content in any unencrypted form on disk
- **Never** send data over the network — no analytics, no telemetry, no update checks
- Auth: A random master key is wrapped per auth slot in `auth_slots` (schema v3). Password slots use Argon2id + AES-256-GCM wrapping; keypair slots use X25519 ECIES. The master key is never stored in plaintext.
- The `DiaryState` holds `Mutex<Option<DatabaseConnection>>` — `None` when locked, `Some` when unlocked
- All commands that access entries must check `db_state.as_ref().ok_or("Diary not unlocked")?`
- **`unlock_diary_auto` intentionally bypasses `require_all_auth`**: Local-only journals use a device-bound key stored in `config.json` and have no user credential to combine with a second factor. The multi-auth guard only applies to password/keypair journals. Applying it to auto-key journals would always fail and is not the intended policy. See `commands/auth/auth_core.rs` `unlock_diary_auto` doc comment and `docs/decisions/2026-04-passwordless-journal.md` for the full rationale (P20, 2026-05-21 Position A decision).

### Network Isolation Defense-in-Depth Stack (v0.5.0)

The following layers prevent the embedded WebView from making outbound network requests:

1. **`on_navigation` handler** (`lib.rs`) — blocks any URL navigation that is not `tauri://`, `ipc://`, or localhost. This was in place before v0.5.0.
2. **CSP** (`tauri.conf.json`) — explicit `connect-src 'self' ipc: http://ipc.localhost`; `worker-src 'none'`; `child-src 'none'`; `frame-src 'none'`; `object-src 'none'`; `form-action 'none'`; `manifest-src 'none'`.
3. **Init script** (`lib.rs` — `initialization_script_for_all_frames`) — nulls `RTCPeerConnection`, `WebTransport`, `Worker`, `SharedWorker`, `navigator.serviceWorker`, `navigator.sendBeacon`, `navigator.connection`, and `window.open` in all frames before any page script runs. `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource` stay available because Tauri IPC and the dev server depend on them; external network requests are blocked by CSP and platform WebView handlers. Source of truth: `src/lib/network-isolation-script.ts` — **keep the two copies in sync**.
4. **`on_new_window(Deny)`** (`lib.rs`) — blocks `window.open()` and `target="_blank"` popup creation on all platforms.
5. **Windows `WebResourceRequested`** (`lib.rs` `#[cfg(target_os = "windows")]`) — COM event handler that returns a synthetic `403 Forbidden` response (`SetResponse`) for external HTTP(S) requests (non-localhost).
6. **macOS `WKContentRuleList`** (`lib.rs` `#[cfg(target_os = "macos")]`) — compiled content-blocking rule that blocks all `https?://.*` requests to non-localhost domains at the WebKit engine level.
7. **Windows Firewall rule** (NSIS installer — `nsis/installer.nsh`) — outbound block rule for `mini-diarium.exe`. Requires `perMachine` install mode (elevated installer). Does not cover WebView2 subprocess traffic (see `docs/network-isolation-plan.md` Task 4.1b).
8. **Linux Flatpak** (`flatpak/io.github.fjrevoredo.mini-diarium.yml`) — no `--share=network` in `finish-args` → kernel namespace blocks all outbound sockets.

**Opener exception**: `tauri_plugin_opener` is retained. User-clicked help/docs links open in the system browser. This is documented in `PHILOSOPHY.md` and `SECURITY.md`.

## Gotchas and Pitfalls

1. **Current schema is v7**: `entries_fts` was removed in v4 for security (it stored plaintext). v5 added `id INTEGER PRIMARY KEY AUTOINCREMENT` for multi-entry-per-date support. v6 added the `db_settings` table (`require_all_auth` flag + HKDF-SHA256 MAC) to bind multi-auth requirement to the encrypted database rather than `config.json`. v7 added `tags` (AES-256-GCM encrypted name, HKDF-SHA256 keyed fingerprint for dedup) and `entry_tags` (association table with `ON DELETE CASCADE` on both sides). `insert_entry`, `update_entry`, `delete_entry`, and all import commands have `// Search index hook:` comments marking where a future search module should be plugged in.

2. **Command registration is two places**: New commands must be added to both `commands/mod.rs` (module declaration) and `generate_handler![]` in `lib.rs`. Missing either causes silent failures or compile errors.

3. **Import behavior (no merge)**: Parsers in `import/*.rs` return `Vec<DiaryEntry>`. Imports always create new entries; there is no date-conflict merging. Re-importing the same file creates duplicate entries. The old merge path has been removed from the current codebase.

4. **Auth slots (v3 schema):** Each auth method stores its own wrapped copy of the master key in `auth_slots`. `remove_auth_method` refuses to delete the last slot (minimum one required). `change_password` re-wraps the master key in O(1) — no entry re-encryption needed. `verify_password` exists as a side-effect-free check used before multi-step operations. The `require_all_auth` flag (v6 schema) lives in the `db_settings` table inside `diary.db`, integrity-protected by an HKDF-SHA256 MAC derived from the master key — tampering with the row enforces the guard via a fail-safe. See [`docs/decisions/2026-05-settings-storage-taxonomy.md`](../docs/decisions/2026-05-settings-storage-taxonomy.md) for the full settings storage taxonomy and when to use `db_settings` vs. `config.json`.

5. **Plugin registry is initialized once at startup** in `lib.rs` `.setup()`. It reads `{app_data_dir}/plugins/` for `.rhai` scripts (central location, shared across all journals). The registry is stored as `State<Mutex<PluginRegistry>>`.

6. **Rhai's `export` keyword is reserved**: Export plugin scripts must use `fn format_entries(entries)` instead of `fn export(entries)`. The `RhaiExportPlugin` wrapper calls `"format_entries"` internally.

7. **Rhai AST requires `unsafe impl Send + Sync`**: The `rhai::AST` type does not implement `Send + Sync` in the current version. The `unsafe` impls on `RhaiImportPlugin` and `RhaiExportPlugin` are required and justified: AST is immutable after compilation, and Engine is created fresh per invocation.

## Common Task Checklists

### Adding a New Tauri Command

1. Write the function in the appropriate `src-tauri/src/commands/*.rs` file (or create a new module and add it to `commands/mod.rs`)
2. Register in `lib.rs` `generate_handler![]` macro
3. Add typed wrapper in `src/lib/tauri.ts`

### Adding a New Import/Export Format

**Option A: Built-in (compiled Rust)**

1. Create `src-tauri/src/import/FORMAT.rs` with a `parse_FORMAT(content: &str) -> Result<Vec<DiaryEntry>, String>` function
2. Add `pub mod FORMAT;` to `src-tauri/src/import/mod.rs`
3. Add a builtin wrapper struct in `plugin/builtins.rs` implementing `ImportPlugin` (or `ExportPlugin`), register in `register_all()`

The plugin runner (`run_import_plugin` / `run_export_plugin`) dispatches to the builtin. No per-format Tauri command is required — the frontend discovers available formats via `list_import_plugins()` / `list_export_plugins()`.

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

- `db/queries/entries.rs` — `insert_entry()`, `update_entry()`, `delete_entry()` — index/remove individual entries
- `commands/import.rs` — `import_entries()` helper — bulk reindex after import (reached via `run_import_plugin`)

**Design constraints for any future implementation:**

1. **No plaintext on disk** — the index must be encrypted or derived in a way that does not expose entry content to raw file access. Options to evaluate: encrypted FTS (e.g. SQLCipher), client-side trigram index stored encrypted alongside entries, or an in-memory index rebuilt at unlock time.
2. **Schema migration required** — bump `SCHEMA_VERSION` in `db/schema/mod.rs` and add a migration step in `db/schema/migrations/`.
3. **UI placement is undecided** — `SearchBar` and `SearchResults` exist but where they appear (sidebar, overlay, command palette, etc.) should be designed fresh. Wire them into `Sidebar.tsx` or a new component; do not assume the old sidebar layout.
4. **State is ready** — `src/state/search.ts` signals can be used as-is or extended.
