# [Plan Title]

## Metadata

- Plan Status: DRAFT
- Created: YYYY-MM-DD
- Last Updated: YYYY-MM-DD
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

[State the desired end state in one short paragraph.]

## Scope

- [In-scope item]

## Non-Goals

- [Out-of-scope item]

## Assumptions

- [Assumption]

## Open Questions

- [Question surfaced to the user, or `None`]

## Milestones

### Milestone 1: [Name]

- Status: TO BE DONE
- Purpose: [Why this group exists.]
- Exit Criteria: [Observable conditions proving the milestone is complete.]

#### Task 1.1: [Name]

- Status: TO BE DONE
- Objective: [Observable outcome.]
- Steps:
  1. [Concrete step.]
- Validation: [Command, test, inspection, or observable self-check.]
- Notes: [Constraints, dependencies, affected files, or `None`.]

#### Task 1.2: [Name]

- Status: TO BE DONE
- Objective: [Observable outcome.]
- Steps:
  1. [Concrete step.]
- Validation: [Command, test, inspection, or observable self-check.]
- Notes: [Constraints, dependencies, affected files, or `None`.]

### Milestone N: Cleanup And Final Verification

- Status: TO BE DONE
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified.
- Exit Criteria: Intermediate artifacts are removed, all final verification passes, and the plan status is COMPLETED.

#### Task N.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract.
- Validation: Worktree diff contains only intended final changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

#### Task N.2: Final Verification

- Status: TO BE DONE
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run the final verification commands or inspections listed below.
  2. Fix failures and rerun until verification passes, or record the blocker.
- Validation: [Final command or inspection that validates the whole change.]
- Notes: [Known limitations or `None`.]

## Decision Log

<!-- CONDITIONAL: Include this section only when the user requested a decision log companion file. Delete it otherwise. -->

Pre-implementation decisions are recorded in [`<plan-name>-decisions.md`](<plan-name>-decisions.md).

**During execution:** write a new entry in that file **before moving to the next task** whenever implementation diverges from what this plan specifies. Do not log deviations retrospectively.

A log entry is required when:
- A different file path, rule, function signature, or approach was used than what the plan specified.
- A validation step reveals the plan's approach is incorrect and you adapt.
- A step is skipped for a reason not already covered by the task's BLOCKED handling.

A log entry is **not** required for:
- Execution that matches the plan exactly.
- Trivial wording differences that don't change meaning or outcome.

---

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval.
Fix all failures before proceeding.

- [ ] `cargo clippy` passes with zero warnings
- [ ] `cargo test` passes with zero failures
- [ ] `tsc --noEmit` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] `bun run format` succeeds
- [ ] All new i18n keys added to every locale file (verify with `grep`)
- [ ] Any text-processing function tested with non-ASCII strings (ASCII + RTL + CJK minimum)
- [ ] Plan status updated to COMPLETED

## Plan Self-Check

- [ ] Plan location follows the default location rule.
- [ ] Scope, non-goals, assumptions, and open questions are explicit.
- [ ] Any unresolved open questions have been surfaced to the user.
- [ ] Tasks are grouped into milestones because the plan has more than 10 tasks.
- [ ] Every task has concrete steps and validation.
- [ ] Every milestone has exit criteria.
- [ ] Cleanup and final verification are included.
- [ ] The plan avoids vague actions without concrete targets.
- [ ] The plan can be executed by a coding agent without reading the original conversation.
- [ ] (If dialog/interaction feature) UX-GATE: each scenario listed and user confirmed against actual behavior, not just a description.
- [ ] (If Tauri WebView behavior) PLATFORM-VERIFY step listed in exit criteria for each WebView interaction.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- If implementation diverges from the plan, write a new entry in the decision log file **before starting the next task** (see Decision Log section above for what qualifies).
