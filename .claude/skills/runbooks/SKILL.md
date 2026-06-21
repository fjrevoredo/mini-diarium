---
name: runbooks
description: |
  Route low-frequency Mini Diarium maintenance workflows to one selected runbook.
  Use only for manual or exceptional project workflows that are intentionally not
  registered as standalone top-level skills.
---

# Runbooks

Use this dispatcher to load one specific Mini Diarium runbook from this library.

This library is manual-first. Do not guess a runbook when the user's request does not clearly match one of the supported entries.

## Usage

- Codex: `$runbooks <entry>`
- Claude Code: `/runbooks <entry>`

## Routing Rules

1. Identify the requested runbook entry from the supported table below.
2. Load exactly one selected nested `ENTRY.md` unless the user explicitly asks for a multi-runbook task that genuinely spans several workflows.
3. After selecting an entry, follow that entry's instructions completely, including any required scripts, assets, evals, or validation steps.
4. If the request is ambiguous, ask the user to choose the runbook instead of inventing one.
5. If the requested entry is unsupported, say so plainly and do not load an unrelated skill.

## Available Skills

| Entry | Use for | Path |
|---|---|---|
| `add-locale` | Adding a brand-new Mini Diarium locale end to end | `skills/add-locale/ENTRY.md` |
| `apply-dependency-prs` | Applying dependency-update pull requests safely | `skills/apply-dependency-prs/ENTRY.md` |
| `diagram-maintainer` | Updating and validating Mermaid or D2 documentation diagrams | `skills/diagram-maintainer/ENTRY.md` |
| `implementation-review` | Reviewing a completed implementation against its plan and validations | `skills/implementation-review/ENTRY.md` |
| `integrate-stale-pr` | Manually integrating an external PR that can no longer merge cleanly | `skills/integrate-stale-pr/ENTRY.md` |
| `pre-release` | Running the pre-release checklist before tagging | `skills/pre-release/ENTRY.md` |
| `review-external-pr` | Reviewing an external contributor PR and drafting the maintainer response | `skills/review-external-pr/ENTRY.md` |
| `update-app-icons` | Replacing the app logo and regenerating platform icons | `skills/update-app-icons/ENTRY.md` |

## Unsupported Requests

If the requested name is not listed in the table above:

- report that `runbooks` does not provide that entry;
- do not search the filesystem for ad hoc alternatives;
- do not fabricate a new runbook name or workflow.
