# Technical Review Implementation Plan — April 2026

> **Source:** Executes the 13 findings in [`TECHNICAL_REVIEW_2026-04.md`](TECHNICAL_REVIEW_2026-04.md).
> **Scope rule:** P1 + P2 findings are planned. P3 findings are **not** scheduled by default — they are listed as an appendix so the maintainer can promote one if priorities shift.
> **Style:** Each milestone is execution-ready: concrete file edits, verification commands, rollback note. Milestones are **independent** unless an explicit `Depends on:` line says otherwise.

## Milestone Overview

| # | Finding(s) | Title | Priority | Effort | Depends on |
|---|---|---|---|---|---|
| M1 | A1 + A2 | Fix state-layer docs and delete dead state exports | P1 | ~1.5 h | — |
| M2 | A3 | Write passwordless-journal decision record | P1 | ~1 h | — |
| M3 | B1 + B2 | Remove legacy import commands; collapse `commands/import.rs` | P2 | ~1.5 h | — |
| M4 | B3 | Replace hand-rolled HTML→Markdown with a vetted library | P2 | ~4–8 h | — |
| M5 | F1 | Split `PreferencesOverlay.tsx` into tab files | P2 | ~4–6 h | — |
| M6 | F2 | Extract `EditorPanel.tsx` logic into custom state hooks | P2 | ~6–10 h | — |
| M7 | F3 | Backfill high-risk frontend component tests | P2 | ~8–12 h | M5 (part only); rest independent |

**Total scheduled effort: ~26–40 h.**

---

## M1 — Fix state-layer docs and delete dead state exports (P1, ~1.5 h)

### Scope

Resolves findings **A1** (documentation drift) and **A2** (dead frontend state code) together. They are paired because fixing one without the other immediately re-introduces drift: deleting a dead export changes the docs, and updating the docs to match current exports would cement dead code.

### Steps

1. **Delete dead exports from `src/state/entries.ts`.** Remove:
   - The `currentEntry` / `setCurrentEntry` signal (declared line 5).
   - The `dayEntries` / `setDayEntries` signal (declared line 8).
   - The `isLoading` / `setIsLoading` signal (declared line 14).
   - Their lines in the `export { ... }` block at the end of the file.
   - Their four `setX(…)` calls inside `resetEntriesState()` — leaving just `setEntryDates([])` and `setIsSaving(false)`.
2. **Decide `authMethods`.** Two acceptable resolutions; pick one:
   - **Option A (recommended):** Promote the global. Remove the local `const [authMethods, setAuthMethods] = createSignal(...)` in `PreferencesOverlay.tsx` (line 114) and import the module-level signals from `src/state/auth.ts` instead. Add one `loadAuthMethods()` function to `state/auth.ts` that reads via `tauri.listAuthMethods()` and sets the signal. Call it from `PreferencesOverlay.handleOpenChange` and from wherever auth methods change (password change / registration / removal paths already in that file). **Rationale:** auth methods are conceptually global; the current duplication means every call site has to know to `setAuthMethods(await tauri.listAuthMethods())`.
   - **Option B:** Delete `authMethods` / `setAuthMethods` from `src/state/auth.ts`. Keep everything local to `PreferencesOverlay.tsx`.
3. **Update `src/CLAUDE.md § State Management`:**
   - Change "Six signal-based state modules" → "**Seven** signal-based state modules" (count matches the table).
   - Add a row for `session.ts` listing `resetSessionState()` as its key function.
   - Update the `entries.ts` row to list only the signals that remain after step 1: `entryDates`, `isSaving`. Add `registerCleanupCallback`, `executeCleanupCallbacks` to the "Key Functions" column.
   - Update the `auth.ts` row consistently with the choice in step 2.
4. **Update `src-tauri/CLAUDE.md § File Structure`:** insert `│   ├── auto_key.rs  # AutoKeyMethod: device-bound random key wrap/unwrap` under the `auth/` tree entry.

