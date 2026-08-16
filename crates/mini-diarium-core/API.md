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
`mini-diarium` in this repository. **Any item listed here may change without notice**:
no deprecation window, no semver promise, no changelog obligation beyond this
repository's own `CHANGELOG.md`.

Open-core **M4a** settled distribution on 2026-07-24 and this status is the deliberate
consequence, not a placeholder: the crate is distributed as a **tagged git dependency**,
is **not** published to crates.io, and stays on an independent `0.x` version decoupled
from the app's. A consumer pins a git tag, so façade churn is its scheduling decision —
which is what makes deferring a semver promise affordable. See
[`docs/decisions/2026-07-core-crate-distribution.md`](../../docs/decisions/2026-07-core-crate-distribution.md)
for the rationale, the publishing prerequisites, and the conditions that would reopen it.

What this document *does* guarantee today is narrower and still useful: it is the complete
list of names an external consumer is allowed to reach for, and it is kept truthful
(see [Change rule](#change-rule)). It is **not** an external stability promise, and the
crate should not be presented as a dependency-ready stable API until that ADR is reopened
and says so.

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
  AES-256-GCM encrypted at the application layer before they reach SQLite, via the
  `format` field codec (see [`format`](#format--at-rest-encrypted-row-field-codec)) —
  which lives in the `rusqlite`-free `mini-diarium-crypto` crate, not core. `db::queries`
  only assembles rows and binds the resulting bytes as SQL params. The SQLite container
  itself is *not* encrypted — that is why an unauthenticated peek is possible.

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
| `ContentCounts` | `tags`, `entry_tag_links`, `images`, `entry_image_links`, `images_missing_thumbnail`, `custom_font_families`, `custom_font_rows`, `locked_entries`, `entries_with_metadata`, `entries_missing_preview` — all `i64`. Serialized into the debug dump file, so this is also a **support-artifact** contract |
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
- `read_content_counts(db) -> Result<ContentCounts, String>` — per-feature row counts for
  the debug dump. Plain `SELECT COUNT(*)` only: **nothing is decrypted**, so no entry text,
  tag name, or image byte is materialised. Deliberately not built on `get_all_tags` /
  `list_image_summaries_filtered`, which do decrypt.
- Type: `ContentCounts`

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

## `format` — at-rest encrypted-row field codec

**Re-exported from [`mini-diarium-crypto`](../mini-diarium-crypto/API.md)** (open-core M3b /
TODO-0083) — the `rusqlite`-free crate where the encrypted-row field codec now lives. Reached at
`format::…`. This is the only plaintext↔ciphertext transform used by every encrypted entry/tag/
image row; `db::queries` re-exports it internally under the historical names.

- `format::{encrypt_for_storage, decrypt_utf8, decrypt_bytes}`

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

### Default-location helpers

Both are pure — no I/O, no platform lookup — so the caller owns creating the directory and
deciding what to do when it cannot.

- `default_journal_dir(app_data_dir, documents_dir: Option<&Path>) -> PathBuf` — where a new
  journal goes when the user has not picked a folder: `<documents>/Mini Diarium`, or
  `<app_data>/journals` when no documents directory is available. A *preference*, not a
  guarantee: it does not check that the result is writable. The app crate probes it and falls
  back to the `None` form when the preferred location cannot be created or written to.
- `journal_dir_name(name: &str) -> String` — sanitises a user-chosen journal name into a safe
  single folder name for use under that directory. Strips path separators and the rest of the
  Windows reserved set, collapses whitespace, trims trailing dots and spaces, sidesteps the
  reserved device names (`CON`, `NUL`, `COM1`…), caps the length, and returns `"Journal"` when
  nothing survives. The result is a **name**, never a path: it contains no separator and is
  never empty, so it cannot escape the parent the caller chose.

---

## `backup` — encrypted-journal snapshots

A snapshot is an ordinary encrypted Mini Diarium database written with `VACUUM INTO`, fsync,
and an atomic rename, then verified before it is reported as created. No plaintext and no key
material is ever written to the backups directory. Reached at the `backup` root; the
`policy` / `store` / `manifest` sub-modules are also public, since the policy layer is the
reusable half.

**Replaces** the pre-TODO-0098 surface (`MAX_BACKUPS`, `create_backup`, `rotate_backups`,
`backup_and_rotate`), which is gone. Retention is now tiered, so no single `MAX_BACKUPS`
number describes it.

### Entry points
- `create_snapshot(db, &BackupContext, SnapshotTrigger) -> Result<SnapshotOutcome, String>` —
  applies the dedup/interval rules, writes and verifies if needed, then applies retention.
  Retention runs even when the snapshot is skipped.
- `list_snapshots(backups_dir) -> Result<Vec<SnapshotMeta>, String>` — newest first. Needs
  **no key and no open journal**: it reconciles the manifest against the directory and
  describes anything new from the snapshot's plaintext columns.
- `backup_health(backups_dir, db_path) -> BackupHealth` — aggregate state for a health
  indicator. Like `list_snapshots`, needs **no key and no open journal**: `db_path` is only
  `stat`ed, for the storage budget and to tell "never backed up yet" (normal) from "the
  journal's directory is gone" (broken).
- `verify_snapshot_file(db, backups_dir, file_name) -> Result<SnapshotMeta, String>` —
  re-checks one snapshot against the live master key and persists the result. A snapshot that
  fails is **reported, not deleted**: it may still be readable with the credential it was
  taken with.
- `delete_snapshot(backups_dir, file_name) -> Result<(), String>` — deletes the file and its
  record. The name is validated against the engine's naming rule first, so a caller cannot
  address anything outside the backups directory (snapshot names arrive from the frontend).
- `create_pre_v3_snapshot(db, backups_dir) -> Result<String, String>` — the reduced form for
  v1/v2 journals, which have no auth slots to verify against.

### Relocation (`backup::relocate`, re-exported at the `backup` root)

Moves an existing backups directory tree when the journal it belongs to moves (TODO-0098
Task 5.1) — what keeps `change_diary_directory` from silently stranding a journal's history at
the old location.

- `relocate_backups(old_dir: &Path, new_dir: &Path) -> Result<(), String>` — copies every
  snapshot from `old_dir` to `new_dir` (skip-don't-clobber on a same-name collision, byte-length
  verified after each copy), merges the two directories' manifests so no snapshot's
  `trigger`/`verified`/`sqlite_change_counter` is lost or silently re-adopted as `Adopted`, and
  only then removes `old_dir` — the one irreversible step, always last. A no-op when `old_dir`
  does not exist, which is also what makes a retry after a partial failure safe: nothing is
  deleted from `old_dir` until every file has copied successfully and the merged manifest is
  durable at the destination. Both paths are the *nested* backups directory a journal actually
  uses (`{journal dir}/backups/{db stem}`), the same value `BackupContext::backups_dir` holds —
  not the flat `{journal dir}/backups` parent.

### Inspection (`backup::inspect`, re-exported at the `backup` root)

Reading a snapshot **without** adopting it as a journal. The distinction matters because a
snapshot is an ordinary openable database: opening one the normal way writes to it
(`update_slot_last_used` alone is enough), which destroys the restore point being examined.

- `open_snapshot_file(backups_dir, file_name, SnapshotCredential) -> Result<DatabaseConnection, String>`
  — validates the name like `delete_snapshot` does, then opens the snapshot
  `SQLITE_OPEN_READ_ONLY`. **No migration runs** and nothing is registered; the caller owns
  the returned connection and dropping it zeroizes the key.
- `check_snapshot_credentials(backups_dir, file_name, live_db_path) -> Result<SnapshotCredentialReport, String>`
  — needs **no key**: auth-slot rows are plaintext. Answers "will today's password open this
  snapshot?" before the user is asked to type one (finding B-11).
- `list_snapshot_entries(db) -> Result<Vec<SnapshotEntry>, String>` — id, date, title, and a
  200-character preview only. Adapts to the snapshot's schema version, since `preview_enc`
  (v12) and `locked` (v13) are absent from exactly the pre-migration snapshots that matter
  most.
- `open_snapshot_readonly(path, SnapshotCredential)` / `compare_snapshot_credentials(snapshot_path, live_db_path)`
  — the same two operations addressed by path rather than by name.
- `SnapshotCredential::{Password(String), PrivateKey([u8; 32]), AutoKey([u8; 32])}` —
  zeroize-on-drop, and its `Debug` prints the variant only.
- `SnapshotEntry { id, date, title, preview }`
- `SnapshotCredentialReport { snapshot_slot_types, live_slot_types, differs_from_live, compared }`
  — `compared: false` means the live journal could not be read, which makes
  `differs_from_live` moot rather than merely `false`.

### Whole-journal restore (`backup::restore`, re-exported at the `backup` root)

Rolls the live journal back to a snapshot: a `PreRestore` safety snapshot of the current
state first, then an atomic file swap (the same write-then-rename primitive `store` uses for
*taking* a snapshot, aimed the other direction), then a reopen that migrates the result if the
restored snapshot predates the current schema.

- `restore_from_snapshot(db: DatabaseConnection, &BackupContext, file_name) -> RestoreOutcome`
  — takes the live connection **by value**: owning it proves nothing else can reach the
  journal while the file underneath it is being replaced. No credential is asked for —
  `change_password` re-wraps the master key rather than re-encrypting entries, so the key the
  live connection already holds is the key every snapshot this journal ever produced was
  encrypted with.
- `RestoreOutcome { db: Option<DatabaseConnection>, safety_snapshot: Option<SnapshotMeta>, restored: bool, error: Option<String> }`
  — deliberately not a `Result`: every path (success, an aborted attempt, or a rolled-back
  failure) hands back a connection the caller should reinstall. `db` is `None` only in the
  unrecoverable case where neither the restored file nor the safety snapshot could be
  reopened; the safety snapshot's file name is still included so there is always something to
  act on.

### Per-entry restore (`backup::restore_entries`, re-exported at the `backup` root)

Copies individual entries out of an already-open inspection connection (see Inspection above)
and into the live journal, in-process — no plaintext ever touches disk.

- `list_snapshot_entries_with_status(snapshot_db, live_db) -> Result<Vec<SnapshotEntryDiff>, String>`
  — the same fields `list_snapshot_entries` returns, plus an `EntryMatchStatus`. Matched by
  date + title (entry ids are not stable across databases — each database assigns its own
  AUTOINCREMENT sequence), falling back to "another blank-titled live entry on the same date"
  when the title itself is blank. `word_count` — already an unencrypted column — stands in for
  "how much content survived", so the comparison costs no decryption beyond what listing the
  snapshot and reading the live day's entries already do.
- `restore_entries_from_snapshot(live_db, snapshot_db, entry_ids: &[i64]) -> Result<RestoreEntriesOutcome, String>`
  — never overwrites: every entry is a fresh `INSERT`, so a date that already holds live
  entries gets an additional one alongside them. `image-id://N` refs are resolved against the
  *snapshot's* image store before the text crosses into the live database, where those ids
  name something else entirely; tags are restored by decrypted name, sidestepping the
  fingerprint mismatch a live-keyed comparison would hit. A restored entry is never locked,
  regardless of the snapshot's own `locked` flag.
- `EntryMatchStatus::{Missing, ShorterInLive, Present}`
- `SnapshotEntryDiff { id, date, title, preview, status }`
- `RestoreEntriesOutcome { added_count }`

### Types
- `BackupContext { db_path, backups_dir, app_version: Option<&str> }` — `db_path` is required
  because the SQLite change counter lives in the live file's header and cannot be read
  through an open connection.
- `SnapshotOutcome::{Created(Box<SnapshotMeta>), Skipped(SkipReason)}`, `SkipReason::{Unchanged, TooSoon}`
- `SnapshotTrigger::{Unlock, Lock, Migration, Destructive(Cow<'static, str>), Manual, PreRestore, Adopted}`
  — `SnapshotTrigger::destructive(&'static str)` constructs the `Destructive` variant without
  allocating. `Adopted` marks a pre-upgrade file whose original trigger is unknowable.
- `SnapshotMeta` — the manifest record (see below).
- `RetentionPolicy` (+ `for_journal_size`), `RetentionDecision { keep, evict, budget_exceeded }`,
  `SnapshotDecision::{Take, Skip}`
- `BackupHealth { snapshot_count, verified_count, total_bytes, budget_bytes, budget_exceeded,
  newest_created_at, oldest_created_at, last_failure, directory_accessible, recent,
  daily_days, weekly_weeks, monthly_months }` — the retention numbers travel with it so a UI
  can render the policy as translated text instead of pinning strings to constants.
- `BackupFailure { at, trigger }` — deliberately carries **no message**: it is persisted in
  the plaintext manifest, where an arbitrary I/O error string is the easiest way to leak a
  filesystem path by accident. The underlying error is in the log at `warn`.
- `Manifest { schema_version, snapshots, last_failure }`, `MANIFEST_FILE`,
  `MANIFEST_SCHEMA_VERSION` — `last_failure` is `#[serde(default)]`, so manifests written
  before it stay readable.
- `SnapshotStore` trait (`list`, `write`, `read`, `delete`, `stat`) + `FsSnapshotStore`,
  `StoredSnapshot` — the storage boundary, so retention is reusable against other backends.

### Naming
- `is_snapshot_file_name(&str) -> bool` and `SNAPSHOT_PREFIX` — the engine's file-naming rule,
  exported so a consumer can *recognise* a snapshot without duplicating the `"backup-"`
  literal. The app uses it to refuse registering a snapshot as a journal: a snapshot is an
  ordinary openable database, and opening one as a journal writes to it, destroying the
  restore point. Recognition only — snapshot names are still produced solely inside `store`.

### Pure policy (no I/O, no clock — `now` is always a parameter)
- `plan_retention(&[SnapshotMeta], &RetentionPolicy, now) -> RetentionDecision`
- `should_snapshot(&[SnapshotMeta], &SnapshotTrigger, current_change_counter, &RetentionPolicy, now) -> SnapshotDecision`
- `summarize_health(&[SnapshotMeta], &RetentionPolicy, last_failure, directory_accessible) -> BackupHealth`
- Constants: `RECENT_SNAPSHOTS`, `DAILY_DAYS`, `WEEKLY_WEEKS`, `MONTHLY_MONTHS`,
  `MIN_AUTOMATIC_INTERVAL_SECS`, `MIN_STORAGE_BUDGET_BYTES`

### `manifest.json` — the core↔consumer interchange point

A **plaintext** sidecar in the backups directory, and therefore a privacy boundary as much as
a data structure. `SnapshotMeta` fields:

| Field | Notes |
|---|---|
| `file_name` | Generated `backup-*.db` stamp. A file name, never a path. |
| `created_at` | RFC 3339 UTC. |
| `trigger` | `SnapshotTrigger`, `snake_case`; `Destructive` serializes as `{"destructive": "<op>"}`. |
| `byte_size` | |
| `sqlite_change_counter` | `Option<u32>`. **Must be persisted, never read back from a snapshot** — `VACUUM INTO` rebuilds the database, so the copy's counter is unrelated to the source's. |
| `db_schema_version`, `app_version`, `entry_count`, `entry_date_range` | All `Option`; read without a key. |
| `auth_slot_types` | **Types only** (`password`/`keypair`/`auto`). Slot *labels* are user-chosen and must never appear. |
| `verified` | "The live master key was confirmed to decrypt this snapshot", **not** "we know what is inside". |

It must never carry entry content, entry titles, tag names, journal names, auth-slot labels,
or any filesystem path. Enforced by `test_manifest_contains_no_user_content`. A missing or
corrupt manifest is rebuilt from a directory scan rather than erroring.

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
