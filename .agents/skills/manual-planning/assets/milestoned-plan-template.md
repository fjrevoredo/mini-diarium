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

## Approval Gate

Implementation must not start until the user approves this plan.

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

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
