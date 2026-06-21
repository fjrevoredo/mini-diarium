---
name: implementation-review
description: |
  Review a completed implementation against its plan, decision log, code changes, tests, docs, and project best practices.
  Use when asked to assess whether an implemented TODO, roadmap item, PR, feature, refactor, or agent output is up to spec,
  maintainable, simple, high quality, and ready to merge. Produces a markdown report with assessment and actionable fixes.
---

# Implementation Review

Use this skill to perform a structured implementation review. Do not implement fixes during the review unless the user explicitly asks for that next.

The workflow is tool-agnostic: use the file, Git, test, browser, and repository-inspection capabilities available in the current agent environment. Prefer the command conventions documented by the repo over any harness-specific defaults.

## Workflow

1. Establish the review target.
   - Read the user's referenced plan, decision log, TODO, issue, or PR.
   - Read the implementation diff or changed files. Prefer `git show --stat`, `git show --name-only`, then targeted file reads when Git is available.
   - Record the branch, commit, and report path in the review artifact when available.

2. Build the standard of judgment.
   - Read the repo/domain guidance that applies to the touched files, such as root `CLAUDE.md`, nested `CLAUDE.md` files, and `docs/best-practices/`.
   - If the implementation deviates from the plan, check whether the decision log explains it and whether the explanation is technically sound.
   - Treat the plan as intent, not as blind truth. Source code and current project state can invalidate plan assumptions.

3. Review by risk area.
   - Correctness: behavior matches the plan, edge cases are handled, migrations are linear, old data remains compatible.
   - Security and privacy: backend enforces invariants, plaintext does not touch disk, raw backend details are not exposed to UI.
   - Data integrity: writes are atomic, rollback paths are clear, references cannot become stale, delete paths clean up safely.
   - Frontend behavior: Solid reactivity is tracked correctly, async race guards exist, user-facing errors are sanitized, accessibility basics are present.
   - Maintainability: modules stay cohesive, duplicated sensitive logic is centralized, new abstractions remove real complexity.
   - Tests and docs: tests cover the new contract, not only the helper internals; user-facing docs and generated docs are updated when behavior changes.

4. Validate selectively.
   - Run targeted tests for the changed area first.
   - Run broader checks when feasible: backend tests, frontend tests, type-check, lint, locale validation, UI error check, format check, build.
   - Use the repo's documented command routing. In Mini Diarium, root `CLAUDE.md`/`AGENTS.md` normally requires Windows commands such as `cmd.exe /c bun run type-check`.
   - Report exact commands and outcomes. Distinguish pre-existing warnings from regressions introduced by the implementation.

5. Write a markdown report.
   - Put the report in the location requested by the user; otherwise use a nearby docs path such as `docs/<todo-or-feature>-implementation-review.md`.
   - Include two main parts:
     - Assessment: concise verdict on spec fit, code quality, maintainability, and validation results.
     - Actionable fixes: meaningful issues only, ordered by severity and impact.
   - For each fix, include file paths and line references where practical, explain the impact, and give concrete repair guidance or snippets.
   - Avoid vanity suggestions. Do not require refactors that only satisfy style preferences unless a project best-practice check fails.

## Finding Quality Bar

Prefer findings that meet at least one of these criteria:

- A user-visible behavior is wrong or likely to break.
- Data can be lost, orphaned, exposed, or made incompatible.
- A security or privacy invariant is trusted to the frontend instead of enforced in Rust.
- A migration, rollback, or compatibility path is under-tested.
- A project-required validation check fails.
- The code creates avoidable future maintenance risk in a touched, high-traffic area.

Deprioritize:

- Naming tweaks that do not affect clarity.
- Splits based only on line count when responsibility is still cohesive.
- Style changes that formatter/linter would not enforce.
- Alternative designs that are merely different, not materially safer or simpler.

## Report Template

````markdown
# <Feature/TODO> Implementation Review

Date:
Branch:
Reviewed commit:

## Part 1: Assessment

<Spec fit, quality, maintainability, and validation summary.>

## Part 2: Actionable Fixes

### 1. <Imperative issue title>

Severity:

<Impact and evidence with file references.>

Suggested fix:

```language
<short snippet when useful>
```

Tests to add:

- <specific regression test>

## Review Verdict

<Merge-ready / not merge-ready and why.>
````
