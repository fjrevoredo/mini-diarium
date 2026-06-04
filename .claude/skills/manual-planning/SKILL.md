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

1. **Use the native question-asking tool** (e.g. `question`, `ask-user`, `request-input`, or equivalent tool exposed by the current harness). This is the primary and preferred method — always prefer a structured tool over plain text.
2. If no native question-asking tool is available, send a concise formatted message in the conversation as a fallback.
3. Record both the question and the user's answer in the plan's `Open Questions` section.
4. After the user answers, update `Open Questions` with the resolved answer or replace the section with `None`.

Ask only questions that affect correctness, scope, risk, validation, sequencing, or user approval. Do not ask questions whose answers can be discovered from the repository or safely handled as explicit assumptions.

**All open questions must be answered before the plan can transition to `READY FOR APPROVAL`. Unanswered questions block approval.**

Fallback message format (only when no tool is available):

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
- Decision Log section with execution protocol (milestoned plans only, and only when a decision log companion file was requested; omit for simple plans and when no companion file was requested).
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
4. Run the task validation. Before declaring the validation passed, check the task's **Steps** and **Validation** sections for any explicitly named tests (e.g. "add a test `test_foo_bar`"). A green test suite does not mean those tests were written — verify by name.
5. Fix issues until validation passes or mark the task `BLOCKED` with a reason.
6. Immediately update the task status to `COMPLETED` after validation passes.
7. Update the milestone status when all tasks in the milestone satisfy its exit criteria.
8. Start the next task only after the plan file reflects the current state.

If validation was intentionally deferred earlier in execution, reconcile the plan text after the deferred checks actually run. Do not leave stale phrases like "validation pending" or self-check statements that describe an earlier plan state once the plan has moved forward.

The plan file is the execution ledger. Keep it accurate before moving forward.

**Discovered issues during implementation:** If a bug or unplanned problem is identified while working on a task, choose one path immediately — do not defer via a mental note:
- Fix it in the current task if it is small and in-scope.
- Create a new task in the plan with status `BLOCKED` if it is out of scope for the current task.

A bug that is noticed but neither fixed nor recorded will be forgotten. There is no third option.

**Decision logs:** If the user requested a decision log file alongside the plan, update it at the point of each deviation — not retrospectively at the end. A decision log entry must be written before moving to the next task whenever the implementation diverges from what the plan specified (different file location, different function signature, different approach). Log entries written after the fact are unreliable.

## Cleanup Phase

Every plan must include a cleanup task near the end. It must remove intermediate artifacts that should not ship, including temporary documentation, one-off test cases, scratch scripts, temporary fixtures, generated data, debug logs, local-only outputs, and obsolete plan fragments.

Do not remove artifacts that the user asked to keep, artifacts required for future maintainability, or generated files that are part of the repository contract.

If the plan originated from a TODO item in `docs/todo/TODO.md`, the cleanup phase must check off that TODO (mark the checkbox as `[x]`).

If the plan delivers a user-facing feature, bug fix, or behavior change, the cleanup phase must create or update a changelog entry (e.g. append to `CHANGELOG.md` or the project's latest-changelog file) summarizing what changed.

## Decision Log Section Rules

Decision logs apply to **milestoned plans only**. Simple plans (10 or fewer tasks) are by definition small enough that deviations can be noted inline in task notes; a companion file adds overhead without benefit.

Include `## Decision Log` in a milestoned plan only when the user also requests a decision log companion file. When included, the section must contain all four of the following — a bare link to the companion file is not enough:

1. **Link** to the companion file by name.
2. **Timing rule**: entries must be written **before moving to the next task**, not retrospectively at the end of the plan.
3. **What qualifies**: a different file path, CSS rule, function signature, or approach than what the plan specified; a validation failure that forces a plan adaptation; a step skipped for a reason not already covered by the task's BLOCKED handling.
4. **What does not qualify**: execution that matches the plan exactly; trivial wording differences that don't change meaning or outcome.

A Decision Log section that only links to the companion file without this protocol gives an executing agent no guidance on when to write entries, so deviations go unrecorded.

Also add a one-line reminder to the plan's `## Execution Notes` that cross-references the Decision Log section, so the protocol is visible at the point of execution:

> If implementation diverges from the plan, write a new entry in the decision log file **before starting the next task** (see Decision Log section for what qualifies).

## Self-Check Before Approval

Before asking for final approval, verify:

- The plan location follows the default location rule.
- The plan status is `READY FOR APPROVAL`.
- Scope, non-goals, and assumptions are explicit.
- All open questions have been asked via the native question-asking tool (or chat fallback if no tool exists), answered by the user, and recorded in the plan
- Zero unanswered questions remain
- If the plan describes a dialog or multi-step user interaction: the plan is tagged `UX-GATE: REQUIRED`, and each interaction scenario is listed with expected user feedback confirmed against actual behavior (mockup, prototype walkthrough, or explicit per-scenario sign-off from the user — not just a description of behavior).
- If the plan includes a Tauri WebView interaction (link clicks, navigation, new-window): an explicit `PLATFORM-VERIFY` manual-verification step is listed in the exit criteria for each such interaction.
- Every task has concrete steps and validation.
- More than 10 tasks are grouped into milestones.
- Every milestone has exit criteria when milestones exist.
- Cleanup and final verification are included.
- The plan avoids vague actions like "improve", "handle errors", or "write tests" without concrete targets.
- The plan can be executed by a coding agent without reading the original conversation.
- If this is a milestoned plan and a decision log was requested: the `## Decision Log` section exists, links to the companion file, states entries must be written before the next task (not retrospectively), and lists qualifying deviations and non-qualifying cases. The `## Execution Notes` section contains a cross-reference bullet pointing back to it. (Simple plans never include a Decision Log section.)

Record the self-check result inside the plan before asking for approval. If any item fails, keep the plan out of `READY FOR APPROVAL`.

## Resources

Copy and adapt one template into the target repository plan file:

- `assets/simple-plan-template.md` for plans with 10 or fewer tasks.
- `assets/milestoned-plan-template.md` for plans with more than 10 tasks.

## Known Platform Traps (Tauri + TipTap)

Before writing or approving a plan step that involves TipTap extensions or Tauri WebView behavior, check these known traps:

| Trap | Risk | Rule |
|------|------|------|
| `target="_blank"` in TipTap Link extension | Triggers WebView new-window handoff, bypasses `openOnClick: false` | Override in `addAttributes()`, not `configure()` |
| `configure({ HTMLAttributes: {...} })` | Deep merge — does not replace defaults | Read `addOptions()` in installed source first (see `FRONTEND_BEST_PRACTICES.md`) |
| `openOnClick: false` vs WebView navigation | Stops JS click handler, not WebView platform routing | Requires `addAttributes()` default override |
| Dialog + `autofocus` input | TipTap collapses selection on focus loss | Use snapshot pattern (see Gotcha #8 in `src/CLAUDE.md`) |

For TipTap extension tasks, include this pre-implementation step in the plan: "Read installed extension source at `node_modules/@tiptap/<extension>/dist/index.js`. Confirm `addOptions()` defaults and `configure()` merge behavior before writing configuration code."
