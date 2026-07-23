# `mini-diarium-core` — Public API

This document is the **curated public surface** of `mini-diarium-core`: the deliberate API
that consumers (the desktop app crate `mini-diarium`, a future `minidiarium-plus`, and
eventually a WASM tier) call. It was defined in open-core **M2 (TODO-0077)**.

**Rule of thumb:** if a name is not listed here, it is an implementation detail. It may be
`pub` inside the crate for internal reuse, but it is sealed behind a `pub(crate)` module or
otherwise not re-exported at a module root, so external crates cannot name it. Treat anything
unlisted as subject to change without notice.

Each item below is reachable at the path shown (e.g. `mini_diarium_core::db::insert_entry`).

---

## Contract & compatibility

### Status: pre-1.0, internal

The crate is version `0.1.0` and is consumed **only** as a path dependency by
`mini-diarium` in this repository. Until open-core **M4** decides distribution
(crates.io vs. git dependency — see [`docs/OPEN_CORE_STRATEGY.md`](../../docs/OPEN_CORE_STRATEGY.md) §10),
**any item listed here may change without notice**: no deprecation window, no semver
promise, no changelog obligation beyond this repository's own `CHANGELOG.md`.

What this document *does* guarantee today is narrower and still useful: it is the complete
list of names an external consumer is allowed to reach for, and it is kept truthful
(see [Change rule](#change-rule)). It is **not** an external stability promise, and the
crate should not be presented as a dependency-ready stable API until M4 says so.

The boundary is enforced by **module visibility + code review**. An automated
`cargo-public-api` guard (fail CI when the public surface changes without a corresponding
API.md update) is an explicit **deferred follow-up** — see OPEN_CORE_STRATEGY.md §10.

### MSRV / edition

Rust **1.95** (pinned in `rust-toolchain.toml`), edition **2021**. Bumping the toolchain is
a contract change and updates this line.

### Error policy

Every fallible function returns `Result<_, String>`. **The error text is a display value,
not a branch key** — consumers must not pattern-match on it, and its wording may change in
any commit.

There is exactly one honest exception, and it exists because the desktop app predates this
contract: `mapTauriError` (`src/lib/errors.ts`) classifies backend errors by **regex
heuristics** to pick a localized message. Core owns two of the phrases it keys on:

| Phrase | Produced by | Consumer behaviour |
|---|---|---|
| `"Incorrect password"` | `auth/password.rs`, `db/schema/open.rs` | mapped to the localized "incorrect password" message |
| any `rusqlite` / `sqlite` / `argon2` substring | propagated driver/KDF errors | collapsed into a generic "internal error" |

Renaming either is a contract change and requires updating `src/lib/errors.ts` in the same
commit. Every other error string is free-form.

### Secrets

No public API returns a master key or a raw `rusqlite::Connection`.
`DatabaseConnection::{conn, key}` are `pub(crate)` by design; operations that need the
master key are exposed as composed functions instead (e.g. `auth::add_password_slot`).
Passwords and key material are never logged, printed, or serialized.

### Handle & mutation semantics

Blanket rules, so individual entries below do not repeat them:

- **Unlocked handle required.** Every `db::*` function that takes `&DatabaseConnection`
  operates on an already-unlocked journal; obtaining one is the job of the
  `create_database*` / `open_database*` constructors. The single exception is
  `db::peek_auth_slot_types`, which takes a **path** and needs neither a handle nor a key.
- **Transactions.** `insert_entry_with_images`, `update_entry_with_images`, and
  `delete_entry_by_id` wrap their work in `BEGIN IMMEDIATE` / `COMMIT` with an explicit
  `ROLLBACK` on any failure (`db/queries/entries/{insert,update,delete}.rs`), so the
  long-lived connection is never left in a half-open transaction. The lower-level
  `insert_entry` / `update_entry` are single-statement writes with no transaction of their
  own — they are the primitives the `*_with_images` variants compose.
- **Foreign keys.** Connections are always opened through `db::schema`'s `open_connection`,
  which sets the per-connection `PRAGMA foreign_keys = ON` that all `ON DELETE CASCADE` /
  `RESTRICT` declarations depend on.
- **Encryption.** Entry title/text/preview/metadata, tag names, and image bytes are
  AES-256-GCM encrypted at the application layer before they reach SQLite. The SQLite
  container itself is *not* encrypted — that is why an unauthenticated peek is possible.

### Serde guarantees

Field names of the IPC-visible types **are frozen**: the frontend's TypeScript interfaces
(`src/lib/tauri/*.ts`) mirror them verbatim, so renaming one silently breaks the UI.

| Type | Serialized fields |
|---|---|
| `DiaryEntry` | `id`, `date`, `title`, `text`, `word_count`, `date_created`, `date_updated`, `metadata` (omitted when `None`), `locked` |
| `EntryMetadata` | `fontFamily`, `fontSize` (**renamed** from `font_family`/`font_size`; each omitted when `None`) |
| `TimelineRow` | `id`, `date`, `title`, `preview`, `locked` |
| `Tag` | `id`, `name`, `created_at` |
| `ImageData` | `id`, `mime_type`, `data_base64` |
| `ImageSummary` | `id`, `mime_type`, `created_at`, `thumbnail_mime_type`, `thumbnail_data_base64`, `width`, `height`, `byte_size`, `usage_count`, `first_entry_date`, `latest_entry_date` |
| `ImageSummaryPage` | `items`, `has_more` |
| `ImageSummarySort` | enum, `snake_case`: `newest`, `oldest`, `most_used` |
| `AuthMethodInfo` | `id`, `slot_type`, `label`, `public_key_hex` (`null` for password slots), `created_at`, `last_used` |
| `KeypairFiles` | `public_key_hex`, `private_key_hex` |
| `JournalPeek` | `slots`, `require_all_auth` |
| `AuthSlotPeek` | `id`, `slot_type`, `label` |
| `PluginInfo` | `id`, `name`, `file_extensions`, `builtin` |
| `ExportOutput` | not serialized — a plain Rust struct with `content: String` and `assets: Vec<(String, Vec<u8>)>` |
| `SearchResult` | `id`, `date`, `title`, `snippet` |
| `SearchResponse` | **`camelCase`**: `results`, `totalMatches` |
| `JournalConfig` | `id`, `name`, `path`, `auto_key`, `db_filename`, `require_all_auth` (last three omitted when `None`) — this is the on-disk `config.json` shape, so it is also a **file-format** contract |
| `JournalInfo` | `id`, `name`, `path`, `auto_protected`, `require_all_auth`, `db_filename` — the IPC-safe DTO; never carries the raw `auto_key` |
| `PrintLabels` | **deserialize-only** input: `generated_label`, `tags_label`, `no_entries_label`, `months` |

### Change rule

Any change to a listed symbol's **name, signature, serde field, or error class** updates
this file **in the same commit**. Adding a new public name means adding it here; if it is
not worth listing, it should not be `pub`.

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

### Locked-journal peek (no handle, no key)
- `peek_auth_slot_types(path) -> Result<JournalPeek, String>` — reads auth-slot types/labels
  and the `require_all_auth` flag straight from a **locked** journal file, so an unlock screen
  knows which credentials to ask for. Excludes `auto` slots; never returns `wrapped_key` or
  `public_key`. A missing file yields an empty peek **without creating it**; a pre-v6 journal
  with no `db_settings` table yields `require_all_auth: false`.
  The flag is read here **without** its HKDF MAC (there is no key to verify with). That is not
  a bypass: this value only decides what the UI *asks* for — enforcement stays with the
  MAC-verified, fail-safe `verify_require_all_auth` on the unlocked path.
- Types: `JournalPeek`, `AuthSlotPeek`

### Introspection / stats
- `read_schema_version`, `read_engine_versions`, `get_entry_date_word_counts`

### Custom fonts
- `list_custom_font_rows`, `custom_font_has_weight`, `upsert_custom_font`,
  `delete_custom_font_family`, `get_custom_font_weight_data`

---

## `auth` — authentication methods & master-key wrapping

The pure cryptographic parts of this surface — `SecretBytes`, `KeypairFiles`, the four method
types, `generate_keypair`, and `derive_public_key` — are **re-exported from
[`mini-diarium-crypto`](../mini-diarium-crypto/API.md)** (open-core M3a / TODO-0082); they live
in that `rusqlite`-free crate. The db-coupled parts (`AuthMethodInfo`, `add_password_slot`,
`add_keypair_slot`) stay in this crate. Consumers reach the whole surface at
`mini_diarium_core::auth::…` regardless. The `auth::{auto_key, keypair, password}` sub-modules
are sealed (`pub(crate)`).

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

**Re-exported from [`mini-diarium-crypto`](../mini-diarium-crypto/API.md)** (open-core M3a /
TODO-0082) — the `rusqlite`-free crate where the cipher and password hashing actually live.
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
