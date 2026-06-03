# TODO-0042 Font System Implementation Review

Reviewed commit: `9eed9f34` (`Three-level font system`)

Source plan: `docs/todo-0042-font-system-plan.md`

## Part 1: Implementation Assessment

The implementation covers the main shape of the approved plan: schema version is bumped to v9, entries now carry encrypted optional metadata, `save_entry` accepts metadata, JSON export/import has a metadata path, Tiptap font family/size extensions are registered, toolbar dropdowns apply inline marks instead of preferences, and the frontend has state for app default, entry default, and inline override precedence.

The overall direction is sound and consistent with the repository architecture: app-wide defaults remain in `localStorage`, entry metadata is stored with encrypted entry data, and inline formatting stays inside encrypted TipTap HTML. The implementation also follows several repo best-practice expectations: the Tauri wrapper is typed, the command core remains testable through `save_entry_inner`, encrypted metadata decryption fails closed, and the migration is wired through the centralized migration pipeline.

However, the implementation should not be accepted as fully complete yet. There are a few concrete spec gaps and behavioral risks:

1. Entry metadata can leak between entries after delete/navigation paths.
   - `src/components/layout/editor-panel/useMultiEntryNav.ts` updates title/content/word count after deleting an entry, but does not update `entryMetadata`.
   - `src/components/layout/editor-panel/useEntryLifecycle.ts` does the same after auto-deleting a blank entry and selecting a remaining entry.
   - This can cause the visible entry to render or save with the deleted/previous entry's font default.

2. Imported and plugin-provided metadata bypasses normalization.
   - `save_entry_inner` normalizes metadata through `queries::normalize_metadata`.
   - `import_entries`, Mini Diarium JSON import, and Rhai import conversion can pass metadata directly to `insert_entry`, which encrypts and persists it as-is.
   - That means imported metadata can preserve empty family names, sizes outside 12-24 px, or metadata objects that should collapse to `None`. This violates the plan's validation requirement at the storage boundary.

3. Website generated docs were not committed.
   - The plan required running `website:build-static` after changing `website/docs-src/*`.
   - The commit changed only `website/docs-src/01-writing-entries.md`, `website/docs-src/05-export.md`, and `website/docs-src/07-preferences.md`; no tracked `website/docs/*/index.html` files changed.
   - Since generated docs are tracked in this repo, the shipped website docs are stale.

4. The plan document was marked complete but still contains stale completion evidence.
   - `docs/todo-0042-font-system-plan.md` says `Plan Status: COMPLETED`, but its "Current Status" section still says implementation has not started.
   - The pre-flight checklist remains unchecked, including manual UI verification and website docs regeneration.
   - This weakens the plan as an audit artifact and conflicts with the repo's manual-planning discipline.

5. Validation could not be independently rerun in this sandbox.
   - `cmd.exe /c bun run test:run ...` reported `Script not found "test:run"` even though `package.json` contains the script and `dir package.json` succeeds in the same directory.
   - `cargo test` failed before compilation with `Access is denied` on `src-tauri\target\debug\.cargo-lock`; a fresh `CARGO_TARGET_DIR` also failed with access denied.
   - Treat this review as static plus attempted validation, not a verified green build.

## Part 2: Actionable Fixes And Improvements

### 1. Fix metadata state when deleting or auto-deleting entries

Severity: High

Files:
- `src/components/layout/editor-panel/useMultiEntryNav.ts`
- `src/components/layout/editor-panel/useEntryLifecycle.ts`
- `src/components/layout/EditorPanel.integration.test.tsx`

Problem:

After a delete selects another entry, the code updates `pendingEntryId`, `title`, `content`, and `wordCount`, but leaves `entryMetadata` unchanged. The next save uses `opts.entryMetadata()` and can persist the wrong entry default.

Fix:

Whenever the active entry changes, update metadata alongside the other entry state.

Example:

```ts
const entry = refreshed[newIndex];
opts.setPendingEntryId(entry.id);
opts.setTitle(entry.title);
opts.setContent(entry.text);
opts.setWordCount(countWordsInHtml(entry.text));
opts.setEntryMetadata(entry.metadata ?? null);
```

Apply the same rule in the blank-entry auto-delete path in `useEntryLifecycle.ts`:

```ts
const entry = updatedEntries[newIdx];
opts.setCurrentIndex(newIdx);
opts.setPendingEntryId(entry.id);
opts.setTitle(entry.title);
opts.setContent(entry.text);
opts.setWordCount(countWordsInHtml(entry.text));
opts.setEntryMetadata(entry.metadata ?? null);
```

Also clear metadata when no entries remain:

```ts
opts.setEntryMetadata(null);
```

Add regression tests:

- Delete entry A with metadata, select entry B without metadata, edit entry B, assert `saveEntry(..., null)`.
- Auto-delete blank entry A with metadata while another entry remains, edit the remaining entry, assert its own metadata is saved.

### 2. Normalize metadata at the query/storage boundary

Severity: High

Files:
- `src-tauri/src/db/queries/entries.rs`
- `src-tauri/src/commands/import.rs`
- `src-tauri/src/import/minidiary.rs`
- `src-tauri/src/plugin/rhai_loader.rs`

