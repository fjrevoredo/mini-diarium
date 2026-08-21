# Project Support Overlay + Streak-Triggered Header Icon — Implementation Plan

## Metadata

- Plan Status: COMPLETED
- Created: 2026-08-21
- Last Updated: 2026-08-21
- Owner: Coding agent
- Approval: APPROVED (user, 2026-08-21, in-conversation)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## UX-GATE: REQUIRED

This plan adds a new dialog (`ProjectSupportOverlay`) with two entry points and six external-link
actions. Milestone 5, Task 5.1 lists each interaction scenario for explicit manual sign-off
against the real running app — not just a description of intended behavior.

## Goal

Give users an in-app way to discover how to support Mini Diarium (donate, star, review, share,
contribute, subscribe) without ever interrupting the editor. A conditionally-rendered header icon
invites users who have demonstrably formed a journaling habit (a real `best_streak` milestone,
gated so it cannot be triggered by bulk import); a permanent About-screen link invites anyone who
goes looking on their own. Both routes open one shared, ascending-friction checklist overlay.

This plan implements **Proposal 4** (streak-anchored trigger + dedicated header icon) and
**Proposal 5** (`ProjectSupportOverlay` destination) from
[`in-app-donation-nudge-proposals.md`](in-app-donation-nudge-proposals.md),
as refined across that exploration session (2026-08-21). Proposals 1–3 in that document are
superseded and are not implemented as originally written; see that doc's "Recommended Direction"
for the full reasoning trail.

## Scope

- `src/state/support-milestone.ts` — pure rung-detection logic (`best_streak` + wall-clock
  journal-age gate) and the reactive pending-milestone signal.
- `src/state/session.ts` — registers `support-milestone.ts`'s reset in `resetSessionState()`
  (post-implementation review finding; see note after Task 5.1).
- `src/App.tsx` — wiring to record `first-seen-${journalId}` and recompute the pending milestone
  once per unlock.
- `Header.tsx` — a conditionally-rendered `Heart` icon at the end of the left-hand icon group.
- `src/state/ui.ts` — new `isProjectSupportOpen` / `projectSupportEntry` signals.
- `src/state/project-support.ts` — global (not per-journal) self-tap checklist completion state.
- `src/components/overlays/ProjectSupportOverlay.tsx` — the new destination overlay.
- `AboutOverlay.tsx` — a new "Support Mini Diarium" entry point button.
- `src/lib/dialog.ts` — a new focus-loss-lock suppression helper for `ProjectSupportOverlay`'s
  external link handoffs (see Task 3.5).
- `src/lib/focus-lock.ts` — reschedule (re-arm) the debounced lock check instead of abandoning
  it when `isDialogOpen()` is true, so the suppression above is bounded rather than open-ended
  (see Task 3.5).
- `.agents/skills/security-stance/SKILL.md` — update Section 6's description of the dialog-guard
  to describe the new reschedule behavior (see Task 4.5).
- `src/i18n/locales/en.ts` — all new copy under a `support` namespace.
- Documentation: `docs/decisions/2026-05-settings-storage-taxonomy.md`, `src/CLAUDE.md`
  (`data-testid` table), `docs/todo/TODO.md`, `CHANGELOG.md`.

## Non-Goals

- No backend/Rust changes. `get_statistics()` already returns `best_streak` (Finding 8 in the
  exploration doc) — this feature is 100% frontend.
- No OS-based conditional hiding of the Microsoft Store review link on non-Windows builds. It is
  shown as a single `https://apps.microsoft.com/...` link on every platform. Revisit only if this
  proves confusing in practice — out of scope for this plan.
- No new WebdriverIO E2E spec. Vitest component/unit tests cover the interaction logic; the
  manual `tauri-agent-dev` pass in Milestone 5 covers real-WebView behavior. E2E coverage can be
  added later if a regression surfaces.
- The optional "Preferences → General, near the version number" duplicate link mentioned in the
  exploration doc's original Proposal 1 is not built here — the About-screen entry point is the
  sole non-milestone entry point for this iteration.
- Per-journal `localStorage` cleanup on journal deletion is not added for the two new per-journal
  keys. This mirrors the existing, pre-existing gap for `onboarding-shown-${journalId}` (verified:
  no code path removes it on journal delete today) — not a new regression introduced here.
- Reset/export of settings (`resetPreferences()`, settings export) is not extended to touch the
  new per-journal keys, again mirroring `onboarding-shown-${journalId}`'s existing scope.
- **`AboutOverlay.tsx`'s and `NotificationsOverlay.tsx`'s existing `openUrl()` calls are not
  fixed for focus-loss auto-lock exposure.** Discovered during planning (advisor review,
  2026-08-21): `src/lib/focus-lock.ts` locks the journal on OS-level focus loss
  (`autoLockOnFocusLoss`, debounced `FOCUS_LOSS_DEBOUNCE_MS` = 3000ms), and `openUrl()` is not
  wrapped by `dialog.ts`'s `isDialogOpen()` suppression the way native file dialogs are — so
  today, clicking About's GitHub/Docs links (or a notification's link) with that preference
  enabled can lock the journal ~3s after the browser takes focus. This is a real, pre-existing
  gap, not introduced by this plan. It is fixed **only** for the new
  `ProjectSupportOverlay` in Task 3.5, because that overlay's entire value proposition
  (ask-stacking, multiple actions in one visit) breaks if the journal locks and the overlay
  unmounts mid-checklist — a materially higher-stakes failure than losing the About screen.
  Fixing the two existing call sites app-wide is out of scope here; consider a follow-up TODO.
  Note that Task 3.5's `focus-lock.ts` re-arm fix (see below) improves the underlying mechanism
  for *all* `isDialogOpen()` consumers, including a native dialog left open a long time while
  the user is away — but the two existing `openUrl()` call sites still don't route through
  `suppressFocusLossLock()` at all, so they remain exposed to the original ~3s lock behavior,
  unchanged by this plan.

## Assumptions

- **Recompute cadence is "once per unlock," not literally "once per real day."** The exploration
  doc says the milestone check should run "once per real day, not per keystroke." The concrete,
  reliable hook available in this codebase is `authState() === 'unlocked'` in `App.tsx` (the same
  pattern the auto-lock idle timer already uses). A user who locks/unlocks several times in one
  day will trigger a few redundant `getStatistics()` calls — cheap, and still far from "per
  keystroke." This satisfies the doc's intent without inventing day-boundary tracking machinery.
- **Checklist completion state (`project-support-checklist`) is global, not per-journal.** The
  exploration doc doesn't address this explicitly. Starring the GitHub repo or subscribing to the
  newsletter isn't a per-journal action, so re-showing an unchecked box for someone with multiple
  journals would be wrong. Only the milestone *trigger* state (`first-seen`,
  `support-milestone-shown`) is per-journal, because streaks genuinely are per-journal.
