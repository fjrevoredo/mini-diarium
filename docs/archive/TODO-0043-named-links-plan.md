# TODO-0043: Named links (hyperlinks with custom display text) — Implementation Plan

## Metadata

- Plan Status: COMPLETED
- Created: 2026-06-01
- Last Updated: 2026-06-01
- Owner: Coding agent
- Approval: APPROVED (2026-06-01)
- Source TODO: `docs/todo/TODO.md:46` (TODO-0043)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Allow the user to insert a hyperlink whose visible label differs from the URL (`[Visit site](https://example.com)`) in the TipTap editor, with that label+URL pair correctly preserved in:

- The encrypted SQLite `entries.text` HTML column (round-trip on save/reload).
- Built-in Markdown export (standard `[label](url)` syntax).
- Built-in JSON export (raw TipTap HTML — already works, only tests needed).
- All Rhai export plugins (via the `html_to_markdown(text)` host function — auto-fixes once the Rust converter is updated).
- The frontend Markdown import path (already works; verified).

The editor must also let the user **create**, **edit**, and **remove** named links on a text selection via the toolbar, and let the user **open a link in the system browser** with Ctrl/Cmd-click.

## Scope

- Add a **Link button** to the editor toolbar (configurable item, enabled by default in `DEFAULT_TOOLBAR_ITEMS`).
- Add a **`LinkOverlay` dialog** (modeled on `TimestampOverlay`) that lets the user:
  - Insert a new link with the URL as the label when no text is selected (URL-only input).
  - Apply a link to a non-empty text selection (the selected text becomes the label; URL is the only input).
  - Edit the URL on an existing link.
  - Remove a link from the current selection / cursor position.
- Add a **Ctrl/Cmd-K keyboard shortcut** that opens the dialog.
- Wire the dialog to TipTap's `Link` extension (already bundled with `StarterKit` v3.23.6) with the following config:
  - `openOnClick: false` — plain click is for editing; Ctrl/Cmd-click opens in system browser.
  - `linkOnPaste: true`, `autolink: true` — keep TipTap defaults for natural URL handling.
  - A custom ProseMirror plugin (or `addKeyboardShortcuts` hook) that opens the system browser via `openUrl()` from `@tauri-apps/plugin-opener` on Ctrl/Cmd-click.
- Fix the **Rust Markdown export** to emit `[label](url)` for `<a href="...">label</a>` rather than silently dropping the URL.
- Add **CSS underline** for `.ProseMirror a` (currently the only style is the link color; underlines improve affordance).
- Update the **`writing-entries`** docs page to document Insert Link UX, the Ctrl/Cmd-click shortcut, and Markdown round-trip.
- Add **Vitest + cargo tests** for: overlay UX, toolbar wiring, Markdown export conversion (basic link, link with formatting in label, link with title attribute, link in heading, link in list, link in blockquote, autolink, link without href).
- Add the new toolbar item to the `link` key, with auto-migration via the existing `preferences.ts:107-113` append-missing-keys logic (no manual migration step needed).

## Non-Goals

- Inline image-with-link wrapping (already works because Link and Image marks can coexist; no explicit UX needed — users select the image, then click the Link button; not tested in this work).
- Floating bubble / link popover toolbar (Notion-style). The dialog is sufficient and matches the existing dialog pattern.
- Visual link editor inside the dialog (rich text in label). The label is not editable in the dialog — the URL is the only structured field. To change a link's label, the user must remove the link and re-insert with new text. This matches Notion / Google Docs.
- Markdown export of link `title` attributes. The TipTap default HTML emits no `title` attribute; if one is set via the `setLink` API it will be lost in Markdown (acceptable — Markdown `[label](url "title")` syntax is rarely used; can be added later if requested).
- A new schema migration. The `text` column is already raw HTML; existing rows are unaffected.
- E2E WebdriverIO tests for the link flow. E2E in this repo currently covers 3 spec files and does not exercise any editor formatting feature (bold, italic, lists, etc.). Out of scope per the user's preference; covered by Vitest + cargo tests instead.
- Full Rhai plugin API change. Plugins already receive `text` as raw HTML and get the fix for free via the `html_to_markdown` host function update.

## Assumptions

