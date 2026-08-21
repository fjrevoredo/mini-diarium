# Project Support Overlay implementation self-check

**Review date:** 2026-08-21  
**Scope:** The complete staged Project Support overlay implementation, reviewed against
[`docs/archive/project-support-overlay-plan.md`](../archive/project-support-overlay-plan.md), the repository
contracts, and the current working tree. This is a review report; no implementation files were
changed.

## Verdict

**Not ready to commit as-is.** The implementation substantially delivers the planned feature and
its automated frontend gates are green, but two P1 findings must be resolved before release:

1. An in-flight milestone lookup can be attributed to a different journal after a lock/switch.
2. The implementation is staged, but the plan it claims to implement is untracked. A commit made
   from the current index would leave several committed links pointing to a missing document.

## Findings

### P1 — Async milestone result can be dismissed for the wrong journal

**Evidence:** [`src/state/support-milestone.ts`](../../src/state/support-milestone.ts) captures
`activeJournalId()` before `await getStatistics()` (lines 34–38), but unconditionally writes the
result to the global `pendingRung` signal after the await. `dismissSupportMilestone()` then uses
the *current* active journal ID (lines 48–54). The unlock effect deliberately starts the lookup
without awaiting or cancelling it ([`src/App.tsx`](../../src/App.tsx), lines 70–76).

**Failure path:** Journal A begins `checkSupportMilestone()`. Before its statistics promise
settles, the user locks or switches journals; `resetSessionState()` clears the signal as intended.
After Journal B is unlocked, the late A promise can still set `pendingRung`. The Header then shows
A's Heart icon in B, and closing its milestone overlay writes A's rung to
`support-milestone-shown-B`. This is the same cross-journal attribution defect the plan's
post-implementation notes sought to prevent, reached through an async completion rather than a
stale pre-lock signal.

**Action:** Make the lookup session/journal-safe: after `await getStatistics()`, confirm that the
captured journal ID is still active and the request is still current before setting the signal.
Use a monotonically increasing request/session token that `resetSupportMilestoneState()` invalidates
so an A → B → A sequence is also safe. Add a deferred-promise test covering lock/switch/reset,
late completion, and dismissal.

### P1 — The authoritative plan is not staged

**Evidence:** `git status --short` reports the root-level implementation plan as untracked, while
the staged TODO, exploration document, ADR, and CHANGELOG all link to it. The plan is also marked
`COMPLETED` at line 5.

**Impact:** The stated implementation contract would be absent from the commit, producing broken
repository links and losing the acceptance criteria, UX-gate record, and decision rationale that
the staged documentation relies on.

**Action:** Include the implementation plan in the same scoped commit after the P1 code fix. Keep
the two unrelated untracked archive plans out of this feature commit unless they have a separate,
explicit purpose.

### P2 — A statistics failure becomes an unhandled fire-and-forget rejection

**Evidence:** `App.tsx` invokes `void checkSupportMilestone()` (line 76), while
`checkSupportMilestone()` directly awaits `getStatistics()` without error handling
([`support-milestone.ts`](../../src/state/support-milestone.ts), line 38). In contrast, the overlay
catches its optional statistics lookup and degrades to zero values.

**Impact:** A transient IPC failure during unlock can create an unhandled promise rejection for a
non-essential support prompt. That conflicts with the plan's non-interrupting objective and the
repository's defensive frontend error-handling convention.

**Action:** Catch the failure inside `checkSupportMilestone()` (clear/retain no pending rung and
return), or attach an explicit error handler at the caller. Add a test that rejects
`getStatistics()` and asserts no rejection escapes and no icon is displayed.

### P2 — The recorded coverage command did not validate the staged patch

**Evidence:** Task 5.4 and the completed pre-flight checklist specify `bun run coverage:diff`
([plan](../archive/project-support-overlay-plan.md), lines 762–776). Run without arguments, that command
compares the merge base to `HEAD`; because this work is staged but uncommitted it reported
“no instrumented changes.” It was not evidence for this patch's coverage.

**Current verification:** Running the correct staged-working-tree form,
`bun run coverage:diff -- --working-tree`, passed at **128/135 (94.8%)**.

**Action:** Correct Task 5.4 and its recorded result to use `coverage:diff -- --working-tree` for
pre-commit review (or `coverage:check -- --working-tree` when lcov needs regeneration). This keeps
the executable plan accurate and prevents a future false-green check.

## What is correctly implemented

- The planned two entry points, six ordered actions, i18n keys, global checklist persistence,
  milestone gating, session reset hook, overlay keyboard guard, and About-to-overlay transition
  match the plan.
- The external-link focus-loss suppression is implemented through the shared dialog guard, and
  the focus-loss retry behavior is covered by targeted tests. The documentation updates required
  by the plan are present in the ADR, TODO, CHANGELOG, `src/CLAUDE.md`, and security-stance skill.
- No network capability or app-side HTTP request was introduced; link actions delegate URLs to the
  OS opener, which is consistent with the project's local-only security stance.

## Verification performed

| Check | Result |
| --- | --- |
| Targeted support/dialog/focus-lock tests | Pass — 5 files, 48 tests |
| Full frontend suite | Pass — 103 files, 1,062 tests |
| Type check | Pass |
| Lint | Pass |
| Prettier check | Pass |
| Production build | Pass (pre-existing large-chunk warning only) |
| Diagram check | Pass |
| `git diff --cached --check` | Pass |
| Working-tree patch coverage | Pass — 94.8% |
| Locale validation | Reports the planned 22 new English keys as missing in each community locale and exits 1; the plan explicitly treats this as expected and non-blocking. |

## Review self-check

I rechecked each finding against the current staged source and `git status` after running the
validation commands. The P1 async issue is a concrete state-transition race, not a claim about a
failed test; current tests cover only a settled lookup in one journal. The coverage finding is
limited to the plan's recorded command and does not negate the subsequently verified 94.8% result.
No implementation changes were made during this review.

## Follow-up

**Follow-up date:** 2026-08-21

The P1 staging finding was accurate at review time: the implementation plan was untracked while
repository documentation linked to it. After this review, commit `41e7297` moved the plan into the
tracked archive at [`docs/archive/project-support-overlay-plan.md`](../archive/project-support-overlay-plan.md).
This note preserves the review chronology and does not rewrite the original finding as if it had
been false. It records document history only and does not claim additional manual or E2E validation.
