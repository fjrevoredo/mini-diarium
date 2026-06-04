# TODO-0046: Sustainable Image Storage — Deduplicate and Reuse Images

## Metadata

- Plan Status: COMPLETED
<!-- All three pre-approval issues from advisor review (Blockers 1, 2, Issue 3) resolved. -->
- Created: 2026-06-01
- Last Updated: 2026-06-01
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Replace the current model — where every image is embedded as a base64 data URL directly inside
the encrypted `text_encrypted` entry BLOB — with a content-addressed `images` table keyed by an
HKDF-keyed fingerprint. One physical copy is stored per unique image; multiple entries reference
it via an `entry_images` junction table. The editor UI gains an image-picker so users can reuse
previously stored images without re-importing. All export paths (JSON, Markdown, Rhai plugins)
resolve image references to data URLs before exporting, preserving full compatibility. Legacy
entries that still embed data URLs continue to display and export correctly; their images are
extracted automatically the next time the entry is saved.

## Scope

- Schema v9 migration: new `images` and `entry_images` tables
- HKDF-SHA256 keyed fingerprint for deduplication (same pattern as tag names)
- AES-256-GCM encrypted image storage (images contain diary content and must be encrypted)
- Atomic `save_entry` backend extension: extract data URLs → upsert images → relink → rewrite text
- `get_entry_images` and `list_journal_images` Tauri commands
- Frontend load path: resolve `image-id://` refs to data URLs before setting TipTap content
- Async-load race guard (request token) to prevent fast-switching overwriting entry content
- Image picker overlay component with toolbar button
- Export pre-resolve pass: substitute `image-id://` refs with data URLs before JSON/Markdown/Rhai export
- Orphan cleanup: after entry deletion, remove images with no remaining `entry_images` references
- Fix: enable `PRAGMA foreign_keys = ON` on all DB connections (prerequisite; existing cascade
  declarations for `entry_tags` were silently inert without this pragma)
- Docs update: `website/docs-src/01-writing-entries.md`
- CHANGELOG entry and TODO-0046 checkbox marked done

## Non-Goals