- **`@tiptap/extension-link@^3.23.6` must be added as a direct dependency** in `package.json` (per the AGENTS.md policy: "NEVER assume that a given library is available... first check that this codebase already uses the given library"). It currently resolves only as a transitive dependency of `@tiptap/starter-kit@^3.23.6` (verified at `node_modules/@tiptap/starter-kit/dist/index.js:60-62` and `package-lock.json:4018-4033`), so the implementation would technically work without the `package.json` entry — but the explicit dep makes the import contract durable across future lockfile reshuffles. Both `bun.lock` and `package-lock.json` must be regenerated after the `package.json` change (per the dependency checklist in `AGENTS.md`).
- **The existing `preferences.ts:107-113` migration logic** will auto-append the new `link` key to any existing user's `toolbarItems` array. No separate migration is required.
- **JSON export needs no code change** — it writes raw HTML from the `entries.text` field, which already contains the `<a href="...">label</a>` markup. Only a round-trip test is needed.
- **Markdown import (frontend, `src/lib/markdown.ts`)** already produces `<a href>` via `marked` + DOMPurify, and the Link extension is in the editor schema, so the import path already works end-to-end. A test will lock this in.
- **The `on_navigation` handler in `src-tauri/src/lib.rs:234-245`** silently blocks any external URL navigation. With `openOnClick: false` and a Ctrl/Cmd-click handler that calls `openUrl()` from `@tauri-apps/plugin-opener`, no link click will hit this guard.
- **The `opener:default` capability** is already in `src-tauri/capabilities/default.json:9`. No capability change is required.
- **The `link` CSS class** on `.ProseMirror a` in `src/styles/editor.css:118-120` is the only existing link style. Adding `text-decoration: underline` (with a hover state) is the minimum to make links visually obvious.
- **Rhai plugin sandbox** receives the new behavior automatically because every export plugin that calls the `html_to_markdown` host function (`src-tauri/src/plugin/rhai_loader.rs:82-84`) goes through the Rust converter. No Rhai API or test changes required.
- **No new Tauri command is required.** The existing `save_entry` command persists the editor's `text` field unchanged.

## Open Questions

None. All UX and scope decisions confirmed with the user in the planning round (2026-06-01):

1. **Click behavior** — Ctrl/Cmd-click opens link in system browser via `openUrl()`.
2. **Autolink behavior** — Keep `linkOnPaste: true` and `autolink: true` (TipTap defaults).
3. **Toolbar default** — Insert Link button enabled by default in `DEFAULT_TOOLBAR_ITEMS`.
4. **Keyboard shortcut** — Ctrl/Cmd-K opens the dialog.
5. **Docs update** — Yes, update `website/docs-src/01-writing-entries.md`.
6. **E2E scope** — No E2E tests; unit + integration coverage only.
7. **Direct dependency** — Add `@tiptap/extension-link@^3.23.6` to `package.json`; regenerate both lockfiles.
8. **Toolbar position** — After `inlineCode` in the inline formatting group.
9. **No-selection behavior** — URL input is required; the URL itself becomes the link label.
10. **Editing existing link** — URL-only edit; label is not editable in the dialog.

## Milestones

### Milestone 1: Editor — Configure Link extension, add toolbar button, build LinkOverlay

- Status: COMPLETED
- Purpose: Give the user a working UI to create, edit, and remove named links inside the editor, with Ctrl/Cmd-K shortcut and Ctrl/Cmd-click open-in-browser. This is the user-visible surface of the feature.
- Exit Criteria:
  - `npm run type-check` passes.
  - `npm run lint` passes.
  - `npm run test:run` passes including the new `LinkOverlay.test.tsx` and updated `EditorToolbar.test.tsx`.
  - Manual: open the editor, place the cursor with no selection, click the Link button, type a URL, confirm — a link with the URL as the label is inserted at the cursor. Select some text, click the Link button, type a URL, confirm — the selection becomes a link with the original text as the label. Place the cursor on an existing link, click the Link button, change the URL, confirm — only the href updates, the label text is unchanged. Click Remove — the link mark is removed, the text remains. Press Ctrl/Cmd-K with the editor focused and confirm the dialog opens. Ctrl/Cmd-click a link and confirm the system browser opens with the URL.
  - Toolbar button appears by default in `preferences.toolbarItems` and is also listed in the Preferences → Writing → Toolbar items list with the new "Link" label.

#### Task 1.1: Configure the Link extension in DiaryEditor

- Status: COMPLETED
- Objective: The Link extension is registered in the editor with `openOnClick: false`, a custom click handler that opens the system browser on Ctrl/Cmd-click, and a Ctrl/Cmd-K keyboard shortcut that opens `LinkOverlay` (the open signal is set from a parent-controlled store, similar to `isTimestampOpen`).
- Steps:
  1. In `src/components/editor/DiaryEditor.tsx:162-181`, add an import for `Link` from `@tiptap/extension-link` and `openUrl` from `@tauri-apps/plugin-opener`.
  2. Create an extended Link instance in the same file (or a new `src/components/editor/extensions/LinkWithDialog.ts` if a separate file reads better) that:
     - Declares an `addStorage()` returning `{ openLinkDialog: () => {} }`.
     - Declares an `addKeyboardShortcuts()` returning `{ 'Mod-k': () => { (this.storage as { openLinkDialog: () => void }).openLinkDialog(); return true; } }`.
     - Configures `openOnClick: false`, `autolink: true`, `linkOnPaste: true`, and `HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank', class: null }` (the `class: null` is the TipTap default and must be re-declared because `mergeAttributes` would otherwise inherit it from the editor; the actual default is `null` per the extension source).
  3. Add the extended Link instance to the `extensions` array in place of StarterKit's bundled Link. The StarterKit's `link` option must be set to `false` to prevent double-registration: `StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false })`.
  4. Add `editorProps.handleClick(view, pos, event)` to the `Editor` constructor that intercepts clicks on `<a>` elements. When the click has `event.metaKey || event.ctrlKey` set and `event.target.closest('a')` has a non-empty `href`, call `event.preventDefault()` and `openUrl(href)`, then return `true` to consume the event. For all other clicks, return `false` so ProseMirror's default cursor placement runs.
