# TODO-0034: Journal Picker Scroll Limit

## Metadata

- Plan Status: READY FOR APPROVAL
- Created: 2026-05-11
- Last Updated: 2026-05-11
- Owner: Coding agent
- Approval: PENDING
- Related TODO: TODO-0034 in `docs/todo/TODO.md`

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Cap the visible journal entries in the journal picker to 5 items. After 5 entries, a vertical scroll must appear to prevent the picker component from growing beyond the viewport.

## Scope

- Add a `max-height` constraint with `overflow-y: auto` to the journal list container in `JournalPicker.tsx`
- Update the existing `JournalPicker.test.tsx` to verify scroll behavior appears when more than 5 journals exist
- Verify E2E specs still pass (default E2E runs at 800x660, below `lg` breakpoint)

## Non-Goals

- Changing the journal picker layout, styling, or behavior beyond the scroll limit
- Virtualization or lazy loading (5 items is small enough)
- Persisting scroll position across renders
- Changing the "Add Journal" section below the list

## Assumptions

- Each journal item has a roughly consistent height (~60-70px with padding and spacing)
- 5 items × ~70px ≈ 350px, so `max-h-96` (384px) will show ~5 items with partial 6th visible
- The project uses UnoCSS utility classes (Tailwind-compatible), not inline styles
- The `<ul>` element at line ~203 in `JournalPicker.tsx` is the correct target for the constraint
- E2E specs do not interact with the journal picker (it's on auth screens; E2E uses a single journal flow)

## Open Questions

- **Heading scroll behavior**: Resolved — "Your Journals" heading stays fixed above the scrollable list. Apply `max-height`/`overflow-y` to the `<ul>` only, not a wrapper.
- **Max-height approach**: Resolved — Use a fixed CSS utility value (e.g., `max-h-96`). No dynamic calculation.

## Tasks

### Task 1: Add scroll limit to journal list

- Status: TO BE DONE
- Objective: The `<ul>` rendering the journal list must show at most 5 items before scrolling. The "Your Journals" heading stays fixed above the scrollable list.
- Steps:
  1. Open `src/components/auth/JournalPicker.tsx`
  2. Find the `<ul>` element with `class="space-y-2 mb-6"` (inside `<Show when={journals().length > 0}>`)
  3. Add `max-h-96 overflow-y-auto` to the class list, resulting in `class="space-y-2 mb-6 max-h-96 overflow-y-auto"`
  4. Manually verify with `bun run dev`: if `max-h-96` (384px) shows more or fewer than 5 items, adjust to the nearest UnoCSS utility (`max-h-80` = 320px, `max-h-84` if available, or custom value) that shows exactly 5 items
  5. Do NOT wrap the heading and list in a scrollable container — apply the constraint to the `<ul>` only so the heading stays fixed
- Validation:
  1. Run `cmd.exe /c bun run dev` and manually verify: with ≤5 journals, no scrollbar appears; with 6+ journals, scrollbar appears and list scrolls
  2. Run `cmd.exe /c bun run lint` — no new lint violations
  3. Run `cmd.exe /c bun run type-check` — no type errors
- Notes: Use utility classes only, no inline styles. The `<ul>` is the direct parent of `<For each={journals()}>`. Do not wrap in an extra div.

### Task 2: Update JournalPicker tests

- Status: TO BE DONE
- Objective: Tests verify that the scroll container appears when more than 5 journals are rendered.
- Steps:
  1. Open `src/components/auth/JournalPicker.test.tsx`
  2. Add a test case that renders 6+ mock journals and verifies:
     - The `<ul>` element has `overflow-y: auto` (or equivalent style/computed style)
     - The list container has a `max-height` constraint applied
  3. Add a test case that renders ≤5 journals and verifies the scroll behavior is not triggered (or the constraint is present but not active)
- Validation:
  1. Run `cmd.exe /c bun run test:run` — all JournalPicker tests pass
  2. No regressions in existing test cases
- Notes: The test file uses `renderWithI18n()` and mocks `journals()` signal. Extend the mock to return 6+ journal objects for the overflow test.

### Task 3: E2E smoke check

- Status: TO BE DONE
- Objective: Verify existing E2E specs still pass with the scroll constraint in place.
- Steps:
  1. Run `cmd.exe /c bun run test:e2e:local` (or `cmd.exe /c bun run test:e2e` if local driver is not configured)
  2. If E2E fails due to journal list visibility, audit whether the test relies on all journals being visible without scrolling
  3. If needed, update E2E selectors to scroll within the list container before interacting with off-screen items
- Validation:
  1. `cmd.exe /c bun run test:e2e:local` passes all specs
  2. No new E2E failures introduced
- Notes: E2E runs at 800x660 viewport. The journal picker card is centered with `my-auto`. If the scroll container changes the card height, verify the card still fits within the viewport.

### Task 4: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments
  2. Remove only artifacts that are not part of the intended final repository state
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract
  4. Mark TODO-0034 as completed in `docs/todo/TODO.md` (change `[ ]` to `[x]`)
- Validation: Worktree diff contains only intended final changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

## Final Verification

- `cmd.exe /c bun run type-check` — zero errors
- `cmd.exe /c bun run lint` — zero new violations
- `cmd.exe /c bun run test:run` — all tests pass
- `cmd.exe /c bun run test:e2e:local` — E2E specs pass (or `cmd.exe /c bun run test:e2e` if local driver unavailable)
- Manual verification: journal picker with 6+ journals shows scroll, with ≤5 journals shows no scroll

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/` directory).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Any unresolved open questions have been surfaced to the user.
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
