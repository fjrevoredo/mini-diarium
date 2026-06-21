# PR {number} — {short title} ({author})

## Summary

{2-3 sentences describing what the PR does and the problem it solves.}

## Verdict

{Merge after fix / Merge as-is / Reject / Scope concern — investigate} — {one sentence reason}

## Scope and supply chain

Files changed: {list}
Files claimed by PR description: {list}
Out-of-scope files: {list, or "none"}

| Check | Result | Note |
|---|---|---|
| All changed files within stated scope | pass / fail | |
| No CI/workflow changes | pass / fail | |
| No package.json script changes | pass / fail | |
| No lockfile additions beyond package.json | pass / fail | |
| No Tauri capability / CSP changes | pass / fail | |
| No network calls introduced | pass / fail | |
| No obfuscated/encoded payloads | pass / fail | |
| No unexpected env var reads | pass / fail | |
| No new hardcoded external URLs | pass / fail | |
| No new network-capable crates (Rust) | pass / N/A | |

{If all pass: "Nothing out of scope. Diff content clean."}
{If any fail: describe exactly what was found and where.}

## Findings

### Correctness

{Describe whether the code does what the PR says it does. Note any subtle bugs or
race conditions. Reference specific file paths and line numbers.}

### Philosophy

| Principle | Result | Note |
|---|---|---|
| 1. Small core | pass / fail | {only include a note if non-obvious} |
| 2. Boring security | pass / N/A | |
| 3. Testing pyramid | pass / fail | |
| 4. Easy in/out | pass / N/A | |
| 5. Focused scope | pass / fail | |
| 6. Simple is good | pass / fail | |

### Best practices

| Rule | Result | Note |
|---|---|---|
| Reactivity | pass / warn | |
| State | pass | |
| IPC | N/A | |
| Editor | pass / warn | |
| Testing | pass / warn | |
| Accessibility | N/A | |
| File sizes | pass | {list sizes of changed files} |

### Claims in PR description

| Claim | Verified? | What we found |
|---|---|---|
| {claim from PR body} | yes / no / partial | {what grep/test run showed} |

## Required before merge

{Numbered list. Each item: what to change, where, and why. Include the exact command
or code snippet if it is a mechanical fix.}

## Optional suggestions

{Numbered list, or "None." Each item: what and why, framed as a question or alternative,
not a demand.}