- Validation: `npm run type-check` passes; manual open the dev app, place cursor on text, press Ctrl/Cmd-K, confirm the LinkOverlay dialog opens. Ctrl/Cmd-click a link and confirm the system browser launches the URL.
- Notes: **`@tiptap/extension-link@^3.23.6` must be added as a direct dependency** to `package.json` per the AGENTS.md policy, even though it currently resolves transitively via `@tiptap/starter-kit@^3.23.6`. Run `cmd.exe /c bun install` and `cmd.exe /c npm install --package-lock-only --legacy-peer-deps` to regenerate both `bun.lock` and `package-lock.json`. The `openUrl` import from `@tauri-apps/plugin-opener` is already a project dep (used in `AboutOverlay.tsx:4`, `NotificationsOverlay.tsx:3`, and the preferences dialog). The storage object is owned by the extended `Link` instance and is set by the toolbar in Task 1.4.

#### Task 1.2: Add `link` to ToolbarItemKey and DEFAULT_TOOLBAR_ITEMS

- Status: COMPLETED
- Objective: The new `link` key is recognized in user preferences, and existing users get it auto-appended to their `toolbarItems` via the existing migration in `preferences.ts:107-113`.
- Steps:
  1. In `src/state/preferences.ts:8-25`, add `'link'` to the `ToolbarItemKey` union.
  2. In `src/state/preferences.ts:32-50`, add `{ key: 'link', enabled: true }` to `DEFAULT_TOOLBAR_ITEMS`. Place it immediately after `{ key: 'inlineCode', enabled: true }` and before `{ key: 'bulletList', enabled: true }` (inline formatting group, between `inlineCode` and the list block). This groups the link with the other inline marks (underline, strikethrough, inlineCode) for visual cohesion.
  3. Verify the migration at `src/state/preferences.ts:107-113` automatically appends `link` to existing user `toolbarItems` on first load. No code change needed there.
- Validation: `npm run test:run` passes; add a unit test in `src/state/preferences.test.ts` (create if missing) that loads a stored `toolbarItems` array without `link` and asserts it is appended with `enabled: true`.
- Notes: The migration logic uses `Set` membership and the `DEFAULT_TOOLBAR_ITEMS` order, so the new entry's position in the array is the position from `DEFAULT_TOOLBAR_ITEMS`.

#### Task 1.3: Build `LinkOverlay` component

