# Backend (src-tauri/) — Mini Diarium

> For project architecture, command registry, and cross-cutting conventions see the [root CLAUDE.md](../CLAUDE.md).
> For durable backend rules, use [Rust best practices](../docs/best-practices/RUST_BEST_PRACTICES.md) and [Tauri best practices](../docs/best-practices/TAURI_BEST_PRACTICES.md) before changing commands, auth policy, migrations, encrypted storage, IPC, or WebView security.

## Workspace layout

The backend is a Cargo **workspace** (root `Cargo.toml`) with three members, layered
bottom-up: `mini-diarium-crypto` (base) → `mini-diarium-core` (depends on crypto) →
`mini-diarium` (app, depends on core):

- **App crate — `src-tauri/`** (`mini-diarium`): the Tauri commands (`commands/*`), native menu, OS shell, WebView security, and window/screen-lock listeners. Depends on the core crate; `lib.rs` re-exports its modules (`pub use mini_diarium_core::{auth, backup, config, crypto, db, export, import, plugin, search};`) so `crate::db::…`-style paths in `commands/*` resolve. **As of open-core M2 (TODO-0077), `commands/*` reach core only through its curated façade** — the module roots (`db`, `auth`, `export`, `import`, `plugin`) re-export the curated API and seal their internals to `pub(crate)`. Do **not** reintroduce `crate::db::queries::…` / `crate::db::schema::…` / `db.conn()` / `db.key()` — **or a raw `rusqlite::Connection`** — in `commands/*`; use the façade names (e.g. `crate::db::insert_entry`, `crate::auth::add_password_slot`, `crate::db::peek_auth_slot_types`). The app crate **no longer depends on `rusqlite` at all** (bundled SQLite arrives transitively through the core crate), so a direct driver call is now a compile error rather than a convention violation. Two greps must stay empty: `rg "rusqlite" src-tauri/src` and `rg "db::queries::|db::schema::|\.conn\(\)|\.key\(\)" src-tauri/src`. The surface is documented in [`crates/mini-diarium-core/API.md`](../crates/mini-diarium-core/API.md), which is explicitly **pre-1.0 and internal** — see its "Contract & compatibility" section for the error/serde/handle rules that come with it.
- **Core crate — `crates/mini-diarium-core/`** (`mini-diarium-core`): the Tauri-free **SQLite** business layer — db, import/export, plugins, backup, config, search. **Zero `tauri::` references.** It **depends on `mini-diarium-crypto` and re-exports** its `crypto`/`auth` modules, so `mini_diarium_core::crypto::…` / `…::auth::…` (and the app-crate shim) still resolve. Consumable by a future separate product and eventually WASM (see [`docs/OPEN_CORE_STRATEGY.md`](../docs/OPEN_CORE_STRATEGY.md)). Its curated public surface is documented in [`API.md`](../crates/mini-diarium-core/API.md) (pre-1.0, internal until open-core M4 decides distribution); everything else is `pub(crate)`/private. Its version is intentionally decoupled from the app version.
- **Crypto crate — `crates/mini-diarium-crypto/`** (`mini-diarium-crypto`): the reusable, **`rusqlite`-free** cryptographic base — AES-256-GCM cipher, Argon2id password hashing, and the X25519/HKDF master-key wrapping (`crypto/` + the pure `auth/` methods and their `SecretBytes`/`KeypairFiles` value types). Carved out in open-core **M3a (TODO-0082)** so the universal cryptographic code compiles without the desktop SQLite binding in its dependency graph, keeping the WASM door open. Acceptance invariant: `cargo tree -p mini-diarium-crypto` shows **no `rusqlite`**. Surface documented in [`crates/mini-diarium-crypto/API.md`](../crates/mini-diarium-crypto/API.md). The db-coupled pieces (`AuthMethodInfo`, `add_password_slot`/`add_keypair_slot`, the encrypted-row format) stay in the core crate.