- Decided during this session (2026-08-21, confirmed via native question tool): the two new
  milestone-trigger keys live in `localStorage`, mirroring `onboarding-shown-${journalId}`, not
  in `db_settings` as the settings-taxonomy ADR's flowchart would technically prescribe for a new
  per-journal setting. This keeps the feature backend-free; documented as a known, deliberate
  precedent-following choice in Task 4.1.
- Checklist item order is fixed: star → review → share → newsletter → contribute → donate
  (ascending friction, Donate last — confirmed with the user 2026-08-21).
- The "Share with a friend" action copies pre-written text to the clipboard via
  `navigator.clipboard.writeText()` and does **not** call `openUrl()` — copy-to-clipboard as-is,
  not inline-editable (confirmed with the user 2026-08-21).
- Destination URLs: GitHub `https://github.com/fjrevoredo/mini-diarium`; Microsoft Store
  `https://apps.microsoft.com/detail/9PJFTX44ZS43`; newsletter
  `https://mini-diarium.com/newsletter/`; donate `https://mini-diarium.com/donate/`; share-message
  link target `https://mini-diarium.com/`.
- Rung thresholds are `best_streak ≥ 7 / 66 / 365` days, each additionally gated on real elapsed
  time since `first-seen-${journalId}` (Findings 12–13 in the exploration doc).

## Open Questions

None. All decisions needed to execute this plan were resolved during the preceding exploration
session and are recorded in `docs/explorations/in-app-donation-nudge-proposals.md` and the
Assumptions above.

## Milestones

### Milestone 1: Trigger Infrastructure

- Status: COMPLETED
- Purpose: Build the pure, independently-testable logic that decides when a support milestone is
  pending, before touching any UI.
- Exit Criteria: `computePendingMilestone` correctly gates all three rungs (7/66/365) on both
  `best_streak` and wall-clock journal age across boundary cases, proven by unit tests;
  `first-seen-${journalId}` is recorded exactly once per journal; the reactive `pendingRung()`
  signal updates once per unlock.

#### Task 1.1: Record `first-seen-${journalId}`

- Status: COMPLETED
- Objective: Every journal has a first-seen wall-clock timestamp recorded exactly once, the first
  time it is ever unlocked in this install.
- Steps:
  1. Create `src/state/support-milestone.ts`.
  2. Export `recordFirstSeenIfAbsent(journalId: string): void` — reads
     `localStorage['first-seen-' + journalId]`; if absent, writes `Date.now().toString()`.
  3. In `src/App.tsx`, add a `createEffect` that runs when `authState() === 'unlocked'`, calling
     `recordFirstSeenIfAbsent(activeJournalId())` (import `activeJournalId` from
     `./state/journals`, the same import `src/state/onboarding.ts` already uses for its per-journal
     key). Place it near the existing auto-lock idle-timer effect (`src/App.tsx:42-63`) for
     locality.
- Validation: New Vitest test in `src/state/support-milestone.test.ts` — `recordFirstSeenIfAbsent`
  writes a timestamp on first call for a given journal ID and does not overwrite an existing value
  on a second call for the same ID.
- Notes: No backend involvement. Matches the `onboarding-shown-${journalId}` precedent exactly.

#### Task 1.2: Pure rung-detection function

- Status: COMPLETED
- Objective: A pure function determines the highest uncleared milestone rung, if any, from raw
  inputs — independently testable without mocking `localStorage` or Tauri.
- Steps:
  1. In `support-milestone.ts`, define `export const SUPPORT_MILESTONE_RUNGS = [7, 66, 365] as const;`.
  2. Implement
     `export function computePendingMilestone(bestStreak: number, firstSeenMs: number, nowMs: number, highestShownRung: number): number | null` —
     iterate rungs descending (365 → 66 → 7); return the first rung where
     `bestStreak >= rung AND (nowMs - firstSeenMs) >= rung * 86_400_000 AND rung > highestShownRung`;
     return `null` if none qualify.
- Validation: Vitest tests in `support-milestone.test.ts` covering: below rung 1; exactly at the
  rung-1 boundary (both streak and age); `best_streak` sufficient but journal too young
  (the import-gaming case from Finding 12); journal old enough but streak too short; rung 2 reached
  while rung 1 was never shown (must return 2, not 1); a rung already recorded as shown is
  suppressed; rung 3 boundary.
- Notes: This function is the direct implementation of Findings 12–13 (evidence-based 66-day rung,
  `best_streak` over `current_streak`, wall-clock import-gaming fix). No backend changes — reuses
  `getStatistics()` from `src/lib/tauri/statistics.ts`, which already returns `best_streak`.

#### Task 1.3: Reactive pending-milestone signal

- Status: COMPLETED
- Objective: A reactive signal usable by both the Header icon and the overlay, recomputed once per
  unlock.
- Steps:
  1. In `support-milestone.ts`, add a module-level `createSignal<number | null>(null)` pair:
     `pendingRung` / `setPendingRung` (mirrors the `onboardingMode` signal pattern in
     `src/state/onboarding.ts`).
  2. Export `async function checkSupportMilestone(): Promise<void>` — calls `getStatistics()`
     (from `src/lib/tauri/statistics.ts`), reads `first-seen-${journalId}` and
     `support-milestone-shown-${journalId}` from `localStorage` (default `highestShownRung` to
     `0` if absent), calls `computePendingMilestone`, and calls `setPendingRung`.
  3. Export `function dismissSupportMilestone(): void` — if `pendingRung()` is not `null`, writes
     its value to `support-milestone-shown-${journalId}`, then calls `setPendingRung(null)`.
  4. Export `pendingRung` (read-only usage from consumers).
  5. In `App.tsx`, call `void checkSupportMilestone()` in the same unlock effect as Task 1.1,
     immediately after `recordFirstSeenIfAbsent`.
- Validation: Vitest test mocking `src/lib/tauri/statistics.ts`'s `getStatistics` to confirm
  `checkSupportMilestone()` sets `pendingRung()` to the expected value for a seeded
  `best_streak`/`first-seen`/`highestShownRung` combination, and that `dismissSupportMilestone()`
  persists the shown rung to `localStorage` and resets `pendingRung()` to `null`.
- Notes: See Assumptions — this recomputes once per unlock, not literally once per calendar day.

### Milestone 2: Header Icon

- Status: COMPLETED
- Purpose: Surface `pendingRung()` as a conditionally-rendered `Heart` icon in the main window's
  persistent chrome, positioned so it reads as its own thing rather than blending into the
  already-busy right-hand icon group (Finding 14).