- Status: COMPLETED
- Objective: A Kobalte `Dialog` (matching the `TimestampOverlay` pattern at `src/components/editor/TimestampOverlay.tsx`) that lets the user create, edit, or remove a named link on the current selection.
- Steps:
  1. Create `src/components/editor/LinkOverlay.tsx` modeled on `TimestampOverlay.tsx` (147 lines). The component props are `{ editor: Editor | null; isOpen: boolean; onClose: () => void }`.
  2. Add a single signal:
     - `urlInput: string` — initialized to `editor.getAttributes('link').href` when the dialog opens and the cursor is on a link, else `''`.
  3. On open (`createEffect(() => { if (props.isOpen) { /* refresh urlInput from editor */ } })`), reset `urlInput` from the editor.
  4. Compute a `mode` value: `'edit' | 'wrap-selection' | 'insert'`:
     - `'edit'` when `editor.isActive('link')`.
     - `'wrap-selection'` when `!editor.isActive('link')` and `editor.state.selection.from !== editor.state.selection.to` (non-empty selection).
     - `'insert'` when no selection and not on a link.
  5. **URL-only edit (per user decision)**: The label is never editable in the dialog. The dialog title and confirm button label vary by mode:
     - `'edit'` → title "Edit link", button "Update".
     - `'wrap-selection'` → title "Add link", button "Apply".
     - `'insert'` → title "Insert link", button "Insert".
  6. Show a Remove button only in `'edit'` mode.
  7. On confirm:
     - `'edit'` mode: `editor.chain().focus().extendMarkRange('link').setLink({ href: urlInput }).run()`. ProseMirror preserves the link's existing text label because only the mark's `href` attribute changes.
     - `'wrap-selection'` mode: `editor.chain().focus().extendMarkRange('link').setLink({ href: urlInput }).run()`. The selected text becomes the link label; existing inline marks (bold, italic, etc.) on the selection are preserved.
     - `'insert'` mode: insert a new text node with the link mark, using the URL itself as the label: `editor.chain().focus().insertContent({ type: 'text', text: urlInput, marks: [{ type: 'link', attrs: { href: urlInput } }] }).run()`. This matches Word / Google Docs / Notion — one click inserts a clickable URL with the URL as the visible label.
  8. Validate `urlInput` is a non-empty string and starts with `http://`, `https://`, `mailto:`, or `tel:` (the Link extension's `isAllowedUri` validator already does this server-side, but pre-validate so the user sees a friendly error). Display the inline error and disable the confirm button when invalid.
  9. On Remove: `editor.chain().focus().extendMarkRange('link').unsetLink().run()`.
  10. On Escape: `props.onClose()`.
  11. Add the buttons (Cancel, Remove (conditional), Insert/Update) using the same styling as `TimestampOverlay.tsx:104-141`.
  12. Add `data-testid` attributes: `link-url-input`, `link-remove-button`, `link-confirm-button`.
- Validation: `npm run type-check` passes; manual test the four flows: (a) no selection → type URL → confirm → link with URL as label is inserted at cursor; (b) text selected → type URL → confirm → selection becomes a link with the original text as label; (c) cursor on existing link → dialog opens with current URL → change URL → confirm → only the href updates, label text is unchanged; (d) cursor on link → click Remove → mark removed, text remains.
- Notes: The `editor.commands.setLink` API requires a non-empty `href` (returns false otherwise). For label creation, prefer extending the existing selection with the mark over deleting-and-reinserting; this preserves formatting inside the selection (bold, italic, etc.) on the link label.

#### Task 1.4: Wire the toolbar button and Ctrl/Cmd-K shortcut

- Status: COMPLETED
- Objective: A new toolbar button (icon: `Link` from `lucide-solid`, matching the existing import block at `EditorToolbar.tsx:18-39`) opens `LinkOverlay`. `Ctrl/Cmd-K` does the same from anywhere in the editor.
- Steps:
  1. In `src/components/editor/EditorToolbar.tsx:18-39`, add `Link` to the lucide-solid import list.
  2. In `src/components/editor/EditorToolbar.tsx`, add a `setIsLinkOpen` signal (mirror the `isTimestampOpen` signal at line 73).
  3. In the `renderItem` switch (after `inlineCode` and before `bulletList`), add a `case 'link':` that renders a button with `onClick={() => setIsLinkOpen(true)}`, `title={t('editor.toolbar.linkTitle')}`, `aria-label={t('editor.toolbar.link')}`, `aria-pressed={isLinkActive()}`, `data-testid="insert-link-button"`, and the `Link` icon (size 18).
  4. Add a new `isLinkActive` signal (mirror `isBoldActive` at line 58) updated in the `createEffect` at line 77-129 inside `updateActiveStates` via `setIsLinkActive(editor.isActive('link'))`.
  5. Mount the `LinkOverlay` component at the bottom of the toolbar's render (next to `TimestampOverlay` at line 520-524), passing `editor`, `isOpen={isLinkOpen()}`, `onClose={() => setIsLinkOpen(false)}`.
  6. Wire `editor.storage.link.openLinkDialog` to `setIsLinkOpen(true)` so the `Mod-k` keymap (defined on the extended Link instance in Task 1.1) opens the dialog. Add a `createEffect` (placed next to the existing `selectionUpdate`/`transaction` listeners at `EditorToolbar.tsx:77-129`):
     ```ts
     createEffect(() => {
       const editor = props.editor;
       if (!editor) return;
       (editor.storage as { link: { openLinkDialog: () => void } }).link.openLinkDialog =
         () => setIsLinkOpen(true);
     });
     ```
     The storage object is guaranteed to exist if the editor was constructed with the extended Link from Task 1.1. The effect re-runs on editor swap (e.g. journal switch), overwriting the callback with the new toolbar's signal setter. No `onCleanup` is required because the storage is destroyed with the editor instance.
- Validation: `npm run test:run` passes; manual press Ctrl/Cmd-K with the editor focused and confirm the dialog opens.
- Notes: The `Mod-k` keymap is intercepted by ProseMirror at the editor's `keydown` handler, so it does not fire when a child dialog input has focus (the input's own keydown runs first and ProseMirror's `Mod-k` only fires when the editor surface has focus).

#### Task 1.5: Add CSS for link affordance

- Status: COMPLETED
- Objective: Links are visually distinguishable from regular text (not just by color).
- Steps:
  1. In `src/styles/editor.css:118-120`, extend the `.ProseMirror a` rule to add `text-decoration: underline; text-decoration-thickness: 0.05em; text-underline-offset: 0.15em;`.
  2. Add a `:hover` rule that increases underline thickness: `text-decoration-thickness: 0.1em;`. This signals interactivity without being intrusive.
  3. Do **not** add `cursor: pointer` — with `openOnClick: false`, plain click on a link places the cursor (editable surface). A pointer cursor would mislead users into expecting a navigation. The underline + hover state + Ctrl/Cmd-click docs are the affordance.
- Validation: `npm run lint` passes; manual open the app, create a link, confirm underline and hover state render correctly in both light and dark themes.
- Notes: The existing rule already uses `var(--editor-link-color)`. Verify the token exists in both light and dark theme files; if not, fall back to `inherit` and let the editor inherit its primary text color.

#### Task 1.6: Add i18n keys for the link feature

- Status: COMPLETED
- Objective: Every new user-facing string has an English source in `en.ts`. The community translation JSONs do not need updates (per the established pattern of letting translations catch up).
- Steps:
  1. In `src/i18n/locales/en.ts:196-263` (`editor.toolbar.*`), add:
     - `link: 'Link'`
     - `linkTitle: 'Link (Ctrl/Cmd+K)'`
  2. In `src/i18n/locales/en.ts:340-358` (`prefs.writing.toolbarItem.*`), add:
     - `link: 'Link'`
  3. Add a new `link.*` namespace (mirror the `timestamp.*` namespace at lines 557-566) with:
     - `link.insertTitle: 'Insert link'`
     - `link.editTitle: 'Edit link'`
     - `link.wrapSelectionTitle: 'Add link'`
     - `link.urlLabel: 'URL'`
     - `link.urlPlaceholder: 'https://example.com'`
     - `link.insert: 'Insert'`
     - `link.update: 'Update'`
     - `link.apply: 'Apply'`
     - `link.remove: 'Remove link'`
     - `link.invalidUrlError: 'Enter a URL starting with http://, https://, mailto:, or tel:.'`
  4. In `src/i18n/locales/en.ts:626-638` (`errors.*`), no new keys needed unless an IPC error arises (the URL validation is purely client-side).
  5. Run `bun run validate:locales` to confirm only the English additions are expected.
- Validation: `bun run validate:locales` exits 0; the new keys appear in the flat key set under `editor.toolbar.link*`, `prefs.writing.toolbarItem.link`, and `link.*`.
- Notes: Community JSON locales (`es.json`, `de.json`, `fr.json`, `it.json`, `hi.json`) intentionally fall behind; the missing-key warnings are accepted and the existing English strings render in fallback.

### Milestone 2: Backend — Markdown export of named links

- Status: COMPLETED
- Purpose: Ensure that exporting a diary to Markdown produces standard `[label](url)` syntax for named links, replacing the current silent-strip behavior. This is the only backend change required; JSON export and Rhai plugin exports pick up the fix automatically.
- Exit Criteria:
  - `cargo test -p mini-diarium --lib markdown` (or `cd src-tauri && cargo test export::markdown`) passes including all new link test cases.
  - `cargo clippy --all-targets -- -D warnings` passes.
  - A round-trip test: an entry containing `<p>See <a href="https://example.com">Visit site</a></p>` exports to Markdown that, when re-imported via the frontend `parseMarkdownToHtml`, yields the same `<a href="https://example.com">Visit site</a>` HTML.
  - All pre-existing Markdown export tests still pass.

#### Task 2.1: Implement link export in `html_to_markdown`

- Status: COMPLETED
- Objective: `<a href="URL">LABEL</a>` (and the self-closing variant `<a ...>LABEL</a>` with attributes) becomes `[LABEL](URL)` in the exported Markdown. Links with formatting in the label (e.g. `<a href="..."><strong>bold</strong></a>`) are correctly converted because the link stage runs **after** the inline-formatting stages: by the time we see the `<a>` tag, `<strong>bold</strong>` has already been replaced with `**bold**` in the LABEL text.
- Steps:
  1. In `src-tauri/src/export/markdown.rs`, add a new pipeline stage between stage 9 (residual block tags) and stage 10 (strip remaining tags) — call it "Stage 9.5: Links". The placement matters: it must run **after** the inline formatting stages (so bold/italic inside the link label are already converted) and **after** block tag stages (so `<p>` wrapping is removed before the link is processed) but **before** `strip_remaining_tags` (so we capture the URL while the tag is still present).
  2. Implement `process_links(input: &str) -> String` as a state-walker modeled on `process_code_blocks` at `src-tauri/src/export/markdown.rs:226-250`. The function:
     - Walks the string finding `<a ` (with the trailing space — distinguishing the open tag from `<aside>` etc.).
     - Parses the attributes to extract `href="..."` (support single or double quotes, handle `&quot;` and `&amp;` inside the attribute value).
     - Finds the matching `</a>`.
     - Extracts the inner content as the LABEL. By the time this stage runs, stages 1-9 have already converted the LABEL's inline formatting (bold, italic, strikethrough, inline code) to Markdown syntax. Apply the existing `HTML_ENTITIES` table (line 97) to the LABEL to decode `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;`. Do not recursively call `html_to_markdown` — that would double-process the inline syntax.
     - Trim trailing whitespace from LABEL. If LABEL is empty, fall through to `strip_remaining_tags` behavior (drop the entire tag, keep no replacement text).
     - Emits `[LABEL](URL)`. If `URL` is empty, fall through to `strip_remaining_tags`. Apply `HTML_ENTITIES` to the URL too (defensive — TipTap usually doesn't store entity-encoded URLs, but if a future change introduces one it will not break).
     - If the URL contains characters that CommonMark requires to be wrapped in `<...>` (space, `(`, `)`, or angle brackets), wrap it: `[LABEL](<URL>)`. Otherwise emit bare: `[LABEL](URL)`. Do not percent-encode `:` or `/` (CommonMark allows them). Do not decode existing `%XX` sequences.
  3. Algorithm placement summary: `process_links` runs between `apply_replacements(BLOCK_TAGS)` (stage 9) and `strip_remaining_tags` (stage 10). It must run **after** stage 3 (inline formatting), so the LABEL is already in Markdown syntax. It must run **after** stage 9 (block tags), so `<p>` wrappers around the link are already stripped. It must run **before** stage 10 (strip remaining), so the `<a>` tag is still parseable. It must run **before** stage 11 (HTML entities), which is why we apply the entity table inside `process_links` itself rather than relying on the pipeline.
  4. Add a unit test `test_html_to_markdown_link_basic` that converts `<p>See <a href="https://example.com">Visit site</a></p>` and asserts the output contains `[Visit site](https://example.com)`.
  5. Add `test_html_to_markdown_link_with_formatting` for `<a href="..."><strong>bold</strong></a>` → `[**bold**](...)`.
  6. Add `test_html_to_markdown_link_with_title` (if title is set via setLink) — output `[label](url "title")`. Skip if not exposed; this is optional.
  7. Add `test_html_to_markdown_link_with_special_chars_in_url` for `?q=hello%20world` → `[label](https://example.com/?q=hello%20world)`.
  8. Add `test_html_to_markdown_link_in_heading`, `..._in_list`, `..._in_blockquote` to ensure pipeline ordering works.
  9. Add `test_html_to_markdown_link_without_href` for `<a>text</a>` (no href attribute) → just `text` (the link is dropped because it has no target).
- Validation: `cd src-tauri && cargo test export::markdown` passes; `cargo clippy --all-targets -- -D warnings` passes; manually export a sample journal with a named link via the in-app Export overlay and inspect the Markdown output file.
- Notes: Keep the implementation defensive: if `href` extraction fails (malformed HTML, missing closing quote), fall through to `strip_remaining_tags` behavior (drop the tag, keep the text). This matches the existing resilience pattern. The placement (after stage 9, before stage 10) is what makes inline formatting inside labels work without a recursive call — the LABEL text has already been through stages 1-9 by the time we extract it, so `**bold**`, `*italic*`, and `` `code` `` are already in their Markdown form.

#### Task 2.2: Verify JSON export round-trip and Rhai plugin inheritance

- Status: COMPLETED
- Objective: Confirm (with tests) that the JSON export passes `<a>` tags through unchanged and that a Rhai export plugin calling `html_to_markdown(text)` produces the same Markdown as the built-in Markdown exporter.
- Steps:
  1. In `src-tauri/src/export/json.rs`, add a unit test `test_json_export_preserves_link_markup` that builds a `DiaryEntry { text: "<p>See <a href=\"https://example.com\">Visit site</a></p>", .. }` and asserts the serialized JSON contains the `<a href="https://example.com">Visit site</a>` substring verbatim.
  2. In `src-tauri/src/plugin/rhai_loader.rs`, add a unit test `test_rhai_export_plugin_html_to_markdown_with_link` that runs a minimal `.rhai` script returning `html_to_markdown(input)` and asserts the output for a link-containing input is `[label](url)`. Reuse the `RhaiEngine` test helper at the bottom of the file.
  3. Add an integration test (or extend the existing test) in `src-tauri/src/export/markdown.rs` that calls `export_entries_to_markdown` on a `DiaryEntry` containing a link and asserts the document-level Markdown output includes the link line and the entry title is preserved.
- Validation: `cd src-tauri && cargo test` passes (all new and existing tests); `cargo clippy --all-targets -- -D warnings` passes.
- Notes: The Rhai test confirms that user-written plugins get the fix for free — no script changes required.

### Milestone 3: Tests, docs, and final verification

- Status: COMPLETED
- Purpose: Lock in the behavior with automated tests, update the user-facing docs, and ensure the entire repo is consistent.
- Exit Criteria:
  - All Vitest and cargo test cases added in this plan pass.
  - `website/docs-src/01-writing-entries.md` documents the new feature; the generated `website/docs/writing-entries/index.html` is regenerated.
  - `CHANGELOG.md` (or `docs/latest-changelog.md`) is updated.
  - The TODO-0043 checkbox in `docs/todo/TODO.md:46` is checked.
  - All pre-flight checks pass.

#### Task 3.1: Add frontend Vitest coverage for LinkOverlay and toolbar

- Status: COMPLETED
- Objective: Unit tests that exercise the overlay UX (open/close, create, edit, remove, validation) and the toolbar wiring (button rendered when enabled, hidden when disabled, active state on link cursor).
- Steps:
  1. Create `src/components/editor/LinkOverlay.test.tsx` following the test style of `TimestampOverlay` (if it has a test) or `EditorToolbar.test.tsx`. Tests to include (using the existing jsdom + `renderWithI18n` setup):
     - Renders nothing when `isOpen` is false.
     - In `insert` mode (no selection, not on a link): renders the URL input and an "Insert" confirm button.
     - In `wrap-selection` mode (non-empty selection, not on a link): renders the URL input and an "Apply" confirm button.
     - In `edit` mode (cursor on a link): renders the URL input pre-filled with the current `href`, an "Update" confirm button, and a "Remove link" button.
     - Does NOT render a "Remove link" button in `insert` or `wrap-selection` mode.
     - On confirm in `insert` mode, calls `editor.chain().focus().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run()`.
     - On confirm in `wrap-selection` mode, calls `editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()`.
     - On confirm in `edit` mode, calls `editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()` and does not call `insertContent`.
     - On Remove, calls `editor.chain().focus().extendMarkRange('link').unsetLink().run()`.
     - Disables the confirm button and shows the inline error when the URL is empty or fails the protocol check.
     - Closes on Escape.
  2. Extend `src/components/editor/EditorToolbar.test.tsx` to:
     - Assert the Link button is rendered when `toolbarItems` includes `link` with `enabled: true`.
     - Assert the Link button is hidden when `enabled: false`.
     - Assert clicking the button triggers the dialog open (mock `setIsLinkOpen`).
  3. Extend `makeEditorMock()` in the same file with new mock fields: `isActive('link')` returning a configurable boolean; `getAttributes('link')` returning `{ href: string }`; `chain().focus().setLink(...).run()`; `chain().focus().extendMarkRange('link').setLink(...).run()`; `chain().focus().insertContent(...).run()`; `chain().focus().unsetLink().run()`; `state.selection.from === state.selection.to` (collapsed or not).
  4. Add a test in `src/lib/markdown.test.ts` (create if missing) asserting that `[Visit site](https://example.com)` round-trips through `parseMarkdownToHtml` and produces an `<a href="https://example.com">Visit site</a>` element that survives DOMPurify.
- Validation: `npm run test:run` passes; coverage report shows `LinkOverlay.tsx` and the `link` case in `EditorToolbar.tsx` are exercised.
- Notes: TipTap cannot run in jsdom per the existing `makeEditorMock()` comment at line 25; the mock approach is the established pattern in this repo.

#### Task 3.2: Add Rust test coverage for link export

- Status: COMPLETED
- Objective: Comprehensive cargo tests for the new `process_links` stage and the existing `html_to_markdown` integration.
- Steps:
  1. In `src-tauri/src/export/markdown.rs`, add the tests listed in Task 2.1 (steps 4-9) as `#[cfg(test)] mod tests` cases following the existing test pattern at lines 572-1035.
  2. In `src-tauri/src/export/json.rs`, add the round-trip test from Task 2.2 (step 1).
  3. In `src-tauri/src/plugin/rhai_loader.rs`, add the Rhai test from Task 2.2 (step 2).
  4. Run `cd src-tauri && cargo test` and confirm all pass.
- Validation: `cd src-tauri && cargo test` exits 0; all new test functions are listed in the output.
- Notes: Test data fixtures should include non-ASCII label text (CJK, RTL) per the durability rule "Any text-processing function tested with non-ASCII strings (ASCII + RTL + CJK minimum)" from the project's best-practices docs.

#### Task 3.3: Update `website/docs-src/01-writing-entries.md`

- Status: COMPLETED
- Objective: User-facing docs accurately describe the new feature so users can discover it without trial and error.
- Steps:
  1. In `website/docs-src/01-writing-entries.md`, add a new section "## Links" between the existing "Inserting Images" section (around line 49) and "Right-to-Left Languages" section. Also expand the existing one-line bullet at line 21 to reference the new section.
  2. The section must cover:
     - The toolbar Insert Link button (icon: chain link).
     - Three flows: (a) no selection → Insert → link with the URL as its label; (b) selected text → Apply → selection becomes a link with the original text as the label; (c) cursor on existing link → Update / Remove.
     - How to edit or remove an existing link: place cursor on the link, open the dialog (button or Ctrl/Cmd-K).
     - The Ctrl/Cmd-K keyboard shortcut to open the dialog.
     - The Ctrl/Cmd-click shortcut to open a link in the system browser.
     - The auto-link behavior: typing `https://...` and pressing space converts the URL to a link.
     - The Markdown round-trip: links are exported as `[label](url)` and re-imported as clickable links.
  3. Update the `updated:` field in the front matter to `2026-06-01`.
  4. Update the `description:` field if the bullet list at line 14-22 changes meaningfully. Keep it within 140-160 characters per the website guide.
  5. Run `bun run website:build-static` (NOT `website:docs` alone — the full pipeline includes the asset fingerprinter, per `website/CLAUDE.md`).
- Validation: `bun run website:build-static` exits 0; the generated `website/docs/writing-entries/index.html` contains the new section; `bun run validate:locales` still passes.
- Notes: The bullet "Links" at line 21 of the source already exists; converting it to a full section is a content change, not a new page, so the navigation order and sitemap remain unchanged.

#### Task 3.4: Update `CHANGELOG.md` and check off TODO-0043

- Status: COMPLETED
- Objective: The change is documented in the changelog and the TODO is marked done.
- Steps:
  1. In `CHANGELOG.md`, prepend a new `## [Unreleased]` section at the top of the "Versions" block (the file's canonical pattern; the current top entry is `## [0.5.2] - 29-05-2026`). Use the file's template (lines 7-27):
     ```
     ## [Unreleased]

     ### Added
     - **Named links in the editor**: insert a hyperlink with custom display text via the toolbar Insert Link button (or Ctrl/Cmd+K). The visible label and the URL are independent. Round-trips through Markdown export as `[label](url)`, JSON export as raw HTML, and is preserved by user Rhai export plugins. Ctrl/Cmd-click a link to open it in the system browser.
     ```
  2. In `docs/todo/TODO.md:46`, change `- [ ] **TODO-0043: ...` to `- [x] **TODO-0043: ...`.
  3. Do not add an entry under `## [0.5.2]` (it is already released; see the date). The new feature lands in the next version (0.5.3 or similar, decided at release time by the maintainer per `docs/RELEASING.md`).
- Validation: `git diff docs/todo/TODO.md CHANGELOG.md` shows the expected changes; the new `[Unreleased]` section is at the top of the "Versions" block.
- Notes: The pre-release skill (`.agents/skills/pre-release/SKILL.md`) is the canonical place to check for changelog generation steps. The skill stamps the date and version on the `[Unreleased]` block when the maintainer actually tags a release — not part of this plan.

### Milestone N: Cleanup And Final Verification

- Status: COMPLETED
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified end-to-end.
- Exit Criteria: Intermediate artifacts are removed, all final verification passes, and the plan status is COMPLETED.

#### Task N.1: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract.
  4. Confirm the plan file `docs/TODO-0043-named-links-plan.md` is either kept as a reference (move to `docs/adr/` or similar) or removed; the user has not requested permanent retention, so default to keeping it as a project artifact.
- Validation: `git status` shows only the intended final changes; the working tree contains no `.bak` files, no temporary scratch files.
- Notes: Do not remove user-provided files or unrelated worktree changes. Pre-existing `EditorToolbar.tsx.bak`, `TitleEditor.tsx.bak`, `WordCount.tsx.bak` files in `src/components/editor/` are out of scope for this plan.

#### Task N.2: Final Verification

- Status: COMPLETED
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run the final verification commands listed in the Pre-flight Checks section below.
  2. Fix any failures and rerun until verification passes, or record the blocker in the plan and ask the user.
- Validation: All Pre-flight Checks items are checked.
- Notes: The lockfile regeneration (Pre-flight item about `bun install` + `npm install --package-lock-only`) is **mandatory** for this plan because Task 1.1 adds `@tiptap/extension-link` as a direct dep. Do not skip it.

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval.
Fix all failures before proceeding.

- [x] `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` passes with zero failures
- [x] `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo clippy --all-targets -- -D warnings"` passes with zero warnings
- [x] `cmd.exe /c bun run type-check` passes
- [x] `cmd.exe /c bun run lint` passes
- [x] `cmd.exe /c bun run test:run` passes with zero failures
- [x] `cmd.exe /c bun run build` succeeds
- [x] `cmd.exe /c bun run format` succeeds
- [x] `cmd.exe /c bun run validate:locales` passes
- [x] If `package.json` was modified, `cmd.exe /c bun install` and `cmd.exe /c npm install --package-lock-only --legacy-peer-deps` both succeed and both lockfiles are committed
- [x] `cmd.exe /c bun run website:build-static` succeeds; generated `website/docs/writing-entries/index.html` includes the new "Links" section
- [x] Link export tested with non-ASCII label text (ASCII + RTL + CJK minimum)
- [x] Plan status updated to COMPLETED
- [x] TODO-0043 checkbox in `docs/todo/TODO.md:46` is checked
- [x] CHANGELOG / latest-changelog entry added

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/TODO-0043-named-links-plan.md`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Open questions are resolved (all UX/scope decisions confirmed 2026-06-01).
- [x] Tasks are grouped into milestones (3 milestones + 1 cleanup milestone = 4 milestones, well above the 10-task threshold).
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Commit per-milestone (or per-task where the work is non-trivial) so partial progress is recoverable.
