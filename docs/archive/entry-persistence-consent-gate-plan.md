# Entry Persistence Consent Gate

## Metadata

- Plan Status: COMPLETED
- Created: 2026-08-19
- Last Updated: 2026-08-20 (all 8 milestones COMPLETED; post-completion self-review found and fixed one real concurrency bug — see Post-Completion Review below)
- Owner: Coding agent
- Approval: APPROVED (2026-08-19, via user instruction to implement)
- UX-GATE: REQUIRED — satisfied 2026-08-19 (see Task 6.3)

## Post-Completion Review (2026-08-20)

After the plan was marked COMPLETED, the user asked for a full self-check of the implemented code for correctness, completeness, and accuracy. A `/code-review high` pass (partially completed before hitting a session API limit — one of four review angles finished cleanly, the rest terminated mid-run) surfaced three findings; each was independently verified by reading the actual source before acting on it, not taken on the review agent's word alone:

1. **CONFIRMED, fixed — same-day search-click race.** `SearchResults.tsx`'s `handleResultClick` sets `selectedEntryId` (a specific-entry deep link) *before* awaiting its own guarded `requestDateAndViewChange`. When the clicked result is on the same day already open, that write synchronously fires `EditorPanel.tsx`'s same-day deep-link effect (lines ~92-100), which independently calls `navigateToEntry` → `canLeaveCurrentEntry` — a *second*, concurrent invocation of the exact same guard `requestDateAndViewChange` is about to call itself via `requestNavigationConsent`. `confirmInApp()` (`src/state/confirm-dialog.ts`) is explicitly single-pending-call by design (see its own doc comment) with no queueing; the second concurrent call's dialog silently overwrote the first's `pendingResolve`, permanently orphaning the first caller's promise. Net effect: the erased entry still got deleted correctly (one of the two calls did resolve), but the intended entry switch driven by the *other*, now-permanently-hung call never completed — a real, user-visible "clicked entry doesn't open" bug, verified by hand-tracing the exact execution order through `SearchResults.tsx` → `EditorPanel.tsx`'s same-day effect → `useMultiEntryNav.ts`'s `navigateToEntry` → `useEntryLifecycle.ts`'s `canLeaveCurrentEntry` → `confirm-dialog.ts`.
   - **Fix:** `canLeaveCurrentEntry` (`useEntryLifecycle.ts`) now coalesces concurrent callers via a `leaveCheckInFlight` single-flight promise — a second caller while one is already running gets the *same* promise instead of starting its own `confirmInApp()` cycle, which is semantically correct (both callers are asking the identical "may I leave the current entry?" question about the identical current-entry snapshot), not just a race workaround.
   - **Regression tests added:** two new `useEntryLifecycle.test.ts` cases (coalescing itself, and that a later *non-concurrent* call still starts its own fresh check rather than reusing a stale result) — 32/32 pass. One new `EditorPanel.integration.test.tsx` case reproduces the exact real-world race against a real rendered `EditorPanel` (real effects, real async timing, not just mocked isolation) and asserts exactly one dialog plus a completed navigation — 26/26 pass in that file.
2. **CONFIRMED, fixed — stale deep-link id on a cancelled cross-date search click.** The same `handleResultClick` never rolled back `setSelectedEntryId(id)` when the guard denied navigation for a *different*-day result. `loadEntriesForDate` (`useEntryLifecycle.ts`) unconditionally reads and clears `selectedEntryId` on *every* date load, anywhere in the app — so a stale id left by a cancelled search click would silently deep-link into that specific entry on some later, unrelated visit to its day, instead of that day's normal default (newest) entry. Low-impact (ids never collide across days, so the "wrong" entry it jumps to is always the one originally clicked — surprising timing, not wrong data) but real.
   - **Fix:** `handleResultClick` now resets `setSelectedEntryId(null)` in the denial branch.
   - **Regression test:** the pre-existing `SearchResults.test.tsx` case literally asserted the buggy behavior (`expect(selectedEntryId()).toBe(2)` after a denial) — updated to assert the corrected behavior (`toBe(null)`) and switched from a fixed 2-tick `Promise.resolve()` wait to `waitFor`, since the fix added an extra async step after the guard resolves. 6/6 pass in that file.
3. **Reviewed, not a bug.** The pre-existing hard-delete button's native `confirm()` call passed `kind: 'warning'` (an OS-level dialog-icon severity hint); `confirmInApp()`/`ConfirmDialog.tsx` has no equivalent and never did across any of this plan's ~11 new call sites. Concluded this is a deliberate, acceptable simplification rather than a regression: every `confirmInApp()` call in the app means the identical thing ("delete this entry"), the plan's own Non-Goals section explicitly rejects building out a general-purpose dialog framework, and the destructive-red Confirm button (visible in the Task 6.3 walkthrough screenshots) already conveys the same severity an OS warning icon would.

Full verification after the fix: `bun run type-check`, `bun run lint`, `bun run format` all clean; full `bun run test:run` — **1021/1021 passed** (1018 + 3 new regression tests). Rust/backend, E2E, and diagrams were not touched by this fix (TypeScript-only), so those pre-flight results from initial completion still stand. `CHANGELOG.md`'s TODO-0104 entry gained a sub-bullet describing this fix in user terms, following this project's own established precedent (see the TODO-0098 "adversarial review" entries earlier in the same file) of documenting self/adversarial-review findings as their own changelog entries even for features that haven't shipped yet.

The review's other two angles (a full line-by-line diff scan, and a cross-file call-graph tracer) did not complete before the session hit its API limit and were not re-run, since the user asked to continue without further subagents. If this plan is revisited and more review budget is available, re-running those two angles against the current (now-fixed) diff would be the natural next step — but nothing here indicates unfinished work was silently skipped; this addendum documents exactly what was and wasn't covered.

## Handover Note (2026-08-20, plan COMPLETED)

**This plan is finished.** All 8 milestones are COMPLETED, all Pre-flight Checks pass, and the UX-GATE sign-off is recorded, and a post-completion self-review (see Post-Completion Review above) found and fixed one real concurrency bug plus one related minor bug. Nothing further to do here — this note is kept for historical context if this file is read again later.

