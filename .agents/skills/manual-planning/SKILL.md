---
name: manual-planning
description: |
  Create, update, review, and execute manual Markdown implementation plans when harness planning
  mode is not being used. Use when the user asks for a plan file, manual plan, implementation plan,
  execution plan, roadmap, task checklist, planning document, or agent-maintained plan with
  statuses, validations, milestones, approval gates, and cleanup steps. Also use when resuming or
  maintaining an existing plan — marking a task complete, checking plan status, recording a
  decision, or validating a plan file — even when the user does not say "plan file".
  Triggers: plan file, manual plan, implementation plan, execution plan, planning document, plan
  template, resume plan, update the plan, continue the plan, plan status, task checklist, roadmap,
  milestones, exit criteria, approval gate, decision log, cleanup phase, check-plan, new-plan.
metadata:
  version: "2.0.0"
---

# Manual Planning

Produce Markdown plans that another coding agent can execute without reinterpreting the original
conversation. A plan is an execution ledger, not a proposal: it has to stay accurate while it is
being worked through, and it has to be readable cold by a session that was not there when it was
written.

Anything that can be checked mechanically is checked by a script. Do not hand-verify what
`check-plan.py` verifies.

## Scripts

Standard library Python 3 only — no install step. Run with `python3` or `uv run`.

```bash
# Create a plan: correct name, correct directory, version stamped from this SKILL.md
python3 scripts/new-plan.py "<title>" [--milestoned] [--dir docs/plans]
                                      [--exclude-locally | --tracked] [--force]

# Validate a plan (read-only). exit 0 = clean, 1 = errors, 2 = warnings only
python3 scripts/check-plan.py <plan-file> [--json] [--strict] [--dir docs/plans]

# Change one task's status, or read every status back
python3 scripts/plan-status.py <plan-file> set <task-id> "<STATUS>"
python3 scripts/plan-status.py <plan-file> show
```

Each answers `--help`, which lists every check ID and exit code. Quote the status argument: three
of the five task statuses contain a space.

## Default Location

`docs/plans/YYYY-MM-DD-<name>-plan.md`.

The date in the filename is the date of record, which is why the metadata block carries no
`Created` or `Last Updated` field. `new-plan.py` produces both the directory and the filename, so
neither is a rule you have to remember. Avoid names like `notes.md`, `scratch.md` or `todo.md`.

## Plan Tracking

Default to not committing the plan. Follow the repo instead when it already has a convention: if
the plan directory holds tracked plans, this project commits them. Commit the plan when the user
asks.

If the plan stays untracked and its `??` entry interferes — a plan's own cleanup task validates with
`git status --porcelain` — add the plan directory to `.git/info/exclude` rather than `.gitignore`;
`.gitignore` is itself a tracked file, so editing it creates the commit you were avoiding.
`new-plan.py --exclude-locally` does this and stamps `Tracking: untracked (locally excluded)`.

## Plan Creation Workflow

1. Gather enough repository context to identify scope, dependencies, test surfaces, and likely
   risks. Everything you learn here goes in `## Context For A Clean Session` — see
   `references/context-and-evidence.md`.
2. Create the file with `new-plan.py`, choosing `--milestoned` for more than 10 tasks.
3. Fill in the template. Every factual claim carries evidence: a `file:line` reference, a section
   reference (`SKILL_RULES.md §5`), or a re-runnable command.
4. Set `Plan Status` to `QUESTIONS PENDING` if clarification is required, then surface the
   questions to the user. Mirror them in `Open Questions`.
5. Incorporate the answers, run `check-plan.py`, and paste its output into `## Plan Self-Check`.
6. Set `Plan Status` to `READY FOR APPROVAL` only when the checker is clean and the only remaining
   gate is user approval.

Do not begin implementation until the user approves the plan, unless the user explicitly asks to
proceed without approval. When approval is given, replace the `## Approval Gate` boilerplate with
`Approved by <who> on <date>.` — the section is a record, not a standing instruction.

## Open Question Handling

Open questions are not plan-only notes. When clarification is needed, actively ask the user before
marking the plan `READY FOR APPROVAL`.

1. **Use the native question-asking tool** (`question`, `ask-user`, `request-input`, or whatever the
   current harness exposes). Always prefer a structured tool over plain text.
2. If no such tool is available, send a concise formatted message in the conversation.
3. Record both the question and the user's answer in `Open Questions`.
4. After the user answers, replace the entry with the resolved answer, or the section with `None`.

