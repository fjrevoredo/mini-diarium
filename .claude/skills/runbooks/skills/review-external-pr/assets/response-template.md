## Normal review response

{Opener: one or two sentences about the specific bug or problem this PR addresses. Do not
say "thanks for the PR" or use generic praise. Name what the PR actually fixes or adds.}

{Body: required changes first, then suggestions. Use a heading per topic when there are
multiple. Keep headings descriptive ("One dep to clean up"), not action prefixes
("fix(deps): remove..."). Use prose for a single item; a short numbered list for two or more.

For each required change: state what must change, where (specific file), the exact command
or code if it is mechanical, and why it matters to the project.

For each suggestion: show the alternative and explain what it gains, framed as something
worth considering, not a correction of something wrong.}

{Factual corrections, if any: name the specific claim, state what the evidence shows, give
enough context that a future contributor reading the thread understands the right answer.
Tone: informative, not corrective.}

{Closing: one sentence about whether the PR needs work or is nearly there. Do not restate
the opener.}

---

*This review was produced through a pairing process between the maintainer and an AI Agent. The agent automated the mechanical parts of the review (diff analysis, claim verification, best-practices checks). All judgements are the maintainer's, in line with the [project's AI stance](README.md).*


## Scope concern response

{One sentence acknowledging the stated fix.}

Before reviewing the change itself, I want to ask about {file or change that is out of scope}.
The PR description mentions {stated scope}, but the diff also touches {unexpected file/change}.
Can you explain what that change is for?

{If multiple out-of-scope items, list them one per paragraph.}

---

*This review was produced through a pairing process between the maintainer and an AI Agent. The agent automated the mechanical parts of the review (diff analysis, claim verification, best-practices checks). All judgements are the maintainer's, in line with the [project's AI stance](README.md).*
