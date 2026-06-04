# TODO-0046 Implementation Review

Date: 2026-06-04
Branch: `feature-v0.5.3`
Reviewed commit: `1bd5777 Image deduplication`

## Part 1: Assessment

The implementation substantially matches the intent of `docs/todo-0046-image-store-plan.md` and the implementation decisions in `docs/todo-0046-decision-log.md`. The core storage model is present: schema v10 adds encrypted `images` and `entry_images`, image bytes are AES-GCM encrypted, deduplication uses an HKDF-keyed fingerprint, `save_entry` extracts embedded data URLs into image rows, entry deletion cleans orphaned images, frontend load paths resolve `image-id://` references, and export/plugin paths attempt to restore data URLs before formatting.

The decision log is useful and mostly justified. In particular, bumping the images migration to v9->v10 was correct because the font-system migration already occupied v8->v9, and preserving `entry_metadata_encrypted` by reusing `update_entry` avoided a real data-loss bug.

Validation results:

- `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`: passed, 425 tests.
- `cmd.exe /c bun run test:run`: passed, 45 files / 472 tests.
- `cmd.exe /c bun run type-check`: passed.
- `cmd.exe /c bun run lint`: passed with one existing warning in `src/state/auth.ts`.
- `cmd.exe /c bun run validate:locales`: passed.
- `cmd.exe /c bun run check:ui-errors`: passed.
- `cmd.exe /c bun run format:check`: failed for three TODO-046 frontend files.

Overall quality is good for the database foundation and save/delete mechanics. The main issues are in edge-case HTML handling, missing export-resolution coverage, and the image-picker UI not fully matching the plan or frontend accessibility conventions.

## Part 2: Actionable Fixes

### 1. Fix single-quoted `image-id://` references on load and export

Severity: High

`extract_and_replace_image_refs` accepts single-quoted data URLs and `replace_data_src` preserves the quote style:

- `src-tauri/src/db/queries/images.rs:261-269`

That means this legacy/imported HTML:

```html
<img src='data:image/png;base64,...' alt=''>
```

is saved as:

```html
<img src='image-id://1' alt=''>
```

But both resolution paths only match refs followed by a double quote:

- `src-tauri/src/db/queries/images.rs:161`
- `src/lib/image-refs.ts:12`

Result: single-quoted stored image refs remain unresolved in the editor and in JSON/Markdown/Rhai exports.

Fix backend resolution to match either quote:

```rust
for img in &images {
    for quote in ['"', '\''] {
        let pattern = format!("image-id://{}{}", img.id, quote);
        let replacement = format!("data:{};base64,{}{}", img.mime_type, img.data_base64, quote);
        entry.text = entry.text.replace(&pattern, &replacement);
    }
}
```

Fix frontend resolution similarly:

```ts
const pattern = new RegExp(`image-id://${img.id}(?=["'])`, 'g');
```

Add regression tests:

- Backend: save an entry with a single-quoted data URL, call `resolve_image_refs_in_entries`, assert the result contains `data:image/png;base64,...` and no `image-id://`.
- Frontend: `resolveImageRefs("<img src='image-id://1'>", images)` resolves to `data:`.

### 2. Constrain existing image refs to real `<img src=...>` references

Severity: Medium-High

`extract_and_replace_image_refs` scans the whole HTML string for any `image-id://` substring:

- `src-tauri/src/db/queries/images.rs:190-205`

That means regular text like `image-id://123` can become a durable `entry_images` association, and a malformed or user-supplied ref to a nonexistent image can make save fail through the foreign key insert. The Tauri IPC boundary is hostile per `docs/best-practices/TAURI_BEST_PRACTICES.md`; the backend should not treat arbitrary text as a trusted image reference.

Fix by collecting existing refs only from `<img>` tags and only from the `src` attribute. Reuse the current tag scanner instead of a global string scan. A small helper is enough:

```rust
fn extract_src_image_ref(tag: &str) -> Option<i64> {
    for quote in ['"', '\''] {
        let pattern = format!("src={}image-id://", quote);
        let Some(pos) = tag.find(&pattern) else { continue };
        let after = &tag[pos + pattern.len()..];
        let id_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        if !matches!(after[id_str.len()..].chars().next(), Some(q) if q == quote) {
            return None;
        }
        return id_str.parse::<i64>().ok();
    }
    None
}
```

Then collect existing IDs while iterating `<img>` tags, not before the loop. Add tests for:

- Plain text `image-id://1` does not create an `entry_images` row.
- `<img src="image-id://999999">` returns a controlled validation error or drops the invalid ref according to the chosen policy.

### 3. Add export-resolution tests that exercise stored image refs

Severity: Medium

The plan explicitly required JSON, Markdown, and Rhai/plugin export paths to resolve `image-id://` refs before export. The implementation adds the calls in:

- `src-tauri/src/commands/export.rs:37-38`
- `src-tauri/src/commands/export.rs:71-72`
- `src-tauri/src/commands/plugin.rs:112-113`

But current export tests still mostly exercise direct `data:image/...` URLs, not the new stored-ref path. This leaves the most important compatibility contract under-tested.

