---
name: skill-improver
description: |
  Captures lessons from completed tasks and turns them into concrete improvements.
  Triggers proactively after high-ceremony tasks (build failures, multi-hour sessions,
  production incidents) and on-demand when the user asks for "post-mortem", "reflect",
  "improve the skill", "lessons learned", "what went wrong". Covers skills, repo
  artifacts (scripts, CI, configs), and process changes. For small/obvious fixes,
  edits directly. For structural changes, produces a plan using the manual-planning format.
  Use this whenever a task surfaced gaps in tooling, documentation, or automation.
compatibility: Designed for Claude Code. Requires the manual-planning and todo-manager skills for plan creation.
---

# Skill Improver

Turn every hard-earned lesson into a reusable improvement. After completing a non-trivial task
(especially one that hit friction), run this skill to catalog what happened, classify the gaps,
and apply fixes — either directly for obvious issues, or via a structured plan for larger changes.

## When to Run

**Proactive (run without being asked):**
- A build, deploy, or CI job failed and was debugged
- A task took more than 3 rounds of trial-and-error
- A session lasted more than one hour and involved multiple skill uses
- The user explicitly expressed frustration or surprise at a gap

**On-demand (run when the user says):**
- "Reflect on this session" / "post-mortem" / "what went wrong"
- "Improve the skill" / "update the skill with these learnings"
- "Lessons learned" / "what should we change"

**Scope:** Reflect on ALL skills used during the session, plus any repo artifacts
and process steps involved. If multiple skills were loaded, review each one.
If the session didn't use any skill, focus on repo/process improvements only.

## Workflow

### Step 1 — Reflect

Catalog observations in three buckets, with concrete examples:

**What went well:**
- Patterns, tools, or decisions that saved time or prevented errors
- Skill instructions that proved particularly useful
- Diagnoses or fixes that were reached quickly

**What went wrong:**
- Mistakes, dead ends, or incorrect assumptions
- Skill instructions that were missing, wrong, or misleading
- Manual workarounds that had to be invented on the fly

**What was missing:**
- Scripts, checks, or tooling that would have caught the issue earlier
- Documentation or guardrails that didn't exist
- Process steps that were skipped or not automated

### Step 2 — Classify

Group findings into three categories. For each finding, identify the concrete artifact
that needs to change (file path, skill section, CI workflow, etc.).

**Skill changes** — improvements to an existing skill:
- Missing failure entries in a diagnosis table
- Wrong fix instructions
- Undocumented pitfalls or edge cases
- Better log access or debugging workflows

**Repo artifact changes** — new or modified files in the repository:
- Utility scripts (e.g., `check-node-sources.mjs`)
- CI workflow steps or pre-release checks
- Configuration or lockfile validation

**Process changes** — workflow or convention changes:
- Release checklist items
- Pre-commit or pre-tag validation steps
- Cross-skill integration (e.g., pre-release skill should validate lockfiles)

### Step 3 — Apply

**If no improvements are identified:** state that explicitly and stop. Do not invent changes.

**The user can always override the plan/execute decision.** If the user says "just fix it directly" for something that would normally need a plan, apply the changes directly instead. If the user says "make a plan" for something small, create one.

**For obvious fixes (typos, missing warnings, incomplete instructions):**
Apply directly to the target file using the Edit tool. These are changes where:
- The fix is a single addition or correction to an existing section
- There's no design decision to make
- The change can't break anything else
- Example: adding a missing failure entry to a diagnosis table, or a warning about a known pitfall

**For structural changes (new sections, new scripts, reorganized workflows):**
Create a plan using the manual-planning skill's format. These are changes where:
- The fix requires creating a new file or reorganizing existing content
- Multiple files are affected
- The user should review the approach before implementation
- Example: adding a new utility script, restructuring a skill's diagnosis workflow, adding pre-release steps

### Step 4 — Verify

After applying fixes (directly or via plan execution):
1. Run format/lint commands if the changed files are in checked languages
2. For scripts, run a syntax check and a quick smoke test
3. Re-read the changed skill sections to ensure they don't contradict other parts of the skill or adjacent skills
4. Summarize what was changed and why

## Output Format

At the end, present using this template:

```
## Session Reflection

### What Went Well
- [item]

### What Went Wrong
- [item]

### What Was Missing
- [item]

## Changes Made

| File | Change |
|------|--------|
| path/to/file | what changed and why |

<!-- If no changes were made: -->
No improvements identified.
```

If a plan was created, add: `**Plan:** docs/plan-name.md — awaiting approval.`

## Gotchas

- **Don't over-improve.** If the session went smoothly and no concrete gaps were found, say so and stop. Inventing minor tweaks dilutes the skill.
- **One session, one reflection.** Don't chain multiple reflection cycles. If the user wants another, they'll ask.
- **Obvious fix ≠ trivial preference.** "I'd word this differently" is a preference, not a fix. Only apply direct edits when the current text is objectively wrong or missing.
- **Respect the user's override.** If the user says "just fix it" for something structural, apply directly. If they say "make a plan" for something small, create one. Their call always wins.

## Integration with Other Skills

- Use **manual-planning** for any change that needs a plan (structural changes)
- Use **todo-manager** if the reflection surfaces new TODO items for the backlog
- The output format mirrors what you'd see in a good commit message: what, why, and where
