# `mini-diarium-core` — Public API (stability contract)

This document is the **curated public surface** of `mini-diarium-core`: the deliberate,
stable API that consumers (the desktop app crate `mini-diarium`, a future `minidiarium-plus`,
and eventually a WASM tier) may depend on. It was defined in open-core **M2 (TODO-0077)**.

**Rule of thumb:** if a name is not listed here, it is an implementation detail. It may be
`pub` inside the crate for internal reuse, but it is sealed behind a `pub(crate)` module or
otherwise not re-exported at a module root, so external crates cannot name it. Treat anything
unlisted as subject to change without notice.

The boundary is enforced today by **module visibility + code review**. An automated
`cargo-public-api` guard (fail CI when the public surface changes without a corresponding
API.md update) is an explicit **deferred follow-up** — see OPEN_CORE_STRATEGY.md §10.

Each item below is reachable at the path shown (e.g. `mini_diarium_core::db::insert_entry`).
Serde-serialized types keep their field names stable — the frontend/IPC contract depends on
them.

---

## `db` — encrypted database layer

Everything is reached at the `db` root. The `db::queries` and `db::schema` sub-modules are
sealed (`pub(crate)`); the names below are re-exported at `db`.

### Handle & constants
- `DatabaseConnection` — the open, unlocked journal handle. **`conn()` and `key()` are
  intentionally NOT public** (they are `pub(crate)`): no raw `rusqlite::Connection` and no
  master key ever escape the crate. Bespoke SQL and master-key wrapping are exposed as
  dedicated functions instead.
- `SCHEMA_VERSION: i32`
- `from_parts(conn, key)` — test-only constructor, gated behind `#[cfg(any(test, feature = "test-support"))]`.

### Types
`DiaryEntry`, `EntryMetadata`, `TimelineRow`, `Tag`, `ImageData`, `ImageSummary`,
`ImageSummaryPage`, `ImageSummarySort`.

### Open / create (unlock)
- `create_database`, `create_database_auto`
- `open_database`, `open_database_auto`, `open_database_with_keypair`

### Entry CRUD
- `insert_entry` → **`Result<i64, String>`** (returns the new AUTOINCREMENT row id)
- `insert_entry_with_images`, `update_entry`, `update_entry_with_images`
- `get_entry_by_id`, `get_entries_by_date`, `get_all_entries`, `get_entries_in_range`
- `get_all_entry_dates`, `get_locked_entry_dates`, `get_entries_for_timeline`
- `delete_entry_by_id`, `is_entry_locked`, `set_entry_locked`, `count_words`

### Tags
- `create_tag`, `get_all_tags`, `rename_tag`, `delete_tag`
- `add_tag_to_entry`, `remove_tag_from_entry`, `get_tags_for_entry`
- `get_entry_dates_by_tag`, `get_tags_names_map`

### Images
- `get_images_for_entry`, `list_image_summaries_filtered`, `get_image_by_id`,
  `resolve_image_refs_in_entries`
- (`upsert_image`, link/extract/cleanup helpers remain `pub(crate)`.)

### Auth-slot management
- `get_password_slot`, `get_keypair_slot_by_pubkey`, `list_auth_slots`, `insert_auth_slot`,
  `delete_auth_slot`, `count_auth_slots`, `update_auth_slot_wrapped_key`,
  `update_slot_last_used` (takes `&DatabaseConnection`), `get_auth_slot_type`

### `db_settings` (operate on `&DatabaseConnection`)
- `get_db_setting`, `set_db_setting`, `delete_db_setting`
- `verify_require_all_auth`, `write_require_all_auth_mac`
- (The raw-`&rusqlite::Connection` forms `*_conn` stay `pub(crate)` — used only by in-crate
  tests exercising the missing-table paths.)

### Introspection / stats
- `read_schema_version`, `read_engine_versions`, `get_entry_date_word_counts`

### Custom fonts
- `list_custom_font_rows`, `custom_font_has_weight`, `upsert_custom_font`,
  `delete_custom_font_family`, `get_custom_font_weight_data`

---

## `auth` — authentication methods & master-key wrapping

The `auth::{auto_key, keypair, password}` sub-modules are sealed (`pub(crate)`).

### Types
`SecretBytes`, `AuthMethodInfo`, `KeypairFiles`, `PasswordMethod`, `KeypairMethod`,
`PrivateKeyMethod`, `AutoKeyMethod`.

### Functions & methods
- `generate_keypair`, `derive_public_key`
- `PasswordMethod::{wrap_master_key, unwrap_master_key}`,
  `KeypairMethod::wrap_master_key`, `PrivateKeyMethod::unwrap_master_key`
- **Composed slot ops** (encapsulate the master-key wrap that `conn()`/`key()` sealing removes
  from consumers):
  - `add_password_slot(db, label, password) -> Result<i64, String>`
  - `add_keypair_slot(db, label, public_key: [u8; 32]) -> Result<i64, String>`

There is intentionally **no `rewrap` function**: `change_password` recovers the master key by
unwrapping the current password slot, so it needs no separate helper.

---

## `crypto` — the reusable cryptographic kernel

Reached at `crypto::cipher` / `crypto::password` (also used by benches).

- `cipher::{Key, encrypt, decrypt, CipherError, tag_name_fingerprint, image_fingerprint}`
- `password::{hash_password, verify_password, derive_key_from_phc_hash, generate_salt, PasswordError}`

---

## `search` — in-memory full-text search

- `SearchResult`, `SearchResponse`, `MAX_RESULTS`
- `search_entries(db, query) -> Result<SearchResponse, String>`

The scan decrypts entries in memory per query and never persists a plaintext index.

---

## `config` — journal configuration (`config.json`)

- Types: `JournalConfig`, `JournalInfo`
- `generate_journal_id`, `load_diary_dir`, `save_diary_dir`, `load_journals`, `save_journals`,
  `load_active_journal_id`, `save_active_journal_id`, `save_journal_auto_key`,
  `set_journal_require_all_auth`

---

## `backup` — encrypted-DB backup rotation

- `create_backup`, `rotate_backups`, `backup_and_rotate`

---

## `export` — export writers

The `export::{html, json, markdown}` sub-modules are sealed (`pub(crate)`).

- `export_entries_to_json`, `export_entries_to_markdown_with_assets`, `generate_print_html`,
  `PrintLabels`
- (`export_entries_to_markdown_inline` / `html_to_markdown` remain `pub(crate)` — used only by
  `plugin::builtins`.)

---

## `import` — import parsers

Nothing beyond the plugin path is public. The parsers (`parse_minidiary_json`,
`parse_dayone_json`, `parse_dayone_txt`, `parse_jrnl_json`) and their serde structs are
`pub(crate)`; consumers import through the plugin registry (`plugin::register_all` wires the
builtin importers).

---

## `plugin` — import/export plugin runtime

- `PluginRegistry` (+ `new`, `register_importer`, `register_exporter`, `list_importers`,
  `list_exporters`, `find_importer`, `find_exporter`)
- `PluginInfo`, `ImportPlugin`, `ExportPlugin`, `ExportOutput`
- `register_all` (re-export of `builtins::register_all`)
- `rhai_loader::{load_plugins, migrate_journal_plugins, ensure_plugins_dir}`
- (The 7 concrete builtin plugin structs are `pub(crate)`.)
