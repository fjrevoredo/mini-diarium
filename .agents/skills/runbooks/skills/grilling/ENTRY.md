---
name: grilling
description: |
  Interview the user relentlessly until reaching genuine shared understanding on a design or
  decision, modeled as a design tree worked in rounds against its frontier. Use only when
  explicitly invoked as `runbooks grilling` — never self-trigger, never infer this is wanted
  from an ordinary feature request. Ends only when the frontier is empty and the user
  explicitly confirms understanding; never implements anything itself. May optionally end by
  writing a Mini Diarium ADR to `docs/decisions/` if the discussion crossed a real decision
  worth recording. Never creates a CONTEXT.md or glossary file.
---

# Grilling

## Overview

This is an interview mechanic, not an implementation skill. Its only output is: (a) a set of
settled decisions the user has explicitly confirmed, and optionally (b) one ADR file in
`docs/decisions/` plus a one-line append to root `CLAUDE.md`. It never writes application code,
never edits unrelated files, and never proceeds to implementation on its own authority — a
human still has to say "go implement this" afterward, as a separate act.

**Invoke this deliberately and rarely.** It is reached only via `runbooks grilling` (per the
`runbooks` dispatcher's routing rules) and must never be guessed into an ordinary task just
because a request seems underspecified — asking one or two clarifying questions inline is
normal agent behavior and does not warrant loading this runbook.

## Stateless by default

Each invocation starts with an empty design tree. This runbook keeps no cross-session memory,
scratch file, or hidden state — the entire tree lives in the visible conversation as a sequence
of numbered questions and their answers. If a session is interrupted, resuming means re-reading
the conversation, not consulting a saved artifact. (The only file this skill ever produces is
the optional ADR in the last section, and that is a deliberate, visible, one-time write — not
a state store.)

## Mechanics: the design tree, rounds, and the frontier

Model the subject as a **design tree**: every decision branches into further decisions that
hang off it. A decision about "what does X mean" branches into "how does X get created", which
branches into "who is allowed to create X", and so on. The tree grows as answers arrive — it is
not planned upfront.

Work the tree in **rounds**. The **frontier** of a round is every decision whose prerequisites
are already settled — i.e., every question that is answerable right now without guessing an
unheard answer to something else. A question that depends on another question still open in
the *same* round does not belong in that round; it waits for a *later* round, once its
prerequisite is settled.

**Ask the whole frontier in one round**, not one question at a time. Number each question and
recommend an answer. Use exactly this format, as plain chat text — never route this through a
structured/multi-choice question tool, because rounds have a variable number of questions and
recommendations are free-form, often multi-paragraph, prose that does not fit a fixed-option
widget:

```
❓ **Q1** - **<question title>**: <question body, possibly multi-paragraph, may include
multiple choices>

➡️ <recommended answer>

---

❓ **Q2** - **<question title>**: ...

➡️ <recommended answer>
```

Each round's answers reshape the tree: settled decisions may unblock brand-new frontier
questions that did not exist before (because their prerequisite decision didn't exist before).
Run another round against the new frontier. Repeat.

**No fixed cap** on the number of questions or rounds. If a single grilling session is running
very long, the correct fix is telling the user the subject should be split into smaller,
separately-grilled pieces — not truncating the interview or batching remaining questions
carelessly to wrap up early.

## Fact-finding vs. decisions

Before adding something to the frontier, ask: *can the filesystem or a tool answer this?* If
yes, it is fact-finding, not a decision — dispatch it to a sub-agent (e.g. via the Task/Agent
tool) to go read the code, docs, or run a read-only command, and fold the result back into the
tree as settled context. Never ask the user something a sub-agent could look up.

Only genuine, unresolved **decisions** — things no amount of repo-reading would answer, because
they require a judgment call or a preference — go to the user as frontier questions.

If a frontier question is blocked on a fact-finding task that is still running, hold only that
question back. Ask the rest of that round's frontier immediately; do not stall the whole round
waiting on one in-flight lookup.

## Ending the session

The session ends only when **both** are true:

1. The frontier is empty (every reachable decision has been asked and answered), and
2. The user explicitly confirms shared understanding — an actual "yes, that's right" /
   "confirmed" statement, not silence, not an assumption, not the mere absence of further
   questions.

**Never implement, edit, or act on the discussion before that confirmation.** This runbook's
only job is to reach shared understanding; execution is deliberately a separate, later act
authorized by the user.

## Recording a decision (adapted for Mini Diarium)

Not every grilling session warrants a written record. Before offering to write one, apply
this three-gate test — the record is worth writing only if **all three** hold, and is skipped
if **any** gate fails:

1. The decision is hard to reverse.
2. The decision would be surprising to someone reading the code later, without this context.
3. The decision is the result of a real trade-off (not just "the obvious choice").

If a session reaches shared understanding but fails this test, say so plainly and stop —
sharpened understanding can live in the conversation alone.

If all three gates pass, propose writing an ADR and confirm the user wants one before creating
any file. If they agree, follow Mini Diarium's own decision-record convention exactly —
**do not** use a sequential-numbered filename or YAML frontmatter (that is a different
project's convention, not this repo's):

**Filename:** `docs/decisions/YYYY-MM-kebab-case-slug.md` — year and month of today, not a
sequential number. Example: `docs/decisions/2026-09-grilling-runbook-scope.md`.

**Template** (omit any body section that wouldn't add value — a short ADR is fine; sections
exist because they earn their place, not because the template lists them):

```markdown
# ADR: <Title>

**Status:** <Proposed|Accepted|...>
**Date:** YYYY-MM-DD
**Related:** <cross-references: files, other ADRs, issues>

## Context

<Why this decision needed to be made.>

## Options considered

<Each option and why it was accepted/rejected/deferred.>

## Decision

<What was decided, and the concrete shape of it.>

## Consequences

<What this buys, what this costs.>

## Future reversibility

<If relevant: what changing this later would require.>

## References

<Optional: pointers to source files, related ADRs, external threads.>
```

**After creating the file**, append exactly one new bullet to the existing
`### Architecture decision records` list in root `CLAUDE.md` (under `## Security Rules`),
matching the format of the bullets already there:

```markdown
- [`docs/decisions/<file>`](docs/decisions/<file>) — <one-sentence summary of what/why, comma-separated clauses>.
```

This must be genuinely **one sentence** — root `CLAUDE.md` is close to the ~200-line point where
best-practice guidance says adherence starts to degrade, so the bullet earns its place by being
terse, not by restating the ADR.

## Never create CONTEXT.md or any glossary file

Do not create `CONTEXT.md`, `CONTEXT-MAP.md`, or any similar glossary/domain-language file, even
if the interview sharpens terminology or produces a shared vocabulary. Mini Diarium already has
a governed, distributed place for durable domain documentation: per-directory `CLAUDE.md` files,
under the rules in `docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md`. A parallel glossary
file would create two competing places to look up a term, and this runbook must not introduce
that.

If a term genuinely needs a durable, sharpened definition:

- **Default:** it stays in the conversation only — the grilling session itself is the record.
- **If truly durable and broadly useful:** suggest it as a normal edit to the relevant existing
  `CLAUDE.md` file, through the same governed process any other CLAUDE.md change would go
  through (see `CONTEXT_FILES_BEST_PRACTICES.md` — does this explain WHY, not just WHAT, and
  would it mislead an agent if it were three months stale?). Never as a new file type.

## Optional follow-up: evals

This entry does not ship an `evals/` folder. If eval coverage for grilling-quality (e.g.
frontier-detection accuracy, round-batching correctness) is wanted later, it can be added as a
separate follow-up under `skills/grilling/evals/evals.json`, matching the existing example at
`skills/pre-release/evals/evals.json` — not a requirement of this change.
