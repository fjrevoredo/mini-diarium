# Root Cause Analysis: Enter Key Silently Did Nothing at End of Paragraph (#273)

**Date:** 2026-08-27
**Scope:** [GitHub issue #273](https://github.com/fjrevoredo/mini-diarium/issues/273), fixed for v0.7.1.
**Validation performed:** live reproduction and fix verification against the real Windows dev app via WebView2 CDP (`tauri-agent-dev` skill), plus `bun run test:run` (1083 passed), `type-check`, `lint`, `format:check`.

## Symptom

On Xubuntu 24.04 (AppImage, v0.7.0), pressing Enter with the cursor at the true end of a paragraph produced no new line and no visible error. Reproduced locally on Windows. Workaround: type a trailing space, move the cursor back one position, then press Enter.

## Investigation

An initial static audit of `src/` ruled out any app-level Enter interceptor: `DiaryEditor.tsx` uses stock `StarterKit` keymap behavior, the two custom `addKeyboardShortcuts()` extensions bind unrelated combos, and the two `document`-level `keydown` listeners both bail out for plain Enter.

Two hypotheses were weighed from static reading alone:

- **A (dependency-level):** the `@tiptap/*` → `^3.30.1` bump (`07bff56`, shipped in v0.7.0) raised `@tiptap/pm`'s own `prosemirror-model` requirement to `^3.30.3`, and `bun.lock` showed a duplicate `prosemirror-model` tree afterward. Initially rated **weak**: a dual-instance bug was assumed to be position-independent (breaking typing/paste broadly) and to throw loudly — neither of which matched the reported symptom.
- **B (app-level):** `DiaryEditor.tsx`'s content-sync `createEffect` (compares `props.content` against `editor.getHTML()` and calls `setContent` when they differ) was suspected of clobbering a real ProseMirror split via a serialize/parse round-trip asymmetry for a newly-created empty trailing paragraph. Initially rated **strong** — it matched this codebase's documented history of similar round-trip bugs (see `src/CLAUDE.md` gotcha #13, TODO-0089).

Static analysis could not settle which was right, so both were held pending empirical verification (per project convention: no root cause is declared from code reading alone).

## Empirical verification

Using `tauri-agent-dev` + CDP `javascript_tool` against the real dev app:

1. A fresh `bun install` was required first: `node_modules` had `@tiptap/pm@3.27.1` installed, predating the `07bff56` bump — the stale tree could not have exercised the reported duplicate at all.
2. A debug hook exposed the live TipTap `Editor` instance; an `update` listener logged every transaction.
3. Typed a sentence, moved the cursor to the true end, pressed Enter: **zero `update` events fired** — not a split followed by a revert, but no transaction at all. This immediately ruled out Hypothesis B, since there was no split for the content-sync effect to clobber.
4. Enter one character before the end (leaving non-empty content on both sides of the split) **worked correctly** — confirming the position-sensitivity was real, just not caused by B.
5. `dev.log` (Vite's client error relay) captured the actual exception, thrown synchronously inside the ProseMirror command chain and never reaching the app's own error handling:

   ```
   RangeError: Can not convert <> to a Fragment (looks like multiple versions of prosemirror-model were loaded)
    > Fragment$3.from node_modules/prosemirror-model/dist/index.js:364:14
    > NodeType$1.create node_modules/prosemirror-model/dist/index.js:2180:65
    > split node_modules/prosemirror-transform/dist/index.js:1187:57
    > Transaction.split node_modules/prosemirror-transform/dist/index.js:2179:8
    > node_modules/@tiptap/core/dist/index.js:2683:6
    > Object.splitBlock node_modules/@tiptap/core/dist/index.js:164:49
    > handleEnter node_modules/@tiptap/core/dist/index.js:5598:49
   ```

   The console had also logged TipTap's own dedup warning: `prosemirror-model is loaded more than once. Wrapping and splitting nodes will fail.`

This confirmed Hypothesis A, with the mechanism explaining the exact position-sensitivity that made it look app-level: `Transaction.split` only needs to **construct a brand-new node** (via `Fragment.from` / `NodeType.create`) when the split leaves one side empty — an Enter at the true end produces an empty trailing paragraph. A split that leaves real content on both sides reuses existing nodes and never crosses the module boundary that way, which is why mid-paragraph Enter worked throughout. The exception is thrown inside the keymap's command handler and escapes before `event.preventDefault()` runs, so the browser never falls back to native contenteditable behavior either — hence the silent no-op instead of a visible error.

## Fix

- Added `"prosemirror-model": "^1.25.11"` to `package.json`'s `overrides` block. All transitive consumers (`prosemirror-state`, `-view`, `-transform`, `-commands`, `-gapcursor`, `-schema-list`, `-tables`) already declared compatible ranges (`^1.0.0` through `^1.25.8`); this was a hoisting gap, not a real version conflict.
- A **plain, clean `bun install`** (not `--force`) was verified to dedup correctly from a fresh `node_modules`. The `--force` requirement seen mid-investigation was an artifact of the incremental/stale install state, not a property of the fix.
- `package-lock.json` already had a single `prosemirror-model` entry before this change — npm's resolver never produced the duplicate. This bug was bun-hoisting-specific; the Flathub/npm-based build path was never affected. No `npmDepsHash` refresh was needed since `package-lock.json`'s content didn't change.
- Re-verified in the live app post-fix: Enter at the true end now dispatches a real `docChanged` transaction and correctly produces a new empty paragraph; the TipTap dedup warning is gone from the console.

## Blast radius

The warning said "wrapping and splitting nodes will fail" generally, not just for Enter. Spot-checked in the fixed session: toggling a bullet list and wrapping a selection in a blockquote both worked cleanly with no errors — these also exercise `prosemirror-transform`'s node-construction paths. Not exhaustively tested: `toggleOrderedList`, table operations, and the markdown-import append path (`EditorPanel.tsx`'s `setHorizontalRule().insertContent(...)`), though all go through the same now-deduped `prosemirror-transform`/`prosemirror-model`.

## Prevention

A unit test asserting "Enter at end yields two paragraphs" would not have caught this and would not catch a regression: Vitest resolves a single hoisted `prosemirror-model` for the test run regardless of what bun's own tree looks like, so an editor-behavior test cannot reproduce a dual-instance bun-hoisting failure. The regression guard that actually matches the failure mode is `src/test/prosemirror-dedup.test.ts` — an ordinary Vitest test (same shape as `src/styles/editor.css.test.ts`'s regression guard) that walks the installed `node_modules` tree directly with `node:fs` and fails if more than one `prosemirror-model` copy is found. Being a normal test, it runs everywhere `bun run test:run` already does (pre-commit, CI) with no separate wiring. The editor-level behavior itself is only verifiable by driving the real WebView, which is what this investigation did.

## Lesson

A hypothesis rated "weak" from static reasoning about a dependency's *typical* failure mode ("dual-instance bugs are usually loud and broad") was wrong once the actual code path was inspected: the failure was narrow (only node-construction across the module boundary) and silent (the throw escaped before any error-surfacing code ran). Reasoning about what a bug class "usually" looks like is not a substitute for tracing the actual call path the symptom implicates, especially when a live-repro tool is available.
