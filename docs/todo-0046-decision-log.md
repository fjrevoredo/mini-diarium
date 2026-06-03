# TODO-0046 Decision Log

Compact record of decisions made during implementation that were not covered by the plan.

---

## DL-001: Migration version bump (v8→v9 → v9→v10)

**Decision:** The images migration is v9→v10 (not v8→v9 as written in the plan).

**Rationale:** The font-system feature (implemented after the plan was authored) added
the `entry_metadata_encrypted` column via a v8→v9 migration and bumped `SCHEMA_VERSION`
to 9. That migration already exists at `src-tauri/src/db/schema/migrations/v8_to_v9.rs`.
The images feature therefore requires a new v9→v10 migration file.

**Impact on plan tasks:**
- Task 1.2: Create `v9_to_v10.rs` (not `v8_to_v9.rs`); update `SCHEMA_VERSION` to 10 (not 9).
- Task 1.2 step 5: Call `migrate_v9_to_v10` in `apply_pending`.
- Task 1.2 step 6: Update test name from `test_apply_pending_advances_v3_to_v9` →
  `test_apply_pending_advances_v3_to_v10`; assert version 10 and table_count 6.
- Task 1.2 step 7: `test_schema_version` should assert `SCHEMA_VERSION == 10`.
- Task 1.2 step 8: Idempotency test comment updated from `v9→v9` to `v10→v10`.
- Task 7.1 step 7: `src-tauri/CLAUDE.md` gotcha #1 updated to note schema v10.

---

## DL-002: `update_entry_with_images` must include metadata and reuse `update_entry`

**Decision:** The `update_entry_with_images` function (Task 3.1) must accept
`metadata: Option<EntryMetadata>` as a parameter, and its final write step must call
`queries::update_entry(db, &entry)` rather than a hand-rolled `UPDATE` SQL statement.

**Rationale:** The font-system feature added `entry_metadata_encrypted` to the `entries`
table. The `queries::update_entry` function already handles encrypting and writing this
column. The plan's proposed `update_entry_with_images` had the signature
`(db, id, title, text)` (no metadata) and a hand-rolled `UPDATE` statement that omitted
`entry_metadata_encrypted = ?5`. Implementing the plan verbatim would silently wipe per-entry
font defaults on every save through the new path.

**Fix:** The signature is `update_entry_with_images(db, id, title, text, metadata)`.
Inside the function, the existing `get_entry_by_id` + field mutation + `update_entry`
pattern from `save_entry_inner` is preserved. The new code only adds:
1. Image extraction from `text` → rewrite `text` → collect image IDs
2. `replace_entry_image_links(db, id, &image_ids)` call
3. `cleanup_orphaned_images(db)` call
4. All wrapped in manual `BEGIN IMMEDIATE / COMMIT` with explicit `ROLLBACK` on error.
`update_entry` does NOT open its own transaction (confirmed by reading entries.rs:219-250),
so nesting it under `BEGIN IMMEDIATE` is safe.

---

## DL-003: `ImagePickerOverlay` mounted in `DiaryEditor.tsx` instead of `MainLayout.tsx`

**Decision:** `ImagePickerOverlay` is mounted inside `DiaryEditor.tsx` rather than
`MainLayout.tsx` as suggested by the plan.

**Rationale:** The picker's `onInsert` callback calls
`editor().chain().focus().setImage({ src: dataUrl }).run()`, which requires a reference to
the TipTap `Editor` instance. `DiaryEditor.tsx` already holds the editor instance, so
mounting the picker there is natural and avoids threading the callback through `MainLayout`
→ `EditorPanel` → `DiaryEditor`. The `isImagePickerOpen` signal is still global state in
`ui.ts`, matching the pattern of all other overlays, so the toolbar button in `EditorToolbar`
can still toggle it. The only difference is the mounting location for the overlay's JSX.

---

## DL-004: `extract_and_replace_image_refs` and `resolve_image_refs_in_entries` in `db/queries/images.rs`

**Decision:** Both helper functions are in `src-tauri/src/db/queries/images.rs` rather than
`export/mod.rs` or a new `export/image_resolve.rs` as suggested by the plan.

**Rationale:** Both functions operate on database queries (they call `upsert_image` and
`get_images_for_entry`), so they logically belong in the queries layer, not the export
layer. Placing them in `export/` would create a cyclic import risk (export layer depending
on DB queries is fine, but the save path also needs `extract_and_replace_image_refs` and
the save path is in `db/queries/entries.rs`). Co-locating all image DB operations in
`db/queries/images.rs` keeps the module cohesive and avoids coupling the export layer to
the save path.

---

## DL-005: `saveCurrentById` shouldDelete branch — image resolution added

**Decision:** Added `hasImageRefs`/`getEntryImages`/`resolveImageRefs` to the
`saveCurrentById` shouldDelete branch in `useEntryLifecycle.ts` (line ~87), where a
remaining entry is shown after an empty entry is auto-deleted.

**Rationale:** `dayEntries()` always stores raw backend text (with `image-id://` refs).
The three explicitly-planned resolution sites (`loadEntriesForDate`, `navigateToEntry`,
`handleDeleteEntry`) only cover fresh loads and explicit navigation. The shouldDelete path
reads from `dayEntries()` directly and can show a remaining entry with unresolved refs.
The fix uses the existing `saveRequestId` guard to cancel stale async calls.