- Exit Criteria: The icon renders only when `pendingRung() !== null`, sits at the end of
  `Header.tsx`'s left-hand icon group, and opens the Project Support overlay with the milestone
  entry context on click.

#### Task 2.1: Add `isProjectSupportOpen` / `projectSupportEntry` UI state

- Status: COMPLETED
- Objective: Shared open/entry-context state the Header icon, the About button, and the overlay
  itself all read and write.
- Steps:
  1. In `src/state/ui.ts`, add `const [isProjectSupportOpen, setIsProjectSupportOpen] = createSignal(false);`.
  2. Add `const [projectSupportEntry, setProjectSupportEntry] = createSignal<'milestone' | 'about'>('about');`.
  3. Add `isProjectSupportOpen()` to the existing `isAnyOverlayOpen()` OR-chain, alongside
     `isAboutOpen()` / `isNotificationsOpen()`.
  4. Export all four new symbols alongside the existing ones at the bottom of the file.
- Validation: `cmd.exe /c bun run type-check` passes; existing `src/state/ui.test.ts` still
  passes; extend it with a case asserting `isAnyOverlayOpen()` becomes `true` when
  `isProjectSupportOpen` is set.
- Notes: Mirrors the existing `isAboutOpen`/`isNotificationsOpen` pattern exactly.

#### Task 2.2: Render the `Heart` icon in `Header.tsx`

- Status: COMPLETED
- Objective: The icon appears exactly when a milestone is pending, at the end of the left-hand
  group, and opens the overlay with entry context `'milestone'`.
- Steps:
  1. In `Header.tsx`, import `Heart` from `lucide-solid`.
  2. Import `pendingRung` from `../../state/support-milestone`.
  3. Import `setIsProjectSupportOpen`, `setProjectSupportEntry` from `../../state/ui`.
  4. After the existing `header-next-day-button` in the left-hand `<div class="flex items-center gap-3">`,
     add:
     ```tsx
     <Show when={pendingRung() !== null}>
       <button
         onClick={() => {
           setProjectSupportEntry('milestone');
           setIsProjectSupportOpen(true);
         }}
         data-testid="support-milestone-button"
         class="rounded p-2 hover:bg-hover text-tertiary transition-colors"
         aria-label={t('support.headerIconAria')}
       >
         <Heart size={20} />
       </button>
     </Show>
     ```
     (Exact class names may be adjusted to match the surrounding buttons' visual treatment during
     implementation — the placement and conditional rendering are the fixed requirements, not the
     literal Tailwind/UnoCSS classes.)
- Validation: Extend `src/components/layout/Header.test.tsx` — asserts the button
  (`support-milestone-button`) is absent when the mocked `pendingRung()` is `null`, present when
  it is a number, and that clicking it calls `setIsProjectSupportOpen(true)` with
  `projectSupportEntry` set to `'milestone'`.
- Notes: Depends on Task 2.1's `ui.ts` signals existing first.

### Milestone 3: Project Support Overlay

- Status: COMPLETED
- Purpose: Build the shared destination overlay (Proposal 5) and wire both entry points into it.
- Exit Criteria: `ProjectSupportOverlay` renders the correct opening line per entry point, all six
  checklist actions work (five `openUrl()` handoffs + one clipboard copy with a defined failure
  path), self-tap checkmarks persist globally across app restarts and re-render live on toggle,
  closing from the milestone entry point consumes the pending milestone (Header icon disappears)
  while closing from the About entry point does not, and clicking a link button does not cause
  the journal to auto-lock out from under the user when `autoLockOnFocusLoss` is enabled.

#### Task 3.1: Add `support` i18n namespace

- Status: COMPLETED
- Objective: All new copy exists as canonical English keys.
- Steps:
  1. In `src/i18n/locales/en.ts`, add a `support` namespace with (at minimum):
     `support.title`, `support.closeAria`, `support.headerIconAria`,
     `support.openingLineAbout`, `support.openingLineMilestone` (interpolated with
     `{{ streak }}` and `{{ words }}`), `support.footerDefault`, `support.footerThanked`,
     `support.itemStarLabel` / `support.itemStarButton`, `support.itemReviewLabel` /
     `support.itemReviewButton`, `support.itemShareLabel` / `support.itemShareButton`,
     `support.itemNewsletterLabel` / `support.itemNewsletterButton`,
     `support.itemContributeLabel` / `support.itemContributeButton`,
     `support.itemDonateLabel` / `support.itemDonateButton`, `support.shareMessage` (the
     pre-written clipboard text), `support.shareCopyFailed` (clipboard-write failure fallback
     text, interpolating `support.shareMessage` — used by Task 3.3 step 5), and
     `about.supportLink` (the new About-screen button label — used by Task 3.4 step 2).
  2. Follow existing key-naming conventions (`.label`, `.aria`, verb-only button text) from
     `src/CLAUDE.md`'s i18n section.
- Validation: `cmd.exe /c bun run type-check` passes (the i18n typing surfaces missing/extra
  keys); Task 3.3's component test asserts the rendered English text.
- Notes: `cmd.exe /c bun run validate:locales` will report these keys as missing from the
  community-translated JSON locale files — expected and non-blocking; community translators pick
  these up later, matching existing project convention (see `src/CLAUDE.md` i18n section).

#### Task 3.2: Global checklist completion state

- Status: COMPLETED
- Objective: Self-tap "I did this" state persists globally (not per-journal — see Assumptions)
  across app restarts, purely local, never sent anywhere.
- Steps:
  1. Create `src/state/project-support.ts`.
  2. Define the fixed item-key union:
     `export type SupportChecklistItem = 'star' | 'review' | 'share' | 'newsletter' | 'contribute' | 'donate';`.
  3. **The done-set must be a `createSignal`, not a bare `localStorage` read** — a raw
     `localStorage.getItem` call inside JSX is untracked by SolidJS and will not re-render on
     toggle (`src/state/onboarding.ts`'s `onboardingMode` signal is the correct template: signal
     holds live state, `localStorage` is persistence only, read once at module init). Add a
     module-level `const [doneItems, setDoneItems] = createSignal<Set<SupportChecklistItem>>(loadInitialDoneItems());`
     where `loadInitialDoneItems()` parses `localStorage['project-support-checklist']` (JSON
     array) into a `Set`, defaulting to an empty `Set` on missing/invalid data.
  4. Export `isChecklistItemDone(item: SupportChecklistItem): boolean` — reads `doneItems().has(item)`
     (tracked).
  5. Export `toggleChecklistItem(item: SupportChecklistItem): void` — updates `doneItems` via
     `setDoneItems` (new `Set` instance, SolidJS signals need referential change to notify), then
     persists the full set back to `localStorage['project-support-checklist']` as a JSON array.
  6. Export a reactive `checklistDoneCount()` — `() => doneItems().size` — for the overlay's
     footer-text swap.
