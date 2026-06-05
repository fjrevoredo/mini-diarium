# Process Retrospective: TODO-0043 Named Links

**Feature:** Named links in the TipTap editor + Markdown export
**Branch:** `feature-v0.5.3`
**Session:** ses_17b86c515ffe2sa7ZEWs6AsmLm (2026-06-01 → 2026-06-02)
**Written:** 2026-06-02

---

## What Happened (Timeline)

| Round | Trigger | What changed |
|-------|---------|--------------|
| Plan | Approved 2026-06-01 — "Open Questions: None" | URL-only dialog, strict validator, no label field, `target="_blank"` in extension config |
| Round 1 | First implementation per plan | 386 cargo + 432 frontend tests passing |
| Round 2 | User reports 4 bugs on first real use | Added label field, normalizeUrl(), fixed mode-stability, fixed click behavior |
| Round 3 | "Link still opens in browser on plain click" | Added `event.preventDefault()` — tests passed, agent declared victory |
| Round 4 | User confirms bug persists | Discovered `target="_blank"` WebView handoff; fixed via `addAttributes()` override |

**Total additional scope vs. plan:** +1 dialog field, +`normalizeUrl`, +`snapshotEditor`, +`handleEditorLinkClick`, +10 tests, +~120 lines.

---

## Root Cause Analysis

### RC-1 — Plan approved UX the user had never seen

The plan's "Open Questions: None — all UX confirmed with the user" was a sign-off on *described behavior*, not *demonstrated behavior*. The user had not interacted with an actual dialog prototype. Three of the four Round-2 bugs were directly about UX behavior that was described in the plan but felt wrong when used:

- "No label field" — plan said "URL-only edit per user decision." The user never actually agreed to that; they agreed to a description of a dialog.
- "Strict validator" — felt hostile the moment the user typed `example.com`.
- "Wrap mode silently becomes insert mode" — impossible to discover by reading the plan.

**The approval gate closed a planning loop, not a user-feedback loop.**

**Prevention:**
- For any plan that describes a dialog or interaction flow, add a UX validation step to the approval gate: a screen mockup, a working prototype, or a walkthrough of each described scenario with the user confirming against *behavior* rather than text.
- Add to the `manual-planning` skill's checklist: "For features with a dialog or multi-step user interaction, tag as `UX-GATE: REQUIRED` and list each scenario with expected user feedback before marking questions resolved."

---

### RC-2 — Plan made configuration assumptions not verified against installed source

The plan included `target: '_blank'` in the `HTMLAttributes` configuration block without noting it was Tauri-dangerous — the plan verified `class: null` against the extension source (that line says "the actual default is `null` per the extension source") but applied no such check to `target`. Had the agent opened `node_modules/@tiptap/extension-link/dist/index.js` before writing that step, it would have seen that:

1. `target: '_blank'` is already the extension's hardcoded default.
2. `configure({ HTMLAttributes: { ... } })` does a **deep merge**, not a replace — setting `class: null` does not remove `target`.
3. In a Tauri app, `target="_blank"` triggers the WebView's new-window pathway, bypassing TipTap's `openOnClick: false`.

This cascade (bad assumption → wrong config → three rounds of debugging) could have been collapsed to zero rounds by checking the installed file first.

**Prevention:**
- Add to `docs/best-practices/FRONTEND_BEST_PRACTICES.md` under "TipTap patterns":
  > Before configuring a TipTap extension, read its installed source in `node_modules/@tiptap/<extension>/dist/index.js` to verify the actual defaults and how `configure()` merges options.
- Add to the planning skill's task template for TipTap work:
  > **Pre-implementation step:** Read installed extension source. Confirm `addOptions()` defaults and `configure()` merge behavior before writing configuration code.

---

### RC-3 — Tauri/WebView platform behavior was treated as unit-testable

After Round 3, the agent added `event.preventDefault()`, ran the tests, saw them pass, and declared the fix complete. The tests pass because jsdom's anchor elements don't trigger actual navigation. But the WebView2/WebKit new-window handoff is not mediated by JavaScript at all — it fires at the platform level, before the JS event loop sees it.

This class of bug (Tauri WebView behavior, OS-level events, WebView2 COM handlers) **cannot be validated by Vitest**. Any fix for platform-level behavior requires in-app verification.

**Prevention:**
- Add to `docs/best-practices/TAURI_BEST_PRACTICES.md` a section "What jsdom cannot test":
  > - `target="_blank"` → WebView new-window (fires before JS)
  > - `on_navigation` / `on_new_window` guards
  > - OS-level screen-lock / session events
  > - WebView2 `WebResourceRequested` handler
  > - Any behavior that depends on the actual Tauri runtime rather than the mocked `@tauri-apps/api`
  >
  > For these, add a `// PLATFORM-VERIFY:` comment next to the test that explains what additional manual verification is needed, and include it in the plan's exit criteria.
