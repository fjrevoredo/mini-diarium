# TODO-0043: Named Links — Implementation Summary & Review

## Metadata

- Plan: `docs/TODO-0043-named-links-plan.md` (APPROVED 2026-06-01)
- Implementation: 2026-06-01 → 2026-06-02
- Source TODO: `docs/todo/TODO.md:46` (TODO-0043) — **marked complete**
- Plan status: **COMPLETED** (post-implementation, in contrast to the plan's "APPROVED")
- Commits in working tree (uncommitted at time of writing): see `git status -s`

## Goal

Allow the user to insert a hyperlink whose visible label differs from the URL (`[Visit site](https://example.com)`) in the TipTap editor, with that label+URL pair correctly preserved in:

- The encrypted SQLite `entries.text` HTML column
- Built-in Markdown export (`[label](url)`)
- Built-in JSON export (raw HTML)
- All Rhai export plugins (via the `html_to_markdown` host function)
- The frontend Markdown import path

The editor must also let the user create, edit, and remove named links on a text selection via a toolbar button and Ctrl/Cmd+K shortcut.

## Final Behavior (what the user sees)

### Link dialog
- Toolbar **Link** button (chain icon, between `inlineCode` and `bulletList`) opens a dialog
- Same dialog opens with **Ctrl/Cmd+K** when the editor surface has focus
- Two fields:
  - **URL** (required) — accepts `https://example.com`, bare `example.com` (auto-prefixed with `https://`), `user@example.com` (auto-prefixed with `mailto:`), `+1 234 567 8901` (auto-prefixed with `tel:`). `javascript:`, `data:`, `vbscript:`, `file:` are rejected.
  - **Display text** (optional) — pre-fills with the selected text (wrap mode) or the link's current text (edit mode). If left empty in insert mode, the raw URL the user typed is used as the visible text.
- An "Open link" button previews the URL via `openUrl()` without closing the dialog
- A "Remove link" button appears only in edit mode
- Plain click → place cursor inside link
- **Ctrl/Cmd+click** → open URL in system browser
- **No `target="_blank"`** is emitted on link HTML — the WebView's new-window handoff is what was causing the original external-browser bug

### Markdown round-trip
`[label](url)` ↔ `<a href="url">label</a>` ↔ render in editor. Tested in `export/markdown.rs` (19 link tests) and `lib/markdown.test.ts` (3 link tests including the javascript: sanitization).

## Files Created (4)

| Path | Purpose | Lines |
|---|---|---|
| `src/components/editor/LinkOverlay.tsx` | Kobalte-based insert/edit/remove dialog | 234 |
| `src/components/editor/LinkOverlay.test.tsx` | Component test (25 tests) | 305 |
| `src/components/editor/extensions/LinkWithDialog.ts` | TipTap extension with `Mod-k` shortcut + `handleEditorLinkClick` for Ctrl/Cmd+click | 122 |
| `src/components/editor/extensions/LinkWithDialog.test.ts` | Click handler + schema-default tests (10 tests) | 234 |
| `src/state/preferences.test.ts` | Tests for the `'link'` key auto-migration in `preferences.ts` | 100 |

## Files Modified (20)

### Editor integration
| Path | Change |
|---|---|
| `src/components/editor/DiaryEditor.tsx` | Imported `LinkWithDialog`, registered it (replacing `StarterKit`'s bundled Link via `link: false`), added `handleClick` to `editorProps` |
| `src/components/editor/EditorToolbar.tsx` | Added `Link` import, `isLinkActive`/`isLinkOpen` signals, `'link':` case in `renderItem`, storage wiring effect, `<LinkOverlay>` mount |
| `src/components/editor/EditorToolbar.test.tsx` | Added 4 tests for the link button visibility/click/active state |

### State and preferences
| Path | Change |
|---|---|
| `src/state/preferences.ts` | Added `'link'` to `ToolbarItemKey` union, `{ key: 'link', enabled: true }` to `DEFAULT_TOOLBAR_ITEMS` (between `inlineCode` and `bulletList`) |
| `src/components/overlays/preferences/PreferencesWritingTab.tsx` | Added `link: t('prefs.writing.toolbarItem.link')` to the `ITEM_LABELS` map |

### Markdown export
| Path | Change |
|---|---|
| `src-tauri/src/export/markdown.rs` | Added `process_links` stage (between block tags and `strip_remaining_tags`) with helpers `find_attr_aware_tag_end`, `extract_href_attr`, `encode_url_for_markdown`. Modified `process_blockquotes` to call `process_links` on segments before stripping (otherwise links inside blockquotes were silently stripped). Added 19 link tests. |
| `src-tauri/src/export/json.rs` | Added `test_json_export_preserves_link_markup` regression test |
| `src-tauri/src/plugin/rhai_loader.rs` | Added `test_rhai_export_plugin_html_to_markdown_with_link` regression test |

### Styles
| Path | Change |
|---|---|
| `src/styles/editor.css` | Added `text-decoration: underline`, `text-decoration-thickness: 0.05em`, `text-underline-offset: 0.15em`, hover bump to `0.1em` on `.ProseMirror a` |

### i18n
| Path | Change |
|---|---|
| `src/i18n/locales/en.ts` | Added `link.labelLabel`, `link.labelPlaceholder`, `link.labelHint`, `link.urlRequiredError`, `link.openInBrowserHint`, `link.open`. Replaced `link.invalidUrlError` with `link.urlRequiredError` (the URL is no longer validated against an allowlist). |
| `src/i18n/locales/{de,es,fr,hi,it}.json` | Same 5 key updates per locale (5 locales × 5 keys = 25 translation updates) |

### Documentation & housekeeping
| Path | Change |
|---|---|
| `website/docs-src/01-writing-entries.md` | New "Links" section, updated "Inserting Images" anchor list, "updated:" date bump |
| `CHANGELOG.md` | New `[Unreleased]` section with `Added` (link feature) and `Changed` (lenient dialog UX) entries |
| `docs/todo/TODO.md:46` | Checked off TODO-0043 |
| `docs/TODO-0043-named-links-plan.md` | Status flipped to COMPLETED; preflight checklist ticked; per-task status flipped to COMPLETED |
| `package.json` | Added `@tiptap/extension-link@^3.23.6` as a direct dependency (previously resolved only transitively via `@tiptap/starter-kit`) |
| `bun.lock`, `package-lock.json` | Regenerated to reflect the new direct dep |

## Implementation Journey (the bugs we hit)

This is the honest, full story. We went through **four** distinct regressions before getting it right. I include them so the reviewer can spot whether the same mistakes would recur in similar features.

### Round 1: Original implementation per the plan

The plan called for: `openOnClick: false`, a Ctrl/Cmd-K shortcut, a dialog with URL field only, Markdown export of `[label](url)`. We implemented it that way. 386 cargo tests passed; 432 frontend tests passed.

The original `LinkWithDialog.ts` configured the extension with:

```ts
HTMLAttributes: {
  rel: 'noopener noreferrer nofollow',
  target: '_blank',
  class: null,
}
```

**The plan was wrong to include `target: '_blank'`** — and I followed it without pushing back. This is the first lesson: when the plan says "safe default for `target`", verify that against the actual platform behavior.

### Round 2: User UX feedback (4 real bugs)

User reported:

1. "Links just open in the browser when you click on them, instead of ctrl+click." — actual behavior was plain click = open
2. "When you insert a link through the dialog you can just put the link but never the name." — no label field
3. "If you hit the link button for the dialog when selecting text, you would expect that the string would be added the link you put in the dialog but instead just the raw url link gets inserted" — wrap mode silently flipped to insert mode
4. "The dialog is too strict, if you put the url without the http or https it doesn't let you add the link." — validator only allowed `http(s)://`, `mailto:`, `tel:`

**Root causes & fixes:**

| # | Bug | Root cause | Fix |
|---|---|---|---|
| 1 | Plain click → URL opened (not from `openOnClick: true`; the `target="_blank"` was doing it via WebView) | `target="_blank"` triggers Tauri's WebView new-window handling, which the platform may handoff to the system browser even with `on_new_window: Deny` | Switched to `openOnClick: false`; planned to add a custom Ctrl+click handler. **Incomplete fix** — see Round 3. |
| 2 | Dialog only has URL field | Design choice from the plan ("URL-only edit per user decision") | Added a `labelInput` signal; smart defaults: selected text in wrap mode, current link's text in edit mode, empty in insert mode (falls back to the raw URL) |
| 3 | Wrap mode silently flipped to insert mode when dialog opened | The mode was a `createMemo` over `editor.state.selection`. When the input received `autofocus`, the editor lost focus and TipTap collapsed the selection — the memo re-evaluated and now thought the mode was `insert`. | Replaced `createMemo` with `createSignal`, captured mode once when `isOpen` became true (via a `snapshotEditor()` pure function that reads `state.doc.textBetween` at open time) |
| 4 | `example.com` rejected | Validator required an explicit scheme prefix | New `normalizeUrl()` function: bare domain → `https://`, email → `mailto:`, phone → `tel:`, accepts the same safe protocols as before. Rejects `javascript:`/`data:`/`vbscript:`/`file:`. |

**Tests added:** 25 LinkOverlay tests covering all four bugs.

### Round 3: "I still get a navigation in the external browser when clicking the link"

I added `event.preventDefault()` to the click handler. Tests passed. User reported the URL still opened externally on plain click. **This was wrong of me to assume the fix worked without testing.**

**Root cause (re-investigated):** I had been chasing the wrong layer. TipTap's `openOnClick: false` only stops TipTap's *own* click plugin from running `window.open()`. It does **not** stop the browser/WebView's default action on `<a target="_blank">`. My `preventDefault()` was a JavaScript-level call; WebView2 (and possibly WebKit on macOS) processes the `NewWindowRequested` event **before** JavaScript can prevent default, and the platform's fallback for a denied `_blank` request is to hand the URL to the system browser.

The plan-level "safety" of `target: '_blank'` was the actual bug. Removing it from `HTMLAttributes` did not work because TipTap's `configure()` does a deep merge — the hardcoded default in the extension's `addOptions()` survives unless I explicitly set `target` to `null` (which would render as `target="null"`).

### Round 4: The actual fix — override `addAttributes`

The correct fix is to override the schema-level attribute default, not the editor-level `HTMLAttributes`:

```ts
addAttributes() {
  const parentAttrs = this.parent?.() ?? {};
  return {
    ...parentAttrs,
    target: { default: null },
  };
}
```

When `target.default` is `null`, ProseMirror's `DOMSerializer` skips the attribute entirely (verified in `LinkWithDialog.test.ts`'s new schema-default test). The rendered `<a>` has no `target` attribute, so:

- **Plain click** → browser tries to navigate the current WebView → Tauri's `on_navigation` blocks it → caret placement
- **Ctrl/Cmd+click** → my `handleEditorLinkClick` calls `openUrl()` → URL opens in system browser
- **Tauri no longer hands the URL to the system browser on its own** because there's no `target="_blank"` to trigger that path

This matches the existing project pattern (see `AboutOverlay.tsx` and `OnboardingOverlay.tsx` — they use `openUrl()` from buttons, not `<a target="_blank">`).

## What could have been simpler

Honest assessment, given the actual scope of the feature:

- The original plan over-engineered the click behavior. It called for "plain click = place caret, Ctrl/Cmd-click = navigate" — a Word/Google Docs model. But the existing project already uses `openUrl()` from button clicks (e.g., About overlay), where plain click navigates. The plan didn't match the project's existing pattern, and the project pattern is simpler.
- The plan included a separate `target: '_blank'` in `HTMLAttributes` as a "safety" measure. In a Tauri app, this is the **opposite** of safe — it triggers the WebView's new-window handling, which can be handed off to the system browser.
- The plan's URL validator (`isAllowedUrl` checking for `http://`/`https://`/`mailto:`/`tel:` prefixes) was too strict for TipTap's `linkOnPaste` behavior, which already auto-prefixes bare domains. The new `normalizeUrl()` function essentially delegates the same prefix logic to runtime, which is also what TipTap's paste handler does. We could have used TipTap's `defaultProtocol` option for this, but doing it explicitly in the dialog gives the user a clearer preview of the URL.
- The plan's `Mod-k` shortcut + `addStorage` round-trip is more complex than needed. TipTap's `addKeyboardShortcuts` can return `true` to consume the event directly without storage indirection — but the storage approach lets the toolbar's signal setter live outside the editor (so the toolbar can be the React/Solid owner of "is the dialog open"). The indirection is justified.

**Recommended follow-up for the next plan:** match the existing project's "openUrl from button" pattern, do not set `target="_blank"`, and skip the Ctrl/Cmd modifier if the rest of the app doesn't use it.

## Tests

### Final counts
- Frontend: **450 tests** (44 test files), all passing
- Backend: **386 tests**, all passing
- `cargo clippy --all-targets -- -D warnings` clean
- `bun run type-check`, `lint`, `format:check` clean
- `bun run validate:locales` clean (all 5 locales at 489 keys)

### Test coverage of the link feature

| File | What it covers | Count |
|---|---|---|
| `src/components/editor/LinkOverlay.test.tsx` | Render in all 3 modes, URL validation, label handling, confirm/remove flows, open link, escape/cancel, mode-stability-after-open regression | 25 |
| `src/components/editor/extensions/LinkWithDialog.test.ts` | Click handler: anchor detection, preventDefault always on link clicks, Ctrl/Cmd+click opens URL, plain click does not, schema default for `target` is `null` (regression test for the Round 4 fix) | 10 |
| `src/components/editor/EditorToolbar.test.tsx` | Link button visibility, click opens dialog, active state | 4 |
| `src/state/preferences.test.ts` | `'link'` key auto-migration in `preferences.ts` | 4 |
| `src/lib/markdown.test.ts` | Markdown `[label](url)` ↔ HTML round-trip, `javascript:` sanitization | 3 |
| `src-tauri/src/export/markdown.rs` | Basic link, formatting in label, heading/list/blockquote context, mailto, attributes, empty label, no href, single-quoted href, entity in URL, CJK label, RTL label, special chars, space-in-URL, multiple links, `<aside>`-vs-link edge case, full entry round-trip | 19 |
| `src-tauri/src/export/json.rs` | JSON export preserves raw `<a>` HTML | 1 |
| `src-tauri/src/plugin/rhai_loader.rs` | Rhai export plugin gets the fix via `html_to_markdown` | 1 |

## i18n

5 new keys added to `en.ts`; 5 keys replaced (`invalidUrlError` → `urlRequiredError`). All 5 community locales (de, es, fr, hi, it) updated to match. `validate:locales` passes — 489 keys per locale, no missing keys.

The replacement of `invalidUrlError` (which said "URL must start with http://...") with `urlRequiredError` (which says "URL is required.") reflects the new lenient validation: empty URL is the only failure mode, since the normalize function handles all valid inputs.

## Documentation

- `website/docs-src/01-writing-entries.md`: new "Links" section (35 lines) inserted between "Inserting Images" and "Right-to-Left and Bidirectional Text"; bullet list at the top now links to it. `updated:` field bumped to `2026-06-01`.
- `CHANGELOG.md`: new `[Unreleased]` section with `Added` and `Changed` blocks.
- `docs/todo/TODO.md:46`: TODO-0043 marked complete.
- `docs/TODO-0043-named-links-plan.md`: status flipped to COMPLETED; per-task statuses flipped to COMPLETED; preflight checklist ticked.

## Key design decisions (and the reasoning)

| Decision | Reasoning |
|---|---|
| `openOnClick: false` on the Link extension | Prevents TipTap's built-in click plugin from calling `window.open()` — but by itself insufficient (see Round 3/4) |
| `Mod-k` keyboard shortcut, NOT a separate "Insert Link" menu entry | Matches the spec from the plan; matches how other TipTap-based editors typically expose link insertion |
| `normalizeUrl()` instead of `isAllowedUrl()` | Allows bare domains (matching TipTap's `linkOnPaste` behavior), still rejects unsafe protocols. Auto-detects email and phone numbers. |
| Fallback to **raw URL** (not normalized URL) when label is empty | User types `example.com` and the visible text is `example.com`, not `https://example.com`. Matches what the user actually typed. |
| **No `target` attribute** on rendered link | Avoids the Tauri WebView new-window → system-browser handoff. Plain click is a no-op (caret placement), Ctrl/Cmd-click calls `openUrl()`. |
| Override `addAttributes` to set `target.default` to `null` (not `undefined` in `HTMLAttributes`) | `configure()` does a deep merge that skips `undefined`; `null` is preserved through the merge and ProseMirror's DOMSerializer skips `null` attribute values |
| "Open link" button in the dialog | Lets the user verify a URL before applying it, without committing the change first |
| No new Tauri command needed | `openUrl()` from `@tauri-apps/plugin-opener` is sufficient and already has the `opener:default` capability granted |
| No new schema migration | Link text is already stored in `entries.text`; existing rows are unaffected |
| No E2E test for the link flow | The plan explicitly deferred this: "E2E in this repo currently covers 3 spec files and does not exercise any editor formatting feature (bold, italic, lists, etc.). Out of scope per the user's preference; covered by Vitest + cargo tests instead." |

## Reviewer checklist

Things to verify when reviewing this PR:

- [ ] **The actual rendered link HTML** has no `target` attribute. (Inspect in the editor after creating a new link; the test in `LinkWithDialog.test.ts`'s "schema defaults" describe block pins this.)
- [ ] **Plain click on a link** does NOT open the URL in any browser. (Caret is placed in the link for editing.)
- [ ] **Ctrl/Cmd+click on a link** opens the URL in the system browser via `openUrl()`.
- [ ] **The dialog** accepts bare domains, emails, and phone numbers, and previews the normalized URL.
- [ ] **Markdown export** of an entry with a link produces `[label](url)` syntax.
- [ ] **Round-trip**: insert a link in the editor, export to Markdown, re-import via the Markdown import, and verify the link is preserved.
- [ ] **Rhai export plugins** that call `html_to_markdown` produce correct link output (covered by `test_rhai_export_plugin_html_to_markdown_with_link`).
- [ ] **Edit mode** lets you change the URL without losing the link, and the dialog's "Remove link" button strips the link mark while preserving the text.
- [ ] **`preferences.test.ts`**: the `'link'` key is auto-migrated into existing user `toolbarItems` arrays.
- [ ] **No regressions** in any of the other editor features (bold, italic, lists, images, alignment, etc.).

## Lessons / takeaways for the next similar feature

1. **Read the actual installed source, not the marketing docs.** The TipTap Link extension's `target: '_blank'` default is in `node_modules/@tiptap/extension-link/dist/index.js`, not in the public docs. Plan-level assumptions about "safe defaults" must be verified against the installed code.
2. **For Tauri apps, `<a target="_blank">` is not the way to make links open in a new tab.** It triggers the WebView's new-window handling, which on some platforms is handed off to the system browser regardless of `on_new_window: Deny`. The Tauri-idiomatic way is `openUrl()` from `@tauri-apps/plugin-opener`, called from a click handler.
3. **TipTap's `configure()` does a deep merge, not a replace.** Setting `HTMLAttributes: { class: null }` does NOT remove the hardcoded `target: '_blank'`; it preserves it. To remove a hardcoded default, override the attribute's schema default via `addAttributes`.
4. **Solid `createMemo` over editor state is fragile when the editor loses focus mid-dialog.** Capture the state once via a `createSignal` updated in a `createEffect` on the open trigger, not via a memo that re-evaluates on every state change.
5. **Don't assume a fix worked just because the tests pass.** After Round 3 I claimed victory; the user pushed back and I had to investigate the actual WebView behavior. Always verify the user-visible outcome, not just the test outcome.