Ask only questions that affect correctness, scope, risk, validation, sequencing, or approval. Do not
ask what the repository can answer or what can safely become a stated assumption.

**All open questions must be answered before the plan can transition to `READY FOR APPROVAL`.**

Do not combine unresolved clarifying questions and final approval in the same user prompt.

## Plan State Lifecycle

`Plan Status` in the metadata block is the authoritative plan-level state. It is modelled once —
there is no separate `Approval` field, because in the surveyed corpus the two contradicted each
other in 11 of 32 plans.

1. `DRAFT` while creating the first version.
2. `QUESTIONS PENDING` while waiting for required clarification.
3. `READY FOR APPROVAL` after clarification is incorporated and the checker is clean.
4. `APPROVED` after the user approves execution.
5. `IN PROGRESS` while implementation is underway.
6. `COMPLETED` after cleanup, `## Pre-flight Checks` and final verification all pass.

Use `BLOCKED` when planning or implementation cannot continue, and record the blocker.

## Plan Format Rules

Every plan has these top-level sections, which is what `check-plan.py` `E009` enforces:

`Metadata`, `Status Legend`, `Context For A Clean Session`, `Goal`, `Scope`, `Non-Goals`,
`Assumptions`, `Open Questions`, `Milestones` (or `Tasks` in a simple plan), `Project Gates`,
`Pre-flight Checks`, `Decision Log`, `Final Verification`, `Approval Gate`, `Plan Self-Check`,
`Execution Notes`.

The metadata block is exactly four fields:

```markdown
- Plan Status: DRAFT
- Plan Format: manual-planning v2.0.0
- Template: milestoned
- Tracking: untracked
```

Use exactly these task statuses: `TO BE DONE`, `IN PROGRESS`, `COMPLETED`, `BLOCKED`, `SKIPPED`.

Use exactly these plan statuses: `DRAFT`, `QUESTIONS PENDING`, `READY FOR APPROVAL`, `APPROVED`,
`IN PROGRESS`, `COMPLETED`, `BLOCKED`.

A status may carry a trailing annotation (`COMPLETED — 381/381 passing`); the vocabulary applies to
the leading token.

More than 10 tasks requires milestones. With 10 or fewer, omit milestones unless they clarify
independent delivery phases.

`## Project Gates` is where project-specific rules live — per-project lint/build/test commands,
manual-verification requirements, changelog or backlog bookkeeping. Put them there rather than
forking this skill for a project.

`## Pre-flight Checks` is a named checklist of the project's actual commands, run before the plan may
reach `COMPLETED`. It is distinct from per-task validation: per-task validation proves one task
worked, pre-flight checks prove the repository is shippable.

## Task Rules

Each task must include:

- `Status`: one of the task statuses.
- `Depends On`: `none`, or a list of task numbers.
- `Objective`: the observable outcome.
- `Steps`: concrete implementation steps.
- `Validation`: commands, tests, inspections, or self-checks that prove completion.
- `Notes`: constraints, affected files, or `None`.

**Task numbering is not an execution order.** `Depends On` is the order. Task 3.1 may be runnable
before Task 2.2.

Prefer deterministic validation — a test, build, linter, or exact file inspection. Where none is
possible, state the manual check in observable terms. Say explicitly when a validation passes by
producing no output: `grep` finding nothing exits 1, and so does `diff` on files that are meant to
differ. An executing agent that branches on `$?` will read those as failures.

## Milestone Rules

Each milestone must include `Status`, `Purpose`, `Exit Criteria`, and its tasks. Exit criteria must
be broader than any single task validation: they confirm the completed tasks work together and that
the next milestone can safely start.

## Implementation Workflow

1. Set the plan status to `IN PROGRESS` before starting implementation.
2. Before starting a task, set it to `IN PROGRESS` — `plan-status.py <plan> set <id> "IN PROGRESS"`.
3. Complete the task.
4. Run the task validation. Before declaring it passed, check the task's `Steps` and `Validation`
   for explicitly named tests (e.g. "add a test `test_foo_bar`"). **A green test suite does not mean
   those tests were written — verify by name.**
5. Fix issues until validation passes, or mark the task `BLOCKED` with a reason.
6. Set the task to `COMPLETED` immediately after validation passes.
7. Update the milestone status when its tasks satisfy its exit criteria.
8. Start the next task only after the plan file reflects the current state.

If validation was intentionally deferred earlier, reconcile the plan text once the deferred checks
actually run. Leave no stale "validation pending" phrasing describing a state the plan has moved past.