- In the plan template's exit criteria section, add: "For any Tauri WebView interaction (link clicks, navigation, new-window), list an explicit manual-verification step."

---

### RC-4 — The implementation agent did not push back on a plan detail it should have caught

The plan specified `target: '_blank'` in `HTMLAttributes`. A TipTap Link extension in a Tauri app with `openOnClick: false` and a custom Ctrl/Cmd-click handler has no reason to set `target="_blank"` — the attribute's entire purpose is to trigger a new window, which is exactly what the custom handler is replacing. An agent with Tauri domain knowledge should have flagged this before starting Round 1.

This is not just about one detail; it's about whether the executing agent reads the plan critically or executes it literally. In this session, the executing agent (MiniMax M3) was not Claude. The plan was written by a different planning agent. Neither agent had visibility into what the other missed.

**Prevention:**
- In `CLAUDE.md` → "Agent Workflow Rules," add:
  > 5. **Before implementing any plan step that configures a third-party extension, framework, or WebView behavior, open the installed source or relevant backend source to verify the step's assumptions.** If the source contradicts the plan, halt and surface the discrepancy before proceeding.
- The `manual-planning` skill should include a "known platform traps" section for Tauri+TipTap features, listing: `target="_blank"` behavior, `openOnClick` vs. WebView navigation, `configure()` deep merge, and focus-loss on dialog open.

---

### RC-5 — Reactive mode computation in a dialog that steals editor focus

`createMemo(() => editor.isActive('link'))` was used to determine dialog mode. TipTap loses the selection when a child input element receives `autofocus`, collapsing the memo to `insert` mode mid-dialog. This is a predictable consequence of how TipTap manages focus: it's documented in TipTap's editor events guide. `TimestampOverlay.tsx` avoids the issue entirely because it never reads editor state — it only inserts. But any future dialog that needs to read the cursor position, active marks, or selection on open will hit the same trap if it uses a reactive memo instead of a snapshot.

The snapshot pattern that fixed it (`snapshotEditor()`, called once in a `createEffect` on the `isOpen` trigger) should be the documented pattern for all future TipTap overlays.

**Prevention:**
- In `src/CLAUDE.md` under "TipTap patterns" (or add a new section):
  > **TipTap dialog state capture**: Never use `createMemo` over `editor.state.*` inside a dialog component. Capture the editor state once when the dialog opens via a `createEffect` that fires when `isOpen` transitions to `true`. TipTap collapses the selection when focus moves to an `autofocus` input, making reactive reads of `editor.state.selection` unreliable after dialog open.
  > See `snapshotEditor()` in `LinkOverlay.tsx` as the reference implementation.

---

## What Went Right

- **The backend `process_links` stage was correct on first implementation.** Zero regressions in the backend across all rounds. The stage placement reasoning (after inline formatting, before `strip_remaining_tags`, nested inside `process_blockquotes` for blockquote context) was sound and the 19 tests confirm it.
- **The `addAttributes()` fix (Round 4) was the right fix** — not a workaround. Overriding the schema-level default rather than fighting `configure()` is the correct TipTap API use and is now pinned by a regression test.
- **The implementation summary (`todo-0043-named-links-implementation.md`) is an honest post-mortem.** The "bugs we hit" section names the mistakes without softening them, making it useful for this retrospective. This is a habit worth keeping.
- **No E2E breakage.** All pre-existing tests continued to pass across all rounds; no regressions were introduced.

---

## Summary: Process Changes to Make

| # | Change | Where | Priority |
|---|--------|-------|----------|
| 1 | UX-gate requirement: dialogue/interaction plans require scenario walkthrough with user before approval | `manual-planning` skill checklist | High |
| 2 | "Read installed source before configuring TipTap extensions" rule | `FRONTEND_BEST_PRACTICES.md`, `manual-planning` TipTap task template | High |
| 3 | "What jsdom cannot test" list + `PLATFORM-VERIFY` comment pattern | `TAURI_BEST_PRACTICES.md` | High |
| 4 | "Before implementing, verify plan assumptions against installed source" workflow rule | root `CLAUDE.md` §Agent Workflow Rules | Medium |
| 5 | TipTap dialog state capture pattern (snapshot, not memo) | `src/CLAUDE.md` §TipTap patterns | Medium |
| 6 | Keep implementation commits scoped; unrelated files go in their own commits | `CLAUDE.md` or commit discipline reminder | Low |