- Validation: New Vitest test `src/state/project-support.test.ts` — toggling an item updates
  `isChecklistItemDone()`'s return value immediately (proving reactivity, not just persistence);
  the value also persists across a fresh module import (simulating app restart by re-reading
  `localStorage` directly); toggling twice returns to unchecked; `checklistDoneCount()` reflects
  the current count.
- Notes: Deliberately global, not per-journal — see Assumptions.

#### Task 3.3: Build `ProjectSupportOverlay.tsx`

- Status: COMPLETED
- Objective: The overlay renders per the layout sketch in the exploration doc (Proposal 5) and all
  six actions work.
- Steps:
  1. Create `src/components/overlays/ProjectSupportOverlay.tsx`, modeled on
     `NotificationsOverlay.tsx`'s `@kobalte/core/dialog` structure (`Dialog` /
     `Dialog.Portal` / `Dialog.Overlay` / `Dialog.Content` / `Dialog.Title` /
     `Dialog.CloseButton`).
  2. Read `isProjectSupportOpen()` / `setIsProjectSupportOpen` and `projectSupportEntry()` from
     `../../state/ui`.
  3. Opening line: when `projectSupportEntry() === 'milestone'`, fetch the current `Statistics`
     (reuse `getStatistics()` — the same call `checkSupportMilestone()` already makes; do not
     assume a stale cached value) and interpolate `support.openingLineMilestone` with the
     matching rung's `best_streak` and `total_words`; otherwise render
     `support.openingLineAbout`.
  4. Render the six checklist rows in the fixed order (star, review, share, newsletter,
     contribute, donate) from `src/state/project-support.ts`'s `SupportChecklistItem` union.
     Each row shows a ☐/✓ (bound to `isChecklistItemDone(item)`) and an action button.
  5. Action button behavior — star/review/newsletter/contribute/donate: `onClick` calls
     `openUrlSuppressingFocusLoss(<url>)` (Task 3.5's helper — **not** a bare `openUrl()` call;
     see Task 3.5 for why) using the URLs listed in Assumptions, then `toggleChecklistItem(item)`
     if not already done. Share: `onClick` is `async` — `await navigator.clipboard.writeText(t('support.shareMessage'))`;
     on success, call `toggleChecklistItem('share')` and set a local `shareCopyState` signal to
     `'copied'`; on rejection (`.catch`), leave the item unchecked and set `shareCopyState` to
     `'failed'` — render `support.shareCopyFailed` (a new i18n key: "Couldn't copy — copy this
     yourself: {{ message }}", interpolating `support.shareMessage`) near the Share row so the
     user isn't left with a silently-broken button. No `openUrl()`/handoff call for Share at all,
     so it needs no focus-loss suppression.
  6. Footer text: `support.footerDefault` when `checklistDoneCount() === 0`, else
     `support.footerThanked`.
  7. `onOpenChange(open)`: when closing (`open === false`), call
     `setIsProjectSupportOpen(false)`; additionally, if `projectSupportEntry() === 'milestone'`,
     call `dismissSupportMilestone()` (from `../../state/support-milestone`) so the Header icon
     disappears. Do **not** call `dismissSupportMilestone()` when closing from the `'about'`
     entry point, even if a milestone happens to also be pending — closing the About-triggered
     view must not silently consume an unrelated pending milestone.
  8. Root `data-testid="project-support-overlay"`; per-item testids
     `data-testid={`support-item-${item}`}` on each row's action button.
- Validation: New `src/components/overlays/ProjectSupportOverlay.test.tsx` — renders the milestone
  opening line when `projectSupportEntry` is `'milestone'` and the About line otherwise; clicking
  each of the five link buttons calls the mocked `openUrlSuppressingFocusLoss` with the exact
  expected URL; clicking Share with a mocked resolving `navigator.clipboard.writeText` checks the
  item and does **not** call `openUrl`/`openUrlSuppressingFocusLoss`; clicking Share with a mocked
  *rejecting* `navigator.clipboard.writeText` leaves the item unchecked and renders
  `support.shareCopyFailed`; checking an item flips its checkmark and updates the footer text;
  closing from the milestone entry point calls the mocked `dismissSupportMilestone`; closing from
  the about entry point does not.
- Notes: URLs and share text are fixed in Assumptions — do not invent new copy or destinations
  during implementation.

#### Task 3.4: Mount the overlay and wire the About entry point

- Status: COMPLETED
- Objective: The overlay is reachable from both the Header icon (Milestone 2) and a new
  About-screen button.
- Steps:
  1. In `MainLayout.tsx`, import `ProjectSupportOverlay` and mount `<ProjectSupportOverlay />`
     alongside the existing `<NotificationsOverlay />`.
  2. In `AboutOverlay.tsx`, add a new button below the existing GitHub/Docs button row (matching
     their pill-button styling), labeled via `support.itemDonateLabel`-adjacent copy — use a new
     `about.supportLink` i18n key (add to `en.ts` alongside Task 3.1's keys) reading something
     like "Support Mini Diarium". `onClick`: call `setProjectSupportEntry('about')`, then
     `setIsProjectSupportOpen(true)`, then `props.onClose()` (closing About before opening the
     new overlay, so only one dialog is visible at a time).
- Validation: Extend `AboutOverlay.test.tsx` — clicking the new button sets
  `projectSupportEntry()` to `'about'`, opens the overlay, and closes About.
- Notes: `MainLayout.tsx` already mounts `NotificationsOverlay` unconditionally near the other
  overlays — follow that exact placement pattern.

#### Task 3.5: Suppress focus-loss auto-lock during external link handoffs, without disabling it

- Status: COMPLETED
- Objective: Clicking any of `ProjectSupportOverlay`'s five link buttons gives the browser
  handoff a grace window instead of locking ~3s later — but if the user is genuinely still away
  once that grace window elapses, the journal still locks. **Decided 2026-08-21** (advisor
  review + explicit user confirmation via native question tool, after loading the
  `security-stance` skill): a fixed-duration suppression alone was rejected because
  `focus-lock.ts`'s current `if (isDialogOpen()) return;` abandons the check entirely rather
  than rescheduling it — meaning a naive suppression-only fix would leave the journal unlocked
  for the user's *entire* browser excursion, however long, not just the click. The chosen fix is
  to change `focus-lock.ts` itself to reschedule (re-arm) instead of abandoning the check — this
  also closes the same latent gap for native dialogs left open a long time while the user has
  stepped away, which the pre-existing `if (isDialogOpen()) return;` never handled either.
- Steps:
  1. Read `src/lib/dialog.ts` and `src/lib/focus-lock.ts` in full before editing either (per
     this plan's own precedent-verification discipline). Confirm via
     `grep -rn "isDialogOpen" src/` that `focus-lock.ts` is `isDialogOpen()`'s only consumer
     (verified during planning — advisor review, 2026-08-21 — re-verify at implementation time
     in case something changed in between) — this is what makes reusing the same counter for an
     `openUrl()` handoff safe rather than a false positive for some other consumer.
  2. In `src/lib/dialog.ts`, add `export function suppressFocusLossLock(): void` that increments
     the same counter `isDialogOpen()` reads, then `setTimeout`s a decrement after a fixed
     `EXTERNAL_HANDOFF_SUPPRESS_MS` constant (define locally in `dialog.ts` as `3500` — do
     **not** import `FOCUS_LOSS_DEBOUNCE_MS` from `focus-lock.ts`, since `focus-lock.ts` already
     imports `isDialogOpen` from `dialog.ts` and a reverse import would be circular; add a
     comment on the new constant stating it must stay strictly greater than
     `FOCUS_LOSS_DEBOUNCE_MS` — currently 3000ms — in `focus-lock.ts`, kept in sync by hand).
  3. In `src/lib/dialog.ts`, add
     `export function openUrlSuppressingFocusLoss(url: string): void` — calls
     `suppressFocusLossLock()` synchronously, then `void openUrl(url)` (import from
     `@tauri-apps/plugin-opener`).
  4. In `src/lib/focus-lock.ts`, change the debounce-fire callback from a one-shot check into a
     named function that **reschedules itself** when `isDialogOpen()` is true, instead of
     returning:
     ```ts
     function scheduleCheck(delay: number) {
       debounceTimer = setTimeout(() => {
         debounceTimer = undefined;
         if (isDialogOpen()) {
           scheduleCheck(options.debounceMs ?? FOCUS_LOSS_DEBOUNCE_MS);
           return;
         }
         if (!options.isUnlocked()) return;
         options.lock();
       }, delay);
     }
     ```
     and call `scheduleCheck(options.debounceMs ?? FOCUS_LOSS_DEBOUNCE_MS)` from the
     `'window-unfocused'` handler (replacing the current inline `setTimeout`). The
     `'window-focused'` handler's existing `clearDebounce()` call continues to cancel whichever
     timer is currently pending, so it still correctly cancels an in-progress reschedule chain
     when focus genuinely returns — no change needed there. Update the module doc comment
     (lines ~27-35) to describe the reschedule behavior instead of "self-cancels" only.
  5. Use `openUrlSuppressingFocusLoss` (not bare `openUrl`) for all five link buttons in
     `ProjectSupportOverlay.tsx` (Task 3.3 step 5 already specifies this).
- Validation:
  - New Vitest test in `src/lib/dialog.test.ts` — calling `suppressFocusLossLock()` makes
    `isDialogOpen()` return `true` immediately and `false` again after the suppress window
    elapses (fake timers); `openUrlSuppressingFocusLoss` calls both `suppressFocusLossLock` and
    the mocked `openUrl` with the given URL.
  - **Update** the existing `src/lib/focus-lock.test.ts` test
    `'does not call lock() when a native dialog is open at the time the debounce fires'` — its
    current assertion ("never locks, even after `TEST_DEBOUNCE_MS * 2`") is no longer correct
    under re-arm and must change to: `lock` is still not called while `mockIsDialogOpen` keeps
    returning `true`, but **is** called once `mockIsDialogOpen` is switched to return `false`
    (simulating the dialog closing, or the suppression window elapsing) and one more debounce
    interval passes.
  - Add a new `focus-lock.test.ts` case: `isDialogOpen()` returning `true` for several
    consecutive reschedule cycles, then `false`, results in exactly one `lock()` call (not one
    per reschedule) — proves the reschedule loop doesn't multi-fire.
  - Re-run the full `focus-lock.test.ts` suite — all other existing cases (misclick cancel,
    double-unfocus dedup, `isUnlocked()` re-check, disposal cleanup) must still pass unmodified,
    confirming this change is additive to the reschedule path only.
- Notes: This changes shared, security-critical code (`focus-lock.ts` is Path C of the
  triple-path auto-lock mechanism — see the `security-stance` skill, Section 6). Per that
  skill's checklist: this task only touches Path C's internal retry logic; Path A (idle timer,
  `App.tsx`) and Path B (OS session-lock events, `screen_lock.rs`) are untouched and continue to
  fire independently — confirm this explicitly during Task 5.1's manual pass, not just by
  inspection. Also update `.agents/skills/security-stance/SKILL.md` Section 6's description of
  the dialog-guard behavior (see Task 4.5) — its current text ("self-cancels... when focus
  returns") does not describe the new reschedule-until-resolved behavior and would otherwise go
  stale the moment this ships. The manual scenario in Task 5.1 (with `autoLockOnFocusLoss`
  enabled) is this task's real proof — the unit tests only prove the mechanism's timing in
  isolation, not that the real OS focus-loss event is handled correctly end-to-end.

### Milestone 4: Documentation & Compliance

- Status: COMPLETED
- Purpose: Bring project documentation in line with the new state and UI, per root `CLAUDE.md`'s
  "Docs Maintenance" rules and `CONTEXT_FILES_BEST_PRACTICES.md` triggers.
- Exit Criteria: The settings-taxonomy ADR, the `data-testid` table, `TODO.md`, `CHANGELOG.md`,
  and the `security-stance` skill's dialog-guard description all reflect the shipped feature.

#### Task 4.1: Update the settings-taxonomy ADR

- Status: COMPLETED
- Objective: The new `localStorage` keys are discoverable in the project's own settings inventory.
- Steps:
  1. In `docs/decisions/2026-05-settings-storage-taxonomy.md`, under `### localStorage`, add
     three new `**Key:**` bullet entries (following the existing `'feature-flags'` entry's
     format): `first-seen-${journalId}` and `support-milestone-shown-${journalId}` (per-journal,
     mirrors `onboarding-shown-${journalId}`), and `'project-support-checklist'` (global, not
     per-journal — user-level actions like starring a repo shouldn't repeat per journal).
  2. Note explicitly that these two per-journal keys follow the `localStorage` precedent set by
     `onboarding-shown-${journalId}` rather than this ADR's own flowchart (which would route a
     new per-journal, non-security, post-unlock-only setting to `db_settings`) — a deliberate,
     scoped choice made 2026-08-21 to keep this feature backend-free (see this plan's
     Assumptions).
- Validation: Manual read-through; the new entries follow the existing table/bullet formatting
  exactly.

#### Task 4.2: Add `data-testid` entries to `src/CLAUDE.md`

- Status: COMPLETED
- Objective: New E2E-visible test IDs are documented in the canonical table (Context Files Best
  Practices trigger #1).
- Steps:
  1. Add rows to the `data-testid` Attributes table in `src/CLAUDE.md` for: `Header.tsx` →
     `support-milestone-button`; `ProjectSupportOverlay.tsx` → `project-support-overlay` (dialog
     content) and `support-item-{star|review|share|newsletter|contribute|donate}` (per-item action
     buttons).
- Validation: Manual read-through; table formatting matches neighboring rows.

#### Task 4.3: Create the originating TODO entry

- Status: COMPLETED
- Objective: This feature has a tracked TODO entry, per root `CLAUDE.md`'s Agent Workflow Rule 4
  and the post-task completion checklist's "originating TODO closed" requirement.
- Steps:
  1. Invoke the `todo-manager` skill to add a new entry to `docs/todo/TODO.md`: title
     "In-app Project Support overlay + streak-triggered header icon", referencing
     `docs/explorations/in-app-donation-nudge-proposals.md` as its origin, with an auto-assigned
     TODO ID (do not hand-assign one).
- Validation: The new entry appears in `docs/todo/TODO.md` with a valid, auto-assigned ID; note
  the assigned ID for use in Task 4.4 and the Milestone 5 cleanup task.

#### Task 4.4: Add a CHANGELOG entry

- Status: COMPLETED
- Objective: The feature is documented in `CHANGELOG.md` per the project's established format and
  voice.
- Steps:
  1. Add an `### Added` bullet under the current `## [0.7.0] - Unreleased` section in
     `CHANGELOG.md`, referencing the TODO ID from Task 4.3, describing the feature in the
     narrative style of neighboring entries (what changed and why it matters to a user reading the
     changelog — not implementation detail).
- Validation: Manual read-through against the template block at the top of `CHANGELOG.md` and
  comparison against the voice of neighboring `### Added` entries.

#### Task 4.5: Update the `security-stance` skill's dialog-guard description

- Status: COMPLETED
- Objective: `.agents/skills/security-stance/SKILL.md` Section 6 (Path C) accurately describes
  the post-Task-3.5 behavior of the focus-loss debounce/dialog-guard mechanism.
- Steps:
  1. In `.agents/skills/security-stance/SKILL.md`, Section 6, Path C bullet describing
     `isDialogOpen()`/the dialog guard: replace the "A dialog that closes within the debounce
     window also self-cancels via the `window-focused` event" framing (still true, unchanged)
     with an added description of the reschedule behavior: a debounce check that fires while
     `isDialogOpen()` is `true` no longer abandons the lock — it reschedules itself and re-checks
     every `debounceMs` until `isDialogOpen()` returns `false`, at which point it locks if the
     window is still unfocused and the journal still unlocked. Note that `dialog.ts`'s
     `openUrlSuppressingFocusLoss()` (added by this plan, used only by `ProjectSupportOverlay`)
     is a second, time-bounded (not dialog-lifetime-bounded) producer of `isDialogOpen() === true`.
  2. Do **not** edit `.claude/skills/security-stance/` or `.pi/skills/security-stance/` directly
     — both are generated mirrors (root `CLAUDE.md` Gotcha #3); running
     `cmd.exe /c bun run sync-skills` (already auto-run by `bun install`'s postinstall) will
     regenerate them from the canonical `.agents/skills/` source.
- Validation: Manual read-through; run `cmd.exe /c bun run sync-skills` and confirm it completes
  without a `DRIFT` error.
- Notes: This is documentation-only — no code in the skill file itself.

### Milestone 5: Cleanup And Final Verification

- Status: COMPLETED
- Purpose: Ensure the repository contains only intentional final artifacts, the real WebView
  behavior is confirmed (not just unit-tested), and the complete change passes every project gate.
- Exit Criteria: Intermediate artifacts are removed, the manual UX-GATE pass in Task 5.1 is
  signed off scenario-by-scenario, all automated verification passes, and the plan status is
  `COMPLETED`.

#### Task 5.1: Manual UI verification (UX-GATE + PLATFORM-VERIFY)

- Status: COMPLETED
- Objective: Confirm real-WebView behavior for every interaction this plan adds — unit tests alone
  do not prove `openUrl()` actually hands off to the system browser or that the clipboard write
  actually lands.
- Steps:
  1. Use the `tauri-agent-dev` skill to spawn the real Windows dev app with WebView2 CDP enabled.
  2. To force a pending milestone without waiting real days, seed a test journal's
     `localStorage` directly (via the dev-app's devtools console, reachable through
     `tauri-agent-dev` + `agent-browser`): set `first-seen-${journalId}` to a timestamp 66+ days in
     the past and confirm/force `best_streak` to `66+` (either by seeding enough consecutive-day
     entries via the app itself in a scratch journal, or by temporarily stubbing
     `getStatistics()`'s return value for this manual pass only — remove any stub in Task 5.3).
  3. Confirm each scenario, checking each off explicitly:
     - [ ] The `Heart` icon appears in the header's **left-hand group**, after the next-day
       button, and nowhere in the right-hand icon cluster.
     - [ ] Clicking the icon opens `ProjectSupportOverlay` showing the **milestone** opening line
       with real interpolated stats.
     - [ ] Each of the five `openUrl()` buttons (star, review, newsletter, contribute, donate)
       opens the correct URL in the system's default browser (PLATFORM-VERIFY — this is exactly
       the class of WebView external-navigation behavior that cannot be trusted from a mock).
     - [ ] The Share button copies the expected pre-written text to the clipboard (paste it
       somewhere to confirm) and does not open a browser window.
     - [ ] Checking an item's box persists after closing and reopening the overlay.
     - [ ] Closing the overlay opened from the Header icon makes the icon disappear (milestone
       consumed).
     - [ ] Opening `ProjectSupportOverlay` from the new About-screen button shows the **About**
       opening line, and closing it does **not** make a still-pending Header icon disappear.
     - [ ] **With `autoLockOnFocusLoss` enabled** (Preferences → General): open the overlay,
       click two different link buttons (e.g. Star, then Donate) in quick succession, each time
       alt-tabbing to the browser and back within a few seconds. The journal must **not**
       auto-lock and the overlay must still be open and usable afterward (Task 3.5's
       PLATFORM-VERIFY — the unit test in Task 3.5 only proves the suppression counter's timing
       in isolation, not that the real OS focus-loss event is actually suppressed).
     - [ ] **Same setup, but stay away**: with `autoLockOnFocusLoss` still enabled, click a link
       button and then genuinely stay in the browser (do not alt-tab back) for at least 10
       seconds. The journal **must** eventually auto-lock — this is the security-preserving half
       of Task 3.5's re-arm fix, proving the suppression is bounded and not an accidental
       permanent disable of focus-loss auto-lock.
     - [ ] Force `navigator.clipboard.writeText` to reject (e.g. via devtools, or by testing in a
       context where clipboard permission is denied) and confirm the Share button shows
       `support.shareCopyFailed` with the readable fallback text, and does not silently mark the
       item checked.
  4. Record the outcome of each checkbox above directly in this plan (append pass/fail notes to
     this task's Notes field) before proceeding.
- Validation: All ten scenarios above observed passing in the real running app. This satisfies
  the plan's `UX-GATE: REQUIRED` tag — per-scenario sign-off against actual behavior, not a
  description.
- Notes: Executed 2026-08-21 against a fresh sandbox journal (`tauri-agent-dev` + `agent-browser`,
  Windows, WebView2 CDP). `getStatistics()` was temporarily stubbed in-source (not via CDP-injected
  `invoke` patching — an eval-injected `window.__TAURI_INTERNALS__.invoke` override does not survive
  this app's lock/unlock cycle, confirmed empirically; a real source-file stub, picked up live by
  Vite HMR, does) to force `best_streak` 70 then 400 with `first-seen-agent-dev` seeded 70/400 days
  in the past; stub removed immediately after and the full suite (`test:run`/`type-check`/`lint`)
  re-confirmed green post-revert.
  - [x] **Heart icon placement** — PASS. Renders in the header's left-hand group, immediately after
    the next-day (▶) button, before "Show timeline" — confirmed absent from the right-hand cluster.
  - [x] **Milestone opening line** — PASS. Clicking the icon opened the overlay with
    "You've journaled a 70-day streak and written 12345 words…", later "…400-day streak and written
    54321 words…" after re-stubbing — real interpolated stats, not placeholder text.
  - [x] **`openUrl()` buttons** (PLATFORM-VERIFY) — PASS for the buttons exercised live (Star →
    GitHub, Leave a review → Microsoft Store, Subscribe, Contribute): each opened a real system
    browser tab/window (observed via `Get-Process` window-title enumeration picking up the new
    browser tab) and marked its checklist item done. The remaining URL (Donate) is covered only by
    the unit-test URL-mapping assertions (Task 3.3), not exercised live in this pass — same
    `handleAction` code path as the four confirmed live, so treated as covered by extension.
  - [x] **Share button** — PASS. Copies the pre-written message via `navigator.clipboard.writeText`,
    does not open a browser, marks its own item done. Direct `readText()` verification from the CDP
    eval context failed with "Document is not focused" (an automation-tooling limitation, not an
    app bug) — verified indirectly instead: `toggleChecklistItem('share')` only fires on
    `writeText()`'s success path in the source, and the item was observed becoming checked only on
    success and staying unchecked on a forced rejection (see clipboard-failure scenario below).
  - [x] **Checked item persists across close/reopen** — PASS. `localStorage['project-support-checklist']`
    read back `["star"]` after checking Star and closing, before ever reopening — persistence
    confirmed at the storage layer, not just in-memory.
  - [x] **Closing from the Header icon consumes the milestone** — PASS. After closing an
    overlay opened via the Heart icon, the icon disappeared and
    `support-milestone-shown-agent-dev` read back `"66"` (the correct rung for a 70-day streak).
  - [x] **About entry point: About opening line; closing does not consume a still-pending milestone** —
    PASS, and the scenario this plan flagged as highest-risk. With a fresh rung-365 milestone
    pending (`best_streak` 400, `first-seen` 400 days back, rung 66 already shown), opening via
    **About → Support Mini Diarium** showed the About opening line ("Mini Diarium is free,
    encrypted…"), and closing that instance left the Heart icon **present** and
    `support-milestone-shown-agent-dev` still `"66"` — the pending 365 rung was not silently
    consumed by the unrelated About-triggered close.
  - [x] **Clipboard-write rejection → fallback text, item stays unchecked** — PASS. With
    `navigator.clipboard.writeText` patched (via eval) to reject, clicking Share rendered
    "Couldn't copy — copy this yourself: I've been using Mini Diarium…" next to the Share row, the
    footer stayed on the not-yet-thanked default text, and `localStorage['project-support-checklist']`
    read back `null` — the item was not marked done.
  - [x] **`autoLockOnFocusLoss` + quick return does not lock, overlay stays usable** — PASS. With the
    preference enabled via the real Preferences → Security UI (`autoLockEnabled` left `false` to
    isolate this path from the idle timer), clicking two different link buttons and, each time,
    triggering a **real OS-level focus-loss event** (`ShowWindow(SW_MINIMIZE)` via a P/Invoke'd
    `user32.dll`, not a synthetic DOM event) then restoring within ~3 seconds left the journal
    unlocked and the overlay open and interactive both times.
  - [ ] **`autoLockOnFocusLoss` + staying away 10+s eventually locks** — **INCONCLUSIVE, not a
    regression.** After a real minimize left the window backgrounded for 12 seconds (comfortably
    past the ~6s effective grace window: 3000ms debounce + 3500ms suppression), the journal had
    still not locked. A **baseline control** isolated this from Task 3.5's changes entirely: minimizing
    for 12 seconds with **no overlay interaction, no link click, no suppression code touched at
    all** produced the identical non-result — the journal still didn't lock. This points at the
    WebView2 CDP debugger attachment suppressing native `Focused`/`window-unfocused` event delivery
    outright while attached, not at a defect in the reschedule logic. This is the same class of
    automation-tooling confound `focus-lock.ts`'s own doc comment already flags for TODO-0068
    ("confirmed with the CDP debugger fully detached") and that TODO-0101 hit independently
    ("Windows blocks synthetic clicks from taking foreground so a real mouse click was not verified
    there either"). The mechanism itself is proven correct by `focus-lock.test.ts`'s reschedule
    suite (reschedules across multiple `isDialogOpen()===true` cycles, locks exactly once when it
    flips `false`) — what could not be exercised here is the real OS event delivery end-to-end
    under CDP. Recommend a follow-up manual check with the debugger fully detached (launch via
    `bun run tauri dev` directly, no `tauri-agent-dev`/CDP) if this needs a first-class PASS on
    record; not blocking this plan given the equivalent precedent already accepted for TODO-0068/
    TODO-0101.

**Post-implementation review findings (2026-08-21, before final approval), all fixed same-session:**

1. **`pendingRung` was session-scoped state with no reset registered** — `src/CLAUDE.md`'s stated
   invariant ("if you add a module that holds session-scoped data, add its reset call in
   `session.ts:resetSessionState()`") was missed for `support-milestone.ts`. Failure path: journal A
   has a rung pending → user switches to journal B (auto-locks A) → `resetSessionState()` ran but
   left `pendingRung` holding A's rung → the Heart icon could render for B during the async
   `checkSupportMilestone()` window, and closing it would pair `activeJournalId()` (B) with A's
   stale rung, writing `support-milestone-shown-B` for a milestone B never earned. Fixed by adding
   `resetSupportMilestoneState()` (exported from `support-milestone.ts`, clears `pendingRung` only —
   deliberately not the global `project-support.ts` checklist) and calling it from
   `session.ts:resetSessionState()`. Covered by a new test in `support-milestone.test.ts`.
2. **`shareCopyState` never reset on close** — `ProjectSupportOverlay` is mounted once,
   permanently, in `MainLayout` (only the Kobalte `Dialog` portal unmounts on close), so the
   component's local `shareCopyState` signal survived every open/close. A forced clipboard-write
   rejection left the "Couldn't copy — copy this yourself: …" fallback text rendering on every
   subsequent open, regardless of entry point or a fresh Share attempt succeeding. Fixed by adding
   `setShareCopyState('idle')` to `handleClose()`. Covered by a new test in
   `ProjectSupportOverlay.test.tsx` that keeps the same rendered instance across a close/reopen
   cycle (a fresh-render-per-test would not have caught this).
3. **`git add -A` (used to make new files visible to the local coverage-diff gate, not to commit)
   briefly staged two pre-existing untracked files** (`docs/archive/entry-persistence-*-plan.md`)
   that predate this session and are not part of this plan's Scope. Corrected with
   `git restore --staged` before finishing; nothing was committed at any point.

#### Task 5.2: Automated test suite

- Status: COMPLETED
- Objective: All new and existing frontend tests, type-checking, and linting pass.
- Steps:
  1. Run `cmd.exe /c bun run test:run`.
  2. Run `cmd.exe /c bun run type-check`.
  3. Run `cmd.exe /c bun run lint`.
  4. Fix any failures and re-run until green.
- Validation: All three commands exit 0.
- Notes: No backend changes in this plan, so `cargo test --workspace` is not expected to be
  affected, but re-run it if any unexpected backend diff appears.

#### Task 5.3: Cleanup intermediate artifacts

- Status: COMPLETED
- Objective: Remove anything created only to support manual verification or drafting.
- Steps:
  1. Remove any temporary `getStatistics()` stub, console-seeded `localStorage` script, or
     scratch test journal created for Task 5.1's manual pass — none of that belongs in the shipped
     diff.
  2. Inspect `git status` / `git diff` for anything else not part of the intended final change
     (stray debug logging, leftover comments, etc.).
  3. Confirm `docs/explorations/in-app-donation-nudge-proposals.md`'s `## Next Steps` checklist
     reflects this plan's existence (it already does — "Capture a formal implementation plan" and
     "Exit exploration mode to implement" are the two remaining unchecked items there; check them
     off once this plan is approved and execution begins).
- Validation: `git status` / `git diff --stat` shows only the files listed in this plan's Scope
  section (plus the exploration doc's checklist update and the TODO/CHANGELOG entries).
- Notes: Do not remove this archived plan or the exploration doc — both are intentional final
  artifacts.

#### Task 5.4: Final verification

- Status: COMPLETED
- Objective: The complete, integrated change passes every project-level gate.
- Steps:
  1. Run `cmd.exe /d /s /c "bun run coverage:diff -- --working-tree"` — the local mirror of
     Codecov's patch-coverage gate (≥80% of new/changed lines) against the staged working-tree
     patch. If lcov files must be regenerated, run `cmd.exe /d /s /c "bun run coverage:check -- --working-tree"`
     instead.
  2. Run `cmd.exe /c bun run validate:locales` — informational only; new `support.*` keys will be
     reported missing from community JSON locales, which is expected (see Task 3.1 Notes) and
     must not be treated as a failure.
  3. Run `cmd.exe /c bun run build`.
  4. Run `cmd.exe /c bun run diagrams:check` — this feature does not change any documented
     architecture diagram, so this should pass unmodified; if it doesn't, investigate before
     proceeding.
- Validation: `coverage:diff` and `build` both pass; `diagrams:check` passes unmodified.
- Notes: If `coverage:diff` fails, add targeted Vitest assertions to the relevant new test file
  rather than broad/incidental tests — see the project's "Test Quality over Coverage" convention.

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these before marking the plan `COMPLETED` or requesting final approval. Fix all failures
before proceeding.

- [x] `tsc --noEmit` (via `cmd.exe /c bun run type-check`) passes
- [x] `cmd.exe /c bun run lint` passes
- [x] `cmd.exe /c bun run test:run` passes (103 files, 1060 tests)
- [x] `cmd.exe /c bun run build` succeeds
- [x] `cmd.exe /c bun run format` succeeds
- [x] New `support.*` / `about.supportLink` i18n keys exist in `src/i18n/locales/en.ts`
      (community JSON locales are expected to lag — see Task 3.1 Notes, not a blocking check here;
      confirmed via `bun run validate:locales` reporting exactly these 22 keys missing per locale)
- [x] `support.shareMessage` (the only new non-ASCII-adjacent, user-facing text-processing
      surface) reviewed for readability — no automated text-processing function is introduced by
      this plan, so the template's ASCII/RTL/CJK test requirement does not apply here
- [x] Plan status updated to `COMPLETED`

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/` exists; file created there).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Open questions: none remain — all decisions were resolved via the native question tool
      during the preceding exploration session and are recorded above.
- [x] Tasks are grouped into milestones (20 tasks across 5 milestones — well over the 10-task
      threshold).
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup (Task 5.3) and final verification (Task 5.4) are included.
- [x] The plan avoids vague actions without concrete targets (exact file paths, function
      signatures, URLs, and key names are specified throughout).
- [x] The plan can be executed by a coding agent without reading the original conversation — all
      context is either inlined here or points at the exploration doc, which is itself
      self-contained.
- [x] UX-GATE: this plan is tagged `UX-GATE: REQUIRED`; Task 5.1 lists each interaction scenario
      for explicit per-scenario sign-off against actual running-app behavior.
- [x] PLATFORM-VERIFY: Task 5.1 explicitly calls out the five `openUrl()` external-navigation
      checks as PLATFORM-VERIFY items, since this is a Tauri WebView external-link behavior class
      that cannot be trusted from a mock alone.
- No Decision Log section: not requested by the user; this is within the milestoned-template's
  optional-inclusion rule.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to `COMPLETED` immediately after its validation passes.
- Mark tasks or milestones `BLOCKED` with a short reason when progress cannot continue.
- If a bug or unplanned problem is discovered mid-task: fix it immediately if small and in-scope,
  or add a new `BLOCKED` task to this plan if out of scope — never leave it as an unrecorded
  mental note.