Add focused tests around `resolve_image_refs_in_entries` and command/plugin export behavior:

```rust
#[test]
fn test_resolve_image_refs_in_entries_replaces_stored_ref() {
    let db = make_db();
    let entry_id = insert_entry_with_text(&db, r#"<p><img src="image-id://1" alt=""></p>"#);
    let image_id = upsert_image(&db, "image/png", b"png-bytes").unwrap();
    assert_eq!(image_id, 1);
    replace_entry_image_links(&db, entry_id, &[image_id]).unwrap();

    let entry = get_entry_by_id(&db, entry_id).unwrap().unwrap();
    let resolved = resolve_image_refs_in_entries(&db, vec![entry]).unwrap();
    assert!(resolved[0].text.contains("data:image/png;base64,"));
    assert!(!resolved[0].text.contains("image-id://"));
}
```

Also add one Markdown export assertion that an entry stored with `image-id://` produces an asset, because `export_entries_to_markdown_with_assets` only sees data URLs after pre-resolution.

### 4. Align the image picker with the plan and frontend accessibility rules

Severity: Medium

The picker works as a basic overlay, but it misses several project frontend conventions from `docs/best-practices/FRONTEND_BEST_PRACTICES.md`:

- The plan says the toolbar button is hidden when the journal has no stored images; `insertExistingImage` is always rendered by `EditorToolbar.tsx:370-380`.
- Escape handling is attached to the overlay, but the overlay is not focusable or focused, so Escape is unreliable (`ImagePickerOverlay.tsx:24-31`).
- The close button has no accessible name and uses a literal `✕` (`ImagePickerOverlay.tsx:36-38`).
- The error message uses raw `text-red-500` and lacks `role="alert"` (`ImagePickerOverlay.tsx:41-43`).

Suggested changes:

```tsx
let dialogRef!: HTMLDivElement;

onMount(() => dialogRef.focus());

<div
  ref={dialogRef}
  tabIndex={-1}
  role="dialog"
  aria-modal="true"
  aria-label={t('editor.imagePicker.title')}
  onKeyDown={handleKeyDown}
>
```

```tsx
<button
  type="button"
  aria-label={t('common.close')}
  onClick={props.onClose}
>
  <X size={16} />
</button>

<p class="text-xs text-error" role="alert">
  {t('editor.imagePicker.error')}
</p>
```

For the no-images button behavior, choose one policy and document it:

- Implement the plan: track whether the journal has stored images and hide/disable the toolbar button until there is at least one.
- Or revise the decision log: keep the button visible and show the empty picker state intentionally.

### 5. Run formatting and commit the resulting frontend style fixes

Severity: Medium

`cmd.exe /c bun run format:check` currently fails for:

- `src/components/layout/editor-panel/useEntryLifecycle.ts`
- `src/components/layout/editor-panel/useMultiEntryNav.ts`
- `src/components/overlays/ImagePickerOverlay.tsx`

This violates the root workflow rule to format after changes. Run:

```powershell
cmd.exe /c bun run format
cmd.exe /c bun run format:check
```

Then rerun at least:

```powershell
cmd.exe /c bun run type-check
cmd.exe /c bun run test:run
```

### 6. Remove or gate the new dead-code warning

Severity: Low-Medium

Backend tests pass, but `cargo test` now emits:

```text
warning: function `open_connection_in_memory` is never used
```

The helper is only used from `#[cfg(test)]` migration tests:

- `src-tauri/src/db/schema/create.rs:24`
- `src-tauri/src/db/schema/migrations/v9_to_v10.rs:47`

Either gate it for tests or justify it explicitly:

```rust
#[cfg(test)]
pub(crate) fn open_connection_in_memory() -> Result<Connection, String> {
    ...
}
```

This keeps normal library builds quiet and preserves the helper for unit tests.

### 7. Consider extracting image HTML parsing helpers before the next image feature

Severity: Low

`src-tauri/src/db/queries/images.rs` is 458 lines, which is above the soft limit for query modules in `docs/best-practices/RUST_BEST_PRACTICES.md`. It is still below the hard limit and cohesive enough for this change, but the HTML scanning helpers are duplicated conceptually with `src-tauri/src/export/markdown.rs`.

Do not split just to reduce line count. If another image-storage or export feature touches this area, extract a small shared module for image-tag scanning and URI/ref parsing so save and export use one parser contract.

## Recommended Fix Order

1. Fix single-quote resolution in backend and frontend, with tests.
2. Add stored-ref export tests for JSON/Markdown/plugin-facing data.
3. Format the changed frontend files and rerun checks.
4. Harden existing-ref parsing to only accept `<img src=...>` refs.
5. Improve picker accessibility and decide the no-images button behavior.
6. Gate the test-only `open_connection_in_memory` helper.

## Review Verdict

The implementation is directionally sound and covers the core storage/security model. I would not merge it as-is because the single-quoted ref bug can produce entries that save successfully but fail to display/export images, and because formatting currently fails a required project check. The remaining issues are contained and fixable without changing the architecture.
