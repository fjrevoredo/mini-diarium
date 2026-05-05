# [Plan Title]

## Metadata

- Plan Status: DRAFT
- Created: YYYY-MM-DD
- Last Updated: YYYY-MM-DD
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

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

## Tasks

### Task 1: [Name]

- Status: TO BE DONE
- Objective: [Observable outcome.]
- Steps:
  1. [Concrete step.]
- Validation: [Command, test, inspection, or observable self-check.]
- Notes: [Constraints, dependencies, affected files, or `None`.]

### Task 2: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract.
- Validation: Worktree diff contains only intended final changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

## Final Verification

- [Final command or inspection that validates the whole change.]

## Plan Self-Check

- [ ] Plan location follows the default location rule.
- [ ] Scope, non-goals, assumptions, and open questions are explicit.
- [ ] Any unresolved open questions have been surfaced to the user.
- [ ] Every task has concrete steps and validation.
- [ ] Cleanup and final verification are included.
- [ ] The plan avoids vague actions without concrete targets.
- [ ] The plan can be executed by a coding agent without reading the original conversation.

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
