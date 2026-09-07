# Context And Evidence

How to write the two sections that most improved plan quality in the surveyed corpus, and that
almost no plan had.

## Why these two

Of 34 surveyed plans, **26 contained zero `file:line` citations** and only **3 contained 20 or
more** (`agent-chat-review-remediation-plan.md`, `TODO-0043-named-links-plan.md`, and the
non-skill-generated `mr13-comments-and-fix-plan.md`). Evidence discipline was an outlier, not a
norm.

The plans that had it were noticeably better to execute — and their strongest sections
(`Hard constraints`, `Verified constraints the fix must preserve`) were **invented by the executing
agent**, not required by v1. v2 requires them so they stop depending on whoever happens to be
writing.

## `## Context For A Clean Session`

The test: **an agent that has never seen the originating conversation can execute this plan.** That
conversation is gone by the time the plan runs. Anything load-bearing that lives only there is lost.

Write:

1. **Repository and branch.** Absolute path, branch name, and the commit it was clean at.
2. **Stack and versions that matter.** Language runtimes, frameworks, anything pinned — and where
   the pin lives (`.sdkmanrc`, `.nvmrc`, `pyproject.toml`), because the ambient version usually
   differs from the project's.
3. **Exact commands** for test, lint and build. Copy-pasteable, not described. Write `none` where
   the project genuinely has no such command — that absence is itself context, and it tells the
   executing agent that "validation" means running something by hand.
4. **A repository-facts table**, with how each fact was verified:

   | Fact | Value | How it was verified |
   | --- | --- | --- |
   | No CI | `.github/workflows` absent | `ls .github/workflows` |
   | Python | 3.11.11 | `python3 --version` |

5. **Hard constraints, numbered, each stating its consequence.** Not "do not modify X" but "do not
   modify X — it is the only copy of the running configuration". A prohibition without a consequence
   gets weighed against convenience and loses.

The corpus lesson is specific: plans that named files, versions and commands inline were executable
months later; plans that said "the usual test command" were not.

## The evidence rule

**Every factual claim in a plan carries evidence**: a `file:line` reference, a section reference, or
a re-runnable command.

Three forms count, because line numbers are unstable in prose files:

| Form | Example | Use for |
| --- | --- | --- |
| `file:line` | `agent-chat.component.ts:139` | code |
| section reference | `SKILL_RULES.md §5`, `AGENTS.md § Testing` | prose, standards, docs |
| re-runnable command | a fenced `grep -rn "legacy_flag" src/` whose output substantiates the claim | facts about the tree |

### Before / after

Before — three assertions, none checkable:

```markdown
- Objective: The chat component leaks a subscription and should be cleaned up.
- Steps:
  1. Fix the leak in the chat component.
  2. The team convention is to use takeUntilDestroyed, so use that.
```

After — same three assertions, each traceable:

```markdown
- Objective: `agent-chat.component.ts:139` subscribes to `messages$` in `ngOnInit` with no
  teardown; the component is recreated per conversation, so each switch leaks one subscription.
- Steps:
  1. Replace the manual subscribe at `agent-chat.component.ts:139` with `takeUntilDestroyed`,
     matching `conversation-list.component.ts:64`.
  2. Convention confirmed — `CONTRIBUTING.md § RxJS teardown` requires it, and it is already used
     in 11 components:
     ```bash
     grep -rln "takeUntilDestroyed" src/app | wc -l
     ```
```

The second version survives its author. The first requires the reader to redo the investigation, and
in practice they redo it differently.

`agent-chat-review-remediation-plan.md` is the worked example to imitate: 28 `file:line` citations
across 12 tasks, every claim about existing behaviour anchored to the line it came from.

## How this interacts with `E011` and `W003`

The check **warns by default and errors only when the plan edits files that already exist**.

- `E011` (**error**) — the plan names at least one file that exists on disk and carries no evidence
  in any of the three forms. Changing code that is already there without citing it is the case worth
  blocking on.
- `W003` (**warning**) — no evidence in any form, in a plan of more than 5 tasks that does not trip
  `E011`.

Greenfield plans are not expected to cite line numbers in files that do not exist yet, which is why
the check only hardens once the plan touches something real. That is a deliberate asymmetry, not a
gap: a plan for a new module legitimately has nothing to point at, while a plan that rewrites
`auth_core.rs` and cites nothing has skipped the investigation.

A plan can also carry evidence in the third form alone. A fenced `git ls-files docs/plans/*.md`
whose output justifies "this project commits its plans" is evidence; `npm test` is not — a build or
test command proves the change works, it does not substantiate a claim about the code.