`Cargo.lock` and `target/` live at the repo root. Run all backend tests with `cargo test --workspace` (**not** `--manifest-path src-tauri/Cargo.toml`, which skips the core and crypto crates' tests).

## Key Modules

### App crate (`src-tauri/src/`)

| Path | Purpose |
|------|---------|
| `commands/` | One module per command group — all registered via `generate_handler![]` in `lib.rs`. Groups: `auth/` (multi-file), `entries`, `search`, `navigation`, `stats`, `import`, `export`, `plugin`, `debug`, `files`, `fonts`, `images`, `menu`, `tags`. Handlers delegate to the core crate. |
| `webview_security/` | Platform WebView handlers that block external HTTP(S) at the OS level |
| `menu.rs` | Native menu builder (Preferences + Quit only, plus the macOS `PredefinedMenuItem` Edit/Window submenus) and the `menu-preferences` event emitter |
| `screen_lock.rs` | OS session-lock listener → auto-lock trigger |
| `spellcheck.rs` | Dictionary-language resolution + the Linux-only WebView enablement (see Gotcha #9) |

### Core crate (`crates/mini-diarium-core/src/`)

| Path | Purpose |
|------|---------|
| `db/schema/` | DB connection helpers (`open_connection*`), DDL, and schema migrations `v1_to_v2` … `v12_to_v13` via `apply_pending` |
| `db/queries/` | Encrypted-row assembly / SQL binding (desktop adapter). The field codec (`encrypt_for_storage`, `decrypt_utf8`, `decrypt_bytes`) now lives in the crypto crate's `format` module (M3b / TODO-0083); `mod.rs` re-exports it under the historical names so call sites are unchanged |
| `auth/` | Composed slot ops (`add_password_slot`/`add_keypair_slot`) + `AuthMethodInfo` DTO. Re-exports the pure auth methods from the `mini-diarium-crypto` crate (see below). |
| `import/` | Built-in diary format parsers (Mini Diary, Day One, jrnl) |
| `export/` | JSON and Markdown export writers |
| `plugin/` | Plugin trait, registry, Rhai script loader and sandbox |
| `backup.rs` | Encrypted-DB backup rotation |
| `config.rs` | `JournalConfig`/`JournalInfo` and `config.json` handling |

### Crypto crate (`crates/mini-diarium-crypto/src/`)

`rusqlite`-free; re-exported by the core crate as `crypto`/`auth`.

| Path | Purpose |
|------|---------|
| `crypto/cipher.rs` | AES-256-GCM encrypt/decrypt + keyed HKDF-SHA256 fingerprints (`tag_name_fingerprint`, `image_fingerprint`) |
| `crypto/password.rs` | Argon2id password hashing (`hash_password`, `verify_password`, `derive_key_from_phc_hash`, `generate_salt`) |
| `format.rs` | At-rest encrypted-row field codec (`encrypt_for_storage`, `decrypt_utf8`, `decrypt_bytes`) — thin `cipher`-backed wrapper, re-exported by core as `format` (M3b / TODO-0083) |
| `auth/password.rs` | `PasswordMethod` — master-key wrap/unwrap via Argon2id + AES-256-GCM |
| `auth/keypair.rs` | `KeypairMethod`/`PrivateKeyMethod` — X25519 ECIES wrap/unwrap; `generate_keypair`, `derive_public_key` |
| `auth/auto_key.rs` | `AutoKeyMethod` — device-bound 32-byte key wrap/unwrap (no KDF) |
| `auth/mod.rs` | `SecretBytes` (zeroize-on-drop) + `KeypairFiles` value types; re-exports the method types |

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

Emit events in `menu.rs`; the frontend listens in `MainLayout.tsx` or overlay components:

```rust
app.emit("menu-preferences", ())
```

Menu event names are prefixed `menu-`. Since TODO-0065 reduced the native menu to
Preferences + Quit, **`menu-preferences` is the only event emitted** — every other action
lives in the WebView (Header controls, the `⋮` overflow menu, and the JS keyboard
shortcuts in `src/lib/keyboard-shortcuts.ts`). Preferences is also the only remaining
OS-level accelerator (`CmdOrCtrl+,`). See root CLAUDE.md for the full cross-layer pattern.

### Import Parser Pattern (Built-in)

To add a new **built-in** import format (compiled Rust):
1. Create `crates/mini-diarium-core/src/import/FORMAT.rs` — parser returning `Vec<DiaryEntry>`
2. Add `pub(crate) mod FORMAT;` to `crates/mini-diarium-core/src/import/mod.rs` (import parsers are sealed to the crate as of open-core M2; the only public import path is via the plugin registry)
3. Add a builtin wrapper struct in `crates/mini-diarium-core/src/plugin/builtins.rs` implementing `ImportPlugin`, and register it in `register_all()`

The plugin system (`run_import_plugin`) is the single entry point; no per-format Tauri command is needed. The search reindex hook lives in `commands::import::import_entries` (see `// Search index hook:` comment).

For **user-scriptable** formats, users drop a `.rhai` file in `{app_data_dir}/plugins/`. See `crates/mini-diarium-core/src/plugin/rhai_loader/` for the Rhai script contract (`metadata.rs` parses the `// @name`/`// @type` header, `runtime.rs` holds the sandboxed engine) and `docs/user-plugins/USER_PLUGIN_GUIDE.md` for the end-user plugin guide and templates.

## Verification Commands

For the canonical post-task checklist (tests + formatting + CHANGELOG + TODO), see [Post-Task Completion Best Practices](../docs/best-practices/POST_TASK_BEST_PRACTICES.md).

Backend-specific:

```bash
cargo bench --manifest-path src-tauri/Cargo.toml                        # All Rust benchmarks (criterion)
cargo bench --manifest-path src-tauri/Cargo.toml --bench cipher_bench   # Specific benchmark
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
7. **Linux Flatpak** (`flatpak/io.github.fjrevoredo.mini-diarium.yml`) — no `--share=network` in `finish-args` → kernel namespace blocks all outbound sockets.

**Opener exception**: `tauri_plugin_opener` is retained. User-clicked help/docs links open in the system browser. This is documented in `PHILOSOPHY.md` and `SECURITY.md`.

## Gotchas and Pitfalls

1. **Current schema is v13**: `entries_fts` was removed in v4 for security (it stored plaintext). v5 added `id INTEGER PRIMARY KEY AUTOINCREMENT` for multi-entry-per-date support. v6 added the `db_settings` table (`require_all_auth` flag + HKDF-SHA256 MAC) to bind multi-auth requirement to the encrypted database rather than `config.json`. v7 added `tags` (AES-256-GCM encrypted name, HKDF-SHA256 keyed fingerprint for dedup) and `entry_tags` (association table with `ON DELETE CASCADE` on both sides). v8 added `custom_fonts` (unencrypted BLOB storage for user-uploaded font files; `UNIQUE(family, weight)` constraint; Regular weight required before Bold). v9 added `entry_metadata_encrypted` (nullable BLOB on the `entries` table, encrypted with the journal master key, context "entry_metadata") to store per-entry metadata such as font family and font size. v10 added `images` (content-addressed encrypted image store; HKDF-SHA256 fingerprint for dedup; AES-256-GCM encrypted `data` BLOB) and `entry_images` (junction table with `ON DELETE CASCADE` on `entry_id`, `ON DELETE RESTRICT` on `image_id`). v11 added `thumbnail_data`, `thumbnail_mime_type`, `width`, `height`, `byte_size`, `thumbnail_version` columns to `images` (nullable; backfilled lazily). v12 added `preview_enc BLOB` (nullable; AES-256-GCM encrypted 200-char plaintext preview; context `"entry_preview"`; populated by `insert_entry`/`update_entry` on every save; NULL for entries not yet saved since v12 upgrade; `get_entries_for_timeline` falls back to full-text decryption when NULL). v13 added `locked INTEGER NOT NULL DEFAULT 0` (plaintext, non-sensitive per-entry "lock against accidental edits" flag, TODO-0071; **not** a security boundary — never routed through the content-save path). It is toggled by the dedicated `set_entry_locked` command (targeted UPDATE, no re-encryption); `save_entry`, `delete_entry`, `add_tag_to_entry`, and `remove_tag_from_entry` reject a locked entry with `"entry is locked"`; `get_locked_entry_dates` feeds the calendar indicator. Migrations run v3→v4 … v12→v13 via `apply_pending`. `insert_entry`, `update_entry`, `delete_entry`, and all import commands have `// Search index hook:` comments marking where a future search module should be plugged in.

2. **Always use `open_connection` / `open_connection_in_memory` — never `Connection::open` directly**: `PRAGMA foreign_keys` is a per-connection setting that SQLite resets on every new connection. Forgetting to set it means `ON DELETE CASCADE` / `ON DELETE RESTRICT` declarations on `entry_tags`, `entry_images`, and any future tables are silently inert. The helpers in `db/schema/create.rs` (`open_connection(path)` for file DBs, `open_connection_in_memory()` for test DBs) apply the pragma automatically. In tests that construct `DatabaseConnection` by hand, call `open_connection_in_memory()` rather than `Connection::open_in_memory()`. **Never bypass this with a direct `Connection::open` call.**

3. **Command registration is two places**: New commands must be added to both `commands/mod.rs` (module declaration) and `generate_handler![]` in `lib.rs`. Missing either causes silent failures or compile errors.

4. **Import behavior (no merge)**: Parsers in `import/*.rs` return `Vec<DiaryEntry>`. Imports always create new entries; there is no date-conflict merging. Re-importing the same file creates duplicate entries. The old merge path has been removed from the current codebase.

5. **Auth slots (v3 schema):** Each auth method stores its own wrapped copy of the master key in `auth_slots`. `remove_auth_method` refuses to delete the last slot (minimum one required). `change_password` re-wraps the master key in O(1) — no entry re-encryption needed. `verify_password` exists as a side-effect-free check used before multi-step operations. The `require_all_auth` flag (v6 schema) lives in the `db_settings` table inside `diary.db`, integrity-protected by an HKDF-SHA256 MAC derived from the master key — tampering with the row enforces the guard via a fail-safe. See [`docs/decisions/2026-05-settings-storage-taxonomy.md`](../docs/decisions/2026-05-settings-storage-taxonomy.md) for the full settings storage taxonomy and when to use `db_settings` vs. `config.json`.

6. **Plugin registry is initialized once at startup** in `lib.rs` `.setup()`. It reads `{app_data_dir}/plugins/` for `.rhai` scripts (central location, shared across all journals). The registry is stored as `State<Mutex<PluginRegistry>>`.

7. **Rhai's `export` keyword is reserved**: Export plugin scripts must use `fn format_entries(entries)` instead of `fn export(entries)`. The `RhaiExportPlugin` wrapper calls `"format_entries"` internally.

8. **Rhai AST requires `unsafe impl Send + Sync`**: The `rhai::AST` type does not implement `Send + Sync` in the current version. The `unsafe` impls on `RhaiImportPlugin` and `RhaiExportPlugin` are required and justified: AST is immutable after compilation, and Engine is created fresh per invocation.

9. **WebView-level spell checking is a Linux-only concern** (TODO-0081, issue #227): WebView2 and WKWebView route the HTML `spellcheck` attribute to an OS-native text checker, so on Windows/macOS the frontend attribute is the whole feature. WebKitGTK runs no checker until `set_spell_checking_enabled(true)` is called on the `WebKitWebContext`, which defaults to off — so `spellcheck::apply` has a `#[cfg(target_os = "linux")]` body and is a deliberate no-op elsewhere. `webkit2gtk` is a direct dependency only under `[target.'cfg(target_os = "linux")'.dependencies]`; it must stay version-compatible with tauri's so `PlatformWebview::inner()` returns the same `webkit2gtk::WebView` type. Dictionaries are data, not code: the Flatpak manifest installs them to `/app/share/hunspell/`, other Linux packages rely on `/usr/share/hunspell`. Keep `DEFAULT_REGIONS` in `spellcheck.rs`, the `hunspell-dicts` module in `flatpak/io.github.fjrevoredo.mini-diarium.yml`, and the shipped locale list in `src/i18n/locales/` in sync — a UI language with no matching dictionary silently checks nothing.

## Common Task Checklists

### Adding a New Tauri Command

1. Write the function in the appropriate `src-tauri/src/commands/*.rs` file (or create a new module and add it to `commands/mod.rs`)
2. Register in `lib.rs` `generate_handler![]` macro
3. Add typed wrapper in the matching command-category sub-file under `src/lib/tauri/`

**If the command is not yet ready to ship**, gate it behind the `experimental` feature instead of blocking the PR:

```rust
// In commands/your_module.rs — gate consumer-only imports too, or clippy -D warnings fails
#[cfg(feature = "experimental")]
use crate::commands::auth::DiaryState;
#[cfg(feature = "experimental")]
use tauri::State;

#[cfg(feature = "experimental")]
#[tauri::command]
pub fn your_command(_state: State<DiaryState>) -> Result<(), String> {
    todo!()
}
```

```rust
// In lib.rs generate_handler![] — Tauri's macro parses outer attributes before each path,
// so #[cfg] here compiles out both the match arm and all references inside it.
#[cfg(feature = "experimental")]
commands::your_module::your_command,
```

Activate during development: `cargo build --features experimental`. See `docs/decisions/2026-06-feature-flags.md` for the full strategy.

### Adding a New Import/Export Format

**Option A: Built-in (compiled Rust)**

1. Create `crates/mini-diarium-core/src/import/FORMAT.rs` with a `parse_FORMAT(content: &str) -> Result<Vec<DiaryEntry>, String>` function
2. Add `pub(crate) mod FORMAT;` to `crates/mini-diarium-core/src/import/mod.rs` (parsers stay sealed to the crate; the plugin registry is the only public path)
3. Add a builtin wrapper struct in `crates/mini-diarium-core/src/plugin/builtins.rs` implementing `ImportPlugin` (or `ExportPlugin`), register in `register_all()`

The plugin runner (`run_import_plugin` / `run_export_plugin`) dispatches to the builtin. No per-format Tauri command is required — the frontend discovers available formats via `list_import_plugins()` / `list_export_plugins()`.

**Option B: User-scriptable (Rhai)**

Users drop a `.rhai` file in `{diary_dir}/plugins/`. The file must have a `// @name`, `// @type`, and optionally `// @extensions` comment header. Import scripts define `fn parse(content)` returning an array of entry maps; export scripts define `fn format_entries(entries)` returning a string. See `docs/user-plugins/USER_PLUGIN_GUIDE.md` for templates and `crates/mini-diarium-core/src/plugin/rhai_loader/runtime.rs` for the runtime.

### Search

Full-text search was originally provided by a SQLite FTS5 table, removed in schema v4
(v0.2.0) because it stored diary content in plaintext, defeating the AES-256-GCM
encryption. Search was reintroduced as an in-memory scan over decrypted entries: each
query decrypts the journal entries (reusing `queries::get_all_entries`, the same decrypt
path used by export/stats), matches case- and accent-folded terms with AND semantics,
builds HTML-escaped `<mark>` snippets, and discards everything — nothing searchable is
ever written to disk.

| Layer | File | What it provides |
|-------|------|-----------------|
| Core scan | `crates/mini-diarium-core/src/search/` | `mod.rs`: `SearchResult` + `SearchResponse` structs + `search_entries(db, query)` DB orchestration (open-core M2 façade). `text.rs`: DB-free, crypto-free term folding, matching, and snippet building |
| Rust command | `src-tauri/src/commands/search.rs` | Thin `#[tauri::command] search_entries` wrapper over `mini_diarium_core::search::search_entries`; re-exports `SearchResult`/`SearchResponse` |
| Frontend wrapper | `src/lib/tauri/search.ts` | `SearchResult` interface + `searchEntries(query)` async function returning `SearchResponse` |
| Frontend state | `src/state/search.ts` | `searchQuery`, `searchResults`, `isSearching` signals |
| Frontend components | `src/components/search/SearchOverlay.tsx` | Palette-style dialog mounting `SearchBar` + `SearchResults` (in `MainLayout`) |
| | `src/components/search/SearchBar.tsx` | Debounced input with a monotonic latest-wins guard |
| | `src/components/search/SearchResults.tsx` | Results list; click deep-links the entry via `setSelectedEntryId` |

**Trigger:** Header search button + Cmd/Ctrl+F (`MainLayout` keydown handler). A result
click sets the entry deep-link before the date so the editor opens the exact entry (a day
can hold multiple entries), then switches `mainView` to `editor` and closes the overlay.

**Indexing hook points** (`// Search index hook:` comments) remain in
`db/queries/entries/{insert,update,delete}.rs` and `commands/import.rs`. They are unused
today because the in-memory scan needs no persistent index, but mark where a future index
would plug in.

**Performance:** the scan is O(n) over all entries per query, debounced 500 ms on the
client and capped at 200 results displayed to the UI; the backend returns `total_matches` 
(pre-truncation count) so the UI can report "Showing first 200 of 1200" when results exceed the cap.
This is acceptable for the personal-journal scale this app targets. If a future index is added, it must satisfy the original constraint:

1. **No plaintext on disk** — the index must be encrypted or derived in a way that does
   not expose entry content to raw file access (e.g. encrypted FTS / SQLCipher, an
   encrypted trigram index, or an in-memory index rebuilt at unlock time).
2. **Schema migration** — bump `SCHEMA_VERSION` in `db/schema/mod.rs` and add a migration
   step in `db/schema/migrations/`.