### Verification

```bash
bun run type-check     # must be clean — dead imports will surface here
bun run lint
bun run test:run       # existing frontend tests must pass unchanged
cd src-tauri && cargo test   # backend unaffected, sanity check
```

### Rollback

One commit per step. If step 2 Option A causes test churn, revert step 2 only and use Option B.

---

## M2 — Write passwordless-journal decision record (P1, ~1 h)

### Scope

Resolves finding **A3**. This is a documentation-only milestone. No code changes.

### Steps

1. **Create** `docs/decisions/2026-04-passwordless-journal.md` (new directory allowed — single-file ADR in the style used by lightweight ADR practices). Required sections:
   - **Status:** Accepted (as-shipped).
   - **Context:** Why users asked for passwordless journals (issue #83, friction for casual users).
   - **Options considered:** A (no encryption at all — rejected), B (password derived from device ID — rejected), C (OS keychain — deferred, requires platform work on all three OSes). B-prime (what shipped) was not in the original discussion.
   - **Decision:** Ship B-prime — generate a random 32-byte device-bound key, store hex-encoded in `{app_data_dir}/config.json` alongside the journal entry, wrap the master key with it via the normal `AutoKeyMethod` auth slot. Explicit trade-off: "OS-account compromise = journal compromise" is documented and surfaced to the user in `PasswordCreation.tsx`.
   - **Consequences:** No additional platform code; no keychain prompts. Threat model is access-control not cryptographic. Explicitly not PHILOSOPHY.md non-negotiable violation (encryption at rest is still AES-256-GCM; the wrapping key is just stored alongside the data — equivalent to a passphrase written on a sticky note on the laptop).
   - **Future reversibility:** A migration from B-prime → C (keychain) is straightforward — the `auto_key` hex in `config.json` can be moved to the OS keychain without touching entries. Note this.
2. **Update the memory entry** `project_passwordless_decision.md` so it references the ADR and reflects the as-shipped decision instead of the pre-discussion plan.
3. **Update `CLAUDE.md` root:** in the "Architecture" or "Security Rules" section, add a one-line pointer to the new ADR so a reader lands on the decision rationale without grepping.

### Verification

- Manual re-read: does the ADR capture the *why* a contributor would need in 2027?
- No code runs. `bun run lint` + `cargo clippy` remain clean (no code changed).

### Rollback

Delete the new file; revert the memory and `CLAUDE.md` edit.

---

## M3 — Remove legacy import commands; collapse `commands/import.rs` (P2, ~1.5 h)

### Scope

Resolves findings **B1** and **B2** together. B2 makes B1 obsolete — deleting the four legacy commands is the cleanest fix for the duplication.

### Steps

1. **Verify no consumer exists.** Run:
   ```bash
   rg "importMiniDiaryJson|importDayOneJson|importJrnlJson|importDayOneTxt" src
   rg "import_minidiary_json|import_dayone_json|import_jrnl_json|import_dayone_txt" src
   rg "import_minidiary_json|import_dayone_json|import_jrnl_json|import_dayone_txt" src-tauri
   ```
   Expected: frontend hits only `src/lib/tauri.ts` and `src/lib/import.test.ts`; backend hits only `commands/import.rs`, `commands/mod.rs`, `lib.rs`. If any UI component references these, **STOP** — B2's premise is incorrect and the finding needs re-evaluation.
2. **Delete backend commands:** in `src-tauri/src/commands/import.rs`, delete the four `#[tauri::command]` functions. Keep `import_entries` and any shared helpers (`read_import_file`, size-limit constant). File shrinks from 380 to ~100 LOC.
3. **Unregister:** remove the four entries from `lib.rs:generate_handler![]` and from `commands/mod.rs` re-exports.
4. **Delete frontend wrappers:** in `src/lib/tauri.ts`, remove `importMiniDiaryJson`, `importDayOneJson`, `importJrnlJson`, `importDayOneTxt`.
5. **Delete the test file:** `src/lib/import.test.ts` becomes stale (it tests the wrappers). Either delete or rewrite it to test the `runImportPlugin` dispatch (if not already covered elsewhere — check `plugin.rs` tests first).
6. **Update command registry in root `CLAUDE.md`:** remove the four `import_*_json` / `import_dayone_txt` rows. The plugin-based `run_import_plugin` row remains.
7. **Update `src-tauri/CLAUDE.md`:** remove gotcha #8 ("Old import/export commands are preserved") and revise § "Adding a New Import/Export Format" to drop step 2 (the command), since the only path left is the plugin wrapper.

### Verification

```bash
cd src-tauri && cargo test
cd src-tauri && cargo clippy -- -D warnings
bun run type-check
bun run test:run
bun run lint
```

**E2E smoke (critical — plugin path is now the only import path):**
```bash
bun run test:e2e:local
```
Open `ImportOverlay` manually in a dev build and import a Mini Diary JSON to confirm the plugin path actually works end-to-end before merging. The existing `diary-workflow.spec.ts` does not cover import.

### Rollback

All steps are pure deletion. `git revert` restores. Note: if the E2E smoke reveals a bug in the plugin import path that was masked by the legacy command existing, file a bug and re-land M3 after it's fixed.

---

## M4 — Replace hand-rolled HTML→Markdown with a vetted library (P2, ~4–8 h)

### Scope

Resolves finding **B3**. Replaces 1025 LOC of string-replacement-based HTML→Markdown in `src-tauri/src/export/markdown.rs`.

### Steps

1. **Spike: evaluate candidate crates.** In a throwaway branch:
   - `html2md` (crates.io, MIT, ~600 stars).
   - `html2text` (weaker markdown support but battle-tested).
   - `pulldown-cmark` (markdown **generation** helper, not HTML parser — useful for the reverse direction but needs `scraper` or `html5ever` for parsing).
   - Score each on: produces the same output as our current `html_to_markdown` for the existing test corpus (`tests/` inside `export/markdown.rs`); handles TipTap's subset (bold/italic/strike/underline, headings, ordered/unordered lists, blockquote, code inline/block, links, images — the 17 tag forms currently handled); crate size and maintenance activity.
   - **Decision gate:** if any candidate passes ≥95% of the existing tests with ≤50 LOC of glue, proceed to step 2. If none does, go to step 4 (fallback plan).
2. **Replace `html_to_markdown()`** with the chosen crate, keeping the public signature `pub fn html_to_markdown(html: &str) -> String` intact so call sites in the image-asset-export path don't change.
3. **Preserve all existing tests** in `export/markdown.rs`. They are the contract. Any test that fails on the new library is either (a) a genuine behavior change to review with the user or (b) the library handling the edge case better — triage case-by-case. Update test expectations only when justified.
4. **Fallback plan** (if no crate fits):
   - Keep the current code but add a `cargo fuzz` target `fuzz_html_to_markdown` that feeds randomised TipTap-like HTML through the function and asserts it (a) terminates in <100 ms per input, (b) returns valid UTF-8, (c) is idempotent on already-markdown content. Adds a small continuous-integration cost but buys confidence.
   - Extract the 17 tag replacements into a `TAG_REPLACEMENTS: &[(&str, &str)]` table and run them in a single `for` loop. Not a win in LOC (~850 after), but reduces copy-paste risk when a new tag is added.
5. **Update `src-tauri/CLAUDE.md`:** if swapped for a crate, remove the mention in § File Structure that `export/markdown.rs` contains "HTML-to-Markdown conversion" and replace with "Export orchestration; HTML parsing via `<crate-name>`".

### Verification

```bash
cd src-tauri && cargo test export   # focused on the export tests
cd src-tauri && cargo test          # full suite
cd src-tauri && cargo clippy -- -D warnings
```

Manual: export a representative diary (sample in `tests/fixtures/` or generate one) and diff the old vs new markdown output. Acceptable differences: whitespace normalisation, escaping style. Unacceptable: semantic content loss.

### Rollback

Keep the old `html_to_markdown` function in a single commit that introduces the replacement; revert that commit to restore. If swapping dependencies, `Cargo.lock` needs to be regenerated.

---

## M5 — Split `PreferencesOverlay.tsx` into tab files (P2, ~4–6 h)

### Scope

Resolves finding **F1**. Splits a 1400-LOC component into a shell plus five tab files, each 150–300 LOC.

### Steps

1. **Target file structure:**
   ```
   src/components/overlays/preferences/
   ├── PreferencesOverlay.tsx           # Shell: dialog + tab list + save/cancel footer
   ├── PreferencesGeneralTab.tsx
   ├── PreferencesWritingTab.tsx
   ├── PreferencesSecurityTab.tsx       # Auth methods + journal directory change + reset
   ├── PreferencesDataTab.tsx           # Debug dump, data management
   └── PreferencesAdvancedTab.tsx       # Theme override JSON editor
   ```
   Delete the monolithic `PreferencesOverlay.tsx` at the old path; the shell takes its place under the new `preferences/` subfolder. Imports site-wide updated.
2. **Each tab is a pure component** with a `Tab` interface: `{ isOpen: Accessor<boolean>; onClose: () => void }`. Tabs own their local signals. Tabs reset local state in an `onCleanup` when the overlay closes. The shell no longer has the 70-line `handleOpenChange` reset block — each tab handles its own.
3. **Shared helpers** extracted to `src/components/overlays/preferences/shared.ts` only if more than one tab uses them. Do not over-share — a form field that appears in one tab stays in that tab.
4. **i18n keys unchanged.** Key structure `prefs.<section>.<key>` already aligns with per-tab files; no `en.ts` edits needed.
5. **Existing menu shortcut** (`menu-preferences` → `setIsPreferencesOpen(true)`) keeps working — the shell still owns `isPreferencesOpen` subscription.
6. **Update `src/CLAUDE.md`** File Structure block: point `overlays/PreferencesOverlay.tsx` → `overlays/preferences/` directory listing.

### Verification

```bash
bun run type-check
bun run lint
bun run test:run
bun run test:e2e:local        # confirm preferences overlay still opens/closes
```

Manual:
- Open each tab; confirm form fields are pre-populated correctly.
- Change a value in each tab; close-and-reopen the overlay; confirm the form reset worked (no stale values).
- Test the destructive flows: journal directory change, journal reset, remove auth method.

### Rollback

One commit per tab extraction (5–6 commits). If one tab misbehaves, revert only that commit and debug; the rest stay extracted.

---

## M6 — Extract `EditorPanel.tsx` logic into custom state hooks (P2, ~6–10 h)

### Scope

Resolves finding **F2**. Breaks a 675-LOC component with 11 local signals + 3 race latches + 2 monotonic request IDs into a small shell plus three composable hooks. Also adds one integration test.

### Steps

1. **Extract three hooks/modules** under `src/components/layout/editor-panel/`:

   | Hook | Owns | Signals |
   |---|---|---|
   | `useEntryLifecycle` | load/save/delete, debounce, race IDs | `loadRequestId`, `saveRequestId`, `pendingCreationPromise`, `justCreatedEntryId`, debounced save handle |
   | `useMultiEntryNav` | per-day entry list + index | `dayEntries`, `currentIndex`, `pendingEntryId`, navigation fns |
   | `useEditorEmptyCheck` | TipTap emptiness helpers | `editorIsEmpty`, `editorHasImages()`, `isContentEmpty()` |

2. **Component shell** keeps only: render tree, effect wiring (`createEffect` subscribing to `selectedDate`), TipTap instance creation, prop passing to `DiaryEditor` / `TitleEditor` / `EntryNavBar`. Target ≤300 LOC.
3. **Keep the existing three logic-mock test files** (`EditorPanel-save-logic`, `-multientry-nav`, `-delete-logic`). After extraction, they test the hooks directly rather than the component — rename to `useEntryLifecycle.test.ts`, `useMultiEntryNav.test.ts`, `useEditorEmptyCheck.test.ts`. Test imports need to change; assertions stay.
4. **Add one integration test** `EditorPanel.integration.test.tsx`:
   - Render the component with a real date and real (jsdom-compatible) TipTap editor instance. If TipTap refuses to mount in jsdom, write a minimal `MockEditor` shim in the test that honors `getHTML()`, `getText()`, `isEmpty`, and the `onUpdate` callback — cover the four flows listed in the review: load-then-type, switch-day-while-unsaved, delete-empty-on-nav, create-on-first-keystroke.
   - This is **one test file, four tests**. Not a full TipTap simulation.
5. **Update `src/CLAUDE.md`** File Structure block.

### Verification

```bash
bun run type-check
bun run lint
bun run test:run       # 229 → ~233 passing (three renamed hooks tests + 4 new integration)
bun run test:e2e:local # golden-path + multi-entry specs must stay green
```

Manual:
- Type in a new entry on today. Confirm auto-save after debounce.
- Switch days rapidly while typing. Confirm no saves race; last edit persists.
- Create an entry, leave blank, navigate away. Confirm deletion.
- Create second entry on same day via `+` button. Confirm navigation works.

### Rollback

Extract step-by-step in separate commits (one per hook). If integration test reveals a behavior regression, revert the offending hook extraction and leave the other two in place.

**Depends on:** none. **Pairs well** with F2-related test work in M7 — if executing M7 first, M7 may reveal the exact race edges M6's hooks need to encapsulate.

---

## M7 — Backfill high-risk frontend component tests (P2, ~8–12 h)

### Scope

Resolves finding **F3**. Incremental; each sub-milestone is independently landable.

### Sub-milestones (execute in value-descending order; each is independent)

#### M7.1 — `PreferencesOverlay` per-tab tests (~3 h, depends on M5)

**Depends on M5** — testing the monolithic file is not worth the effort; splitting makes tests natural.

For each of the five tab files, write one test that:
- Renders the tab in isolation.
- Verifies initial field values match the current preferences.
- Simulates a change, verifies the setter was called.
- For the Security and Data tabs, additionally test the destructive-action confirm dialogs.

Target: ~20 tests across 5 files.

#### M7.2 — `Calendar` tests (~2 h)

Test file: `src/components/calendar/Calendar.test.tsx`. Coverage:
- Renders the correct month header for a given `selectedDate`.
- `hasEntry` dots render only on dates that appear in `entryDates`.
- Month picker toggle opens/closes.
- Keyboard grid nav: Arrow keys move focus one day; Home / End; PageUp / PageDown; Enter selects.
- Click on a day calls `setSelectedDate`.

Target: ~8 tests.

#### M7.3 — `EditorPanel` integration test (~1 h, part of M6 → counts if M6 done)

Already planned as part of M6 step 4. If M6 is executed, this is done.

#### M7.4 — `JournalPicker` tests (~2 h)

Test file: `src/components/auth/JournalPicker.test.tsx` exists but has 4 tests — expand.

Add coverage:
- Add-journal flow: open overlay, select directory, confirm call to `addJournal`.
- Remove-journal flow: confirm dialog, `removeJournal` called.
- Rename-journal flow: inline edit, `renameJournal` called.
- Error-display path: `mapTauriError` result surfaces.
- Empty state: no journals → "create your first" CTA visible.

Target: +6 tests.

#### M7.5 — `state/auth.ts` state-machine tests (~2 h)

Test file: `src/state/auth.test.ts`. Coverage — per `AuthState` transition:
- `checking` → `journal-select` (no active journal on init).
- `checking` → `unlocked` (active auto-protected journal, auto-unlock success).
- `checking` → `locked` (active password journal, exists, not unlocked).
- `locked` → `unlocked` via `unlockJournal(password)` (mock tauri).
- `locked` → `locked` with error signal on bad password.
- `unlocked` → `locked` via `lockJournal()` (exercises `executeCleanupCallbacks`).
- `unlocked` → `locked` via backend `journal-locked` event.
- `unlocked` → `no-journal` via `journalExists()` returning false.

Target: ~8 tests. Mocks `tauri` module globally per existing test setup.

### Verification (all sub-milestones)

```bash
bun run test:run
bun run lint
bun run type-check
```

### Rollback

Each sub-milestone is one or two test files. Delete the test file(s); no source changes required.

### Notes

- Do **not** add tests for: `MainLayout.tsx` (existing listener test covers highest-risk path), `Sidebar.tsx` (tiny), `DiaryEditor.tsx` (heavily TipTap-dependent; covered by M6's integration test + E2E), low-traffic overlays (`AboutOverlay`, `GoToDateOverlay`, `ExportOverlay`, `ImportOverlay`). These are P3 until a regression actually lands.
- This milestone does **not** target 100% coverage. Goal is to cover the top-5 risk surfaces.

---

## Appendix A — P3 findings (not scheduled)

Listed for completeness. Promote only if a related P1/P2 milestone surfaces the issue.

| ID | Title | If promoted, plan |
|---|---|---|
| **B4** | `DiaryState` lock-guard boilerplate | Add `fn with_unlocked_db<T>` helper in `commands/auth/mod.rs`; refactor 30+ commands opportunistically as each is touched (no dedicated milestone). |
| **F4** | `en.ts` vs JSON locale inconsistency | Migrate `en.ts` → `en.json`; generate TypeScript type from JSON at build time. Defer until a community translator raises it. |
| **F5** | `debounce.ts` `any` leaks | Replace with `unknown[]` + stricter generic. Low-risk but noisy diff; skip. |
| **X1** | `lib.rs` legacy app-dir resolution comment | Leave; working as designed. |

## Appendix B — Execution order

Preferred order (all milestones are independent except M7.1 on M5, and M7.3 overlaps M6):

1. **M2** (1 h) — pure documentation, lowest risk, unblocks clarity.
2. **M1** (1.5 h) — small scope, fixes visible rot.
3. **M3** (1.5 h) — high value, pure deletion.
4. **M5** (4–6 h) — precondition for M7.1.
5. **M7.2, M7.4, M7.5** (~6 h) — independent test work, can interleave with anything.
6. **M6** (6–10 h) — highest-risk refactor; do after test harness is stronger (M7.2 + M7.5 already provide signal).
7. **M7.1** (3 h) — after M5.
8. **M4** (4–8 h) — independent; slot in as calendar allows.

If executing only P1: M1 + M2 = ~2.5 hours. Report done.

If executing P1 + highest-leverage P2: M1 + M2 + M3 + M5 + M6 + M7.1 = ~20 h.

## Self-check

Re-read of the plan confirms:

- Every milestone cites the source finding ID (A1–X1). Nothing invented.
- Every milestone lists concrete files to touch, not vague "refactor X". Paths verified against current tree.
- Verification commands match `CLAUDE.md § Verification Commands`.
- Dependencies are stated: only M7.1 has a hard dependency (M5); the rest are independent.
- P3 findings are parked in an appendix with a promotion path, not silently dropped.
- Each milestone has a rollback note; none are all-or-nothing.
- Total scheduled effort (~26–40 h) matches the review's summary table after subtracting P3.

**Not covered (out of scope, by design):**
- Search re-implementation (feature addition, not a review finding).
- E2E expansion (acknowledged thin in review; separate roadmap item).
- Website / benchmarks (explicitly out of review scope).
- Performance profiling (no findings; not worth a milestone).
