---
description: Run code review on files or recent changes
---

Delegate to the `reviewer` agent to perform a code review.

**Scope:** $ARGUMENTS

If no arguments provided, review staged changes using `git diff --cached`.
If argument is "recent", review changes since last commit using `git diff HEAD~1`.
Otherwise, review the specified file(s) or directory.

The reviewer agent will:
- Load the code-review skill
- Apply the 4 Review Layers (Correctness, Security, Performance, Style)
- Classify findings by severity (Critical, Major, Minor, Nitpick)
- Only report findings with >=80% confidence
- Include positive observations
- Provide Philosophy Compliance checklist results

Return the complete review findings to the user.
