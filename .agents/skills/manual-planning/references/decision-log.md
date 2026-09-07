# Decision Log

The convention specified once, so it stops being reinvented.

## Why this file exists

Across the 34-plan corpus that produced v2, the decision log was invented independently **six
times**, under **three different filename patterns**:

| Pattern | Count | Example |
| --- | --- | --- |
| `<plan>-plan-decision-log.md` | 4 | `custom-fonts-plan-decision-log.md` |
| `<plan>-decision-log.md` | 1 | `todo-0046-decision-log.md` |
| `<plan>-decisions.md` | 1 | `plan-website-docs-improvements-decisions.md` |

They also used **two incompatible entry formats**: flat `Date` / `Task` / `Decision` / `Rationale`
bullets in one group, and `### DEC-XXX` headings with extra `Options considered` and `Impact` fields
in the other. Nothing was shared between them, so every plan that needed a decision log paid the
design cost again.

v2 removes the choice: the log is a section that ships in both templates, in one format.

## The format

`## Decision Log` is a top-level section of the plan itself, present in simple and milestoned plans
alike. It is append-only.

```markdown
### DEC-001 — <short title>

- Date: YYYY-MM-DD
- Task: <task number>
- Decision: <what was chosen>
- Rationale: <why>
```

Number entries `DEC-001`, `DEC-002`, … in the order they are written. Do not renumber; the ids are
referenced from task notes.

## Timing

Write an entry **before moving to the next task**, never retrospectively.

This is the whole rule. Entries written at the end of a plan are reconstructions: the alternatives
that were live at the time are gone, and what survives is a justification of what happened rather
than a record of a decision. The corpus shows the failure directly — logs written in a batch at the
end record *what* changed but almost never *what else was considered*.

## What qualifies

An entry is required when:

- **Implementation diverges from the plan** — a different file path, function signature, CSS rule,
  or approach than what the plan specified.
- **A validation failure forces the plan to adapt** — the plan said one thing, the command said
  another, and the plan changed.
- **An unplanned problem is found.** This is the discovered-issues rule's paper trail: a bug that is
  neither fixed in-task nor recorded as a `BLOCKED` task will be forgotten.
- **A validation is deliberately deferred** — the task was marked `COMPLETED` before its command
  actually ran.

No entry is needed when:

- Execution matches the plan.
- The difference is wording that changes no meaning or outcome.

## One section, three kinds of event

Deviations, discovered issues and deferred validations are the same shape of event: something
happened during execution that the plan did not say would happen, and a later reader needs to know.
Giving each its own mechanism produces three places to forget to write in.

They all land here, in one append-only section, because **appends are what agents do reliably**. The
corpus is unambiguous on this: agents skip mutations scattered across a file — 29 of 32 plans never
updated `Last Updated`, and three closed with every task still `TO BE DONE` — while single-location
additions get made.

## The strongest piece of evidence for all of this

The first entry of `v0.5.3-review-remediation-plan-decision-log.md`:

> - Date: `2026-06-04`
>   Task: plan execution policy
>   Decision: Mark tasks `COMPLETED` once implementation and explicitly named test updates are in
>   place, while deferring command-based validation until the later verification window.
>   Rationale: The plan already carries forward a standing instruction to defer validation commands
>   during implementation, but the user still asked for live task-state updates during full
>   implementation.

An executing agent formally granting itself an exception to the skill's own "validate before marking
`COMPLETED`" rule — and doing it in the right place, in writing, at the moment it happened. Batched
validation is real. It needs a sanctioned place to be recorded, or it happens silently instead.

## Promotion to a companion file

Once the inline section passes **~10 entries**, move it to
`docs/plans/YYYY-MM-DD-<name>-decisions.md` and leave a pointer in its place:

```markdown
## Decision Log

Entries live in `docs/plans/2026-09-02-payment-refactor-decisions.md` (12 entries).
The timing rule is unchanged: write an entry before moving to the next task.
```

`check-plan.py` emits `W005` at that threshold. It is a warning, not an error — a plan with 12
inline entries is not broken, it is just getting hard to read around.

Use the same entry format in the companion file. Do not invent a richer one there; the reason this
file exists is that six plans each invented their own.