- Per-image thumbnail column (can be added as follow-up if the picker feels slow in practice)
- Background migration of all legacy entries on journal open (lazy on re-save is sufficient)
- GIF animation or SVG support beyond current canvas `toDataURL` behavior (already limited)
- Import-path image extraction (imported entries with embedded data URLs are treated as legacy
  and are extracted on the user's first save of that entry)
- Custom `entry-image://` URI scheme / Tauri protocol handler (decided against in architectural
  review; prefetch IPC is simpler and carries the same per-save IPC cost as today)

## Assumptions

1. **Images are sensitive**: they must be encrypted with the master key (AES-256-GCM), unlike
   `custom_fonts` which are unencrypted.
2. **HKDF fingerprint for dedup**: `HKDF-SHA256(IKM=master_key, info=SHA256(plaintext_bytes))`
   → hex-encoded 32-byte output. Keyed by master key so offline attackers cannot test whether a
   given image is present. Same image + same key → same fingerprint (deterministic).
3. **Dedup is two-tiered**:
   - **Picker reuse** (primary): the image picker inserts the stored data URL **verbatim** —
     no canvas re-encode — so the fingerprint on the next save is identical to the stored one,
     and `upsert_image` returns the existing row. This is exact, guaranteed reuse.
   - **Re-import dedup** (opportunistic): canvas `toDataURL` re-encoding is not byte-for-byte
     reproducible, so the fingerprint may differ for re-imported copies of the same image file.
     The picker is the explicit path; file-import dedup is a best-effort safety net only.
4. **Lazy migration**: existing entries with embedded data URLs display and export correctly
   without any migration step. Their images are extracted the next time the entry is saved.
   This is stated explicitly in TODO-0046 and confirmed by the maintainer in issue #150.
5. **No new Cargo dependencies**: `sha2 0.11`, `hkdf 0.13`, and `base64 0.22` are already in
   `src-tauri/Cargo.toml`.
6. **PRAGMA foreign_keys is OFF by default**: confirmed via grep — no connection path sets this
   pragma. This means all `ON DELETE CASCADE` declarations (including the existing `entry_tags`
   ones added in v7) have been silently inert. This plan adds a `configure_connection` helper
   that enables it for all new operations; existing orphaned rows are left in place.
7. **Frontend always works with data URLs**: TipTap in-memory representation never changes.
   Conversion happens only at the DB boundary (save: data URLs → image-id refs; load: refs → data
   URLs).
8. **`save_entry` is the only write path for entry text**: `import_entries` creates entries via
   `insert_entry` directly and does not call `save_entry`. Imported entries with data URLs are
   treated as legacy.

## Open Questions

None — all questions resolved before drafting.

| Question | Answer |
|---|---|
| Load-path resolution: prefetch IPC vs. URI scheme? | Prefetch IPC — no CSP change needed, same IPC cost as today |
| Image picker: thumbnails vs. full images? | Full images only — simpler schema, optimize later if needed |
| Lazy vs. background migration? | Lazy (assumption #4) — not asked, confirmed by advisor |

## Milestones

---

### Milestone 1: Database Foundation

- Status: TO BE DONE
- Purpose: Lay the DB schema and query layer that all other milestones depend on.
- Exit Criteria:
  - `PRAGMA foreign_keys = ON` is set on every new connection (create + all open paths).
  - Schema v9 migration creates `images` and `entry_images` tables and advances `SCHEMA_VERSION`.
  - All image query functions exist in `db/queries/images.rs` and pass unit tests.
  - `migrations::apply_pending` calls the new v8→v9 migration.
  - `SCHEMA_VERSION` constant is updated to `9`.

---

#### Task 1.1: Enable `PRAGMA foreign_keys = ON` on all DB connections

- Status: TO BE DONE
- Objective: Every `DatabaseConnection` has foreign-key enforcement active from the moment the
  connection is opened, so `ON DELETE CASCADE` works for `entry_tags`, `entry_images`, and
  future tables.
- Steps:
  1. Add a helper function in `src-tauri/src/db/schema/create.rs` (or a new `pragma.rs`):
     ```rust
     pub(super) fn configure_connection(conn: &Connection) -> Result<(), String> {
         conn.pragma_update(None, "foreign_keys", true)
             .map_err(|e| format!("Failed to enable foreign_keys: {}", e))
     }
     ```
  2. Call `configure_connection(&conn)?` immediately after every `Connection::open(...)` call in:
     - `create.rs`: `create_database`, `create_database_auto`
     - `open.rs`: `open_database` (both branches), `open_database_auto`, `open_database_with_keypair`
     - Any v1→v2, v2→v3 migration paths that open a new connection to a target file.
  3. Verify no existing test uses an in-memory `Connection` that bypasses `create_database` /
     `open_database`; if it does, update the setup to call `configure_connection` there too, or
     accept that in-memory test connections are not covered by the pragma (cascades are not
     relied upon in tests that bypass the helpers).
- Validation:
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test db"
  ```
  All existing DB tests must still pass. No new failures.
- Notes: This is a prerequisite for Tasks 1.2 and 3.2. Orphaned `entry_tags` rows from prior
  sessions are left in place (the pragma only affects future operations). The pragma must be
  re-applied on every new connection open (SQLite pragmas are per-connection, not per-file).

---

#### Task 1.2: Schema v9 migration — `images` and `entry_images` tables

- Status: TO BE DONE
- Objective: Schema v9 DDL exists in `create.rs` and `migrations/v8_to_v9.rs`; `SCHEMA_VERSION`
  is updated to 9; `apply_pending` includes the new migration.
- Steps:
  1. Update `SCHEMA_VERSION` from `8` to `9` in `src-tauri/src/db/schema/mod.rs`.
  2. Add the new table definitions to the `create_schema` function in `create.rs`, inside the
     existing `execute_batch` call:
     ```sql
     -- Images: content-addressed encrypted store; one copy per unique image
     CREATE TABLE IF NOT EXISTS images (
         id          INTEGER PRIMARY KEY AUTOINCREMENT,
         fingerprint TEXT    NOT NULL UNIQUE,
         mime_type   TEXT    NOT NULL,
         data        BLOB    NOT NULL,
         created_at  TEXT    NOT NULL
     );

     -- Entry-image associations (reference counting)
     CREATE TABLE IF NOT EXISTS entry_images (
         entry_id  INTEGER NOT NULL,
         image_id  INTEGER NOT NULL,
         PRIMARY KEY (entry_id, image_id),
         FOREIGN KEY (entry_id) REFERENCES entries(id)  ON DELETE CASCADE,
         FOREIGN KEY (image_id) REFERENCES images(id)   ON DELETE RESTRICT
     );
     CREATE INDEX IF NOT EXISTS idx_entry_images_image_id ON entry_images(image_id);
     ```
  3. Create `src-tauri/src/db/schema/migrations/v8_to_v9.rs` following the exact pattern of
     `v7_to_v8.rs`:
     - Function signature: `pub(super) fn migrate_v8_to_v9(db: &DatabaseConnection) -> Result<(), String>`
     - Guard: `if version < 9 { ... }`
     - `execute_batch` with `BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS images ...; CREATE TABLE IF NOT EXISTS entry_images ...; CREATE INDEX ...; UPDATE schema_version SET version = 9; COMMIT;`
     - `info!("Migrated database from v8 to v9 (added images and entry_images tables)");`
     - Unit tests: `test_migrate_v8_to_v9_creates_tables` and `test_migrate_v8_to_v9_is_idempotent`
  4. Add `mod v8_to_v9;` and `pub(crate) use v8_to_v9::migrate_v8_to_v9;` to
     `migrations/mod.rs`.
  5. Add `v8_to_v9::migrate_v8_to_v9(db)?;` to `apply_pending` in `migrations/mod.rs`.
  6. Update the integration test `test_apply_pending_advances_v3_to_v8` in `migrations/mod.rs`
     to be `test_apply_pending_advances_v3_to_v9` and assert:
     - version `9` (not `8`)
     - `table_count == 6` with `IN ('db_settings','tags','entry_tags','custom_fonts','images','entry_images')`
       (currently asserts `4`, must expand to include the two new tables)
  7. Update `test_schema_version` in `schema/mod.rs` to assert `SCHEMA_VERSION == 9`.
  8. Update the `test_open_v3_is_idempotent` test comment from `v8→v8` to `v9→v9`.
- Validation:
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test schema"
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test migrations"
  ```
  All schema and migration tests must pass.
- Notes: The `images.data` BLOB stores AES-256-GCM encrypted image bytes (same format as
  `text_encrypted` in `entries`). `images.fingerprint` is the HKDF-keyed fingerprint — plaintext
  hex string (the fingerprint does not reveal image content). `FOREIGN KEY (image_id) ... ON DELETE RESTRICT`
  prevents deleting a referenced image; orphan cleanup (Task 3.2) deletes unreferenced images
  explicitly. Do not use `ON DELETE CASCADE` on the `image_id` side — that would cascade image
  deletion to association rows, not what we want.

---

#### Task 1.3: Image query functions in `db/queries/images.rs`

- Status: TO BE DONE
- Objective: A new `images.rs` query module with all image CRUD and utility functions, exported
  via `db/queries/mod.rs`.
- Steps:
  1. Create `src-tauri/src/db/queries/images.rs` with the following public functions:

     **`image_fingerprint(key: &cipher::Key, plaintext_bytes: &[u8]) -> String`**
     - Compute `SHA-256(plaintext_bytes)` → 32-byte digest
     - `HKDF-SHA256(IKM=key, info=sha256_digest)` → 32-byte OKM
     - Return `hex::encode(okm)`
     - Use `sha2::Sha256`, `hkdf::Hkdf`, same pattern as `cipher::tag_name_fingerprint`

     **`upsert_image(db: &DatabaseConnection, mime_type: &str, plaintext_bytes: &[u8]) -> Result<i64, String>`**
     - Compute fingerprint
     - Encrypt bytes: `encrypt_for_storage(db.key(), plaintext_bytes, "image")?`
     - `INSERT OR IGNORE INTO images (fingerprint, mime_type, data, created_at) VALUES (?1, ?2, ?3, ?4)`
     - `SELECT id FROM images WHERE fingerprint = ?1` → return image ID
     - Both INSERT and SELECT in the same call handles the "already exists" case

     **`replace_entry_image_links(db: &DatabaseConnection, entry_id: i64, image_ids: &[i64]) -> Result<(), String>`**
     - `DELETE FROM entry_images WHERE entry_id = ?1`
     - `INSERT INTO entry_images (entry_id, image_id) VALUES (?1, ?2)` for each id
     - Used during save to atomically replace the association set for an entry

     **`get_images_for_entry(db: &DatabaseConnection, entry_id: i64) -> Result<Vec<ImageData>, String>`**
     - `SELECT i.id, i.mime_type, i.data FROM images i JOIN entry_images ei ON i.id = ei.image_id WHERE ei.entry_id = ?1`
     - Decrypt each `data` blob: `decrypt_utf8_bytes(db.key(), &encrypted, "image")?` (or a new helper returning `Vec<u8>`)
     - Base64-encode plaintext: `base64::engine::general_purpose::STANDARD.encode(&plaintext)`
     - Return `Vec<ImageData { id, mime_type, data_base64 }>`

     **`list_all_images(db: &DatabaseConnection) -> Result<Vec<ImageData>, String>`**
     - `SELECT id, mime_type, data FROM images ORDER BY created_at DESC`
     - Decrypt and base64-encode same as above

     **`cleanup_orphaned_images(db: &DatabaseConnection) -> Result<(), String>`**
     - `DELETE FROM images WHERE id NOT IN (SELECT DISTINCT image_id FROM entry_images)`

  2. Define the shared struct in the same file (or in `mod.rs`):
     ```rust
     #[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
     pub struct ImageData {
         pub id: i64,
         pub mime_type: String,
         pub data_base64: String,
     }
     ```
  3. Add `pub mod images;` to `src-tauri/src/db/queries/mod.rs`.
  4. Re-export `ImageData` and the functions via `pub use images::{...}` or access via
     `crate::db::queries::images::*` — whichever pattern the module uses.
  5. For the `decrypt_utf8_bytes` helper: `cipher::decrypt` returns `Vec<u8>`;
     the existing `decrypt_utf8` calls `String::from_utf8` on it. Add a parallel helper
     `pub fn decrypt_bytes(key: &Key, ciphertext: &[u8], ctx: &str) -> Result<Vec<u8>, String>`
     in `db/queries/mod.rs` that decrypts without UTF-8 coercion (images are binary).
- Validation:
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test images"
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test db::queries"
  ```
  All query unit tests must pass.
- Notes: `encrypt_for_storage` and `decrypt_utf8` are in `db/queries/mod.rs`. The new
  `decrypt_bytes` helper follows the same pattern without the `from_utf8` call at the end.
  `image_fingerprint` is a pure function (no DB) — it should also be added to `cipher.rs`
  (as `cipher::image_fingerprint`) so it is co-located with `tag_name_fingerprint` and
  follows the same review surface.

---

#### Task 1.4: Migration and query unit tests

- Status: TO BE DONE
- Objective: Test file for `v8_to_v9` migration (already partly covered in Task 1.2 steps),
  plus comprehensive unit tests for each query function in `images.rs`.
- Steps:
  1. The `v8_to_v9.rs` migration module includes its own `#[cfg(test)]` block following the
     pattern of `v7_to_v8.rs`:
     - `test_migrate_v8_to_v9_creates_tables` — asserts both `images` and `entry_images` exist
     - `test_migrate_v8_to_v9_is_idempotent` — call migration twice, version remains 9
  2. In `images.rs`, add `#[cfg(test)]` tests:
     - `test_upsert_image_returns_same_id_for_same_bytes` — upsert the same bytes twice → same `id`
     - `test_upsert_image_different_bytes_different_ids` — two different images → two different IDs
     - `test_replace_entry_image_links_replaces_set` — link [A,B], then link [B,C], assert final set is {B,C}
     - `test_get_images_for_entry_returns_decrypted_data` — store image, link, retrieve, compare plaintext
     - `test_list_all_images_returns_all` — store two images, list returns both
     - `test_cleanup_orphaned_images_removes_unreferenced` — store image, do NOT link to entry, run cleanup, assert gone
     - `test_cleanup_orphaned_images_keeps_referenced` — store image, link to entry, run cleanup, assert present
  3. Each test sets up an in-memory DB with a v9 schema via a helper (adapt from v7_to_v8's
     `setup_v7_db` helper to `setup_v9_db`).
- Validation:
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test images"
  ```
  All tests in `images.rs` and `v8_to_v9.rs` pass; zero test failures.
- Notes: `setup_v9_db` helper must call `configure_connection` (Task 1.1) to ensure foreign-key
  enforcement is active in the test.

---

### Milestone 2: Backend Commands & Registration

- Status: TO BE DONE
- Purpose: Expose image data to the frontend via typed Tauri commands and typed TS wrappers.
- Exit Criteria:
  - `get_entry_images` and `list_journal_images` commands compile, are registered in `lib.rs`,
    and have typed wrappers in `tauri.ts`.
  - `cmd.exe /c bun run type-check` passes.

---

#### Task 2.1: `get_entry_images` and `list_journal_images` Tauri commands

- Status: TO BE DONE
- Objective: Two new Tauri commands in `src-tauri/src/commands/files.rs` (or a new
  `commands/images.rs` module) that fetch image data for the frontend.
- Steps:
  1. Create (or extend) `src-tauri/src/commands/images.rs`:
     ```rust
     use crate::commands::auth::{with_unlocked_db, DiaryState};
     use crate::db::queries::images::ImageData;
     use tauri::State;

     #[tauri::command]
     pub fn get_entry_images(entry_id: i64, state: State<DiaryState>) -> Result<Vec<ImageData>, String> {
         with_unlocked_db(&state, |db| {
             crate::db::queries::images::get_images_for_entry(db, entry_id)
         })
     }

     #[tauri::command]
     pub fn list_journal_images(state: State<DiaryState>) -> Result<Vec<ImageData>, String> {
         with_unlocked_db(&state, |db| {
             crate::db::queries::images::list_all_images(db)
         })
     }
     ```
  2. Add `pub mod images;` (or `pub use images::...;`) to `src-tauri/src/commands/mod.rs`.
- Validation:
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo build"
  ```
  Compiles with zero errors and zero new warnings.
- Notes: Both commands follow the canonical `with_unlocked_db` pattern. No new error strings
  needed — `with_unlocked_db` returns `"Journal must be unlocked"` which `mapTauriError`
  already handles.

---

#### Task 2.2: Command registration and `tauri.ts` typed wrappers

- Status: TO BE DONE
- Objective: Commands are registered in `lib.rs`'s `generate_handler![]` and have typed async
  wrappers in `src/lib/tauri.ts`.
- Steps:
  1. In `src-tauri/src/lib.rs`, add `commands::images::get_entry_images` and
     `commands::images::list_journal_images` to the `generate_handler![]` macro.
  2. In `src/lib/tauri.ts`, add:
     ```typescript
     export interface ImageData {
       id: number;
       mime_type: string;
       data_base64: string;
     }

     export async function getEntryImages(entryId: number): Promise<ImageData[]> {
       return invoke<ImageData[]>('get_entry_images', { entryId });
     }

     export async function listJournalImages(): Promise<ImageData[]> {
       return invoke<ImageData[]>('list_journal_images');
     }
     ```
  3. Also update `CLAUDE.md` command registry table with the two new commands:
     - `images | get_entry_images | getEntryImages(entryId)` — fetch decrypted images for one entry
     - `images | list_journal_images | listJournalImages()` — list all images in the journal
- Validation:
  ```
  cmd.exe /c bun run type-check
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo build"
  ```
  Zero type errors, zero compiler errors.
- Notes: This codebase serializes Rust `snake_case` field names as-is to TypeScript — there is
  NO automatic camelCase conversion. Verified against `DiaryEntry`, `AuthMethodInfo`, `Tag`,
  `FontFaceData` and `CustomFontSummary` in `tauri.ts`, all of which use `snake_case` field
  names matching their Rust counterparts. Do NOT add `#[serde(rename_all = "camelCase")]` to
  `ImageData` — it would break consistency with every other struct in the codebase.

---

### Milestone 3: Atomic Save Path and Orphan Cleanup

- Status: TO BE DONE
- Purpose: Extend `save_entry` to be the single atomic write point for both entry text and
  associated images, preventing partial-save inconsistencies.
- Exit Criteria:
  - Saving an entry with data-URL images stores them in `images`, links them in `entry_images`,
    and writes the rewritten text — all in one DB transaction.
  - After entry deletion, orphaned images are removed.
  - All backend tests pass.

---

#### Task 3.1: Extend `save_entry` backend to atomically handle images

- Status: TO BE DONE
- Objective: `save_entry` in `commands/entries.rs` detects data-URL `<img>` tags in the HTML,
  extracts them, stores them via `upsert_image`, rewrites the HTML with `image-id://ID` refs,
  links them via `replace_entry_image_links`, and then saves the entry — all inside a single
  `BEGIN IMMEDIATE … COMMIT` transaction.
- Steps:
  1. In `src-tauri/src/db/queries/entries.rs` (or `export/markdown.rs`), add a helper function:
     ```rust
     pub fn extract_and_replace_image_refs(
         html: &str,
         db: &DatabaseConnection,
         entry_id: i64,
     ) -> Result<(String, Vec<i64>), String>
     ```
     - Scan `html` for `<img src="data:IMAGE_MIME;base64,DATA">` patterns using a regex or the
       existing `extract_and_replace_with_assets` logic from `export/markdown.rs` as a model.
     - For each match: base64-decode `DATA`, call `images::upsert_image(db, mime, &bytes)` to get
       the image ID.
     - Replace the `data:...` src with `image-id://ID` in the HTML.
     - Also scan for existing `image-id://N` refs already in the HTML (from previously saved
       images that survived the load → edit → save round-trip). Collect those IDs too.
     - Return `(rewritten_html, all_image_ids)`.
  2. In `db/queries/entries.rs`, wrap the image extraction and entry text save in a single
     transaction using an explicit rollback-on-error closure pattern. **Do not use manual
     `BEGIN/COMMIT` with `?` propagation** — if any step returns `Err`, the function returns
     without a `ROLLBACK`, leaving the long-lived `DiaryState` connection in an open transaction.
     The next save's `BEGIN IMMEDIATE` will then fail with "cannot start a transaction within a
     transaction," wedging all saves until the journal is locked and unlocked. `rusqlite`'s
     `Transaction::transaction()` needs `&mut Connection`, but `DatabaseConnection::conn()`
     returns `&Connection` — so `transaction()` is not directly available.

     Use this safe pattern instead:
     ```rust
     pub fn update_entry_with_images(
         db: &DatabaseConnection,
         id: i64,
         title: &str,
         text: &str,
     ) -> Result<(), String> {
         // Explicit rollback-on-error wrapper: execute all steps; ROLLBACK on any failure.
         let result: Result<(), String> = (|| {
             db.conn().execute("BEGIN IMMEDIATE", []).map_err(|e| format!("BEGIN failed: {}", e))?;
             let (rewritten, image_ids) = extract_and_replace_image_refs(text, db, id)?;
             images::replace_entry_image_links(db, id, &image_ids)?;
             images::cleanup_orphaned_images(db)?;
             let title_enc = encrypt_for_storage(db.key(), title.as_bytes(), "title")?;
             let text_enc = encrypt_for_storage(db.key(), rewritten.as_bytes(), "text")?;
             let wc = count_words(&rewritten);
             db.conn().execute(
                 "UPDATE entries SET title_encrypted=?1, text_encrypted=?2, word_count=?3, date_updated=?4 WHERE id=?5",
                 params![&title_enc, &text_enc, wc, chrono::Utc::now().to_rfc3339(), id],
             ).map_err(|e| format!("UPDATE failed: {}", e))?;
             db.conn().execute("COMMIT", []).map_err(|e| format!("COMMIT failed: {}", e))?;
             Ok(())
         })();
         if result.is_err() {
             let _ = db.conn().execute("ROLLBACK", []);
         }
         result
     }
     ```
     The `ROLLBACK` in the error path is best-effort (`let _ = ...`); SQLite auto-rolls-back
     when the connection closes, but the explicit call ensures the connection is clean for the
     next operation without requiring a lock/unlock cycle.
  3. Update `save_entry_inner` in `commands/entries.rs` to call `update_entry_with_images`
     instead of `queries::update_entry(db, &entry)`. The public `save_entry` command and its
     signature do not change — it remains a thin wrapper over `save_entry_inner`. The change is
     in the inner function body at `commands/entries.rs:48`: replace `queries::update_entry(db, &entry)?`
     with `queries::update_entry_with_images(db, id, title, text)?` (adjust argument names to
     match what is available in `save_entry_inner`'s scope: `id`, `title`, `text`).
  4. `insert_entry` (used for new entries at creation time) does not handle images — new entries
     start empty. Image extraction happens on the first `save_entry` call for that entry.
- Validation:
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test entries"
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"
  ```
  All entry tests pass. Add a new test `test_save_entry_extracts_images_atomically` that:
  1. Creates an entry with `text = "<p>Hi</p><img src=\"data:image/png;base64,iVBOR...\">"`
  2. Calls `update_entry_with_images`
  3. Reads the entry back → asserts text contains `image-id://` and NOT `data:`
  4. Queries `images` table → asserts 1 row
  5. Queries `entry_images` → asserts 1 row linked to the entry
- Notes: The regex/parser for data URL extraction already exists in
  `export/markdown.rs:extract_and_replace_with_assets`. Extract it into a shared utility in
  `export/image_extract.rs` (or a submodule) so both `save_entry` and the export layer can use
  it without code duplication. Be precise about the `image-id://` scan: the pattern is
  `src="image-id://(\d+)"` — collect those IDs from the original (pre-replacement) HTML before
  doing data-URL substitution, so existing refs survive re-save.

---

#### Task 3.2: Orphan cleanup on entry deletion

- Status: TO BE DONE
- Objective: After `delete_entry` or `delete_entry_if_empty` removes an entry, any images that
  are no longer referenced by any entry are also removed.
- Steps:
  1. In `db/queries/entries.rs`, update `delete_entry_by_id` using the same rollback-on-error
     pattern as Task 3.1 (manual `BEGIN`/`COMMIT` with explicit `ROLLBACK` on `Err`):
     ```rust
     pub fn delete_entry_by_id(db: &DatabaseConnection, id: i64) -> Result<bool, String> {
         let result: Result<bool, String> = (|| {
             db.conn().execute("BEGIN IMMEDIATE", []).map_err(|e| format!("BEGIN failed: {}", e))?;
             let rows = db.conn()
                 .execute("DELETE FROM entries WHERE id = ?1", params![id])
                 .map_err(|e| format!("DELETE failed: {}", e))?;
             // ON DELETE CASCADE on entry_images.entry_id removes association rows
             // (requires PRAGMA foreign_keys = ON from Task 1.1).
             images::cleanup_orphaned_images(db)?;
             db.conn().execute("COMMIT", []).map_err(|e| format!("COMMIT failed: {}", e))?;
             Ok(rows > 0)
         })();
         if result.is_err() {
             let _ = db.conn().execute("ROLLBACK", []);
         }
         result
     }
     ```
     Note: the `ON DELETE CASCADE` on `entry_images.entry_id` removes the association rows;
     `cleanup_orphaned_images` then removes any images that have no remaining associations.
  2. Verify `delete_entry_if_empty` also ultimately calls `delete_entry_by_id` (or update it
     to trigger orphan cleanup if it has its own delete path).
- Validation:
  - Add test `test_delete_entry_cleans_up_images`:
    1. Create entry, save with one image → `images` has 1 row
    2. Delete the entry
    3. Assert `images` table is empty
  - Add test `test_delete_entry_keeps_shared_images`:
    1. Create two entries, both referencing the same image (same fingerprint)
    2. Delete one entry
    3. Assert `images` table still has 1 row (the other entry references it)
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test entries"
  ```
- Notes: The cascade fires only if `PRAGMA foreign_keys = ON` is set (Task 1.1). The orphan
  cleanup query is a simple `DELETE FROM images WHERE id NOT IN (SELECT DISTINCT image_id FROM entry_images)`
  and is fast even with large image sets.

---

#### Task 3.3: Backend save-path tests

- Status: TO BE DONE
- Objective: Full coverage of the save path edge cases.
- Steps:
  1. `test_save_entry_no_images_unchanged` — save entry with no images → text unchanged,
     `images` and `entry_images` tables empty.
  2. `test_save_entry_with_two_images` — save entry with two images → 2 rows in `images`,
     2 rows in `entry_images`.
  3. `test_save_entry_idempotent_same_image` — save same image twice (same bytes, same entry) →
     still only 1 row in `images` (dedup by fingerprint).
  4. `test_save_entry_remove_image` — save with 1 image, then re-save without it → `images` row
     is deleted (orphan cleanup).
  5. `test_save_entry_legacy_data_url_with_mixed` — entry text has both `image-id://42` and
     a new `data:image/...` → after save, text has 2 `image-id://` refs, `images` has 2 rows.
  6. `test_picker_reuse_shares_one_image_row` (critical dedup regression test):
     1. Save entry A with one image (data URL → `upsert_image` → entry A gets `image-id://1`).
     2. Retrieve the stored data URL by calling `get_images_for_entry(entry_A_id)` → `img.data_base64`.
     3. Reconstruct the data URL: `data:{img.mime_type};base64,{img.data_base64}`.
     4. Save entry B with the same data URL verbatim (simulating picker insert without re-encode).
     5. Assert `images` table has exactly **1 row**.
     6. Assert `entry_images` has **2 rows**, both referencing `image_id = 1`.
     This test directly verifies that picker-path reuse (no canvas re-encode) achieves
     single-copy storage.
- Validation:
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"
  ```
  All backend tests pass.
- Notes: Tests 4 and 5 are the critical regression cases.

---

### Milestone 4: Frontend Load Path

- Status: TO BE DONE
- Purpose: After fetching an entry, resolve `image-id://` references to data URLs before
  setting TipTap content. Legacy entries with data URLs work unchanged.
- Exit Criteria:
  - Entries with `image-id://` refs display images correctly in the editor.
  - Legacy entries with embedded data URLs display correctly.
  - Fast entry-switching does not inject stale images into a different entry.

---

#### Task 4.1: Resolve `image-id://` refs on entry load

- Status: TO BE DONE
- Objective: `useEntryLifecycle.ts` (or `EditorPanel.tsx`) calls `getEntryImages(entryId)` after
  loading an entry and replaces `image-id://ID` srcs with `data:MIME;base64,DATA` before setting
  TipTap content.
- Steps:
  1. In `src/lib/tauri.ts`, the `getEntryImages` wrapper is already added in Task 2.2.
  2. Add a pure helper in `src/lib/image-refs.ts`:
     ```typescript
     export function resolveImageRefs(html: string, images: ImageData[]): string {
       // Regex-based replacement with word-boundary on the ID to prevent
       // 'image-id://5' from partially matching 'image-id://50'.
       // srcs are always in double-quotes: replace `image-id://ID"` (quoted).
       let resolved = html;
       for (const img of images) {
         // Match only exact IDs followed by the closing quote character.
         const pattern = new RegExp(`image-id://${img.id}(?=")`, 'g');
         const dataUrl = `data:${img.mime_type};base64,${img.data_base64}`;
         resolved = resolved.replace(pattern, dataUrl);
       }
       return resolved;
     }

     export function hasImageRefs(html: string): boolean {
       return /image-id:\/\/\d+/.test(html);
     }
     ```
  3. `opts.setContent(entry.text)` is called in **two** places that must both be updated:

     **A. `useEntryLifecycle.ts` — `loadEntriesForDate` (line ~161)**:
     Inside the existing `requestId !== loadRequestId` guard, wrap the setContent call:
     ```typescript
     const entry = entries[startIndex];
     opts.setPendingEntryId(entry.id);
     opts.setTitle(entry.title);
     let html = entry.text;
     if (hasImageRefs(html)) {
       const images = await getEntryImages(entry.id);
       if (isDisposed || requestId !== loadRequestId) return; // guard after await
       html = resolveImageRefs(html, images);
     }
     opts.setContent(html);
     opts.setWordCount(countWordsInHtml(html));
     ```
     The existing `loadRequestId` / `isDisposed` guards already handle the async race for
     this path — the `if (token !== currentLoadToken) return` pattern described in Task 4.2
     is the same mechanism; use the existing `requestId` variable rather than introducing a
     second counter.

     **B. `useMultiEntryNav.ts` — `navigateToEntry` (line ~86)**:
     Same change: replace `opts.setContent(entry.text)` with the image-resolution pattern.
     `navigateToEntry` is already async; add a local `navToken` counter (or reuse the
     outer `loadRequestId` from `lifecycle` if exposed) to guard the `await getEntryImages` call.
  4. The `if (hasImageRefs(html))` guard avoids the IPC round-trip for legacy entries that
     still have data URLs (no refs to resolve).
- Validation:
  - Manual: open a saved entry that contains images → images display correctly.
  - `cmd.exe /c bun run type-check` — zero errors.
- Notes: For legacy entries with data URLs, `hasImageRefs` returns false → no IPC call, content
  set directly. First save of such an entry triggers image extraction (Milestone 3).
  The `countWordsInHtml(html)` call should use the resolved HTML (with data URLs), not
  `entry.text` (with ID refs), so the word count is accurate.

---

#### Task 4.2: Async-load race guard (request token)

- Status: TO BE DONE
- Objective: Fast entry-switching cannot inject entry A's resolved images into entry B's editor
  session.
- Steps:
  1. **`loadEntriesForDate` (already has a guard)**: `useEntryLifecycle.ts` already has
     `let loadRequestId = 0` and checks `if (isDisposed || requestId !== loadRequestId) return`
     after each `await`. Task 4.1 already inserts the `await getEntryImages` call inside this
     existing guard. No new counter needed for this path.
  2. **`navigateToEntry` (needs a guard)**: `useMultiEntryNav.ts:navigateToEntry` does not
     currently have an async-load race guard. Add one:
     ```typescript
     let navToken = 0;

     const navigateToEntry = async (newIndex: number) => {
       const token = ++navToken;
       // ... existing save-current logic ...
       const refreshed = await fetchEntriesOrdered(opts.selectedDate());
       if (opts.lifecycle.isDisposed() || token !== navToken) return;
       // ...
       let html = entry.text;
       if (hasImageRefs(html)) {
         const images = await getEntryImages(entry.id);
         if (opts.lifecycle.isDisposed() || token !== navToken) return;
         html = resolveImageRefs(html, images);
       }
       opts.setContent(html);
     };
     ```
     The `navToken` is declared in the `useMultiEntryNav` function scope (alongside the
     existing `navigateToEntry` closure) so it persists across calls.
- Validation:
  - Unit test in `useMultiEntryNav.test.ts`: simulate two rapid `navigateToEntry` calls;
    only the second entry's content ends up in the editor.
  - `cmd.exe /c bun run test:run` — all tests pass.
- Notes: The increment must happen before the first `await`, not after. The `loadRequestId`
  guard in `loadEntriesForDate` is already correct; only `navigateToEntry` needs a new counter.

---

#### Task 4.3: Backward-compat test (legacy data-URL entries)

- Status: TO BE DONE
- Objective: A unit test confirms that entries with embedded data URLs load without calling
  `getEntryImages` and without modification to the HTML.
- Steps:
  1. In the frontend test suite (Vitest), add a test in `useEntryLifecycle.test.ts`:
     - Mock `getEntryImages` to track calls.
     - Load an entry whose `text` contains a `data:image/jpeg;base64,...` URL but no
       `image-id://` refs.
     - Assert `getEntryImages` was NOT called.
     - Assert the editor content matches the original HTML verbatim.
- Validation:
  ```
  cmd.exe /c bun run test:run
  ```
  Test passes; zero regressions in other `useEntryLifecycle` tests.
- Notes: This prevents a future regression where the guard condition is accidentally removed.

---

### Milestone 5: Image Picker UI

- Status: TO BE DONE
- Purpose: Users can browse images already stored in the journal and insert one into the editor
  without re-importing, satisfying the core user request from issue #150.
- Exit Criteria:
  - An "Insert existing image" toolbar button opens an `ImagePickerOverlay`.
  - The overlay shows a grid of stored images; clicking one inserts it at the cursor.
  - The toolbar button is hidden when the journal has no stored images.
  - i18n strings exist and all locale JSON files have corresponding entries.

---

#### Task 5.1: `ImagePickerOverlay` component

- Status: TO BE DONE
- Objective: A new `src/components/overlays/ImagePickerOverlay.tsx` component that shows all
  stored images in a scrollable grid and allows single-click insertion.
- Steps:
  1. Create `src/components/overlays/ImagePickerOverlay.tsx`:
     - Props: `onInsert: (dataUrl: string) => void; onClose: () => void`
     - On mount, call `listJournalImages()` and display a loading state.
     - Render a `<div class="image-picker-grid">` with one `<button>` per image.
     - Each button shows `<img src="data:MIME;base64,DATA" alt="..." />` at a fixed thumbnail
       size (e.g. 120×120, `object-fit: cover`).
     - Clicking a button calls `onInsert(dataUrl)` and `onClose()`.
     - Pressing Escape or clicking outside closes without inserting.
     - If no images are found, show a translated "No saved images yet" message.
     - Show a translated error if `listJournalImages` fails.
  2. Add CSS in `src/styles/editor.css` (or a new `image-picker.css`):
     ```css
     .image-picker-grid {
       display: grid;
       grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
       gap: 8px;
       max-height: 400px;
       overflow-y: auto;
       padding: 8px;
     }
     ```
  3. Add overlay open state `isImagePickerOpen` to `src/state/ui.ts`:
     - Add `const [isImagePickerOpen, setIsImagePickerOpen] = createSignal(false);`
     - Add `setIsImagePickerOpen(false)` to `resetUiState()`.
     - Export both `isImagePickerOpen` and `setIsImagePickerOpen`.
  4. Mount `<ImagePickerOverlay>` inside `MainLayout.tsx` (same pattern as other overlays).
- Validation:
  - Manual: save an entry with images, open the picker → grid shows the stored images.
  - `cmd.exe /c bun run type-check` — zero errors.
- Notes: The picker does not paginate or lazy-load. If a user has hundreds of images, loading
  all at once may be slow — this is accepted for MVP per the architectural decision (Assumption
  from Non-Goals). The `onInsert` callback receives the data URL; the **caller inserts it
  verbatim** via `editor.chain().focus().setImage({ src: dataUrl }).run()` — NOT via
  `resizeAndEmbedDataUrl`. See Task 5.2 for the critical reason (re-encoding would break dedup).

---

#### Task 5.2: Toolbar button integration

- Status: TO BE DONE
- Objective: A new toolbar action `insertExistingImage` opens `ImagePickerOverlay`; when the
  user selects an image, it is inserted at the cursor using the existing `resizeAndEmbedDataUrl`.
- Steps:
  1. Add `insertExistingImage` to the `ToolbarItem` union type in `src/state/preferences.ts`
     and add it to the default toolbar configuration.
  2. In `EditorToolbar.tsx`, add the handler for `insertExistingImage`:
     - Shows `isImagePickerOpen(true)` (via the new ui.ts signal).
  3. In `EditorPanel.tsx` (or `DiaryEditor.tsx`), wire up the `onInsert` callback from the
     picker overlay. **Critical**: the picker must insert the stored data URL **verbatim** via
     `editor.chain().focus().setImage({ src: dataUrl }).run()` — it must NOT route through
     `resizeAndEmbedDataUrl`, which runs the image through `canvas.toDataURL()` and re-encodes
     the bytes. Re-encoding produces a different byte sequence → different HKDF fingerprint →
     `upsert_image` inserts a second physical copy, defeating deduplication.
     ```typescript
     const handlePickerInsert = (dataUrl: string) => {
       const editor = getEditor();
       // Insert verbatim — no canvas re-encode — so save preserves the original fingerprint.
       editor?.chain().focus().setImage({ src: dataUrl }).run();
     };
     ```
  4. The toolbar button uses the `Images` (or `Library`) icon from `lucide-solid`.
  5. The button label in the toolbar tooltip uses the i18n key
     `editor.toolbar.insertExistingImage`.
- Validation:
  - Manual: click "Insert existing image" in the toolbar → picker opens → select an image →
    image appears in editor at cursor.
  - Unit test `test_picker_reuse_shares_one_image_row`:
    1. Save entry A with one image via the normal file-import path.
    2. Simulate a picker insert into entry B by calling `handlePickerInsert(dataUrl)` where
       `dataUrl` is the exact stored value.
    3. Save entry B.
    4. Assert `images` table has exactly **1 row** (both entries share the same physical image).
    5. Assert `entry_images` has 2 rows — one for each entry pointing to the same `image_id`.
  - `cmd.exe /c bun run type-check` — zero errors.
- Notes: The picker's `onInsert` prop passes the data URL it received from `listJournalImages`.
  That data URL is the decrypted, base64-encoded original. Because no re-encoding happens,
  the bytes and therefore the fingerprint are identical, and `upsert_image` deduplicates correctly.
  Images from the picker were already resized to ≤1200px on first import, so no re-resize is needed.

---

#### Task 5.3: i18n strings and locale sync

- Status: TO BE DONE
- Objective: All new UI strings are added to `src/i18n/locales/en.ts` and every locale JSON
  file (`es.json`, `de.json`, `fr.json`, `hi.json`, `it.json`) has the same keys (translated
  or copy of English as a placeholder).
- Steps:
  1. Add to `src/i18n/locales/en.ts` under a logical namespace (e.g. `imagePicker`):
     ```typescript
     imagePicker: {
       title: 'Saved Images',
       noImages: 'No saved images yet. Insert an image to save it here.',
       insertButton: 'Insert',
       error: 'Failed to load images.',
     },
     editor: {
       // ... existing keys ...
       toolbar: {
         // ... existing keys ...
         insertExistingImage: 'Insert existing image',
       }
     }
     ```
  2. Add the same keys to `es.json`, `de.json`, `fr.json`, `hi.json`, `it.json` — English
     values are acceptable as placeholders for community translation.
  3. Run `cmd.exe /c bun run validate:locales` — no missing keys.
- Validation:
  ```
  cmd.exe /c bun run validate:locales
  cmd.exe /c bun run type-check
  ```
  Both pass with no errors.
- Notes: Follow the existing key-naming convention (`namespace.camelCase`, `.label` for form
  labels, `.hint` for helper text). The `insertButton` key may be `common.insert` if it
  already exists — check before adding a duplicate.

---

### Milestone 6: Export Layer

- Status: TO BE DONE
- Purpose: All export paths (JSON, Markdown, Rhai plugin exporters) receive entry text with
  data URLs restored, preserving full backward compatibility and the existing Rhai plugin
  contract.
- Exit Criteria:
  - `export_json`, `export_markdown`, and `run_export_plugin` resolve `image-id://` refs to
    data URLs before passing to pure export functions.
  - Existing export tests pass with no changes to their assertions.
  - A new export test covers the round-trip for an entry with image refs.

---

#### Task 6.1: Pre-resolve `image-id://` refs before all export paths

- Status: TO BE DONE
- Objective: A helper `resolve_image_refs_in_entries(db, entries) -> Result<Vec<DiaryEntry>, String>`
  substitutes `image-id://N` with `data:MIME;base64,DATA` in each entry's `text` field before
  the entry vector is handed to any export function.
- Steps:
  1. In `src-tauri/src/export/mod.rs` (or a new `export/image_resolve.rs`), add:
     ```rust
     pub fn resolve_image_refs_in_entries(
         db: &DatabaseConnection,
         entries: Vec<DiaryEntry>,
     ) -> Result<Vec<DiaryEntry>, String> {
         entries.into_iter().map(|mut entry| {
             if entry.text.contains("image-id://") {
                 let images = crate::db::queries::images::get_images_for_entry(db, entry.id)?;
                 // Use regex with a delimiter to prevent partial-ID collisions:
                 // 'image-id://5"' must not match inside 'image-id://50"'.
                 // srcs in TipTap HTML are double-quoted, so matching the closing '"'
                 // makes each substitution exact.
                 for img in &images {
                     let pattern = format!(r#"image-id://{}""#, img.id);
                     let replacement = format!(r#"data:{};base64,{}""#, img.mime_type, img.data_base64);
                     entry.text = entry.text.replace(&pattern, &replacement);
                 }
             }
             Ok(entry)
         }).collect()
     }
     ```
  2. In `commands/export.rs`, update `export_json` and `export_markdown` to call
     `resolve_image_refs_in_entries(db, entries)?` immediately after `fetch_entries(db, ...)`.
  3. In `commands/plugin.rs`, update `run_export_plugin` to call
     `resolve_image_refs_in_entries(db, entries)?` inside the DB lock, before releasing it and
     calling `plugin.export(entries, &tags)`.
  4. No changes to `json.rs`, `markdown.rs`, `builtins.rs`, `rhai_loader.rs`, or any plugin
     code. The Rhai plugin contract (`entry.text` contains HTML with data URLs) is preserved.
- Validation:
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test export"
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"
  ```
  All existing export tests pass. No changes to existing assertions required.
- Notes: The `contains("image-id://")` guard skips the IPC overhead for legacy entries.
  Entries with no image refs are returned unchanged.

---

#### Task 6.2: Export tests with image refs

- Status: TO BE DONE
- Objective: Unit tests confirm that exported JSON and Markdown correctly inline images that
  were stored as `image-id://` refs.
- Steps:
  1. In `export/json.rs` tests (or `commands/export.rs` tests), add:
     - `test_json_export_resolves_image_refs` — create DB with an entry whose text contains
       `image-id://1`, store a corresponding image in `images` + `entry_images`, call
       `export_entries_to_json` on the resolved entries → assert the output contains
       `data:image/` and does NOT contain `image-id://`.
  2. In `export/markdown.rs` tests, add a parallel test for Markdown export:
     - Same setup; assert Markdown output contains the image as an asset file reference
       (the asset extraction already handles `data:` URLs).
  3. Add a test for entries with NO image refs (guard check) — `resolve_image_refs_in_entries`
     on an entry without `image-id://` must return the entry unchanged.
- Validation:
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test export"
  ```
  All new tests pass.
- Notes: Use an in-memory DB with a v9 schema (adapted from Task 1.4's `setup_v9_db`).

---

### Milestone 7: Cleanup and Final Verification

- Status: TO BE DONE
- Purpose: Ensure only intentional artifacts ship and the complete change is verified end-to-end.
- Exit Criteria: All pre-flight checks pass; TODO-0046 is marked done; CHANGELOG updated; docs updated.

---

#### Task 7.1: Cleanup intermediate artifacts and update docs

- Status: TO BE DONE
- Objective: Remove any scratch files; update `website/docs-src/01-writing-entries.md` to
  document the image picker and the new storage model; update `CHANGELOG.md`.
- Steps:
  1. Inspect the worktree for any temporary scripts, debug logs, or scratch test fixtures;
     remove those not part of the intended final state.
  2. Edit `website/docs-src/01-writing-entries.md` to add a paragraph or section describing:
     - "Insert Existing Image" toolbar button to reuse previously stored images.
     - How images are now stored once and shared across entries.
     - Note that images inserted before this update remain intact.
  3. Run `cmd.exe /c bun run website:build-static` (via PowerShell tool, not Bash) to
     regenerate `website/docs/writing-entries/index.html`.
  4. Append to `CHANGELOG.md` (under the current unreleased section):
     ```
     ### Added
     - Image deduplication: images are now stored once in a content-addressed encrypted store
       and referenced by ID; inserting the same image into multiple entries shares one copy.
     - "Insert existing image" toolbar button: browse and reuse any image previously saved in
       the journal without re-importing.

     ### Changed
     - `save_entry` now extracts embedded images atomically, reducing stored entry size for
       entries with images.

     ### Internal
     - Schema v9: added `images` and `entry_images` tables.
     - Enabled `PRAGMA foreign_keys = ON` on all DB connections (fixes silently-inert
       `ON DELETE CASCADE` constraints on `entry_tags`, `entry_images`).
     ```
  5. Mark TODO-0046 as done in `docs/todo/TODO.md` by changing `- [ ]` to `- [x]` on the
     `TODO-0046` line.
  6. Update `CLAUDE.md` command registry table with the two new commands from Task 2.2.
  7. Update `src-tauri/CLAUDE.md` gotcha #1 to note schema v9 and the `images`/`entry_images`
     tables.
- Validation:
  - `docs/todo/TODO.md` shows `[x]` for TODO-0046.
  - `website/docs/writing-entries/index.html` is regenerated (mtime updated).
  - CHANGELOG contains the new entries.
- Notes: Do not edit HTML files under `website/docs/` directly — always edit `docs-src/` and
  regenerate.

---

#### Task 7.2: Final verification

- Status: TO BE DONE
- Objective: All pre-flight checks pass after cleanup; the feature is confirmed working.
- Steps:
  1. Run the full backend test suite.
  2. Run the full frontend test suite.
  3. Run type-check.
  4. Run the linter.
  5. Run a build.
  6. Run locale validation.
  7. (Optional if environment allows) Run the app via `tauri-agent-dev` skill and manually:
     - Insert an image via file picker → save → reload → image displays.
     - Open image picker → stored image appears → insert → image appears in editor.
     - Export as JSON → JSON contains `data:image/` (no `image-id://` refs).
     - Export as Markdown → `assets/` directory contains the image file.
     - Delete the entry → `images` table is empty (verified via debug dump).
- Validation:
  ```
  cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"
  cmd.exe /c bun run test:run
  cmd.exe /c bun run type-check
  cmd.exe /c bun run lint
  cmd.exe /c bun run build
  cmd.exe /c bun run validate:locales
  ```
  All pass with zero failures.
- Notes: The build step catches any missing command registrations or type mismatches that unit
  tests might miss.

---

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval.
Fix all failures before proceeding.

- [ ] `cargo test` passes with zero failures
- [ ] `bun run test:run` passes with zero failures
- [ ] `bun run type-check` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] `bun run validate:locales` passes
- [ ] `docs/todo/TODO.md` shows `[x]` for TODO-0046
- [ ] CHANGELOG.md updated with new entries under unreleased section
- [ ] `website/docs-src/01-writing-entries.md` updated and regenerated
- [ ] CLAUDE.md command registry table includes `get_entry_images` and `list_journal_images`
- [ ] `src-tauri/CLAUDE.md` gotcha #1 updated for schema v9
- [ ] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] All open questions were asked via the native question tool and are recorded in the plan.
- [x] Zero unanswered questions remain.
- [x] Tasks are grouped into milestones (19 tasks, well above the 10-task threshold).
- [x] Every task has concrete steps, file paths, and validation commands.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included in Milestone 7.
- [x] The plan avoids vague actions — every step names specific files and functions.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Milestone 1 is a hard prerequisite for all other milestones.
- Milestones 2, 3, 4, 5 can be worked in parallel once Milestone 1 is complete.
- Milestone 3 depends on Milestone 1 (needs the `images` query functions from `db/queries/images.rs`).
- Milestone 6 depends on Milestone 3 (needs `resolve_image_refs_in_entries`).
- Milestone 7 must be last.