Problem:

Only the save command normalizes metadata. Any path that builds a `DiaryEntry` and calls `insert_entry` directly can persist invalid metadata.

Fix:

Move normalization into the query boundary so all writers get the same invariant. `insert_entry` and `update_entry` should normalize before encryption, or `encrypt_metadata` should normalize internally.

Example:

```rust
fn encrypt_metadata(
    db: &DatabaseConnection,
    metadata: &Option<EntryMetadata>,
) -> Result<Option<Vec<u8>>, String> {
    let metadata = normalize_metadata(metadata.clone());
    match metadata {
        Some(m) => {
            let json = serde_json::to_string(&m)
                .map_err(|e| format!("Failed to serialize entry metadata: {}", e))?;
            Ok(Some(super::encrypt_for_storage(
                db.key(),
                json.as_bytes(),
                "entry_metadata",
            )?))
        }
        None => Ok(None),
    }
}
```

Then add tests that insert through import/plugin-equivalent paths with:

- `fontFamily: "   "` -> stored as `None`
- `fontSize: 99` -> stored as `24`
- `fontSize: 4` -> stored as `12`

This matches the Rust best-practice rule that storage-format helpers should enforce encrypted row serialization invariants near the query boundary.

### 3. Regenerate and commit website docs

Severity: Medium

Files:
- `website/docs/writing-entries/index.html`
- `website/docs/export/index.html`
- `website/docs/preferences/index.html`
- any other generated website docs touched by the generator

Problem:

User-facing source docs changed, but tracked generated docs did not. The deployed static website will continue showing the old font behavior until the generated files are updated.

Fix:

Run the documented command from PowerShell, then commit the generated output:

```powershell
cmd.exe /c bun run website:build-static
```

Inspect the generated HTML for the three-level font model, JSON full-fidelity export note, and Preferences app-default wording.

### 4. Update the plan audit trail

Severity: Medium

File:
- `docs/todo-0042-font-system-plan.md`

Problem:

The plan is marked complete but still says implementation has not started, and the pre-flight checklist is unchecked.

Fix:

Update "Current Status" to summarize the actual implementation state. Check only validations that were actually run and passed. If manual UI verification was done, record the exact scenarios and date. If it was not done, leave it unchecked and do not mark the plan fully complete.

Suggested wording:

```md
## Current Status

Implementation landed in commit `9eed9f34`. Follow-up review found remaining issues in metadata state reset, import normalization, and generated website docs; see `docs/todo-0042-font-system-review.md`.
```

### 5. Escape font family names before injecting CSS

Severity: Medium

Files:
- `src/components/editor/DiaryEditor.tsx`
- optionally `src/lib/font-utils.ts`

Problem:

`DiaryEditor` writes custom and imported font family names directly into `@font-face` CSS:

```ts
`  font-family: "${data.family}";`
```

Custom font family names are user-controlled and imported entry metadata may also carry arbitrary family strings. Even if this is a local-only app, malformed names containing quotes or backslashes can break the generated stylesheet and cause unrelated fonts to stop loading.

Fix:

Escape CSS string content before building `@font-face` rules.

Example:

```ts
function cssString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
```

Then:

```ts
`  font-family: ${cssString(data.family)};`
```

Add a focused test for a family such as `A "Quoted" Font` to prove the generated stylesheet remains valid.

### 6. Improve inline font-family extraction or document its limits

Severity: Low

File:
- `src/lib/font-utils.ts`

Problem:

`extractFontFamiliesFromHtml` uses a narrow regex. It works for the current simple TipTap output, but it can miss or truncate valid CSS values such as comma-separated fallback lists or escaped quotes. Since this helper controls which local font faces get loaded, misses can cause inline-styled content to fall back visually until the user selects the font again.

Fix:

Prefer a browser parser for HTML/style attributes in frontend code where `document` exists, or at minimum extend tests for the actual TipTap outputs the app stores.

Useful test cases:

```ts
extractFontFamiliesFromHtml('<span style="font-family: &quot;Noto Serif&quot;">x</span>');
extractFontFamiliesFromHtml('<span style="font-family: Noto Serif, serif">x</span>');
extractFontFamiliesFromHtml('<span style="color:red; font-family: JetBrains Mono;">x</span>');
```

If the intended contract is "only exact family values emitted by Tiptap's FontFamily extension", state that in the helper comment and keep the tests aligned with that narrower scope.

### 7. Add the missing behavior tests rather than broad snapshots

Severity: Medium

Files:
- `src/components/layout/EditorPanel.integration.test.tsx`
- `src-tauri/src/commands/import.rs` or `src-tauri/src/db/queries/entries.rs`

Problem:

The new tests cover normal metadata preservation and toolbar command calls, but not the risky boundary cases found in this review.

Fix:

Add targeted tests only:

- Frontend: metadata resets or switches correctly after delete and blank-entry auto-delete.
- Backend: import/plugin metadata is normalized before persistence.
- Docs/build: no unit test needed; generated docs should be regenerated and inspected.

Avoid broad snapshot tests here; the valuable checks are the exact `saveEntry` metadata argument and the exact decrypted persisted metadata.

