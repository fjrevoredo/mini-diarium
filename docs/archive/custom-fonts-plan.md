# Custom Fonts Support

## Metadata

- Plan Status: READY FOR APPROVAL
- Created: 2026-05-28
- Last Updated: 2026-05-28
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Allow users to upload their own `.ttf`, `.otf`, `.woff`, or `.woff2` font files (Regular and Bold weights separately) and use them as the editor font from both Preferences and the optional toolbar font-family selector. Custom fonts are stored as raw BLOBs in a new `custom_fonts` table inside `diary.db` (schema v8, unencrypted), so they travel with the journal to other devices automatically. The Preferences → Writing tab gains a management section for uploading and removing custom fonts. If a font is missing its Bold weight, the app must warn about that in Preferences and let the browser synthesize bold text at render time by omitting the custom 700-weight `@font-face`.

## Scope

- Schema migration v7 → v8 (`custom_fonts` table)
- Three new Tauri commands: `import_custom_font`, `list_custom_fonts`, `delete_custom_font_family`
- Modified `get_font_data`: checks DB before bundled fonts; adds `bold_synthesized: bool` to `FontFaceData`
- Frontend wrappers in `src/lib/tauri.ts` for all new/changed commands
- `DiaryEditor.tsx` runtime font-face injection updated so missing Bold uses browser synthesis instead of a fake 700-weight face
- Custom font management UI in `PreferencesWritingTab.tsx`: two file pickers (Regular + Bold), family name input, upload button, list of uploaded fonts with bold-missing warning and delete button
- Custom fonts merged into both existing font-family selectors: `PreferencesWritingTab.tsx` and `EditorToolbar.tsx`
- New i18n keys in `en.ts` and all five JSON locale files (`es`, `de`, `fr`, `it`, `hi`)
- Required docs updates: `website/docs-src/`, `CLAUDE.md` command registry, and backend schema notes

## Non-Goals

