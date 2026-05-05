---
name: manual-planning
description: Create, update, review, and execute manual Markdown implementation plans when harness planning mode is not being used. Use when the user asks for a plan file, manual plan, implementation plan, execution plan, roadmap, task checklist, planning document, or agent-maintained plan with statuses, validations, milestones, approval gates, and cleanup steps.
---

# Manual Planning

Use this skill to produce Markdown plans that another coding agent can execute without reinterpreting the original conversation. Keep plans stable, explicit, and easy to update mechanically.

## Default Location

Create the plan in `docs/` when that directory exists. Otherwise create it at the repository root.

Use a descriptive kebab-case filename such as `docs/payment-refactor-plan.md` or `manual-plan.md`. Avoid temporary names like `notes.md`, `scratch.md`, or `todo.md`.

## Plan Creation Workflow

1. Gather enough repository context to identify scope, dependencies, test surfaces, and likely risks.
2. Draft the plan as a Markdown file using one of:
   - `assets/simple-plan-template.md` for 10 or fewer tasks.
   - `assets/milestoned-plan-template.md` for more than 10 tasks.
3. Set `Plan Status` to `QUESTIONS PENDING` if clarification is required, then surface all clarifying questions to the user. Put the same unresolved questions in the plan under `Open Questions`.
4. Incorporate the answers, then self-check the whole plan before requesting final approval.
5. Set `Plan Status` to `READY FOR APPROVAL` only when the self-check passes and the only remaining gate is user approval.

Do not begin implementation until the user approves the plan, unless the user explicitly asks to proceed without approval.

## Open Question Handling

Open questions are not plan-only notes. When clarification is needed, actively ask the user before marking the plan `READY FOR APPROVAL`.

Use this order:

1. Prefer the native ask-user or request-input tool when the current harness exposes one.
2. If no native ask-user tool is available, send a concise formatted message in the conversation.
3. Mirror the exact unresolved questions in the plan's `Open Questions` section.
4. After the user answers, update `Open Questions` with the resolved answer or replace the section with `None`.

Ask only questions that affect correctness, scope, risk, validation, sequencing, or user approval. Do not ask questions whose answers can be discovered from the repository or safely handled as explicit assumptions.

Fallback message format:

```markdown
I drafted the plan, but need these clarifications before it is ready for approval:

1. [Question]
2. [Question]
```

Do not combine unresolved clarifying questions and final approval in the same user prompt. Ask for final approval only after the questions are answered and the self-check passes.

## Plan State Lifecycle

Treat `Plan Status` in the metadata block as the authoritative plan-level state.

Use this lifecycle unless the user explicitly asks for a different one:

1. `DRAFT` while creating the first version.
2. `QUESTIONS PENDING` while waiting for required clarification.
3. `READY FOR APPROVAL` after clarification is incorporated and self-check passes.
4. `APPROVED` after the user approves execution.
5. `IN PROGRESS` while implementation is underway.
6. `COMPLETED` after cleanup and final verification pass.

Use `BLOCKED` when implementation or planning cannot continue. Record the blocker in `Open Questions`, task notes, or milestone notes as appropriate.

## Plan Format Rules

Every plan must include:

- Title and metadata block.
- Goal, scope, and non-goals.
- Current status.
- Assumptions and open questions.
- Task list, optionally grouped by milestones.
- Validation command/check for every task.
- Cleanup phase after implementation.
- Final verification section.
- Approval gate.

Use exactly these task statuses:

- `TO BE DONE`
- `IN PROGRESS`
- `COMPLETED`
- `BLOCKED`
- `SKIPPED`

Use exactly these plan statuses:

- `DRAFT`
- `QUESTIONS PENDING`
- `READY FOR APPROVAL`
- `APPROVED`
- `IN PROGRESS`
- `COMPLETED`
- `BLOCKED`

If there are more than 10 tasks, group tasks into milestones. Each milestone must have a status and exit criteria. If there are 10 or fewer tasks, omit milestones unless they clarify independent delivery phases.

## Task Rules

Each task must be concrete enough for an agent to execute from the plan alone.

Each task must include:

- `Status`: one of the task statuses.
- `Objective`: the observable outcome.
- `Steps`: one or more concrete implementation steps.
- `Validation`: commands, tests, inspections, or self-checks that prove completion.
- `Notes`: constraints, dependencies, or affected files when known.

Prefer validation that can be run deterministically, such as a unit test, integration test, build command, linter, rendered artifact check, or exact file inspection. If deterministic validation is impossible, state the manual self-check in observable terms.

## Milestone Rules

Each milestone must include:

- `Status`: one of the task statuses.
- `Purpose`: why the group exists.
- `Exit Criteria`: observable conditions that prove the milestone is complete.
- Tasks owned by the milestone.

Milestone exit criteria must be broader than a single task validation. They should confirm that the completed tasks work together and that the next milestone can safely start.

## Implementation Workflow

When executing a manual plan:

1. Set the plan status to `IN PROGRESS` before starting implementation.
2. Before starting a task, update that task to `IN PROGRESS`.
3. Complete the task.
4. Run the task validation.
5. Fix issues until validation passes or mark the task `BLOCKED` with a reason.
6. Immediately update the task status to `COMPLETED` after validation passes.
7. Update the milestone status when all tasks in the milestone satisfy its exit criteria.
8. Start the next task only after the plan file reflects the current state.

The plan file is the execution ledger. Keep it accurate before moving forward.

## Cleanup Phase

Every plan must include a cleanup task near the end. It must remove intermediate artifacts that should not ship, including temporary documentation, one-off test cases, scratch scripts, temporary fixtures, generated data, debug logs, local-only outputs, and obsolete plan fragments.

Do not remove artifacts that the user asked to keep, artifacts required for future maintainability, or generated files that are part of the repository contract.

## Self-Check Before Approval

Before asking for final approval, verify:

- The plan location follows the default location rule.
- The plan status is `READY FOR APPROVAL`.
- Scope, non-goals, and assumptions are explicit.
- All open questions are either answered or clearly marked as unresolved.
- Any unresolved open questions have been surfaced to the user through a native ask-user tool or formatted conversation message.
- Every task has concrete steps and validation.
- More than 10 tasks are grouped into milestones.
- Every milestone has exit criteria when milestones exist.
- Cleanup and final verification are included.
- The plan avoids vague actions like "improve", "handle errors", or "write tests" without concrete targets.
- The plan can be executed by a coding agent without reading the original conversation.

Record the self-check result inside the plan before asking for approval. If any item fails, keep the plan out of `READY FOR APPROVAL`.

## Resources

Copy and adapt one template into the target repository plan file:

- `assets/simple-plan-template.md` for plans with 10 or fewer tasks.
- `assets/milestoned-plan-template.md` for plans with more than 10 tasks.
