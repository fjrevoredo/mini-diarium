# [Plan Title]

## Metadata

- Plan Status: DRAFT
- Plan Format: manual-planning v2.0.0
- Template: simple
- Tracking: untracked

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Context For A Clean Session

<!--
This section is what makes the plan executable without the originating conversation.
An agent picking this plan up cold gets everything it needs from here. Restate facts inline
even when they are "obvious" from the conversation that produced the plan — that conversation
is gone by the time the plan is executed.
-->

- Repository: [absolute path], branch `[branch]`, clean at `[commit]`.
- Stack and versions that matter: [language/runtime versions, frameworks, anything pinned].
- Exact commands:
  - Test: `[command]`
  - Lint: `[command]`
  - Build: `[command]`
  - (Write `none` where the project genuinely has no such command — that is itself context.)

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| [e.g. no CI] | [e.g. `.github/workflows` absent] | [`ls .github/workflows`] |

### Hard constraints

<!-- Each entry states the *consequence* of violating it, not just the prohibition. -->

1. [Constraint] — [what breaks if it is violated].

## Goal

[State the desired end state in one short paragraph.]

## Scope

- [In-scope item]

## Non-Goals

- [Out-of-scope item]

## Assumptions

- [Assumption, with the command that verified it where one exists.]

## Open Questions

- [Question surfaced to the user, with the answer once given, or `None`.]

## Tasks

### Task 1: [Name]

- Status: TO BE DONE
- Depends On: none
- Objective: [Observable outcome.]
- Steps:
  1. [Concrete step.]
- Validation: [Command, test, inspection, or observable self-check.]
- Notes: [Constraints, affected files, or `None`.]

### Task 2: [Name]

- Status: TO BE DONE
- Depends On: 1
- Objective: [Observable outcome.]
- Steps:
  1. [Concrete step.]
- Validation: [Command, test, inspection, or observable self-check.]
- Notes: [Constraints, affected files, or `None`.]

<!--
`Depends On` takes `none` or a list of task numbers. Task numbering is **not** an ordering:
Task 3 may be runnable before Task 2. Execute by following `Depends On`, not by counting up.
A plan with more than 10 tasks must use the milestoned template instead.
-->

### Task N-1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Depends On: [tasks producing the artifacts being cleaned up]
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract.
- Validation: Worktree diff contains only intended final changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

### Task N: Final Verification

- Status: TO BE DONE
- Depends On: N-1
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run every item in `## Pre-flight Checks`.
  2. Run the final verification commands or inspections listed under `## Final Verification`.
  3. Fix failures and rerun until verification passes, or record the blocker.
- Validation: [Final command or inspection that validates the whole change.]
- Notes: [Known limitations or `None`.]

## Project Gates

<!--
This is where project-specific rules live, so that no project needs to fork this skill.
Fill it from the repository's own conventions: per-project lint/build/test commands, manual
verification requirements, changelog or backlog bookkeeping, review or sign-off rules.
Write `none` for a category the project genuinely does not have.
-->

- [Gate, as a runnable command or an explicit manual check.]

## Pre-flight Checks

Run before the plan may reach `COMPLETED`. This is a named checklist of this project's actual
commands, distinct from per-task validation: per-task validation proves one task worked, these
prove the repository as a whole is in a shippable state.

- [ ] [`command`]
- [ ] [`command`]

## Decision Log

Write an entry **before moving to the next task**, never retrospectively.
An entry is required when implementation diverges from what this plan specifies (different path,
signature, or approach), when a validation failure forces the plan to adapt, when an unplanned
problem is found, or when a validation is deliberately deferred.
No entry is needed when execution matches the plan.

<!--
This section is present in small plans too. The trigger for needing it is deviation volume, which
is unknowable when the plan is written, and four lines per entry does not bloat a small plan.
Once it passes ~10 entries, move it to a companion `YYYY-MM-DD-<name>-decisions.md` and leave a
pointer here. `check-plan.py` warns (`W005`) at that threshold.
-->

### DEC-001 — <short title>

- Date: YYYY-MM-DD
- Task: <task number>
- Decision: <what was chosen>
- Rationale: <why>

## Final Verification

[The end-to-end check that the whole change works, or a pointer to the task that performs it.]

## Approval Gate

Implementation must not start until the user approves this plan.

<!--
Once approval is given, replace the sentence above with the record:
`Approved by <who> on <date>.`
Leaving the boilerplate in place after approval trips `W002`.
-->

## Plan Self-Check

Paste the output of `check-plan.py` here, with the date it was run:

```
$ python3 scripts/check-plan.py <this-file>
[output]
```

Run: YYYY-MM-DD

## Execution Notes

- Update task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
- Task numbering is not an execution order. Follow `Depends On`.
- Write a `## Decision Log` entry **before starting the next task** whenever execution diverges from
  this plan, an unplanned problem is found, or a validation is deferred — never retrospectively.
