# Implementation Review: TODO-0043 Named Links

**Scope:** commits e9a66f5 and 539fb3e (branch `feature-v0.5.3`)
**Reviewer:** Claude Sonnet 4.6
**Date:** 2026-06-02

---

## Verdict

The implementation is **functionally correct and ships the right feature**. The backend (`process_links` stage) is well-structured and appropriately sized for the existing pipeline. The two main issues are (1) a correctness regression in the frontend's apply logic that the tests codify rather than catch, and (2) unrelated files included in the first commit.

---

## What Is Good

**`addAttributes()` override** (`LinkWithDialog.ts:47-53`) — Overriding the schema-level default for `target` to `null` (rather than fighting TipTap's deep-merge `configure()`) is the correct idiomatic fix. The comment explains *why* precisely enough that a future TipTap upgrade that re-introduces the default would be caught by the pinning test.

**`snapshotEditor()` pure function** (`LinkOverlay.tsx:19-39`) — Capturing mode, URL, and label once at dialog-open time (rather than as a reactive memo over editor state) is the right pattern. The motivation is explicit in the comment: autofocus steals editor focus, which causes TipTap to collapse the selection mid-dialog. This fix is correct and the pattern is reusable.

**`handleEditorLinkClick` export** (`LinkWithDialog.ts:80-103`) — Clean separation of the click handler from the extension definition. The blanket `preventDefault` on any anchor click is defensible belt-and-suspenders: Tauri's `on_navigation` guard would catch navigation anyway, but the JS-level prevent is the earlier, less-surprising stop.

**`process_links` stage** (`markdown.rs:313-371`) — Consistent with the existing state-walker pattern (`process_blockquotes`, `process_code_blocks`). The three helpers (`find_attr_aware_tag_end`, `extract_href_attr`, `encode_url_for_markdown`) are each single-responsibility and less than 20 lines. The blockquote-path fix (calling `process_links` before `strip_remaining_tags` on blockquote segments) is necessary and correctly placed.

**Test coverage** — The 19 backend link tests are comprehensive. Non-ASCII label coverage (CJK, RTL) follows the project durability rule. The `<aside>` disambiguation test (`test_html_to_markdown_link_does_not_match_aside`) is a sharp edge-case catch. The schema-default pin test in `LinkWithDialog.test.ts:208-216` is exactly the right regression guard for the `target="_blank"` fix.

---

## Issues

### Issue 1 — Edit and wrap-selection modes destroy inline formatting (correctness)

**Severity:** Medium — affects any link whose label text contains bold, italic, strikethrough, or inline-code marks.

**Where:** `LinkOverlay.tsx:139-177` (`applyLink` function).

All three modes now use the same `deleteSelection().insertContent({ type: 'text', text: label, marks: [link] })` chain. `insertContent` with a plain `text` node type carries only the marks listed in its `marks` array. Any existing marks on the original text (bold, italic, etc.) are not carried forward.

- **Edit mode** (`LinkOverlay.tsx:139-153`): the plan promised "ProseMirror preserves the link's existing text label because only the mark's `href` attribute changes." This is only true if you use `setLink({ href })`, which adds the link mark to existing nodes without touching their content. The delete+insert path replaces the node entirely with a plain text node, dropping all other marks.
- **Wrap-selection mode** (`LinkOverlay.tsx:154-165`): the plan explicitly stated "existing inline marks (bold, italic, etc.) on the selection are preserved." They are not.

**The wrap-selection tests codify the regression.** `LinkOverlay.test.tsx:258-282` ("wraps selected text with the link mark on confirm in wrap-selection mode") opens the dialog with the label pre-filled from `selectionText: 'Hello'`, the user only types a URL — label unchanged — then the test expects `deleteSelection` to be called. Because the mock chain does not construct actual ProseMirror nodes, no formatting loss is observable in the test, and it passes. The mode-stability test at lines `:200-207` has the same structure.

The edit mode test at `:309-338` is different: the user changes the label from `'Old label'` to `'New label'` — this is a legitimate label-change scenario where `deleteSelection+insertContent` is the correct behavior. The regression for edit mode (user changes only the URL, label stays the same) is simply **not tested**.

**Remediation:**

Add a signal to track the initial label at snapshot time. Split the apply path on whether the label actually changed:

```ts
// LinkOverlay.tsx — applyLink(), edit mode
if (currentMode === 'edit') {
  if (trimmedLabel() === initialLabel()) {
    // URL only changed: setLink preserves existing formatting inside the link text
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  } else {
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .deleteSelection()
      .insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] })
      .run();
  }
}
```

Apply the same split to `wrap-selection` mode:

```ts
} else if (currentMode === 'wrap-selection') {
  if (trimmedLabel() === initialLabel()) {
    // Text unchanged: apply the mark to the existing selection (preserves bold, etc.)
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  } else {
    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] })
      .run();
  }
}
```

`initialLabel` can be stored as a signal alongside `labelInput`, set in the same `createEffect` that calls `snapshotEditor()`.

Update `LinkOverlay.test.tsx`:
- For the wrap-selection unchanged-label test (lines 258-282): change the assertion from `deleteSelection` to `setLink({ href })` and remove the `insertContent` expectation.
- Add a new edit mode test: URL-only change (label unchanged) → expects `setLink`, not `deleteSelection`.
- The existing edit mode test at 309-338 (label changed) stays as-is — it tests the correct delete+insert path.

---

### Issue 2 — Unrelated files included in commit e9a66f5

**Severity:** Low (no functional impact, but pollutes git history).

`docs/todo-0042-font-system-implementation.md` (257 lines) and `mini-diarium.com_FailingUrls_5_31_2026.csv` (12 lines) are present in the `feature-v0.5.3` diff. Neither file has any relation to the named-links feature. They should be moved to a separate commit or kept out of this branch.

**Remediation:** Before merging, move these two files to their own isolated commit so `git log -- src/components/editor/LinkOverlay.tsx` returns only link-related changes.

---

### Issue 3 — Test name misleads about URL encoding strategy (documentation)

**Severity:** Negligible — no behavioral impact.

`test_html_to_markdown_link_with_space_in_url_wraps_in_angle_brackets` (markdown.rs) asserts `[spaced](https://example.com/a%20b)`, but the name says "wraps in angle brackets." The implementation percent-encodes instead of angle-bracket-wraps (the rationale is in the `encode_url_for_markdown` doc comment: angle-bracket wrapping would conflict with `strip_remaining_tags` running downstream). Rename the test to `test_html_to_markdown_link_with_space_in_url_percent_encodes`.

---

### Issue 4 — `ftp`/`ftps` in `normalizeUrl` allowlist (minor)

**Severity:** Negligible.

`normalizeUrl` (`LinkOverlay.tsx:52`) allows `ftp` and `ftps` protocols. A personal encrypted journal app has essentially no legitimate use case for FTP links. The protocols add test surface without adding real user value. Remove them from the array.

---

## Code Complexity Assessment

**Frontend:** The `applyLink` function at 55 lines is on the long side, but the length comes from the three distinct modes (one per branch). With the formatting-preservation fix above, edit/wrap modes gain an inner conditional but no new concepts. The `normalizeUrl` and `snapshotEditor` functions are focused and appropriately sized.

**Backend:** `process_links` (58 lines) + three helpers (15/12/10 lines) = 95 lines of new logic for a non-trivial HTML parsing stage. This is commensurate with the task. The 19 tests (194 lines) are proportionate given the number of edge cases (entity encoding, attribute variants, nested contexts, multi-link paragraphs, non-ASCII labels). Nothing here warrants a simplification pass.

---

## Remediation Plan

| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 1 | Store `initialLabel` as a signal; split `applyLink` edit/wrap paths on label-changed vs. URL-only | `LinkOverlay.tsx` | ~20 lines |
| 2 | Update wrap-selection unchanged-label test (258-282) to expect `setLink`; add URL-only-change test for edit mode | `LinkOverlay.test.tsx` | ~20 lines |
| 3 | Isolate unrelated files into their own commit | git | trivial |
| 4 | Rename `test_html_to_markdown_link_with_space_in_url_wraps_in_angle_brackets` | `markdown.rs` | 1 line |
| 5 | Remove `ftp`/`ftps` from `normalizeUrl` allowlist | `LinkOverlay.tsx:52` | 1 line |

Items 3-5 are housekeeping. Item 1+2 is the only correctness fix; prioritize before merging to master.