**Discovered issues.** If a bug or unplanned problem is identified while working on a task, choose
one path immediately — do not defer via a mental note:

- Fix it in the current task if it is small and in scope.
- Create a new task in the plan with status `BLOCKED` if it is out of scope for the current task.

A bug that is noticed but neither fixed nor recorded will be forgotten. There is no third option.

## Decision Log

`## Decision Log` is always present, in simple and milestoned plans alike. Deviations, discovered
issues and deferred validations are the same shape of event and all land in this one append-only
section.

Write an entry **before moving to the next task**, never retrospectively. Entries written after the
fact are unreliable.

An entry is required when implementation diverges from what the plan specifies (different path,
signature, or approach), when a validation failure forces the plan to adapt, when an unplanned
problem is found, or when a validation is deliberately deferred. No entry is needed when execution
matches the plan, or for wording differences that change no outcome.

```markdown
### DEC-001 — <short title>

- Date: YYYY-MM-DD
- Task: <task number>
- Decision: <what was chosen>
- Rationale: <why>
```

Read `references/decision-log.md` when the inline log passes ~10 entries (`check-plan.py` warns with
`W005`), when the user asks for a companion decisions file, or when you are unsure whether something
qualifies as an entry.

## Cleanup Phase

Every plan must include a cleanup task near the end, removing intermediate artifacts that should not
ship: temporary documentation, one-off test cases, scratch scripts, temporary fixtures, generated
data, debug logs, local-only outputs, and obsolete plan fragments.

Do not remove artifacts the user asked to keep, artifacts required for future maintainability, or
generated files that are part of the repository contract.

**Changelog steps are conditional.** Add one only when the project actually has a changelog file.
`check-plan.py` `E010` looks for `CHANGELOG*` at the repository root and requires a task step
mentioning it only when one exists — a project without a changelog needs no changelog step.

## Plan Retirement

Untracked plans need no retirement step; deleting the file is enough.

Where plans are committed, the project owns the retirement convention, and `check-plan.py` must pass
before a plan is retired: in a tracked repo a misleading final state is permanent.

## Self-Check Before Approval

Run the checker and paste its output into `## Plan Self-Check` with the date:

```bash
python3 scripts/check-plan.py docs/plans/<plan>.md
```

Fix every error before requesting approval. Judge each warning on its merits and say in the plan why
any surviving warning is acceptable.

Do not replace this with a hand-ticked list. The v1 hand-ticked self-check passed in 32 of 32
surveyed plans and failed in none — including on a plan with no `Open Questions` section that still
claimed its open questions were explicit. It was a signature, not a gate.

## Gotchas

- **A deployed skill copy can be older than its repository.** Editing a repo changes nothing about
  what runs if the deployed path is a copy rather than a symlink into it. Check what the path
  actually resolves to (`readlink`, then read the file that comes back) before assuming an edit took
  effect.
- **Task numbering is not an execution order.** That is what `Depends On` is for. Reading the
  numbers as a sequence serialises work that was designed to run in any dependency-respecting order.
- **`.gitignore` versus `.git/info/exclude`.** `.gitignore` is tracked, so excluding an untracked
  plan there produces the very commit the untracked default avoids. Use `.git/info/exclude`.
- **A plan that reaches `COMPLETED` with tasks still `TO BE DONE` is the single most common way a
  plan ends up lying.** Three surveyed plans were closed with every one of their 18–26 tasks still
  `TO BE DONE`. `E005` catches it; `plan-status.py` warns as soon as a write creates it.
- **Statuses are scattered.** A 26-task plan has 27+ status lines. Use `plan-status.py set`, which
  rewrites exactly one line, rather than editing by hand and missing some.
- **A validation that passes by producing no output exits non-zero.** Read what the validation
  asserts rather than branching on `$?`.
- **Greenfield plans cannot cite line numbers in files that do not exist yet.** That is why the
  evidence check only hardens (`E011`) when the plan names files that already exist, and otherwise
  only warns (`W003`).

## References

- `references/context-and-evidence.md` — read before writing `## Context For A Clean Session`, or
  when a plan is being written for a session that will not have the originating conversation.
- `references/decision-log.md` — read when the inline decision log passes ~10 entries, when a
  companion decisions file is requested, or when deciding whether an event qualifies as an entry.

## Resources

`new-plan.py` copies the right one; copy by hand only if the script cannot run.

- `assets/simple-plan-template.md` — 10 or fewer tasks.
- `assets/milestoned-plan-template.md` — more than 10 tasks.