**Summary of what shipped:**
- Backend: `delete_entry_if_empty_inner` now refuses to delete an entry whose on-disk row still holds real content, regardless of what the frontend sends (`src-tauri/src/commands/entries.rs`); new read-only `entry_has_content(id)` command.
- Frontend: a new in-app confirm dialog (`ConfirmDialog.tsx` + `confirm-dialog.ts`'s `confirmInApp()`), a navigation-guard registry (`src/state/entries.ts`), and `canLeaveCurrentEntry()` (`useEntryLifecycle.ts`) wired into every navigation entry point that can reach the user before discarding a blank-but-real entry: entry nav, lock toggle, day nav, Calendar, Sidebar "Today", Go To Date, Timeline, Search results, and the Timeline header toggle. The pre-existing hard-delete button's confirm was migrated from a native OS dialog to the same in-app one.
- Auto-lock and app-close deliberately never show a dialog — they rely solely on the backend refusal above (Non-Goals section).
- Full test coverage across all four layers (Rust unit, Vitest unit/integration, real E2E dialog round trip in `multi-entry.spec.ts` Scenario F) plus a live UX-GATE walkthrough of the 8 highest-value scenarios, user-approved 2026-08-19.
- Docs: `src/CLAUDE.md` (data-testid table + two gotcha extensions), `src-tauri/CLAUDE.md` (delete-commands note), `docs/diagrams/save-entry.mmd` **and** `save-entry-dark.mmd` (a light/dark pair Task 7.2 almost missed — see that task's Notes), `CHANGELOG.md`.
- Three real bugs were found and fixed via E2E testing during Milestone 4-6 work (not catchable by mocked-editor Vitest tests) — full detail recorded inline at their respective task Notes if this needs re-deriving: `navigateToEntry` off-by-one after a guard-confirmed delete (Task 4.1), `handleToggleLock` continuing to lock a just-deleted entry (Task 4.3), and `canLeaveCurrentEntry` mishandling a benign "Entry not found" race plus not refreshing `entryDates` after its own hard delete (Task 3.3, two separate findings).
- Two more real bugs were found and fixed in a **post-completion self-review** the user requested after the plan first reached COMPLETED — a same-day search-click concurrency race that could silently strand the intended entry switch, and a stale deep-link id left dangling after a cancelled cross-date search click. Full detail, including how each was independently verified before fixing, in the **Post-Completion Review** section above.
- Two environment-only issues surfaced and were worked around, not fixed in the codebase (see Task 6.3 and Task 8.2 Notes): a Vite dev-server optimizer wedge during the `tauri-agent-dev` walkthrough, and Vitest test timeouts caused by this session's own concurrent `cargo test`/`clippy`/`build` runs (confirmed environmental by an isolated re-run, not a regression).
- TODO-0104 marked `[x]` in `docs/todo/TODO.md`.

Nothing is pending. If a future task references this plan, treat it as closed — reopen only if new evidence (a bug report, a regression) requires revisiting the design here.

## Addendum (2026-08-20): Cancel Now Restores Content

A user-reported gap surfaced after this plan shipped: cancelling the confirm dialog correctly denied
navigation and never deleted anything, but left the editor showing the blank state that triggered the
dialog, with no visible way back to the real (still-safe-on-disk) content. The Non-Goals line above
("keeps the user on the current entry with their edit intact") is now superseded in one specific way:
"intact" means the real on-disk content is restored into view, not that the blank state is left as-is.
See `docs/entry-persistence-cancel-restore-plan.md` for the fix.

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Decision History

An earlier draft of this plan reused the app's existing native OS `confirm()` (`src/lib/dialog.ts`, backed by `@tauri-apps/plugin-dialog`) for the new consent gate, matching the one existing precedent — the explicit hard-delete button's confirmation. Two things surfaced during review:

1. That native dialog is a separate OS window, confirmed unreachable by WebDriver/`tauri-driver` (documented in `e2e/specs/backup-restore.spec.ts`'s own header comment) and not established to be reachable by `tauri-agent-dev`/CDP either — meaning the consent gate's dialog behavior could only ever be verified by a human manually clicking through the real app, for every one of the ~11 new trigger points this plan adds.
2. That native dialog turns out to be the **outlier**, not the norm, in this codebase: `GoToDateOverlay`, `PreferencesOverlay`, `BackupsOverlay`, `StatsOverlay`, `ImportOverlay`, `ExportOverlay`, `SearchOverlay`, and `BackupInspectDialog` are all in-app `@kobalte/core/dialog` dialogs — themed, DOM-based, fully driveable by WebDriver.

Given the consent gate multiplies dialog usage from 1 call site to ~11, the plan now builds a small in-app confirm dialog (Milestone 2) instead, and migrates the existing hard-delete button's confirm call to it too, so the app has one consistent, testable confirmation dialog rather than two different mechanisms. This removes the human-in-the-loop-only UX-GATE constraint from later milestones and makes full automated E2E coverage possible.

## Goal

Close the remaining silent-content-loss gap in entry persistence: the soft auto-delete path (`delete_entry_if_empty`) currently treats "this entry never had content" and "this entry had real content that just got erased" identically, deleting both without asking. After this plan:

1. The backend refuses to auto-delete any entry whose **on-disk** row currently holds real content, regardless of what the frontend sends — a floor that protects every write path, including the ones that can never show a dialog (auto-lock, app close).
2. Wherever the app can reach the user before navigating away with such an entry, it asks first via a blocking, in-app confirm dialog — reusing the same message/title copy the existing explicit delete button already shows, now rendered consistently for both — instead of leaving a silently-un-deleted blank row for the user to discover later.

## Scope

- Backend: `delete_entry_if_empty_inner` in `src-tauri/src/commands/entries.rs` gains an on-disk content check before deleting.
- Backend: new read-only `entry_has_content` command exposing that same on-disk check to the frontend guard.
- Frontend: a new in-app confirm dialog — a promise-based service (`src/state/confirm-dialog.ts`) plus one Kobalte dialog component (`src/components/overlays/ConfirmDialog.tsx`), mounted once in `MainLayout.tsx`, exposing `confirmInApp(message, options): Promise<boolean>`.
- Frontend: the existing hard-delete button's confirm (`handleDeleteEntry` in `useMultiEntryNav.ts`) migrates from the native `confirm()` to `confirmInApp()` — same behavior, consistent dialog language.
- Frontend: a new navigation-guard registry (`src/state/entries.ts`), mirroring the existing `registerCleanupCallback`/`registerReloadCallback` pattern.
- Frontend: `useEntryLifecycle.ts` registers a `canLeaveCurrentEntry()` guard that shows the in-app confirm dialog and performs an explicit hard-delete on confirmation.
- Frontend Phase 1: wire the guard into `navigateToEntry`, `addEntry` (`useMultiEntryNav.ts`), and `handleToggleLock` (`EditorPanel.tsx`) — all already plain async functions called directly from click handlers.
- Frontend Phase 2: new guarded navigation entry points (`requestDateChange`, `requestMainViewChange`, and a combined variant) in `src/state/ui.ts`, wrapping the existing raw `setSelectedDate`/`setMainView`. Every non-reset call site that currently calls the raw setters switches to the guarded wrappers: `day-navigation.ts` (5 functions), `Calendar.tsx`, `Sidebar.tsx`, `GoToDateOverlay.tsx`, `Timeline.tsx`, `SearchResults.tsx`, `Header.tsx` (timeline toggle).
- Test coverage across all four layers touched: Rust unit tests, Vitest unit/integration tests, and real E2E dialog-interaction coverage (now possible — see Decision History).
- Docs: `src/CLAUDE.md` (including a new data-testid table entry), `src-tauri/CLAUDE.md`, `docs/diagrams/save-entry.mmd`, `CHANGELOG.md`.

## Non-Goals

- **Auto-lock paths** (idle timer, OS session lock/logoff/suspend, focus-loss debounce) — all four converge on the single `lockJournal()` in `src/state/auth.ts` and must never wait on a dialog; they rely solely on the backend safety net (Milestone 1). No changes to `lockCleanup`'s flush call in `useEntryLifecycle.ts`.
- **`beforeunload`/app close** — fire-and-forget today (`EditorPanel.tsx`); stays fire-and-forget. Relies solely on the backend safety net.
- Adding new i18n keys or new dialog copy — the confirm dialog reuses the existing `editor.deleteConfirmMessage`/`editor.deleteConfirmTitle` keys verbatim (decided during exploration; see Open Questions). Switching to an in-app dialog does not change this — it changes how the message renders, not what it says.
- Any change to how `save_entry` (non-delete path) behaves.
- Building a general-purpose, app-wide confirm/dialog framework. `confirmInApp()` is scoped to this one use case (delete confirmation, single-pending-call-at-a-time); it is not a generic queueing dialog system.
- Building a "recycle bin"/undo mechanism. A cancelled navigation simply keeps the user on the current entry with their edit intact; there is no separate trash state.

## Assumptions

- No existing `docs/todo/TODO.md` item tracks this work. Before implementation starts, a TODO entry should be added via the `todo-manager` skill per root `CLAUDE.md`'s Agent Workflow Rules — this plan does not create one itself, since that is a distinct action from planning.
- `@kobalte/core/dialog` is already a project dependency, used by 8+ existing overlay components (verified: `GoToDateOverlay.tsx` and others). No new dependency is introduced.
- `db::get_entry_by_id` (used by `create_entry` already) is available to `commands/entries.rs` without a new import.
- Community locale files (`de.json`, `es.json`, `fr.json`, `hi.json`, `it.json`, `pt-BR.json`) need no changes, since no new i18n keys are introduced.
- The project's Windows execution environment rules apply: run frontend/type-check/lint commands via `cmd.exe /c bun run ...`, backend tests via bare `cargo test --workspace`.

## Open Questions

Resolved during exploration and plan drafting (both via `AskUserQuestion`, recorded here per the skill's protocol):

1. **Dialog copy**: reuse the existing `editor.deleteConfirmMessage`/`editor.deleteConfirmTitle` keys verbatim rather than writing new context-specific wording. **Resolved: reuse existing keys.** Rationale given: the action performed is identical (the entry is deleted) even though the trigger differs, and this avoids new i18n keys across 6 locale files.
2. **"Was this real content?" check**: read live from the backend (new `entry_has_content` command) rather than from the in-memory `dayEntries()` copy. **Resolved: live backend read.** Rationale given: immune to the in-memory copy being stale or wrong — the exact failure class TODO-0089 already fixed once.
3. **Dialog mechanism**: native OS `confirm()` (matching the one existing precedent) vs. an in-app Kobalte dialog (matching the app's dominant pattern). **Resolved: in-app dialog**, and migrate the existing hard-delete button's confirm to match. Rationale given: the native dialog is untestable by WebDriver/CDP, steals OS focus, and is the outlier rather than the norm in this codebase — see Decision History.

No unresolved questions remain.

## UX-GATE Scenarios

This plan introduces confirm-dialog interactions at multiple navigation points. Per the manual-planning UX gate, each scenario below must be walked through against the real running app with explicit user sign-off before the plan can move to `COMPLETED` — see Task 6.3. Listing them here is the enumeration; the sign-off itself happens at execution time since no UI exists yet to prototype against.

Because the dialog is now in-app DOM content (Decision History), the agent can drive the full interaction — including clicking Confirm/Cancel — via `tauri-agent-dev`/CDP or WebdriverIO, unlike the native-dialog approach originally planned. The user's sign-off is still required per the UX-GATE rule (an agent's own description of behavior does not satisfy it), but the walkthrough no longer needs a manual hand-off at the moment of clicking.

| # | Scenario | Trigger | Expected behavior | Sign-off |
|---|----------|---------|--------------------|----------|
| 1 | Entry-to-entry nav, content erased | Click `←`/`→`/entry-number in `EntryNavBar` after erasing a real entry's content | In-app confirm dialog shown before navigating; Cancel keeps the editor open on the same (now-blank) entry with focus retrievable; Confirm deletes the entry and navigates | **agent-verified 2026-08-19, **APPROVED by user 2026-08-19**.** Live walkthrough: seeded a 2-entry day, erased entry 2's content, clicked `←`. Dialog appeared, blocking navigation (editor still showed entry 2's blank state). Escape/backdrop not separately tested here (covered under #15). Cancel: dialog closed, still on entry 2, entry 1 & 2 both intact. Repeated, clicked Confirm: dialog closed, entry 2 deleted, navigated to entry 1. Screenshot: `.agent-dev/scenario1-dialog.png`. |
| 2 | Toggle lock, content erased | Click the lock toggle after erasing a real entry's content | Same confirm/cancel/confirm behavior as #1, gating the lock toggle | **agent-verified 2026-08-19, **APPROVED by user 2026-08-19**.** Erased entry 1's content (single entry remaining on the day), clicked the lock toggle. Same dialog appeared (screenshot: `.agent-dev/scenario2-dialog.png`). Confirmed: dialog closed, entry hard-deleted (day nav collapsed to "+" only) rather than locked — correct, since Task 4.3 fixed `handleToggleLock` to not lock a just-deleted entry. |
| 3 | Header day-nav | Click `◀`/`▶` after erasing a real entry's content | Confirm dialog shown before the date changes | Not walked live — user chose the reduced scope via `AskUserQuestion` (see Task 6.3 note). Automated coverage: `day-navigation.test.ts` (shares the same five `day-navigation.ts` functions as #4/#5). |
| 4 | Keyboard day-nav | `Mod+[`/`Mod+]` after erasing a real entry's content | Same as #3 — keyboard shortcuts share `day-navigation.ts` with the Header buttons | Not walked live (reduced scope). Automated coverage: `day-navigation.test.ts`. |
| 5 | Keyboard today/month-nav | `Mod+T`, `Mod+Shift+[`, `Mod+Shift+]` after erasing content | Same confirm behavior | Not walked live (reduced scope). Automated coverage: `day-navigation.test.ts`. |
| 6 | Calendar day click | Click a different day in `Calendar.tsx` after erasing content | Confirm dialog shown before the date changes | Not walked live (reduced scope). Automated coverage: `Calendar.test.tsx`. |
| 7 | Sidebar "Today" | Click the Sidebar "Today" shortcut after erasing content | Confirm dialog shown before the date changes | Not walked live (reduced scope). Automated coverage: `Sidebar.tsx`'s guarded call site + `ui.test.ts`. |
| 8 | Go To Date overlay | Submit a new date in `GoToDateOverlay.tsx` after erasing content | Confirm dialog shown before the date changes (stacked on top of the Go To Date overlay) | **agent-verified 2026-08-19, **APPROVED by user 2026-08-19**.** Erased content, opened Go To Date, submitted a different date. Confirm dialog appeared stacked on top of the Go To Date overlay (screenshot: `.agent-dev/scenario8-dialog.png`, both dialogs visible). Confirmed: both dialogs closed, header date changed to the target date. |
| 9 | Timeline row click | Click a Timeline row (changes date + view together) after erasing content on the open entry | Confirm dialog fires **exactly once** for the combined date+view change, not twice | Not walked live (reduced scope). Automated coverage: `Timeline.test.tsx` (asserts single-fire `requestDateAndViewChange`). |
| 10 | Search result click | Click a search result (changes date + view together) after erasing content | Same single-fire behavior as #9 | Not walked live (reduced scope). Automated coverage: `SearchResults.test.tsx` (asserts single-fire `requestDateAndViewChange`). |
| 11 | Header Timeline toggle | Click the Timeline toggle button after erasing content | Confirm dialog shown before the view switches (and before `EditorPanel` unmounts) | **agent-verified 2026-08-19, **APPROVED by user 2026-08-19**.** Erased content, clicked the Timeline toggle. Dialog appeared before the view switched. Confirmed: dialog closed, `timeline-toggle-button[aria-pressed]` became `true` (now on Timeline view), entry deleted. |
| 12 | Boundary check: auto-lock never blocks | Erase real content, trigger idle-timeout auto-lock (or the OS-lock/focus-loss paths) | Journal locks immediately with **no dialog**; the entry is left un-deleted (backend refusal), discoverable afterward | **agent-verified 2026-08-19, **APPROVED by user 2026-08-19**.** Set a 5s idle auto-lock timeout via the real Preferences → Security UI, erased a real entry's content, then took no action past the debounce. App locked to the password-unlock screen with no dialog anywhere. Unlocked again, navigated to the entry's date: title/body were fully intact (`"Scenario 14 Entry A"` / `"First entry for delete button test."`) — not just present-but-blank, proving the backend on-disk check protected the actual content, not merely a row. |
| 13 | Boundary check: app close never blocks | Erase real content, close the app | App closes with **no dialog**; the entry is left un-deleted (backend refusal) | **agent-verified 2026-08-19, **APPROVED by user 2026-08-19** (verified via console log + architectural symmetry rather than a fresh relaunch screenshot).** Erased the same entry's content again, waited past the debounce, then closed the app (`agent:dev:stop`) — closed cleanly in 0.66s with no hang and no dialog anywhere. The dev-server console log (`.agent-dev/dev.log`) shows the debounce's own delete attempt was refused in real time just before close: `[Editor] debouncedSave: backend refused to delete entry 5 — content was not blank`. A relaunch-and-reopen screenshot to directly re-confirm content survival was attempted but blocked by a Vite dev-server hang unrelated to the app (see Notes) after two cache-clear retries; not re-attempted a third time. Confidence in content survival rests on: (a) the console log proving the exact same backend refusal fired for this entry that #12 already proved (via full unlock+reopen) preserves real content, not just an empty row — same code path (`delete_entry_if_empty_inner`'s on-disk check), same entry, same erase-then-idle sequencing; and (b) the plan's own architecture (Non-Goals section) — app-close relies solely on the same backend safety net as auto-lock, with no separate close-specific logic to diverge. |
| 14 | Explicit delete button still works | Click the `−` trash button in `EntryNavBar` on any entry | Same in-app dialog now backs this pre-existing action too (migrated in Milestone 2); confirms it looks/behaves identically to before, just no longer a native OS window | **agent-verified 2026-08-19, **APPROVED by user 2026-08-19**.** Created a 2-entry day with real content in both entries, clicked the trash button on entry 2 (which has real content — not gated by the consent-gate's blank-check, since the trash button always confirms regardless of content). Same `confirm-dialog` component appeared with identical copy. Confirmed: entry 2 deleted, entry 1 remains. |
| 15 | Dialog resists incidental dismissal | With the dialog open (any trigger from #1-11 or #14): press Escape; click outside the dialog (on the dimmed backdrop); look for a close (`×`) button | **Nothing happens** in all three cases — dialog stays open, no entry is deleted, no navigation occurs. Only clicking Cancel or Confirm closes it. No `×`/close icon is present at all | **agent-verified 2026-08-19, **APPROVED by user 2026-08-19**.** During the #11 walkthrough's open dialog: Escape pressed — dialog stayed open. Backdrop clicked at a point well outside the dialog card (confirmed via `elementFromPoint` before clicking, and again as a direct DOM dispatch to rule out a covered-element false negative) — dialog stayed open. Confirmed no `[aria-label*="Close"]`/`[aria-label*="Dismiss"]` element exists inside `confirm-dialog`, and the screenshots (#1/#2/#8) show no `×` icon. Only the Cancel/Confirm buttons closed it in every trial across #1, #2, #8, #11, #14. Also independently covered by Task 6.2's automated Scenario F (real trusted WebDriver clicks, not JS-dispatched). |

## Milestones

### Milestone 1: Backend Safety Net — On-Disk Content Check

- Status: COMPLETED
- Purpose: Make the soft-delete path refuse to delete any entry whose on-disk row currently holds real content, independent of what the frontend sends, and expose that same fact as a cheap read the frontend guard can use before deciding whether to show a dialog. This is the floor that protects every path, including ones that can never show a confirm.
- Exit Criteria: `cargo test --workspace` is green including the new named tests below; `delete_entry_if_empty_inner` refuses to delete when the on-disk row is non-blank even if the incoming `title`/`text` arguments are blank; `entry_has_content` is registered and reachable end-to-end.

#### Task 1.1: Extract a shared blank-row helper and gate `delete_entry_if_empty_inner` on the on-disk row

- Status: COMPLETED
- Objective: `delete_entry_if_empty_inner` deletes only when **both** the incoming arguments and the entry's currently-persisted row are blank.
- Steps:
  1. In `src-tauri/src/commands/entries.rs`, add a small private helper next to `is_blank_html`: `fn entry_is_blank(title: &str, text: &str) -> bool { title.trim().is_empty() && is_blank_html(text) }`. Replace the existing inline condition in `delete_entry_if_empty_inner` with a call to it (no behavior change yet).
  2. Inside `delete_entry_if_empty_inner`'s `with_unlocked_db` closure, after the incoming-argument check passes, fetch the current row with `db::get_entry_by_id(db, id)?`. If it returns `None`, return `Ok(false)` (nothing to delete — matches the existing "not found" tolerance used elsewhere in this file).
  3. If the row exists, require `entry_is_blank(&existing.title, &existing.text)` to also be true before calling `db::delete_entry_by_id(db, id)`. If the on-disk row is non-blank, return `Ok(false)` — the same refusal contract the function already has, now covering a new case.
- Validation: Add these named Rust tests in the `#[cfg(test)] mod tests` block of `src-tauri/src/commands/entries.rs`:
  - `test_delete_entry_if_empty_refuses_when_disk_row_still_has_content` — insert an entry with real title/text, call `delete_entry_if_empty_inner` with blank `title`/`text` arguments (simulating a stale/blank frontend payload), assert it returns `Ok(false)` and the row still exists.
  - `test_delete_entry_if_empty_still_allows_genuinely_blank_entry` — insert a blank entry (as `create_entry` would), call with blank arguments, assert it returns `Ok(true)` and the row is gone. This guards against a regression of the pre-existing "abandoned new entry" cleanup behavior.
  Run `cargo test --workspace` and confirm both pass along with the full suite.
- Notes: Depends on nothing. `db::get_entry_by_id` is already imported/used in this file (see `create_entry`). Did not change `save_entry_inner` — out of scope, as planned. **Deviation (in-scope fix, not a separate task):** the pre-existing test `test_delete_entry_if_empty_refuses_non_empty_text` asserted that blank incoming args alone delete an entry even while its on-disk row still held `"<p>Real content</p>"` — exactly the silent-content-loss bug this task closes. Updated it in place: that call now asserts refusal, and a new final step actually blanks the on-disk row via `save_entry_inner` before asserting the delete succeeds. All 270 app-crate tests (460 workspace tests total) pass.

#### Task 1.2: Add and register a read-only `entry_has_content` command

- Status: COMPLETED
- Objective: A new Tauri command lets the frontend guard check, without mutating anything, whether an entry's on-disk row currently holds real content.
- Steps:
  1. In `src-tauri/src/commands/entries.rs`, add:
     ```rust
     #[tauri::command]
     pub fn entry_has_content(id: i64, state: State<DiaryState>) -> Result<bool, String> {
         with_unlocked_db(&state, |db| {
             let entry = db::get_entry_by_id(db, id)?.ok_or_else(|| "Entry not found".to_string())?;
             Ok(!entry_is_blank(&entry.title, &entry.text))
         })
     }
     ```
     (Signature/body illustrative — match existing command conventions in this file, e.g. the `with_unlocked_db` closure style used by `get_entries_for_date`.)
  2. `src-tauri/src/commands/mod.rs` contains only `pub mod` declarations (one line per command-group file, e.g. `pub mod entries;`) — verified by reading the file; individual commands are not re-declared there. No change needed in this file.
  3. Add `commands::entries::entry_has_content,` to the `generate_handler![]` macro in `src-tauri/src/lib.rs`, immediately after `commands::entries::delete_entry_if_empty,` (line 413 as of this plan's writing) to keep related commands grouped.
- Validation: Add named Rust tests:
  - `test_entry_has_content_true_for_entry_with_real_content` — insert a non-blank entry, assert `entry_has_content` returns `Ok(true)`.
  - `test_entry_has_content_false_for_blank_entry` — insert a blank entry, assert `Ok(false)`.
  - `test_entry_has_content_errors_for_missing_entry` — call with a nonexistent id, assert an `Err` containing `"Entry not found"`.
  Run `cargo test --workspace`.
- Notes: Depends on Task 1.1's `entry_is_blank` helper. Command registration is two places per `src-tauri/CLAUDE.md` gotcha #3 — missing either causes a silent frontend failure, not a compile error, so double-check both. **Deviation:** `tauri::State`'s inner field is private with no public constructor, so it cannot be built directly in a unit test (confirmed by reading `tauri-2.11.5/src/state.rs`). Followed the same pattern this file already uses for `save_entry`/`save_entry_inner`: added `entry_has_content_inner(id, state: &DiaryState)` as the pure, directly-testable core, with the `#[tauri::command]` as a one-line delegator. The three named tests call the `_inner` function.

### Milestone 2: In-App Confirm Dialog Infrastructure

- Status: COMPLETED
- Purpose: Replace reliance on the native OS `confirm()` with an in-app Kobalte dialog usable from anywhere via a promise-based API, matching the app's dominant dialog pattern instead of its one native outlier (see Decision History). This removes the WebDriver/CDP untestability problem and the OS-focus-steal/auto-lock interaction the native dialog required, for both the new consent gate and the pre-existing hard-delete button.
- Exit Criteria: `confirmInApp()` is implemented and rendered once in the app shell; the existing hard-delete button's confirm is migrated to it with no behavior change from the user's perspective (same message/title, same confirm/cancel semantics); the dialog can be closed **only** by its Cancel or Confirm button — Escape, outside click, and any close icon are all explicitly proven inert (Task 2.2); Vitest coverage proves the promise resolves correctly; `bun run test:run` and `bun run type-check` are green.

#### Task 2.1: Add the confirm-dialog service

- Status: COMPLETED
- Objective: A small promise-based service exists that any code can call to show the confirm dialog and await the user's answer, mirroring the native `confirm()` call shape it replaces (`Promise<boolean>`).
- Steps:
  1. Create `src/state/confirm-dialog.ts`:
     ```ts
     import { createSignal } from 'solid-js';

     const [isOpen, setIsOpen] = createSignal(false);
     const [message, setMessage] = createSignal('');
     const [dialogTitle, setDialogTitle] = createSignal('');
     let pendingResolve: ((result: boolean) => void) | null = null;

     export const isConfirmDialogOpen = isOpen;
     export const confirmDialogMessage = message;
     export const confirmDialogTitle = dialogTitle;

     export function confirmInApp(msg: string, options?: { title?: string }): Promise<boolean> {
       return new Promise((resolve) => {
         setMessage(msg);
         setDialogTitle(options?.title ?? '');
         pendingResolve = resolve;
         setIsOpen(true);
       });
     }

     export function respondToConfirm(result: boolean): void {
       setIsOpen(false);
       pendingResolve?.(result);
       pendingResolve = null;
     }
     ```
     (Illustrative — match existing signal-export conventions used elsewhere in `src/state/*.ts`.)
  2. Add `isConfirmDialogOpen()` to `isAnyOverlayOpen()` in `src/state/ui.ts` (currently lines 62-76), so the global Escape handler and every app-level keyboard shortcut treat this dialog like every other overlay — per that function's own doc comment ("Every overlay signal in this module belongs here").
- Validation: `cmd.exe /c bun run type-check` passes. New `src/state/confirm-dialog.test.ts`: `confirmInApp resolves true when respondToConfirm(true) is called`, `confirmInApp resolves false when respondToConfirm(false) is called`, `isConfirmDialogOpen reflects open/closed state around a pending confirm`.
- Notes: Only one pending confirm is ever in flight in this app (a single delete-confirmation call site active at a time) — no queueing is needed, and none should be added (see Non-Goals). **Addition found during implementation (advisor review before Milestone 2 started):** if auto-lock fires while the dialog is open, `pendingResolve` would never be called and `isOpen` would stay `true` after the next unlock — a promise nobody resolves, and a dialog that reappears after unlock. `src/CLAUDE.md`'s documented state-management invariant ("if you add a module that holds session-scoped data, add its reset call [to `session.ts:resetSessionState()`]") applies directly here. Fix: export a `resetConfirmDialogState()` from `confirm-dialog.ts` that resolves any pending promise as `false` and closes the dialog, and call it from `resetSessionState()` in `src/state/session.ts` alongside the existing `resetEntriesState`/`resetSearchState`/`resetUiState`/`resetTagsState` calls. This makes the Non-Goals' "auto-lock must never wait on a dialog" guarantee hold even for a dialog that is already open when lock fires, not just for dialogs not yet opened.

#### Task 2.2: Add the `ConfirmDialog` component — explicit choice only, no incidental dismissal

- Status: COMPLETED
- Objective: A rendered dialog component shows the message/title from Task 2.1's service, reports the user's choice back to it, and **cannot be dismissed except by pressing Confirm or Cancel** — no Escape key, no click-outside, no close (`×`) button. This is a hard requirement, not a default: Kobalte's dialog is dismissable by Escape and outside-click **by default**, even when modal, so each path must be explicitly overridden.
- Steps:
  1. **Verified against installed source** (`node_modules/@kobalte/core/src/dialog/dialog-content.tsx`, `dismissable-layer.tsx`, `dialog-root.tsx`): `Dialog.Root`'s `modal` prop defaults to `true` (`dialog-root.tsx` line 66/101), which already traps focus and blocks focus-outside dismissal automatically (`DialogContent`'s own `onFocusOutside` calls `e.preventDefault()` when modal). It does **not**, however, block Escape or a plain outside click by default — `DismissableLayer` (`dismissable-layer.tsx` lines 180-193, 145-160) calls the consumer's `onEscapeKeyDown`/`onPointerDownOutside` first and only skips its own `onDismiss()` call if that handler called `event.preventDefault()`. `DialogOverlay` (the backdrop) has no independent close-on-click logic of its own (verified — it only guards a Firefox text-selection quirk) — a backdrop click is routed through this same outside-pointer-down path, so blocking `onPointerDownOutside` covers it too.
  2. Create `src/components/overlays/ConfirmDialog.tsx`, following `GoToDateOverlay.tsx`'s general structure (`Dialog` from `@kobalte/core/dialog`, `open`/`onOpenChange` bound to `isConfirmDialogOpen`), but on `Dialog.Content` add:
     ```tsx
     <Dialog.Content
       onEscapeKeyDown={(e) => e.preventDefault()}
       onPointerDownOutside={(e) => e.preventDefault()}
       data-testid="confirm-dialog"
     >
     ```
     Both handlers must do nothing but `preventDefault()` — no fallback `respondToConfirm(false)` call, since the requirement is that these interactions have **no effect at all**, not that they act as an implicit Cancel.
  3. Do **not** render a `Dialog.CloseButton` (the `×` icon `GoToDateOverlay.tsx` includes at line 116) — omitting it removes the third dismiss path. The only way `isOpen` may become `false` is via the Cancel/Confirm buttons calling `respondToConfirm(false)`/`respondToConfirm(true)`.
  4. Render `confirmDialogTitle()` in `Dialog.Title` and `confirmDialogMessage()` in `Dialog.Description`, with Cancel and Confirm buttons calling `respondToConfirm(false)` / `respondToConfirm(true)` respectively.
  5. Add `data-testid="confirm-dialog-cancel-button"` on the Cancel button and `data-testid="confirm-dialog-confirm-button"` on the Confirm button — these plus `confirm-dialog` from step 2 are new entries for the canonical table (Milestone 7, Task 7.1).
  6. Style the Confirm button as the destructive action. This codebase has no existing destructive-button class precedent (verified: no `bg-red-`/`danger` button styling found in `EntryNavBar.tsx` or elsewhere) but does use a semantic `text-error` token (seen in `ImagePickerOverlay.tsx`) — check `uno.config.ts`/`src/styles` for an existing error/danger color token and use it rather than introducing an ad hoc raw color value.
  7. Mount `<ConfirmDialog />` once in `MainLayout.tsx`, alongside the other overlay components it already renders (`PreferencesOverlay`, etc.).
- Validation: `cmd.exe /c bun run type-check` passes. New `ConfirmDialog.test.tsx`:
  - renders the message/title passed via `confirmInApp` when open;
  - clicking Confirm calls `respondToConfirm(true)` and closes;
  - clicking Cancel calls `respondToConfirm(false)` and closes;
  - **pressing Escape while open does not close the dialog and does not call `respondToConfirm`** (simulate a keydown event on the dialog content, assert `isConfirmDialogOpen()` is still `true` and the mock is not called);
  - **a simulated outside pointerdown does not close the dialog and does not call `respondToConfirm`**;
  - no `Dialog.CloseButton`/`×` element is present in the rendered output.
  Run `cmd.exe /c bun run test:run`.
- Notes: This dialog does **not** need `src/lib/dialog.ts`'s focus-loss guard (`isDialogOpen()`/`withDialogGuard`) — that mechanism exists specifically because native dialogs are separate OS windows that steal focus; an in-app Kobalte dialog is ordinary WebView content and never triggers the focus-loss auto-lock path in the first place. Do not wire it into that guard. This behavior (no incidental dismissal) is deliberately **specific to `ConfirmDialog`** — do not carry `onEscapeKeyDown`/`onPointerDownOutside` overrides into any of the app's other Kobalte dialogs (`GoToDateOverlay` etc.), which are expected to keep their existing Escape/outside-click dismiss behavior. **Implementation notes:** re-verified all of step 1's source claims directly against `node_modules/@kobalte/core/src/dialog/dialog-root.tsx`, `dialog-content.tsx`, `dialog-overlay.tsx`, and `primitives/create-interact-outside`/`create-escape-key-down` before writing the component — all confirmed accurate. **Deviation on step 6:** the plan's own verification ("no existing destructive-button class precedent … found in `EntryNavBar.tsx` or elsewhere") was incomplete — `src/index.css` already defines `.interactive-destructive`/`.interactive-destructive:not(:disabled):hover`, in active use by `PreferencesDataTab.tsx`'s "Reset Journal" button. Used that existing class instead of `text-error`, since it is the actual established destructive-button precedent, not just a status-text token. **Button labels:** the plan specified reusing `editor.deleteConfirmMessage`/`deleteConfirmTitle` for the dialog body/title but did not specify the button labels; per the Non-Goals' "no new i18n keys" constraint, reused `common.cancel` ("Cancel") and `editor.deleteEntry` ("Delete entry") — the latter already exists in the same `editor` namespace as the message/title keys and names the exact action.

#### Task 2.3: Migrate `handleDeleteEntry`'s existing confirm to `confirmInApp`

- Status: COMPLETED
- Objective: The pre-existing explicit hard-delete button (`EntryNavBar`'s `−` button) uses the same in-app dialog as the new consent gate, so the app has one confirmation dialog language, not two.
- Steps:
  1. In `useMultiEntryNav.ts`, replace `import { confirm } from '../../../lib/dialog';` with `import { confirmInApp } from '../../../state/confirm-dialog';`.
  2. Replace the call `await confirm(opts.t('editor.deleteConfirmMessage'), { title: opts.t('editor.deleteConfirmTitle'), kind: 'warning' })` in `handleDeleteEntry` with `await confirmInApp(opts.t('editor.deleteConfirmMessage'), { title: opts.t('editor.deleteConfirmTitle') })` — the `kind: 'warning'` option is native-dialog-only (an OS icon hint) and is dropped; Task 2.2's destructive Confirm-button styling conveys severity instead.
- Validation: `cmd.exe /c bun run type-check` passes. Update `useMultiEntryNav.test.ts`'s existing delete-confirm coverage to mock `confirmInApp` in place of `confirm`; the confirmed → deletes / cancelled → no-op assertions are otherwise unchanged.
- Notes: Pure swap of the dialog primitive — `handleDeleteEntry`'s own delete logic (`opts.dayEntries().length <= 1` guard, `deleteEntry(entryToDelete.id)` call, post-delete index selection) does not change. **Deviation:** the plan's validation named `useMultiEntryNav.test.ts` as the file to update, but that file's `handleDeleteEntry` coverage turned out to be pure-logic mirrors (`calculatePostDeleteIndex` etc.) that never exercised the real `confirm()`/`confirmInApp()` call at all — grep confirmed zero `confirm`/`dialog` references in that file. The actual coverage exercising the real confirm call through a rendered `EntryNavBar` delete-button click lives in `EditorPanel.integration.test.tsx` (`mocks.confirm` wired through `@tauri-apps/plugin-dialog`'s mocked `confirm`). Updated that file instead: dropped `confirm` from the `@tauri-apps/plugin-dialog` mock (kept `open`, still used by the import flow) and added a `vi.mock('../../state/confirm-dialog', ...)` that spreads the real module's exports and overrides only `confirmInApp` with `mocks.confirm` — `isConfirmDialogOpen()` etc. stay real since `state/ui.ts`'s `isAnyOverlayOpen()` (imported directly by this suite) depends on them. All 52 tests in both files pass unchanged in behavior (`mocks.confirm.mockResolvedValue(true)` in `beforeEach` still drives the same confirmed-delete path).

### Milestone 3: Frontend Guard Infrastructure

- Status: COMPLETED
- Purpose: Build the single reusable consent guard and its registration mechanism, ready for both Phase 1 (in-`EditorPanel`) and Phase 2 (outside-`EditorPanel`) call sites to use.
- Exit Criteria: `canLeaveCurrentEntry()` is implemented, registered by `useEntryLifecycle`, unit-tested in isolation for its three branches (no-op, confirmed, cancelled), and `bun run test:run` is green.

#### Task 3.1: Add the navigation-guard registry to `src/state/entries.ts`

- Status: COMPLETED
- Objective: A registry exists that lets `useEntryLifecycle` register a guard callback and lets navigation call sites ask "may I proceed?" before mutating navigation state.
- Steps:
  1. In `src/state/entries.ts`, add a new callback-array signal mirroring the existing `cleanupCallbacks`/`reloadCallbacks` pattern (lines 34-46 and 48-70): `const [navigationGuards, setNavigationGuards] = createSignal<(() => Promise<boolean>)[]>([]);`.
  2. Add `registerNavigationGuard(callback: () => Promise<boolean>): () => void`, matching `registerCleanupCallback`'s shape exactly (push on register, filter on unregister, return the unregister function).
  3. Add `export async function requestNavigationConsent(): Promise<boolean>` that awaits every registered guard in sequence and returns `false` as soon as any guard returns `false` (short-circuit — do not run subsequent guards once one has denied). Return `true` if the registry is empty or every guard approves.
  4. Add a short doc comment on the new exports explaining the contract, following the existing doc-comment style on `registerReloadCallback` in the same file (explain what "denies navigation" means to a caller).
- Validation: `cmd.exe /c bun run type-check` passes. `src/state/entries.test.ts` already exists (verified) — extend it with cases: zero guards registered → `requestNavigationConsent()` resolves `true`; one guard returning `true` → resolves `true`; one guard returning `false` → resolves `false`; two guards where the first returns `false` → the second guard is never invoked (assert via a spy call count of zero).
- Notes: In practice only one guard is ever registered at a time (one live `EditorPanel` instance), but the array-based registry keeps this consistent with the existing `registerCleanupCallback`/`registerReloadCallback` conventions rather than introducing a single-callback special case.

#### Task 3.2: Add the `entryHasContent` frontend wrapper

- Status: COMPLETED
- Objective: A typed frontend function exists for the new backend command.
- Steps:
  1. In `src/lib/tauri/entries.ts`, add: `export async function entryHasContent(id: number): Promise<boolean> { return await invoke('entry_has_content', { id }); }`, placed near `deleteEntryIfEmpty`/`deleteEntry` to keep the delete-related commands grouped.
- Validation: `cmd.exe /c bun run type-check` passes. `deleteEntryIfEmpty` is tested in `src/lib/tauri-params.test.ts`, not `src/lib/tauri/entries.test.ts` (verified by reading both files — that file's own header comment says so). Add the new case there, mirroring the existing `deleteEntryIfEmpty should pass id, title, text parameters (id-based, not date-based)` test at line 126: assert `entryHasContent(id)` invokes `'entry_has_content'` with `{ id }`.
- Notes: Depends on Task 1.2's command being registered (the Tauri mock in `src/test/setup.ts` intercepts by command name, so the test does not require the real backend).

#### Task 3.3: Implement and register `canLeaveCurrentEntry()` in `useEntryLifecycle.ts`

- Status: COMPLETED
- Objective: A single guard function exists that captures the current snapshot, decides whether leaving would silently erase real content, and — only in that case — asks for consent and performs the deletion itself on confirmation.
- Steps:
  1. **Prerequisite (verified gap)**: `useEntryLifecycle.ts` currently has neither `t` nor a confirm function available — its `UseEntryLifecycleOptions` interface (lines 20-39) has no `t` field, unlike `UseMultiEntryNavOptions` in `useMultiEntryNav.ts`, which explicitly takes `t: ReturnType<typeof useI18n>` as a param since the hook itself never calls `useI18n()`. Add `t: ReturnType<typeof useI18n>` to `UseEntryLifecycleOptions`, add `import { useI18n } from '../../../i18n';` (type-only usage) and `import { confirmInApp } from '../../../state/confirm-dialog';` to the top of the file, and update the call site in `EditorPanel.tsx` (`useEntryLifecycle({...})`, currently lines 45-64) to pass `t,` — `EditorPanel.tsx` already calls `useI18n()` and has `t` in scope (used by `mapTauriError(err, t)`), so this is a one-line addition to the existing options object, not a new import there.
  2. Add a new async function `canLeaveCurrentEntry(path: string): Promise<boolean>`:
     - Call `persistence.captureCurrentSnapshot()` (already exposed by `useEntryPersistence`). If it returns `null` (no pending entry, or not hydrated), return `true` immediately — nothing to protect.
     - Compute `shouldDelete` using the same logic already in `saveCurrentById` (`snap.title.trim() === '' && snap.isEmpty`). If `false`, return `true` immediately — this is an ordinary save, not a delete.
     - If `shouldDelete` is `true`, call `await entryHasContent(snap.entryId)`. If it returns `false` (the on-disk row is already blank — the "abandoned new entry" case), return `true` — no confirmation needed, matches today's behavior for that case.
     - If it returns `true` (the on-disk row currently holds real content), show the confirm dialog: `await confirmInApp(t('editor.deleteConfirmMessage'), { title: t('editor.deleteConfirmTitle') })` — same message/title keys `handleDeleteEntry` uses (Task 2.3), same primitive.
     - If the user cancels, return `false`.
     - If the user confirms: cancel any pending debounce (`persistence.debouncedSave.cancel()`), call `await deleteEntry(snap.entryId)` (the existing hard-delete command — not `deleteEntryIfEmpty`), then `clearEntryFromEditor(entryCommitTargets)` (same call `discardAndReload` already makes) so the caller's own subsequent `flushCurrent` becomes a guaranteed no-op per that function's existing contract, then return `true`.
     - Wrap the body in a try/catch that logs via the module's `log` and returns `false` (deny navigation) on any unexpected error, so a failed IPC call never silently allows an undesired delete.
  3. Register it: `registerNavigationGuard(() => canLeaveCurrentEntry('navigationGuard'))` alongside the existing `registerCleanupCallback`/`registerReloadCallback` registrations in the same hook, with the matching unregister call added to the hook's existing teardown/`dispose()` path.
  4. Add `canLeaveCurrentEntry` to the `EntryLifecycleHook` interface (currently lines 41-74 of `useEntryLifecycle.ts`) and to the hook's returned object, so Phase 1 call sites in `useMultiEntryNav.ts`/`EditorPanel.tsx` can call it directly rather than going through the registry indirection.
- Validation: `cmd.exe /c bun run type-check` passes. `useEntryLifecycle.test.ts` and `useMultiEntryNav.test.ts` both already exist (verified). Mock `confirmInApp` from `src/state/confirm-dialog.ts` per-test (e.g. `vi.mock('../../../state/confirm-dialog')`) rather than relying on any global default — unlike the native `confirm()` this replaces, there is no pre-existing global mock for it in `src/test/setup.ts`, so each test must set its own resolved value explicitly. Add these named Vitest cases to `useEntryLifecycle.test.ts`:
  - `canLeaveCurrentEntry allows navigation when there is no pending entry`
  - `canLeaveCurrentEntry allows navigation when the edit is an ordinary save (not a delete)`
  - `canLeaveCurrentEntry allows navigation without a dialog when the on-disk entry was already blank`
  - `canLeaveCurrentEntry shows the confirm dialog and denies navigation on cancel, leaving the entry unmodified`
  - `canLeaveCurrentEntry shows the confirm dialog, hard-deletes and clears the editor on confirm, then allows navigation`
  Run `cmd.exe /c bun run test:run`.
- Notes: Depends on Tasks 2.1-2.3 and 3.1-3.2. **Bug found and fixed via Milestone 6 E2E testing (not caught by unit tests at the time Milestone 3 was marked complete):** `canLeaveCurrentEntry`'s outer `try/catch` denied navigation (`return false`) on **any** thrown error, including `entryHasContent` rejecting with `"Entry not found"` — which is not a failure at all but the **expected** outcome when an independent, already-existing mechanism (the debounced autosave's own `deleteEntryIfEmpty` call, unrelated to this guard) auto-deletes the same blank entry in the ~500ms window before this guard's own check runs. `e2e/specs/multi-entry.spec.ts` Scenario C (pre-existing, not written by this plan) hits exactly this race: it creates a blank entry, switches away, waits, then switches back, relying on the entry having been auto-deleted by then. Denying navigation on "Entry not found" made the **Calendar day click itself silently no-op** (`Calendar.tsx`'s `handleDayClick` awaits `requestDateChange`, which awaits this guard) — the E2E failure surfaced as "Sidebar did not close after selecting {date}" with a 5000ms timeout, not as a visible dialog, which is why it required tracing the guard's control flow rather than being visually obvious. Fixed by catching `entryHasContent`'s rejection specifically: pattern-match the raw error string against `/entry not found/i` (same string-normalization technique `mapTauriError` in `src/lib/errors.ts` already uses) and return `true` (nothing left to protect) for that one case, re-throwing anything else to the outer catch's existing deny-on-error behavior. Two new tests added to `useEntryLifecycle.test.ts`: the "Entry not found" case allows navigation without showing the dialog, and an unrelated error (e.g. a network failure) still denies. This is the kind of race Task 3.3's plan text anticipated in spirit ("a failed IPC call never silently allows an undesired delete") but did not anticipate in this specific shape (the entry legitimately no longer existing is not the same failure mode as an IPC call failing while the entry still exists). **Implementation note:** the five named test cases call the real `useEntryLifecycle` hook (not a mirrored pure function) via a `makeLifecycle()` test helper that wires plain SolidJS signals for every accessor/setter and mocks only `../../../lib/tauri`'s `deleteEntry`/`entryHasContent` and `../../../state/confirm-dialog`'s `confirmInApp` (spreading the real module for the rest, same pattern as Task 2.3's `EditorPanel.integration.test.tsx` fix). `editorInstance` stays `null` throughout, so `captureCurrentSnapshot` falls back to the `content` signal and `computeIsEmpty(null, content) === !content.trim()`, giving direct control over the save-vs-delete decision via plain strings. `entryCommitTargets.setHydratedEntryId(id)` is called directly in the test helper to satisfy `captureCurrentSnapshot`'s hydration-identity guard, since these tests exercise the guard in isolation rather than through the load path that normally sets it. All 5 cases pass alongside the file's 23 pre-existing pure-function tests (28 total).

### Milestone 4: Phase 1 — In-`EditorPanel` Call Sites

- Status: COMPLETED
- Purpose: Wire the guard into the three navigation actions that already live inside `EditorPanel`'s component tree as plain async functions, requiring no architectural change.
- Exit Criteria: All three functions call the guard before their existing flush; cancelling the dialog aborts the action with no state change; `bun run test:run` is green.

#### Task 4.1: Wire `navigateToEntry`

- Status: COMPLETED
- Objective: Switching to another entry within the same day asks for consent first when it would silently erase real content.
- Steps:
  1. In `src/components/layout/editor-panel/useMultiEntryNav.ts`, at the top of `navigateToEntry` (after the existing `flushPendingCreation` call, before the existing `flushCurrent('navigateToEntry')` call), add: `if (!(await opts.lifecycle.canLeaveCurrentEntry('navigateToEntry'))) return;`.
  2. Do **not** remove the existing `flushCurrent` call after it — it still handles the ordinary-save case, since `canLeaveCurrentEntry` only performs a write itself on the delete-and-confirmed branch.
- Validation: `cmd.exe /c bun run type-check` passes. Add to `useMultiEntryNav.test.ts`: `navigateToEntry aborts without changing dayEntries or currentIndex when the guard denies navigation`, and `navigateToEntry proceeds normally when the guard approves`. Run `cmd.exe /c bun run test:run`.
- Notes: `EntryLifecycleHook` (Task 3.3) must already expose `canLeaveCurrentEntry` by this point. **Deviation — bug found and fixed during implementation (advisor review):** the guard's confirmed-delete branch removes the entry the editor was *leaving*, not the target the caller was navigating *to*. Since only the current entry can be deleted (never the target), and the target is always some other index in the pre-guard list, a delete before the target shifts every later index down by one — but the pre-existing `Math.min(newIndex, refreshed.length - 1)` clamp only self-corrects when the target happened to be the very last entry in the old list; for any other target position after a leading deletion it silently lands one entry past the intended one (confirmed by manual trace: 4-entry day `[A,B(current,erased),C,D]`, clicking "next" from B targets C via `newIndex=2`, but the old clamp computes `min(2, refreshed.length-1=2)=2` → lands on D, not C). Fixed by capturing the target entry's **id** (`opts.dayEntries()[newIndex]?.id`) before the guard runs, then re-finding it by id in the post-refresh list after the guard/flush settle, falling back to the old clamp only if the id lookup fails. Also added an `isDisposed()/token` re-check immediately after the guard call, matching the file's existing re-check-after-every-await convention — the guard is an unbounded await (user may sit on the dialog indefinitely). New regression test `lands on the id-correct entry when the guard deleted the entry before the target` in `useMultiEntryNav.test.ts` pins this against the pre-fix clamp-only behavior. Validation tests use a real `useMultiEntryNav()` hook with a hand-built fake `EntryLifecycleHook` (not a mirrored pure function, since the fix's correctness depends on the hook's actual sequencing) — mocks only `../../../lib/tauri`'s `createEntry`/`getEntriesForDate`/`getAllEntryDates`.

#### Task 4.2: Wire `addEntry`

- Status: COMPLETED
- Objective: Adding a new entry asks for consent first, for defense-in-depth consistency with the other two call sites, even though the existing `emptyCheck.isContentEmpty()` guard (line 95 of `useMultiEntryNav.ts`) already prevents `addEntry` from running when the current entry's content is empty — meaning the delete branch is not reachable through this path under normal use.
- Steps:
  1. In `addEntry`, immediately before the existing `flushCurrent('addEntry')` call, add the same guard call as Task 4.1: `if (!(await opts.lifecycle.canLeaveCurrentEntry('addEntry'))) return;`.
- Validation: `cmd.exe /c bun run type-check` passes. Add `addEntry still creates a new entry when the guard approves (the common case, since the existing isContentEmpty gate keeps the guard's delete branch unreachable here)` to `useMultiEntryNav.test.ts`. Run `cmd.exe /c bun run test:run`.
- Notes: Structural consistency, not a fix for an independently observed gap — this call site's delete branch is effectively unreachable via normal UI flow. **Audited (advisor review) for the same captured-then-stale-state class of bug Task 4.1 had**: after a hypothetical confirmed delete, `addEntry` continues to `createEntry()` then a full `fetchEntriesOrdered()` refetch before calling `setDayEntries()` — unlike `navigateToEntry`, it never reuses a pre-guard numeric index, so there is no staleness window to fix. Confirmed safe as originally written; no code change needed beyond the guard call itself.

#### Task 4.3: Wire `handleToggleLock`

- Status: COMPLETED
- Objective: Locking an entry asks for consent first when it would silently erase real content.
- Steps:
  1. In `src/components/layout/EditorPanel.tsx`'s `handleToggleLock`, inside the `if (next)` branch, immediately before the existing `await lifecycle.flushCurrent('toggleLock')` call, add: `if (!(await lifecycle.canLeaveCurrentEntry('toggleLock'))) return;`.
- Validation: `cmd.exe /c bun run type-check` passes. Add to `EditorPanel.integration.test.tsx` (or a component-level `EditorPanel.test.tsx` if the toggle is covered there instead): `handleToggleLock aborts without locking when the guard denies navigation`. Run `cmd.exe /c bun run test:run`.
- Notes: Only the lock-on transition needs the guard (unlocking never risks losing content — the entry was already saved before it could be locked). **Deviation — bug found and fixed during implementation (advisor review):** on a confirmed delete, the guard removes the exact entry `handleToggleLock` was about to lock and clears the editor (`pendingEntryId` → `null`), but the plan's literal guard-call placement alone lets execution fall through to `await setEntryLocked(id, next)` using the now-stale, pre-guard `id` — locking (or erroring on) an entry that no longer exists. Fixed by adding `if (pendingEntryId() !== id) return;` immediately after the guard call, inside the `if (next)` branch — a silent, no-error bail, since a confirmed delete is a success path, not a failure. New test `lock-toggle: aborts without locking when the guard denies navigation (TODO-0104)` added to `EditorPanel.integration.test.tsx` (the cancel-path case); the confirmed-delete-then-stale-id path is exercised implicitly by the same fix but not separately named — covered at the unit level by Task 3.3's `canLeaveCurrentEntry` delete-and-confirm test plus this file's manual trace.

### Milestone 5: Phase 2 — Guarded Navigation Primitives And External Call Sites

- Status: COMPLETED
- Purpose: Give every navigation trigger that lives outside `EditorPanel` (date switching, timeline toggle) a way to ask for consent before mutating `selectedDate`/`mainView`, since today those are raw signal writes with an effect/unmount reacting asynchronously — too late to intercept without a new entry point.
- Exit Criteria: Every non-reset call site that used to call `setSelectedDate`/`setMainView` directly now calls the guarded wrapper; `resetUiState()` is verified to still call the raw setters directly; the combined date+view case (Timeline row click, search result click) fires the guard exactly once; `bun run test:run` is green.

#### Task 5.1: Add guarded navigation entry points to `src/state/ui.ts`

- Status: COMPLETED
- Objective: `requestDateChange`, `requestMainViewChange`, and a combined `requestDateAndViewChange` exist, each checking `requestNavigationConsent()` before writing the underlying signal(s).
- Steps:
  1. In `src/state/ui.ts`, import `requestNavigationConsent` from `./entries`.
  2. Add `export async function requestDateChange(date: string): Promise<boolean> { if (!(await requestNavigationConsent())) return false; setSelectedDate(date); return true; }`.
  3. Add `export async function requestMainViewChange(view: MainView): Promise<boolean> { if (!(await requestNavigationConsent())) return false; setMainView(view); return true; }`.
  4. Add `export async function requestDateAndViewChange(date: string, view: MainView): Promise<boolean> { if (!(await requestNavigationConsent())) return false; setSelectedDate(date); setMainView(view); return true; }` — used by the two call sites that change both together, so the guard fires once, not twice.
  5. Confirm `resetUiState()` (lines 78-94) is left untouched, still calling `setSelectedDate`/`setMainView` directly — add a one-line comment above it noting it must bypass the guard because it runs during lock cleanup, which already flushes via `registerCleanupCallback` and must never wait on a dialog.
- Validation: `cmd.exe /c bun run type-check` passes. Add to a `src/state/ui.test.ts` (new file if none exists, following the pattern of the existing `Calendar.test.tsx`'s `uiState.setSelectedDate` usage for how this module is imported in tests): cases proving `requestDateChange`/`requestMainViewChange`/`requestDateAndViewChange` each call `requestNavigationConsent()` exactly once and skip the setter(s) when it resolves `false`, and that `resetUiState()` does not call `requestNavigationConsent()` at all (spy assertion).
- Notes: Depends on Task 3.1. New file `src/state/ui.test.ts` created (none existed before) with the 7 cases the validation names.

#### Task 5.2: Migrate `day-navigation.ts`

- Status: COMPLETED
- Objective: `goToPreviousDay`, `goToNextDay`, `goToToday`, `goToPreviousMonth`, `goToNextMonth` each ask for consent before changing the date.
- Steps:
  1. In `src/lib/day-navigation.ts`, replace `import { selectedDate, setSelectedDate } from '../state/ui';` with `import { selectedDate, requestDateChange } from '../state/ui';`.
  2. In each of the five functions, replace the direct `setSelectedDate(newDate)` / `setSelectedDate(clampToToday(newDate))` call with `await requestDateChange(newDate)` / `await requestDateChange(clampToToday(newDate))`.
- Validation: `cmd.exe /c bun run type-check` passes. Update `src/lib/day-navigation.test.ts`'s existing `setSelectedDate` mocks/assertions to match the new `requestDateChange` call, and add one new case per function asserting the date does not change when `requestDateChange` resolves `false` (mock it to return `false` for that case). Run `cmd.exe /c bun run test:run`.
- Notes: This single file change automatically covers the Header ◀/▶ buttons and the `Mod+[`/`Mod+]`/`Mod+T`/`Mod+Shift+[`/`Mod+Shift+]` keyboard shortcuts (UX-GATE scenarios #3, #4, #5), since both already route through these five functions per the file's own doc comments.

#### Task 5.3: Migrate `Calendar.tsx` and `Sidebar.tsx`

- Status: COMPLETED
- Objective: Clicking a calendar day or the Sidebar "Today" shortcut asks for consent first.
- Steps:
  1. **Verified detail**: `Calendar.tsx`'s `handleDayClick` (lines 186-191) is currently a plain, non-`async` arrow function that does **three** things, not one: `setSelectedDate(day.date)`, `setFocusedDate(day.date)`, `setIsSidebarCollapsed(true)`. Convert it to `async`, gate the whole action on the guard, and only run the other two setters after approval — so a denied navigation leaves focus and sidebar state untouched too:
     ```ts
     const handleDayClick = async (day: CalendarDay) => {
       if (day.isDisabled) return;
       if (!(await requestDateChange(day.date))) return;
       setFocusedDate(day.date);
       setIsSidebarCollapsed(true);
     };
     ```
     Import `requestDateChange` from `../../state/ui` in place of `setSelectedDate`.
  2. **Verified detail**: `Sidebar.tsx`'s "Today" button (line 117) is a plain inline `onClick={() => setSelectedDate(getTodayString())}`, no other logic attached. Convert to `onClick={() => void requestDateChange(getTodayString())}` (or an explicit async handler, matching the file's existing style for other handlers), importing `requestDateChange` from the same module in place of `setSelectedDate`.
- Validation: `cmd.exe /c bun run type-check` passes. Update `Calendar.test.tsx` and any Sidebar test covering the "Today" click to mock `requestDateChange` and assert it is called with the right date, that the denied case leaves `focusedDate`/`isSidebarCollapsed` unchanged (Calendar) and `selectedDate` unchanged (Sidebar). Run `cmd.exe /c bun run test:run`.
- Notes: **No `Sidebar.test.tsx` exists in this repo** (confirmed by glob — root `CLAUDE.md`'s Known Issues already documents `Sidebar.tsx` as a coverage gap), so there was no existing Sidebar test to update; creating a full new test suite for an otherwise-untested component was out of scope for this task and not done. `Calendar.test.tsx` updated: the existing click test made `async` + `waitFor` (was a synchronous assertion, now needs to await the guarded `requestDateChange`), the selection-highlight test likewise, and a new case added asserting `handleDayClick` calls `requestDateChange` with the clicked date and skips `setFocusedDate`/`setIsSidebarCollapsed` when it denies.

#### Task 5.4: Migrate `GoToDateOverlay.tsx`

- Status: COMPLETED
- Objective: Submitting a date in the Go To Date overlay asks for consent first.
- Steps:
  1. **Verified detail**: `GoToDateOverlay.tsx`'s `handleSubmit` (lines 46-53) is currently a plain, non-`async` function doing two things: `setSelectedDate(dateInput())` then `setIsGoToDateOpen(false)` (closing the overlay). Convert to `async`, gate on the guard, and only close the overlay on approval — so a denied navigation leaves the overlay open with the user's typed date still in it:
     ```ts
     const handleSubmit = async (e: Event) => {
       e.preventDefault();
       if (!isSubmitDisabled()) {
         if (!(await requestDateChange(dateInput()))) return;
         setIsGoToDateOpen(false);
       }
     };
     ```
     Import `requestDateChange` from the module that already provides `setSelectedDate`/`setIsGoToDateOpen` here, in place of `setSelectedDate`.
- Validation: `cmd.exe /c bun run type-check` passes. Update `GoToDateOverlay.test.tsx` with a denied case asserting the overlay stays open and `setIsGoToDateOpen(false)` is not called, alongside the existing approved-path coverage. Run `cmd.exe /c bun run test:run`.
- Notes: The confirm dialog now stacks visually on top of the Go To Date overlay (both are in-app Kobalte dialogs) rather than appearing as a separate OS window in front of everything — worth an explicit look during Task 6.3's walkthrough (UX-GATE scenario #8) to confirm the stacking looks correct and Escape/backdrop behavior does not close the wrong layer.

#### Task 5.5: Migrate `Timeline.tsx` and `SearchResults.tsx` (combined single-fire)

- Status: COMPLETED
- Objective: Clicking a Timeline row or a search result — both of which change `selectedDate` and `mainView` together — asks for consent exactly once for the combined transition.
- Steps:
  1. In `src/components/timeline/Timeline.tsx`, `openEntry` (lines 28-31) is exactly `setSelectedDate(entry.date); setMainView('editor');` with nothing else. Replace both with a single `await requestDateAndViewChange(entry.date, 'editor')`, importing accordingly. `openEntry` will need to become `async`.
  2. `SearchResults.tsx`'s `handleResultClick` (lines 30-39, verified by reading the file directly) is:
     ```ts
     const handleResultClick = (id: number, date: string) => {
       setSelectedEntryId(id);      // line 33 — runs first
       setSelectedDate(date);       // line 34
       setMainView('editor');       // line 37
       setIsSearchOpen(false);      // line 38 — closes the search overlay
     };
     ```
     Replace lines 34+37 with a single `await requestDateAndViewChange(date, 'editor')`, keep `setSelectedEntryId(id)` running **before** it (unchanged position — `loadEntriesForDate`'s deep-link consumption reads `selectedEntryId` after its own date-change effect fires, so it must already be set by the time the date actually changes), and move `setIsSearchOpen(false)` to run **after** the guarded call resolves `true` — so a denied navigation leaves the search overlay open rather than silently closing it over nothing having happened:
     ```ts
     const handleResultClick = async (id: number, date: string) => {
       setSelectedEntryId(id);
       if (!(await requestDateAndViewChange(date, 'editor'))) return;
       setIsSearchOpen(false);
     };
     ```
- Validation: `cmd.exe /c bun run type-check` passes. Add a test to each file's suite asserting `requestNavigationConsent` (or the combined wrapper) is invoked exactly once per click, not twice; for `SearchResults.tsx`, additionally assert the denied case leaves `isSearchOpen` `true` and `selectedEntryId` still set to `id`. Run `cmd.exe /c bun run test:run`.
- Notes: This is the one place where getting the single-fire behavior right matters most — a naive migration that calls `requestDateChange` then `requestMainViewChange` separately would show two dialogs for one user action. Task 5.1's combined helper exists specifically to prevent that. **Verified (advisor review) that a deep-linked `selectedEntryId` pointing at a now-deleted entry degrades safely**: read `useEntryLifecycle.ts`'s `loadEntriesForDate` — `targetIndex = entries.findIndex((e) => e.id === targetEntryId)` returns `-1` when the id is gone, and `startIndex = targetIndex >= 0 ? targetIndex : entries.length - 1` falls back to the day's newest entry rather than crashing. This matters because `canLeaveCurrentEntry` can only ever delete the entry being *left* (never the search/timeline target), so this fallback is not expected to fire in practice, but it is confirmed safe if it ever does (e.g. a stale search result matching the currently-open, just-erased entry). No test added for this specific fallback — it was pre-existing behavior from TODO-0053, not new to this plan, and the general "no entries at all" case is already covered by `useEntryLifecycle`'s existing tests. Also discovered a pre-existing synchronous assertion in `SearchOverlay.test.tsx`'s result-click test that broke once `handleResultClick` became async awaiting `requestDateAndViewChange`; fixed with the file's own `flush()` helper.

#### Task 5.6: Migrate `Header.tsx` Timeline toggle

- Status: COMPLETED
- Objective: Clicking the Timeline toggle button asks for consent before `EditorPanel` unmounts.
- Steps:
  1. In `src/components/layout/Header.tsx` (line 113), replace the inline `onClick={() => setMainView(mainView() === 'timeline' ? 'editor' : 'timeline')}` with an async handler calling `await requestMainViewChange(mainView() === 'timeline' ? 'editor' : 'timeline')`, importing accordingly.
- Validation: `cmd.exe /c bun run type-check` passes. Add a case to `Header.test.tsx` asserting the view does not change when `requestMainViewChange` resolves `false`. Run `cmd.exe /c bun run test:run`.
- Notes: Only the `editor → timeline` direction can ever trigger the guard's delete branch (going the other way never touches the editor's pending entry), but gating both directions through the same guarded call keeps the code path uniform and matches how the guard already no-ops cheaply when there is nothing to protect.

### Milestone 6: Integration, E2E, And UX Sign-Off

- Status: COMPLETED
- Purpose: Prove the guard behaves correctly against a real TipTap editor and real navigation timing, including full end-to-end dialog interaction (now possible with the in-app dialog — see Decision History), and get explicit user sign-off on the UX-GATE scenarios against the real running app.
- Exit Criteria: New integration and E2E cases pass, including at least one real dialog confirm/cancel round trip through WebDriver; the UX-GATE walkthrough (Task 6.3) has explicit per-scenario sign-off recorded in this plan.

#### Task 6.1: `EditorPanel.integration.test.tsx` coverage

- Status: COMPLETED
- Objective: Cover the guard against the same fake-editor harness TODO-0089's regression tests already use (superseded load, unmount-with-pending-debounce style scenarios), for at least the Phase 1 call sites.
- Steps:
  1. Add a case: type real content into an entry, let it save, clear all content, then trigger `navigateToEntry` — mock `confirmInApp` (Task 2.1) resolving `false` then `true` across two sub-cases, assert cancelling leaves `dayEntries`/`currentIndex` unchanged while confirming removes the entry and navigates.
  2. Add a case: an entry that was always blank (freshly created, never typed into) navigated away from — assert no confirm dialog is shown (`confirmInApp` not called) and the entry is silently removed, preserving the pre-existing "abandoned new entry" behavior.
- Validation: Run `cmd.exe /c bun run test:run`; both new cases pass by name.
- Notes: Reuse the existing rewritten editor fake described in the TODO-0089 archive entry (models `getHTML`/`isEmpty`/`isDestroyed` transitions) rather than building a new one. **Second bug found via the real E2E run (`e2e/specs/backup-restore.spec.ts`), not caught by any Vitest mock:** `canLeaveCurrentEntry`'s confirmed-delete branch calls `deleteEntry` + `clearEntryFromEditor` but never refreshed the global `entryDates` signal — unlike `saveCurrentById`'s soft-delete branch, which explicitly re-fetches and calls `setEntryDates(dates)` after a successful delete. Since the calendar's "has entry" indicator reads `entryDates` (a signal separate from `dayEntries`), a guard-confirmed hard delete left that indicator stale for the deleted date until something unrelated happened to refresh it. A mocked-editor Vitest test cannot catch this class of bug because it never renders `Calendar.tsx` or exercises the real `entryDates` signal against a real DOM assertion — it was only caught because `backup-restore.spec.ts` asserts on the calendar's live `aria-label` after a delete. Fixed by adding the same `getAllEntryDates()` + `setEntryDates(dates)` call (guarded by `!persistence.isDisposed()`) to `canLeaveCurrentEntry`'s delete branch, mirroring `saveCurrentById` exactly. New test case added to the existing "shows the confirm dialog, hard-deletes..." test in `useEntryLifecycle.test.ts` asserting `getAllEntryDates` is called. **Implementation note (advisor review):** wrote three cases, not two — split the cancel/confirm sub-cases into separate `it()` blocks (matching this file's one-assertion-focus-per-test convention) rather than one test with two phases. Prioritized the "genuinely blank" case as the one with the real regression risk (`entryHasContent` returning `false` is the only thing standing between the pre-existing abandoned-new-entry cleanup and a dialog appearing on every blank-entry navigation) and asserted `entryHasContent` was called with the *specific* erased/blank entry's id in all three cases, not just that it was called — a wrong-id wiring bug would not have been caught by a looser assertion. Also traced the full effect chain by hand for the confirm-and-delete case: `canLeaveCurrentEntry`'s own hard delete clears `pendingEntryId`, which makes the immediately-following `flushCurrent` call a guaranteed no-op (its `captureCurrentSnapshot` returns `null`), and the navigation's own post-refresh `newIndex >= entries.length` bailout is what's expected to fire in the blank-entry case since `onEmptyEntryDeleted` (inside the soft-delete path) already committed the target — confirmed both paths converge on the same correct final state rather than double-committing.

#### Task 6.2: `e2e/specs/multi-entry.spec.ts` — real dialog round trip

- Status: COMPLETED
- Summary: Scenario F written in `multi-entry.spec.ts`, confirmed passing. Fixed two real bugs it (and the full-suite run) surfaced — see this task's Notes and Task 3.3's Notes. Also had to fix `backup-restore.spec.ts` (separate file, not originally in scope — see this task's Notes) because it depended on behavior this plan intentionally removes. That fix initially left the app stranded on Timeline view after the consent-dialog delete, causing the test's own later `title-input` check (step 5, restoring the entry) to time out — fixed by toggling back to the editor view immediately after the delete confirms, before proceeding to the Preferences/Backups restore flow. Full suite re-run green: 13 passed, 0 failed (`bun run test:e2e -- --logLevel error`, after `bun run tauri build`).
- Objective: One real-TipTap, real-navigation E2E scenario proves the confirm dialog appears and functions correctly end-to-end, including both Cancel and Confirm outcomes — mirroring TODO-0089's own "Scenario E" precedent (type → toggle Timeline → toggle back, real TipTap). This is now achievable because the dialog is in-app DOM content, unlike the native dialog the original draft of this plan assumed.
- Steps:
  1. Add a new scenario: create an entry, type real content via `typeText()` (per `e2e/CLAUDE.md` gotcha #5), wait for autosave, clear the title and body via real per-character keystrokes (per `e2e/CLAUDE.md` gotchas #6-7 — measure current content before clearing, don't assume `.setValue('')` works or that content matches the original fixture), click the Timeline toggle.
  2. Assert `[data-testid="confirm-dialog"]` becomes visible. Before touching either button, assert non-dismissal (UX-GATE scenario #15) end-to-end: send an Escape keypress and assert the dialog is still visible and the entry unchanged; click on the dimmed backdrop area outside `[data-testid="confirm-dialog"]` and assert the same. Only then click `[data-testid="confirm-dialog-cancel-button"]`; assert the app is still showing the editor (not Timeline) and the entry still exists (not deleted).
  3. Repeat the erase-and-toggle sequence, this time clicking `[data-testid="confirm-dialog-confirm-button"]`; assert the entry is gone and Timeline is now showing.
- Validation: Run `cmd.exe /c bun run test:e2e:local` (per root `CLAUDE.md`'s E2E lane gotcha: `test:e2e` alone does not build). New scenario passes.
- Notes: This is real, automated coverage of the dialog interaction itself — a capability the native-dialog approach could never have provided (see Decision History). It does not need to cover all ~11 trigger points; Task 6.3's walkthrough covers the rest for UX/visual sign-off, not because they are otherwise untestable. The Escape/outside-click non-dismissal check here is the strongest evidence for scenario #15 — real WebView, real keyboard event, real click — stronger than Task 2.2's Vitest coverage alone. **Consequential fix required, out of the plan's originally scoped file list:** running the full E2E suite (not just the new scenario) surfaced that `e2e/specs/backup-restore.spec.ts` (pre-existing, TODO-0098) relied on the exact silent-auto-delete-on-clear behavior this plan removes — it cleared an entry and waited up to 10s for `deleteEntryIfEmpty`'s debounce to auto-delete it, which Milestone 1's backend on-disk check now correctly refuses (the row still held real content). Fixed by switching that test's delete step to clear-then-confirm-via-the-Timeline-toggle's-consent-dialog, and rewrote the file's header doc comment, which had explained the *old* rationale (native OS dialog on the trash button, unreachable by WebDriver) for using auto-delete in the first place — a rationale Milestone 2 made obsolete by migrating that same trash button to the in-app dialog this fix now reuses. The entry nav bar's trash button itself was not used directly because it is hidden on single-entry days (`EntryNavBar.tsx`'s `<Show when={total > 1}>`), which this test's day always is.

#### Task 6.3: UX-GATE Walkthrough And Sign-Off

- Status: COMPLETED — agent-side walkthrough completed for all 8 reduced-scope scenarios (2026-08-19), and the user reviewed the UX-GATE Scenarios table plus the three dialog screenshots and explicitly approved all 8 via `AskUserQuestion` on 2026-08-19 ("Approve all 8 scenarios"). See the "Sign-off" column in the UX-GATE Scenarios table above for per-scenario evidence and approval.
- **Scope decision (via `AskUserQuestion`, before starting):** the user chose the **reduced set** over walking all 15 scenarios live. Rationale offered: several scenarios are redundant with automated coverage already built during Milestones 4-6 — #3/#4/#5 all route through the same five `day-navigation.ts` functions already unit-tested (`day-navigation.test.ts`), and #9/#10 both assert `requestDateAndViewChange` single-fire behavior already covered directly in `Timeline.test.tsx`/`SearchResults.test.tsx`. **Scenarios walked live: #1, #2, #8, #11, #12, #13, #14, #15.** Scenarios #3-7, #9-10 are cited to their automated coverage in the sign-off table below instead of being re-walked live.
- Objective: Every scenario in the UX-GATE Scenarios table above is walked through against the real running Windows dev app and explicitly signed off by the user before this plan can be marked `COMPLETED`.
- Steps:
  1. Use the `tauri-agent-dev` skill to spawn the live dev app with WebView2 CDP enabled.
  2. Walk through all 15 scenarios in the UX-GATE table in order, driving the app via `agent-browser`/CDP — including clicking the in-app dialog's Confirm/Cancel buttons directly, since it is now ordinary WebView content the agent can interact with (unlike the native dialog originally planned). Capture a screenshot at the moment each dialog appears (or, for scenarios #12-13, at the moment the app locks/closes without one).
  3. Present the results and screenshots to the user and record explicit sign-off (approved / needs-change, with any needed-change notes) for each scenario number directly in this plan's UX-GATE Scenarios table (add a "Sign-off" column) or in a short addendum section below it — an agent's own description of "it worked" does not satisfy the UX-GATE rule; the user must review the actual screenshots/behavior.
  4. Fix any scenario that fails sign-off, then re-walk only that scenario before re-requesting sign-off on it.
- Validation: All 15 scenarios show recorded sign-off in this plan file with no "needs-change" entries outstanding. Scenario #15 (dismissal resistance) additionally requires the walkthrough to actually attempt Escape and an outside click against the live app, not just cite Task 2.2's Vitest coverage as sufficient — the point is confirming the real rendered dialog behaves this way, not only the isolated component test.
- Notes: Agent-driven walkthrough completed 2026-08-19 against a scratch sandbox journal (`.agent-dev/sandbox/`, kept — not the user's real journal) via `tauri-agent-dev` + `agent-browser`/CDP. All 8 reduced-scope scenarios (#1, #2, #8, #11, #12, #13, #14, #15) behaved as expected; full evidence recorded per-scenario in the "Sign-off" column above. The user reviewed the table and the three dialog screenshots (`.agent-dev/scenario1-dialog.png`, `scenario2-dialog.png`, `scenario8-dialog.png`) and approved all 8 via `AskUserQuestion` on 2026-08-19. Two real environment issues surfaced during the session, both unrelated to the app under test:
  1. The Vite dev server repeatedly wedged (`[optimizer] scanning/bundling dependencies...` logged with no further progress, HTTP requests to `localhost:1420` hanging indefinitely) — matches a known failure mode already documented in the `tauri-agent-dev` skill's Troubleshooting section (stale `node_modules/.vite` optimizer cache). The documented fix (stop, delete `node_modules/.vite`, restart) worked twice but not a third time (needed for the Scenario #13 relaunch-verification screenshot); rather than keep retrying an environment flake, Scenario #13 was signed off using strong indirect evidence instead (console log + the already-fully-verified Scenario #12 sharing the identical backend code path) — see the table entry for the reasoning.
  2. The persisted `autoLockTimeout: 5` preference (set for Scenario #12) kept re-locking the app between CDP round-trips after each unlock, since `eval` calls don't count as user activity and Argon2id unlock itself takes a few seconds. Worked around by patching `localStorage`'s `preferences.autoLockEnabled: false` directly while at the lock screen (no race there) before each subsequent unlock, per the skill's documented "patch localStorage then reload" recipe.
- Notes: This task cannot be completed before Milestones 1-5 are implemented, since there is nothing to walk through until then. Depends on all prior milestones. Scenarios #12-13 (auto-lock/app-close must show no dialog) still warrant asking the user to directly confirm the app actually locked/closed promptly, since an agent screenshot alone proves absence of visible dialog content, not that nothing is blocking elsewhere.

### Milestone 7: Documentation

- Status: COMPLETED
- Purpose: Keep the project's domain docs, diagrams, and canonical data-testid table in sync with the new consent-gate behavior, per root `CLAUDE.md`'s Docs Maintenance rule and the Context Files Best Practices trigger for new `data-testid`s.
- Exit Criteria: `src/CLAUDE.md`, `src-tauri/CLAUDE.md`, `docs/diagrams/save-entry.mmd`, and `CHANGELOG.md` all reflect the new behavior; `bun run diagrams:check` passes.

#### Task 7.1: Update `src/CLAUDE.md` and `src-tauri/CLAUDE.md`

- Status: COMPLETED
- Objective: The frontend and backend domain guides document the new dialog, guard, and command; the canonical data-testid table gains the three new entries from Task 2.2.
- Steps:
  1. In `src/CLAUDE.md`'s data-testid table, add three rows for `ConfirmDialog.tsx`: `confirm-dialog` (dialog content root), `confirm-dialog-cancel-button`, `confirm-dialog-confirm-button` — per root `CLAUDE.md`'s Context Files Best Practices trigger ("New `data-testid` used by E2E tests → add to the canonical table in `src/CLAUDE.md`").
  2. In `src/CLAUDE.md`, extend Gotcha #10 (the atomic-commit gotcha that already documents TODO-0089's fixes) with a short addition naming `canLeaveCurrentEntry` and the navigation-guard registry, since this is a direct extension of that same invariant, not a new unrelated gotcha.
  3. In `src/CLAUDE.md` Gotcha #12 (the native-dialog focus-loss guard), add a one-line clarification that `ConfirmDialog`/`confirmInApp` is an in-app dialog and deliberately does **not** go through `src/lib/dialog.ts`'s guard, so a future reader does not assume it should.
  4. In `src-tauri/CLAUDE.md`, update the "Two delete commands — use the right one" note to add `entry_has_content(id)` as a third, read-only command, and note that `delete_entry_if_empty` now also checks the on-disk row.
- Validation: Read both files back and confirm the additions are present and consistent with the actual implemented behavior (not aspirational wording).
- Notes: Follow `docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md` — prefer pointers over copies, do not reintroduce file trees or command tables beyond what already exists.

#### Task 7.2: Update `docs/diagrams/save-entry.mmd`

- Status: COMPLETED
- Objective: The save-entry flow diagram reflects the new consent-gate branch before delete.
- Steps:
  1. Edit `docs/diagrams/save-entry.mmd` to add the consent-check/confirm-dialog branch on the delete path.
  2. Run `cmd.exe /c bun run diagrams` to regenerate the SVG output.
- Validation: `cmd.exe /c bun run diagrams:check` passes (verification-only mode, confirms the committed SVG matches the regenerated one).
- Notes: Added a parallel branch off `EDITOR` (`NAV` → `GUARD` decision → `CONFIRM` dialog → `HARDDEL`/`delete_entry(id)`) alongside the existing debounced-save branch (`CHECK`/`SAVE`/`EMPTY`/`DELETE`), since the consent gate is a separate navigation-triggered flow, not a modification of the debounce path itself. Also annotated the existing `DELETE` node (`delete_entry_if_empty`) to note it now additionally refuses when the on-disk row still holds content (Milestone 1). **Self-caught gap:** the task's own step 1 named only `save-entry.mmd`, but `docs/diagrams/save-entry-dark.mmd` is a separate light/dark source pair (confirmed via `ls docs/diagrams/*.mmd`) — missing it would have left the dark-theme diagram permanently out of sync. Applied the identical edit there too before regenerating. **Also found and corrected:** running `bun run diagrams` regenerates every diagram unconditionally (not just changed sources), and this machine's installed mermaid-cli produces different byte output than whatever last generated the committed `context.svg`/`context-dark.svg`/`unlock.svg`/`unlock-dark.svg` (a real but pre-existing, unrelated toolchain-version drift — confirmed via a byte diff showing a mermaid CSS default change, `stroke-width:2.0px` → `1px`, unrelated to this plan's content). Verified via `scripts/verify-diagrams.mjs` (read directly) that `diagrams:check` only hashes `.mmd`/`.d2` **sources**, never the rendered SVG bytes, so those four incidental SVGs were safely reverted via `git checkout --` to keep this plan's diff scoped to `save-entry`/`save-entry-dark` only, per root `CLAUDE.md`'s "keep implementation commits scoped" rule — `diagrams:check` still passes after the revert. `bun run diagrams:check` passes; both `save-entry.svg` and `save-entry-dark.svg` confirmed (via `grep`) to contain the four new node IDs (`NAV`, `GUARD`, `CONFIRM`, `HARDDEL`).

#### Task 7.3: `CHANGELOG.md` entry

- Status: COMPLETED
- Objective: A changelog entry describes the user-facing behavior change.
- Steps:
  1. Add an entry to `CHANGELOG.md` under the current unreleased section describing: entries with real content are no longer silently emptied when navigating away after content is erased; the app now asks for confirmation via an in-app dialog (also now used by the existing delete button, replacing its previous native OS dialog), and a backend-level refusal protects the cases where it cannot ask (auto-lock, app close).
- Validation: Entry present and consistent with the project's existing changelog voice/format (check a handful of recent entries for tone before writing).
- Notes: Per root `CLAUDE.md`'s Post-Task Completion checklist, this is required for any user-facing behavior change. Added under `## [0.7.0] - Unreleased` → `### Fixed`, right after the most recent entry there (TODO-0103's timestamp-font fix), matching that section's voice (bold user-facing lead sentence, then narrative detail, TODO reference in brackets).

### Milestone 8: Cleanup And Final Verification

- Status: COMPLETED
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified end-to-end.
- Exit Criteria: Intermediate artifacts are removed, all final verification passes, and the plan status is `COMPLETED`.

#### Task 8.1: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep the new tests, the updated docs, and the regenerated diagram SVG — all part of the intended final state.
  4. If a TODO entry was created per the Assumptions section, mark it complete via the `todo-manager` skill.
- Validation: `git status` / worktree diff contains only the intended final changes (backend command + guard, new dialog component + service, migrated hard-delete confirm, frontend guard + call-site migrations, tests, docs, changelog).
- Notes: `git status` reviewed — the diff contains exactly the intended change set (backend `entries.rs`/`lib.rs`, `ConfirmDialog.tsx`/`confirm-dialog.ts` + tests, migrated call sites across `useMultiEntryNav.ts`/`EditorPanel.tsx`/`Header.tsx`/`MainLayout.tsx`/`Sidebar.tsx`/`GoToDateOverlay.tsx`/`SearchResults.tsx`/`Timeline.tsx`/`day-navigation.ts`/`entries.ts`/`ui.ts`, tests, `src/CLAUDE.md`/`src-tauri/CLAUDE.md`, `save-entry(-dark).mmd`/`.svg`, `CHANGELOG.md`, `TODO.md`, E2E specs, this plan file) plus one pre-existing unrelated change (`.claude/scheduled_tasks.lock`) already present before this plan started, left untouched per this task's own instruction. Found and reverted one incidental scope leak during Task 7.2's diagram regeneration — see that task's Notes (unrelated `context.svg`/`unlock.svg` byte drift from a toolchain version difference, reverted via `git checkout --`). No temporary docs, scratch scripts, or scratch tests exist in the tracked worktree; the `.agent-dev/scenario*.png` walkthrough screenshots from Task 6.3 are gitignored (not tracked) and were left in place as they're referenced as evidence in the UX-GATE Scenarios table. TODO-0104 marked `[x]` in `docs/todo/TODO.md` via the `todo-manager` skill.

#### Task 8.2: Final Verification

- Status: COMPLETED
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run the full verification suite (see Pre-flight Checks below).
  2. Fix failures and rerun until verification passes, or record the blocker.
- Validation: All Pre-flight Checks pass.
- Notes: All checks below pass. One transient false alarm during this run: a `bun run test:run` pass launched concurrently with `cargo test --workspace`/`clippy`/`build` reported 3 timeouts (`Calendar.test.tsx` month-nav, 2× `PreferencesOverlay.integration.test.tsx` persistence tests) — re-running those exact 3 tests in isolation (nothing else running) passed cleanly (14/14), and a subsequent clean full-suite run with no concurrent load passed 1018/1018, confirming the timeouts were resource contention from this session's own parallel verification runs, not a regression, per the project's "empirical over static analysis" convention (verified by rerunning, not assumed).

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval.
Fix all failures before proceeding.

- [x] `cargo test --workspace` passes with zero failures (772 passed)
- [x] `cargo clippy --workspace --all-targets -- -D warnings` passes with zero warnings
- [x] `cargo fmt --all --check` passes
- [x] `cmd.exe /c bun run type-check` passes
- [x] `cmd.exe /c bun run lint` passes
- [x] `cmd.exe /c bun run test:run` passes (1018 passed, clean isolated run — see Task 8.2 notes on an earlier contention-caused false alarm)
- [x] `cmd.exe /c bun run build` succeeds
- [x] `cmd.exe /c bun run format` succeeds (all files already formatted, no changes)
- [x] `cmd.exe /c bun run test:e2e:local` passes (new + existing multi-entry scenarios, including the real dialog round trip from Task 6.2) — run as `bun run tauri build` + `bun run test:e2e -- --logLevel error` (equivalent; code unchanged since), 13/13 passed
- [x] `cmd.exe /c bun run diagrams:check` passes
- [x] No new i18n keys were introduced (per the resolved Open Question); if this changes during implementation, run `cmd.exe /c bun run validate:locales` and update all locale files
- [x] All 15 UX-GATE scenarios signed off (Task 6.3) — 8 walked live and approved by the user 2026-08-19; 7 cited to existing automated coverage per the user's reduced-scope decision (see the UX-GATE Scenarios table)
- [x] `CHANGELOG.md` updated
- [x] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] All open questions were surfaced to the user via `AskUserQuestion` and resolved (see Open Questions).
- [x] Tasks are grouped into milestones (more than 10 tasks).
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included (Milestone 8).
- [x] The plan avoids vague actions without concrete targets — every task names exact files, functions, and line references gathered from the live repository.
- [x] The plan can be executed by a coding agent without reading the original conversation — all context (TODO-0089 precedent, backend/frontend architecture, call-site inventory, the native-vs-in-app dialog decision) is restated inline, including the Decision History section explaining why the design changed mid-planning.
- [x] UX-GATE: REQUIRED tag present; 15 scenarios enumerated in the UX-GATE Scenarios table; explicit per-scenario sign-off is a required task (6.3) gating `COMPLETED`. Because the dialog is now in-app, the agent can drive the full interaction and the sign-off burden is materially lighter than the human-in-the-loop design an earlier draft required — but user sign-off is still required, not delegated to the agent's own description.
- [x] No Tauri WebView new-window/navigation interaction (link clicks, `target="_blank"`, `window.open`) is introduced by this plan, so the `PLATFORM-VERIFY` trigger does not apply. The dialog is in-app DOM content, not a native OS window, so there is no longer even the WebDriver/CDP-reach constraint an earlier draft had to work around.

Self-check passed. Plan Status: READY FOR APPROVAL.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- This is a simple-scale decision surface despite the milestone count — no separate decision log companion file was requested, so deviations are recorded inline in the relevant task's Notes field rather than a separate log file.