- Encrypting custom font bytes — fonts are not sensitive data; plaintext BLOB is correct
- System font enumeration — only user-provided files
- Sharing fonts across journals — fonts are per-journal (stored in each journal's `diary.db`)
- Uploading more than Regular and Bold weights
- Automatic Bold detection from font file metadata — the user may optionally upload a separate Bold file, and the family name is only auto-filled from the selected Regular filename as an editable convenience

## Assumptions

- `get_font_data` is only called when the journal is unlocked (the editor is inaccessible when locked). The DB lookup path should therefore use the normal unlocked-state guard instead of a best-effort `try_lock`, so selected custom fonts resolve deterministically while the journal is open.
- Maximum allowed font file size is 20 MB (generous upper bound; real-world fonts are 100 KB–2 MB).
- Only Regular and Bold weights are supported. The `weight` column has a `CHECK(weight IN ('Regular','Bold'))` constraint, and backend validation rejects a Bold upload until the family already has a Regular row.
- `INSERT OR REPLACE` semantics: uploading a new Regular for an existing family replaces the previous Regular row; Bold is independent.
- Deleting a custom font removes **all weights** for that family name at once.
- Because `PreferencesWritingTab.tsx` is otherwise a buffered Save/Cancel tab, add/remove custom-font actions are immediate side effects like the existing security/data actions. If the deleted family is currently selected, the saved `editorFontFamily` preference must be cleared immediately instead of waiting for the overlay Save button.
- When Bold is missing, the backend sets `bold_synthesized: true`, and the frontend must omit the custom 700-weight `@font-face` rule so the browser sees Bold as missing and synthesizes it.
- File path access: the file paths returned by `@tauri-apps/plugin-dialog` are directly readable by the Rust backend (including Flatpak XDG portal paths when the user selected the file through the dialog).
- Community locale JSON files (`es`, `de`, `fr`, `it`, `hi`) receive the new keys with English fallback strings. Translators update them separately; `bun run validate:locales` enforces completeness.

## Open Questions

None.

---

## Milestones

### Milestone 1: DB Schema v8

- Status: TO BE DONE
- Purpose: Create the `custom_fonts` table and advance the schema version so subsequent milestones can store and query font data.
- Exit Criteria: relevant Rust schema/migration tests pass; migration advances schema from v7 to v8 idempotently; `apply_pending` integration test verifies `custom_fonts` exists after running from v3; a fresh `create_database` call produces schema v8.

#### Task 1.1: Write migration file `v7_to_v8.rs`

- Status: TO BE DONE
- Objective: A new file `src-tauri/src/db/schema/migrations/v7_to_v8.rs` that creates the `custom_fonts` table when the stored schema version is below 8.
- Steps:
  1. Create `src-tauri/src/db/schema/migrations/v7_to_v8.rs`.
  2. Implement `pub(super) fn migrate_v7_to_v8(db: &DatabaseConnection) -> Result<(), String>` following the exact pattern of `v6_to_v7.rs`: read current version, skip if already ≥ 8, run `BEGIN IMMEDIATE` batch, `COMMIT`.
  3. DDL inside the batch:
     ```sql
     CREATE TABLE IF NOT EXISTS custom_fonts (
         id         INTEGER PRIMARY KEY AUTOINCREMENT,
         family     TEXT NOT NULL,
         weight     TEXT NOT NULL CHECK(weight IN ('Regular','Bold')),
         data       BLOB NOT NULL,
         created_at TEXT NOT NULL,
         UNIQUE(family, weight)
     );
     UPDATE schema_version SET version = 8;
     ```
  4. Add a `log::info!` line after a successful migration (match wording style of v6_to_v7).
  5. Write two `#[cfg(test)]` unit tests in the same file. The v7 starting schema must include all tables present at v7: `schema_version`, `metadata`, `entries`, `auth_slots`, `db_settings`, `tags`, `entry_tags`. Use this setup boilerplate (adapted from the v6→v7 test but extended with `tags` and `entry_tags`):
     ```rust
     let conn = Connection::open_in_memory().unwrap();
     conn.execute_batch(
         "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
          INSERT INTO schema_version (version) VALUES (7);
          CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE auth_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
              label TEXT NOT NULL, public_key BLOB, wrapped_key BLOB NOT NULL,
              created_at TEXT NOT NULL, last_used TEXT);
          CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
              title_encrypted BLOB, text_encrypted BLOB, word_count INTEGER DEFAULT 0,
              date_created TEXT NOT NULL, date_updated TEXT NOT NULL);
          CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT,
              name_encrypted BLOB NOT NULL, name_fingerprint TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL);
          CREATE TABLE entry_tags (entry_id INTEGER NOT NULL, tag_id INTEGER NOT NULL,
              PRIMARY KEY (entry_id, tag_id));",
     ).unwrap();
     let db = DatabaseConnection { conn, encryption_key: cipher::Key::from_slice(&[0u8; 32]).unwrap() };
     ```
     - `test_migrate_v7_to_v8_creates_table`: use the setup above, call the function, assert schema version is 8, assert `custom_fonts` exists in `sqlite_master`.
     - `test_migrate_v7_to_v8_is_idempotent`: call the function twice on the same DB, assert version stays 8 and no error on the second call.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test migrations"` passes with both new tests.
- Notes: Follows the exact structure of `src-tauri/src/db/schema/migrations/v6_to_v7.rs`. The `UNIQUE(family, weight)` constraint supports `INSERT OR REPLACE` semantics in `import_custom_font`.

#### Task 1.2: Register migration in `apply_pending`

- Status: TO BE DONE
- Objective: `migrations/mod.rs` declares the new module and calls `migrate_v7_to_v8` in `apply_pending`.
- Steps:
  1. Open `src-tauri/src/db/schema/migrations/mod.rs`.
  2. Add `mod v7_to_v8;` after `mod v6_to_v7;`.
  3. Add `v7_to_v8::migrate_v7_to_v8(db)?;` as the last line inside `apply_pending`, after the `v6_to_v7` call.
  4. Update the module-level doc comment so it no longer says migrations stop at `v6_to_v7`.
  5. Update the existing `test_apply_pending_advances_v3_to_v7` test:
     - Rename it to `test_apply_pending_advances_v3_to_v8`.
     - Change the final version assertion from `7` to `8`.
     - Add `custom_fonts` to the `sqlite_master` name list in the table count assertion (count becomes 4).
     - Update the `assert_eq!(table_count, 3, ...)` to `4` with an updated message listing all four tables.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test apply_pending"` passes.
- Notes: `apply_pending` is called from `open.rs` for every DB open; the migration is idempotent so repeated opens are safe.

#### Task 1.3: Update `SCHEMA_VERSION` and `create_schema`

- Status: TO BE DONE
- Objective: Newly created databases start at schema v8 and include the `custom_fonts` table without needing to migrate.
- Steps:
  1. In `src-tauri/src/db/schema/mod.rs`, change `pub const SCHEMA_VERSION: i32 = 7;` to `8`.
  2. In the `#[cfg(test)]` block of the **same file** (`mod.rs`), update every hardcoded version assertion from `7` to `8`. There are four places:
     - `test_schema_version`: `assert_eq!(SCHEMA_VERSION, 7)` → `8`
     - `test_open_v3_is_idempotent`: `assert_eq!(version1, 7)` → `8`; `assert_eq!(version2, 7)` → `8`; update the string comment `"No new backup should be created for v7→v7"` → `"v8→v8"`
     - `test_open_with_keypair`: `assert_eq!(version, 7)` → `8`
  3. In `src-tauri/src/db/schema/create.rs`, inside `create_schema`, add the following DDL block immediately before the closing `"#` of the `execute_batch` string (after the `entry_tags` index):
     ```sql
     -- Custom fonts (unencrypted BLOBs; font data is not sensitive)
     CREATE TABLE IF NOT EXISTS custom_fonts (
         id         INTEGER PRIMARY KEY AUTOINCREMENT,
         family     TEXT NOT NULL,
         weight     TEXT NOT NULL CHECK(weight IN ('Regular','Bold')),
         data       BLOB NOT NULL,
         created_at TEXT NOT NULL,
         UNIQUE(family, weight)
     );
     ```
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test schema"` passes; `test_schema_version` asserts 8; `test_open_v3_is_idempotent` and `test_open_with_keypair` pass.
- Notes: The `IF NOT EXISTS` guards make the DDL idempotent in both `create_schema` and the migration, which is required by the project pattern.

---

### Milestone 2: Rust Backend Commands

- Status: TO BE DONE
- Purpose: Implement the four backend operations (list, import, delete, and the modified get) that the frontend will call.
- Exit Criteria: fonts-related Rust tests pass; `import_custom_font` enforces the Regular-before-Bold invariant; `get_font_data` sets `bold_synthesized: true` when Bold is absent from the DB; all three new commands are registered in `generate_handler![]`.

#### Task 2.1: Add `CustomFontSummary` struct and `list_custom_fonts` command

- Status: TO BE DONE
- Objective: `list_custom_fonts` returns all custom font families stored in the DB, each with flags for which weights are present.
- Steps:
  1. Open `src-tauri/src/commands/fonts.rs`.
  2. Add these imports at the top of the file (they do not exist there currently):
     ```rust
     use crate::commands::auth::{with_unlocked_db, DiaryState};
     use tauri::State;
     ```
  3. Add the following struct before the existing `FontFaceData` struct:
     ```rust
     #[derive(serde::Serialize)]
     pub struct CustomFontSummary {
         family: String,
         has_regular: bool,
         has_bold: bool,
     }
     ```
  4. Add a `#[tauri::command] pub fn list_custom_fonts(state: State<DiaryState>) -> Result<Vec<CustomFontSummary>, String>` function that:
     - runs under `with_unlocked_db`
     - selects `family, weight` from `custom_fonts`
     - aggregates rows by family into a `BTreeMap<String, CustomFontSummary>` so ordering is deterministic
     - propagates row/query errors instead of silently dropping them
  5. Add a focused unit test such as `test_list_custom_fonts_aggregates_weights` that inserts two families and verifies `has_regular` / `has_bold` flags.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test fonts"` passes.
- Notes: `BTreeMap` keeps alphabetical output without a second sort. Do not use `filter_map(|r| r.ok())` or other silent row-dropping patterns; backend row-decoding failures should surface as errors.

#### Task 2.2: Add `import_custom_font` command

- Status: TO BE DONE
- Objective: `import_custom_font` validates a font file from a path, then stores its bytes as a BLOB in `custom_fonts`.
- Steps:
  1. In `src-tauri/src/commands/fonts.rs`, add:
     ```rust
     const MAX_FONT_BYTES: usize = 20 * 1024 * 1024; // 20 MB

     #[tauri::command]
     pub fn import_custom_font(
         family: String,
         weight: String,
         path: String,
         state: State<DiaryState>,
     ) -> Result<(), String> {
         let family = family.trim().to_string();
         if weight != "Regular" && weight != "Bold" {
             return Err(format!("Invalid weight '{}': must be 'Regular' or 'Bold'", weight));
         }
         if family.is_empty() {
             return Err("Font family name must not be empty".to_string());
         }
         let bytes = std::fs::read(&path)
             .map_err(|e| format!("Cannot read font file: {e}"))?;
         if bytes.len() > MAX_FONT_BYTES {
             return Err(format!(
                 "Font file is too large ({} MB). Maximum is 20 MB.",
                 bytes.len() / (1024 * 1024)
             ));
         }
         if mime_from_bytes(&bytes).is_none() {
             return Err("Invalid font file. Only TTF, OTF, WOFF, and WOFF2 files are accepted.".to_string());
         }
         let now = chrono::Utc::now().to_rfc3339();
         with_unlocked_db(&state, |db| {
             if weight == "Bold" {
                 let has_regular: bool = db.conn()
                     .query_row(
                         "SELECT 1 FROM custom_fonts WHERE family = ?1 AND weight = 'Regular' LIMIT 1",
                         rusqlite::params![family],
                         |_row| Ok(()),
                     )
                     .optional()
                     .map_err(|e| format!("Failed to verify existing Regular weight: {e}"))?
                     .is_some();
                 if !has_regular {
                     return Err("Import the Regular weight before importing Bold.".to_string());
                 }
             }
             db.conn()
                 .execute(
                     "INSERT OR REPLACE INTO custom_fonts (family, weight, data, created_at) VALUES (?1, ?2, ?3, ?4)",
                     rusqlite::params![family, weight, bytes, now],
                 )
                 .map(|_| ())
                 .map_err(|e| format!("Failed to store font: {e}"))
         })
     }
     ```
  2. Add `use rusqlite::OptionalExtension;` if needed for the `Bold`-without-`Regular` guard.
  3. Keep the file read and size/magic validation outside the DB lock so journal-state lock time stays short.
- Validation: Add tests for invalid magic, oversized files, and rejecting a Bold upload before a Regular upload; run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test import_custom_font"`.
- Notes: `INSERT OR REPLACE` uses the `UNIQUE(family, weight)` constraint to overwrite an existing weight for the same family. The explicit Bold-before-Regular check is required so every selectable family has a usable 400-weight face.

#### Task 2.3: Add `delete_custom_font_family` command

- Status: TO BE DONE
- Objective: `delete_custom_font_family` removes all weight rows for the given family name from `custom_fonts`.
- Steps:
  1. In `src-tauri/src/commands/fonts.rs`, add:
     ```rust
     #[tauri::command]
     pub fn delete_custom_font_family(
         family: String,
         state: State<DiaryState>,
     ) -> Result<(), String> {
         let family = family.trim().to_string();
         if family.is_empty() {
             return Err("Font family name must not be empty".to_string());
         }
         with_unlocked_db(&state, |db| {
             db.conn()
                 .execute("DELETE FROM custom_fonts WHERE family = ?1", rusqlite::params![family])
                 .map(|_| ())
                 .map_err(|e| format!("Failed to delete custom font '{}': {e}", family))
         })
     }
     ```
- Validation: Add a unit test `test_delete_custom_font_family_removes_all_weights` that inserts two rows (Regular + Bold) for the same family, calls the delete, and asserts zero rows remain; run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test delete_custom_font_family"`.
- Notes: Deletes both weights in one statement. If the family does not exist, zero rows are affected and no error is returned (DELETE is idempotent here).

#### Task 2.4: Modify `get_font_data` to check DB first

- Status: TO BE DONE
- Objective: `get_font_data` checks `custom_fonts` in the DB before falling back to the bundled directory; adds `bold_synthesized: bool` to `FontFaceData`.
- Steps:
  1. In `FontFaceData`, add `bold_synthesized: bool`. Match the existing style — no `pub` on fields:
     ```rust
     #[derive(serde::Serialize)]
     pub struct FontFaceData {
         family: String,
         regular: String,
         bold: String,
         bold_synthesized: bool,
     }
     ```
  2. Change the `get_font_data` signature to include `state`:
     ```rust
     #[tauri::command]
     pub fn get_font_data(
         family: String,
         app_handle: AppHandle,
         state: State<DiaryState>,
     ) -> Result<FontFaceData, String>
     ```
  3. At the start of the function body, query `custom_fonts` under `with_unlocked_db` before falling back to bundled files. The custom-font branch should:
     ```rust
     let custom = with_unlocked_db(&state, |db| {
         let regular_blob = db.conn()
             .query_row(
                 "SELECT data FROM custom_fonts WHERE family = ?1 AND weight = 'Regular'",
                 rusqlite::params![family],
                 |row| row.get::<_, Vec<u8>>(0),
             )
             .optional()
             .map_err(|e| format!("Failed to read custom Regular font: {e}"))?;
         if let Some(reg_bytes) = regular_blob {
             let bold_blob = db.conn()
                 .query_row(
                     "SELECT data FROM custom_fonts WHERE family = ?1 AND weight = 'Bold'",
                     rusqlite::params![family],
                     |row| row.get::<_, Vec<u8>>(0),
                 )
                 .optional()
                 .map_err(|e| format!("Failed to read custom Bold font: {e}"))?;
             let bold_synthesized = bold_blob.is_none();
             let bold_bytes = bold_blob.unwrap_or_else(|| reg_bytes.clone());
             let reg_mime = mime_from_bytes(&reg_bytes).unwrap_or("font/ttf");
             let bold_mime = mime_from_bytes(&bold_bytes).unwrap_or("font/ttf");
             let regular = format!("data:{};base64,{}", reg_mime, general_purpose::STANDARD.encode(&reg_bytes));
             let bold = format!("data:{};base64,{}", bold_mime, general_purpose::STANDARD.encode(&bold_bytes));
             return Ok(Some(FontFaceData { family: family.clone(), regular, bold, bold_synthesized }));
         }
         Ok(None)
     })?;
     if let Some(data) = custom {
         return Ok(data);
     }
     ```
  4. In the existing bundled-fonts code path (the `read_font_file` calls at the end), update the `Ok(FontFaceData { ... })` return to add `bold_synthesized: false`.
  5. Keep the payload shape unchanged for the frontend: when Bold is missing, `bold` may still reuse the Regular data URL, but `bold_synthesized: true` must be the signal that the frontend uses to omit the 700-weight `@font-face`.
- Validation: Add tests for custom Regular-only, custom Regular+Bold, and bundled fallback behavior; run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test get_font_data"`.
- Notes: `bold_synthesized` is a runtime hint for `DiaryEditor.tsx`; it does not by itself create synthesized bold unless the frontend omits the fake 700-weight face.

#### Task 2.5: Register new commands

- Status: TO BE DONE
- Objective: All three new commands appear in `generate_handler![]` in `lib.rs`.
- Steps:
  1. `commands/mod.rs` already declares `pub mod fonts;` — **no changes needed there**. Commands in this codebase are referenced directly as `commands::fonts::function_name` in `lib.rs`, not via flat re-exports.
  2. Open `src-tauri/src/lib.rs`. Find the `// Fonts` comment block in `generate_handler![]` (currently contains `commands::fonts::list_bundled_fonts` and `commands::fonts::get_font_data`). Add the three new commands immediately after:
     ```rust
     commands::fonts::list_custom_fonts,
     commands::fonts::import_custom_font,
     commands::fonts::delete_custom_font_family,
     ```
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo check"` passes with no unused-import warnings.
- Notes: Command registration is only required in `lib.rs` `generate_handler![]`. The module is already publicly visible via `pub mod fonts;` in `commands/mod.rs`. Missing the `generate_handler![]` entry causes the command to be silently unavailable at runtime (see backend CLAUDE.md gotcha #2).

---

### Milestone 3: Frontend

- Status: TO BE DONE
- Purpose: Wire the new commands into the UI, expose custom fonts in both selectors, and make runtime font loading handle missing Bold correctly.
- Exit Criteria: TypeScript type-checks clean; targeted Vitest coverage passes; custom fonts appear in both Preferences and toolbar selectors; deleting the selected custom font clears the saved preference immediately; `DiaryEditor.tsx` omits the fake 700-weight face when `bold_synthesized` is true.

#### Task 3.1: Update `tauri.ts` wrappers

- Status: TO BE DONE
- Objective: `src/lib/tauri.ts` exports typed wrappers for all three new commands and reflects the updated `FontFaceData` interface.
- Steps:
  1. Update the `FontFaceData` interface:
     ```typescript
     export interface FontFaceData {
       family: string;
       regular: string;
       bold: string;
       bold_synthesized: boolean;
     }
     ```
  2. Add the `CustomFontSummary` interface:
     ```typescript
     export interface CustomFontSummary {
       family: string;
       has_regular: boolean;
       has_bold: boolean;
     }
     ```
  3. Add the three new wrappers in the `// Font commands` section:
     ```typescript
     export async function listCustomFonts(): Promise<CustomFontSummary[]> {
       return await invoke('list_custom_fonts');
     }

     export async function importCustomFont(family: string, weight: string, path: string): Promise<void> {
       await invoke('import_custom_font', { family, weight, path });
     }

     export async function deleteCustomFontFamily(family: string): Promise<void> {
       await invoke('delete_custom_font_family', { family });
     }
     ```
- Validation: `cmd.exe /c bun run type-check` passes.
- Notes: `bold_synthesized` is new on `FontFaceData` and is consumed by `DiaryEditor.tsx`; the current "no frontend changes needed" assumption is incorrect and must not remain in the implementation plan.

#### Task 3.2: Update `DiaryEditor.tsx`

- Status: TO BE DONE
- Objective: Runtime font injection uses `bold_synthesized` correctly so Regular-only custom fonts still produce bold-looking text.
- Steps:
  1. In the existing `createEffect` that injects `@font-face`, branch on `data.bold_synthesized`.
  2. When `bold_synthesized === false`, keep the current two-face behavior: inject one 400-weight face and one 700-weight face.
  3. When `bold_synthesized === true`, inject only the 400-weight face for that family. Do **not** register a 700-weight face that points at the same Regular file, because that would prevent browser-side bold synthesis.
  4. Keep the existing cleanup behavior that removes the injected `<style id="editor-font-face">` when the selected font changes or the editor unmounts.
- Validation: `cmd.exe /c bun run type-check` passes.
- Notes: Per MDN, browser bold synthesis happens only when the bold typeface is missing, so the frontend must make Bold genuinely absent at the CSS `@font-face` level for Regular-only uploads to work as intended.

#### Task 3.3: Update `PreferencesWritingTab.tsx`

- Status: TO BE DONE
- Objective: The Writing tab shows (a) custom font families in the existing font dropdown, (b) a new "Custom Fonts" management section below the dropdown, while respecting the shell’s buffered Save/Cancel model.
- Steps:
  1. Add imports for `open as openDialog` from `@tauri-apps/plugin-dialog`, `mapTauriError` from `../../../lib/errors`, and the new Tauri wrappers/types from `../../../lib/tauri`.
  2. Add a `createResource(listCustomFonts)` alongside the existing `bundledFonts` resource.
  3. Add local signals for the upload form (`uploadFamily`, `uploadRegularPath`, `uploadBoldPath`, `fontManagerError`, `isUploading`).
  4. Implement `pickRegular()` and `pickBold()` using the same dialog plugin pattern already used in `ImportOverlay.tsx`. Auto-fill the family name only as a convenience from the chosen Regular filename; keep the field editable.
  5. Implement `handleAddFont()` to:
     - require a family name and Regular file path
     - clear the current error first
     - call `importCustomFont(family, 'Regular', regularPath)` and then optionally `importCustomFont(family, 'Bold', boldPath)`
     - clear the form and refetch the custom-font list on success
     - surface failures via `mapTauriError(err, t)`
  6. Implement `handleDeleteFont(family)` to:
     - call `deleteCustomFontFamily(family)` immediately
     - refetch the custom-font list
     - clear `localEditorFontFamily()` if it matches the deleted family
     - also call `setPreferences({ editorFontFamily: null })` immediately if the saved preference currently points at the deleted family, so Cancel cannot leave a broken persisted selection behind
     - surface failures via `mapTauriError(err, t)` instead of `console.error`
  7. In the existing font-family `<select>`, add a "Custom" `<optgroup>` after the bundled-font options. Only include custom families where `has_regular === true`.
  8. After the `fontFamilyHint` paragraph, add a new Custom Fonts management section that includes:
     - explanatory copy about journal-local storage and backup size
     - the existing custom-font list
     - a persistent warning row when `!font.has_bold`
     - Regular and Bold file pickers
     - a family-name input
     - an inline error area
     - an upload button
- Validation: `cmd.exe /c bun run type-check` passes; `cmd.exe /c bun run test:run -- PreferencesWritingTab` passes.
- Notes: The Writing tab already mixes buffered settings with immediate side effects elsewhere in the Preferences overlay; treat add/remove custom-font actions like those immediate actions, not like buffered Save/Cancel-only state.

#### Task 3.4: Update `EditorToolbar.tsx`

- Status: TO BE DONE
- Objective: The optional toolbar font-family selector shows the same bundled + custom font choices as Preferences.
- Steps:
  1. Import `listCustomFonts` from `../../lib/tauri`.
  2. Add a `createResource(listCustomFonts)` alongside the existing `bundledFonts` resource.
  3. In the `fontFamily` toolbar item renderer, keep the existing "System Default" option, then render bundled fonts, then a Custom optgroup containing custom families with `has_regular === true`.
  4. Preserve the existing direct-write behavior: the toolbar selector still calls `setPreferences({ editorFontFamily: e.target.value || null })` immediately.
- Validation: `cmd.exe /c bun run test:run -- EditorToolbar` passes.
- Notes: This is required for consistency with the docs and the existing toolbar feature. Without it, a selected custom font would be invisible or invalid in the toolbar selector.

#### Task 3.5: Update `PreferencesWritingTab.test.tsx`

- Status: TO BE DONE
- Objective: The test file mocks the new commands and covers the new management UI plus the saved-preference reset case.
- Steps:
  1. Open `src/components/overlays/preferences/PreferencesWritingTab.test.tsx`.
  2. Extend the mock of `../../../lib/tauri` with `listCustomFonts`, `importCustomFont`, and `deleteCustomFontFamily`.
  3. Add a test that renders the Custom Fonts section heading and hint.
  4. Add a test that mocks `listCustomFonts` to return `[{ family: 'TestFont', has_regular: true, has_bold: false }]` and asserts the missing-Bold warning text appears.
  5. Add a test that starts with `preferences().editorFontFamily === 'TestFont'`, deletes that family, and verifies the persisted preference is cleared immediately instead of waiting for the overlay Save callback.
- Validation: `cmd.exe /c bun run test:run -- PreferencesWritingTab` passes with no skipped tests.
- Notes: Follow the existing `renderWithI18n` and `PreferencesShellContext` patterns already used throughout the file.

#### Task 3.6: Update `EditorToolbar.test.tsx`

- Status: TO BE DONE
- Objective: The toolbar tests cover custom-font options in the font-family selector.
- Steps:
  1. Open `src/components/editor/EditorToolbar.test.tsx`.
  2. Extend the existing hoisted/mocked `../../lib/tauri` setup with `listCustomFonts`.
  3. Add a test that enables the `fontFamily` toolbar item, mocks one bundled font and one custom font, and asserts both appear in the rendered `<select>`.
  4. Add a test that sets `preferences().editorFontFamily` to a custom font and asserts the toolbar selector still renders that option correctly.
- Validation: `cmd.exe /c bun run test:run -- EditorToolbar` passes.
- Notes: `EditorToolbar` already has targeted tests for bundled-font options, so keep the custom-font coverage in the same file instead of creating a new test surface.

---

### Milestone 4: i18n

- Status: TO BE DONE
- Purpose: Add all new UI strings to the canonical English source and mirror them into community locale files.
- Exit Criteria: locale validation passes with zero errors; all new keys are present in `en.ts` and all five JSON locale files.

#### Task 4.1: Add new keys to `en.ts`

- Status: TO BE DONE
- Objective: All new i18n keys exist in `src/i18n/locales/en.ts` under the `prefs.writing` namespace.
- Steps:
  1. Open `src/i18n/locales/en.ts`.
  2. In the `writing:` section, locate the existing `fontFamilyHint` key. Insert the following new keys immediately after it (do not add or modify `fontFamilyHint` — it already exists):
     ```typescript
     customFontsGroupLabel: 'Custom',
     customFontsLabel: 'Custom fonts',
     customFontsHint:
       'Custom fonts are stored inside your journal, imported or removed immediately, and travel with the journal to other devices. They also increase the size of your journal file and backups.',
     customFontBoldPairHint:
       'For correct bold text, provide both a Regular and a Bold weight file.',
     customFontRegularLabel: 'Regular weight (.ttf / .otf / .woff / .woff2)',
     customFontBoldLabel: 'Bold weight (.ttf / .otf / .woff / .woff2)',
     customFontChooseFile: 'Choose file…',
     customFontFamilyLabel: 'Font family name',
     customFontAddButton: 'Add font',
     customFontMissingBold: 'Bold weight missing — Mini Diarium will let the browser synthesize bold text, which may look incorrect.',
     customFontDeleteButton: 'Remove',
     customFontDeleteAriaLabel: 'Remove {{ family }} custom font',
     ```
- Validation: `cmd.exe /c bun run type-check` passes (the TypeScript locale type will catch any mismatched keys).
- Notes: `customFontDeleteAriaLabel` uses the `{{ family }}` interpolation syntax required by `@solid-primitives/i18n` v2.

#### Task 4.2: Mirror keys into all JSON locale files

- Status: TO BE DONE
- Objective: The same keys exist in `es.json`, `de.json`, `fr.json`, `it.json`, and `hi.json` with English fallback strings (community translators update them separately).
- Steps:
  1. For each of the five files (`src/i18n/locales/es.json`, `de.json`, `fr.json`, `it.json`, `hi.json`), locate the `"writing"` object.
  2. Add all of the new keys from Task 4.1 with the same English strings as values.
  3. Run `cmd.exe /c bun run validate:locales` and fix any key-path mismatches.
- Validation: `cmd.exe /c bun run validate:locales` exits with code 0.
- Notes: The validate script compares JSON locale files against `en.ts`. Any missing or extra key causes a non-zero exit.

---

### Milestone 5: Documentation, Cleanup and Final Verification

- Status: TO BE DONE
- Purpose: Update every required documentation surface, remove temporary artifacts, and verify the completed feature end-to-end.
- Exit Criteria: `website/docs-src/` and generated docs are updated; agent-facing docs reflect schema v8 and the new commands; CHANGELOG is updated under the current unreleased version block; manual UI verification passes; final verification commands pass; plan status is set to COMPLETED.

#### Task 5.1: Update User Documentation

- Status: TO BE DONE
- Objective: The authoritative user docs describe custom fonts accurately.
- Steps:
  1. Update [website/docs-src/07-preferences.md](/D:/Repos/mini-diarium/website/docs-src/07-preferences.md) so the Writing settings table explains:
     - custom fonts can be uploaded and removed from Preferences → Writing
     - custom fonts are stored inside the journal and increase backup size
     - the font-family selector now includes bundled and custom fonts
     - add/remove actions are immediate, while choosing the active font still follows the normal Save/Cancel flow
  2. Update [website/docs-src/01-writing-entries.md](/D:/Repos/mini-diarium/website/docs-src/01-writing-entries.md) so the Editor Font section explains:
     - bundled and custom font options
     - missing Bold behavior and warning
     - the toolbar font-family selector also includes custom fonts when enabled
  3. While touching those docs, fix any adjacent path drift in the same sections so the setting locations remain accurate.
  4. Run `cmd.exe /c bun run website:build-static` to regenerate the generated docs output under `website/`.
- Validation: `cmd.exe /c bun run website:build-static` succeeds and the generated website docs reflect the updated `docs-src` content.
- Notes: Root repo guidance makes `website/docs-src/` the authoritative user reference; updating code without these docs would leave the repo in a known-bad state.

#### Task 5.2: Update Agent-Facing Docs

- Status: TO BE DONE
- Objective: The repo’s agent-facing docs reflect the new schema version and command registry.
- Steps:
  1. Update [CLAUDE.md](/D:/Repos/mini-diarium/CLAUDE.md):
     - change the registered-command count from 62 to 65
     - add rows for `list_custom_fonts`, `import_custom_font`, and `delete_custom_font_family`
     - update the `get_font_data` description so it matches the new behavior
  2. Update [src-tauri/CLAUDE.md](/D:/Repos/mini-diarium/src-tauri/CLAUDE.md):
     - change "Current schema is v7" to v8
     - add the `custom_fonts` table to the schema/gotcha summary
  3. Update any nearby schema-version or font-command references in those same files if they become stale due to this feature.
- Validation: File inspection confirms the new schema version and commands are documented consistently.
- Notes: These doc updates are required by the repo’s "Docs Maintenance" rules, not optional cleanup.

#### Task 5.3: CHANGELOG Entry

- Status: TO BE DONE
- Objective: `CHANGELOG.md` records the feature in the current unreleased release block format used by this repo.
- Steps:
  1. Open [CHANGELOG.md](/D:/Repos/mini-diarium/CHANGELOG.md).
  2. Use the existing top unreleased block format already present in the file (`## [0.5.2] - Unreleased` at the time this plan was reviewed). Do **not** invent a new `## [Unreleased]` section unless the maintainer has already changed the project’s changelog format by the time implementation happens.
  3. Under the current unreleased block’s `### Added` section, insert a custom-fonts entry summarizing:
     - upload of Regular/Bold custom fonts from Preferences → Writing
     - journal-local storage
     - missing-Bold warning / synthesized-bold behavior
     - schema bump to v8
- Validation: `CHANGELOG.md` contains the new entry under the repo’s current unreleased block format.
- Notes: The plan's previous "create `[Unreleased]` if missing" instruction was incorrect for this repository.

#### Task 5.4: Manual UI Verification

- Status: TO BE DONE
- Objective: Verify the feature in the real desktop UI, including the missing-Bold rendering path that unit tests cannot prove visually.
- Steps:
  1. Launch the real app using the repo’s Windows/Tauri manual verification path (see the `tauri-agent-dev` skill referenced by root guidance) or equivalent local manual run.
  2. Import a Regular-only custom font and confirm:
     - it appears in Preferences → Writing
     - the missing-Bold warning is shown
     - selecting it changes the editor font
     - bold text in the editor still appears visually bolder than regular text
  3. Enable the toolbar `Font family` item and confirm the same custom font appears in the toolbar selector too.
  4. Import the matching Bold file and confirm the missing-Bold warning disappears.
  5. Delete the currently selected custom font and confirm the active font falls back to System Default immediately, including after closing/reopening Preferences.
  6. Lock and unlock the journal (or restart the app) and confirm uploaded custom fonts persist because they are stored in the journal DB.
- Validation: Manual checklist completed with no visual or state-consistency regressions.
- Notes: This is the only reliable way to verify that browser-synthesized bold still looks acceptably bold in the actual desktop runtime.

#### Task 5.5: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove any artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary files, scratch notes, or test fixtures not part of the final deliverable.
  2. Confirm `docs/custom-fonts-plan.md` (this file) is intentionally kept as a record — do not delete it.
  3. Remove any `*.tmp`, `*.bak`, or debug output files if created during implementation.
- Validation: `git status` shows only intentional changes.
- Notes: None.

#### Task 5.6: Final Verification

- Status: TO BE DONE
- Objective: All verification commands pass after the complete change is integrated.
- Steps:
  1. Run `cmd.exe /c bun run format`.
  2. Run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`.
  3. Run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo clippy --all-targets -- -D warnings"`.
  4. Run `cmd.exe /c bun run test:run`.
  5. Run `cmd.exe /c bun run type-check`.
  6. Run `cmd.exe /c bun run lint`.
  7. Run `cmd.exe /c bun run validate:locales`.
  8. Run `cmd.exe /c bun run build`.
  9. Confirm the generated website docs are up to date from Task 5.1 (re-run `cmd.exe /c bun run website:build-static` only if `website/docs-src/` changed again after that task).
  10. Set plan status to COMPLETED.
- Validation: All required commands exit with code 0.
- Notes: If the build fails around `get_font_data`, verify both the updated command signature and the new `DiaryEditor.tsx` `bold_synthesized` branch, because the old plan incorrectly assumed no runtime font-injection changes were needed.

---

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval.
Fix all failures before proceeding.

- [ ] `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` passes with zero failures
- [ ] `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo clippy --all-targets -- -D warnings"` passes with zero warnings
- [ ] `cmd.exe /c bun run type-check` passes
- [ ] `cmd.exe /c bun run lint` passes
- [ ] `cmd.exe /c bun run build` succeeds
- [ ] `cmd.exe /c bun run format` applied
- [ ] `cmd.exe /c bun run validate:locales` passes
- [ ] `cmd.exe /c bun run website:build-static` has been run after updating `website/docs-src/`
- [ ] All new i18n keys present in `en.ts` and all five JSON locale files
- [ ] Toolbar and Preferences selectors both show custom fonts
- [ ] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] No open questions remain.
- [x] Tasks are grouped into milestones.
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] Repo-specific execution rules (`cmd.exe /c ...`, `website/docs-src/` regeneration, agent-doc updates) are reflected.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- `get_font_data` now requires `State<DiaryState>` — ensure `lib.rs` registration and any test mocks for the command account for this extra parameter.
- Add/remove custom-font actions are immediate DB mutations inside a buffered Preferences tab. Keep that mixed model explicit in code and docs so Save/Cancel semantics remain understandable.
- `bold_synthesized` is not just metadata. The frontend must actually omit the 700-weight `@font-face` when it is `true`, or browser-side synthetic bold will never happen.
