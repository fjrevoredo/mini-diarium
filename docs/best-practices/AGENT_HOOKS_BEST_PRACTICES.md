# Agent Hooks Best Practices

Rules for configuring Claude Code hooks in this repo: the commands the agent harness runs automatically on events such as `PostToolUse`, `Stop`, and `UserPromptSubmit`, declared under the `hooks` key of `.claude/settings.json` or `.claude/settings.local.json`.

This is not about the Git pre-commit hook or CI. For those, see [Local Pre-commit Hook](CI_BEST_PRACTICES.md#local-pre-commit-hook), which owns the rule that heavy work belongs in CI or a manual script rather than on the commit path. Agent hooks obey the same principle at a much tighter budget, because they fire far more often than commits do.

## Agent hooks are per-developer, not shared

`.gitignore` excludes both `.claude/settings.json` (line 86) and `.claude/*.local.json` (line 26). Cloning this repo gives you no hooks at all. Nothing in either file reaches another machine, and no review ever sees it.

Two consequences. First, a hook is never a project guarantee, so anything correctness-critical belongs in `bun run pre-commit` or CI, where it is tracked and runs for everyone. Treat agent hooks as personal ergonomics. Second, a useful configuration is lost unless it is written down, which is what the [Current configuration](#current-configuration) section below is for. Update that section when you change your hooks.

## Time budget

Every hook blocks the agent loop while it runs. The event determines how often that happens and therefore how much time you can afford.

| Event | Fires | Budget |
|-------|-------|--------|
| `PreToolUse`, `PostToolUse` | Once per matching tool call, dozens to hundreds per session | Under 2s |
| `UserPromptSubmit` | Once per prompt | Under 2s |
| `Stop`, `SessionStart` | Once per turn or session | Under 10s |

A hook over budget does not fail loudly. It just makes every affected action slower, which reads as the agent being sluggish rather than as a configuration problem.

## Measured costs in this repo

Measured 2026-07-30 on Windows 11, warm meaning a second or later run in the same session. Re-measure rather than trusting these numbers after a toolchain change, but use them to size a new hook before you write it.

| Operation | Cold | Warm |
|-----------|------|------|
| `powershell -Command "exit 0"` (startup only) | 1.5s | 1.3s |
| `pwsh -NoProfile -Command "exit 0"` (startup only) | 1.3s | 1.3s |
| `bun x eslint <one file>` | 6.5s | 2.2s |
| `node node_modules/eslint/bin/eslint.js <one file>` | | 2.0s |
| `bun run type-check` (`tsc --noEmit`, 203 files) | 12.1s | 4.2s |
| `tsc --noEmit --incremental` | 4.5s | 2.2s |

Two results are worth internalizing. PowerShell 7 does not start faster than Windows PowerShell 5.1 here, so switching interpreters buys nothing. And `--incremental` roughly halves the type-check, which is the single cheapest win available on any tsc-based hook.

## Rules

### Match the event to the granularity of the work

Per-file work belongs on `PostToolUse`. Whole-project work belongs on `Stop`, which fires once per turn no matter how many files the agent touched.

This repo learned the rule the expensive way. A `PostToolUse` hook ran the full `tsc --noEmit` after every single `.ts` or `.tsx` edit. Across a 10-day window that was 206 whole-project type-checks, roughly 34 minutes of blocked wall-clock time, and most of those runs reported errors that the agent's next edit was about to fix. Moving the type-check to `Stop` cut the per-edit cost from about 9.0s to about 3.3s and made the feedback more useful, because it now describes a finished change instead of a half-applied one.

### Prefer fewer hooks over faster ones

Each entry in a hook array spawns its own interpreter, and on this machine that costs about 1.3s before the command does any work. Two hooks on the same event pay it twice. Merging two commands into one invocation saves more than any optimization inside either command, and it is the reason the interpreter-swap idea above is a dead end.

### Always exit 0

End every hook command with `exit 0`. A non-zero exit or a `decision: "block"` payload from a `Stop` hook sends the agent back around the loop, which can produce a hook that never lets a turn finish.

### Report failures through `systemMessage`, and stay silent otherwise

Print nothing on success. On failure, print a single JSON object and still exit 0:

```
'{\"systemMessage\":\"TypeScript errors found — run bun run type-check to see details\"}'
```

Point at the command that shows the detail rather than dumping the tool's full output into the agent's context.

### Cache build artifacts outside the working tree

`tsc --incremental` writes a `.tsbuildinfo` file. Send it to `node_modules/.cache/`, which is already ignored, using `--tsBuildInfoFile 'node_modules\.cache\tsc.tsbuildinfo'`. The repo's `.gitignore` does not cover `*.tsbuildinfo` at the root, so the default location would show up as an untracked file after every turn.

### Verify both paths before trusting a hook

A hook that never reports failures is worse than no hook, because it looks like a passing check. Test the failing path explicitly. Write a probe file with a deliberate error, run the hook command, confirm it emits the expected message, and delete the probe in a `finally` block so a mistake cannot leave it behind:

```powershell
$probe = "D:\Repos\mini-diarium\src\__probe__.ts"
try {
  Set-Content $probe "const x: number = 'not a number';"
  & cmd /c $hookCommand
} finally {
  Remove-Item $probe -Force -ErrorAction SilentlyContinue
}
```

Then confirm the clean path is silent again after removal.

### Do not try to measure hooks from session transcripts

Successful hook runs that produce no output are never persisted to the transcript. Zero recorded runs means the hook is quiet, not that it is rare. Timing has to come from running the command yourself:

```powershell
[math]::Round((Measure-Command { & bun run type-check 2>&1 | Out-Null }).TotalMilliseconds)
```

Discard the first result and take the second. Cold runs on this repo are two to three times slower than steady state, so a cold measurement will talk you out of a hook that is actually fine.

## Current configuration

Recorded so it can be reproduced on a fresh clone. Copy into `.claude/settings.local.json`.

| Event | Matcher | Command | Typical cost |
|-------|---------|---------|--------------|
| `PostToolUse` | `Write\|Edit` | `bun x eslint --fix` on the edited file, for `.ts`, `.tsx`, `.js`, and `.jsx` only | ~3.3s per matching edit |
| `Stop` | any | `bun x tsc --noEmit --incremental --tsBuildInfoFile 'node_modules\.cache\tsc.tsbuildinfo'`, reporting through `systemMessage` | ~3.5s per turn |

Both read `tool_input.file_path` from stdin as JSON, set `[Console]::InputEncoding` to UTF-8 first, and exit 0 unconditionally.

Balloon-notification hooks on `Notification` and `Stop` live in user-scope `~/.claude/settings.json`. Those are personal and outside this repo's concern.

## Checklist for a new hook

1. Pick the event by granularity. Whole-project work goes on `Stop`, never on `PostToolUse`.
2. Time the command warm before wiring it up, and compare against the budget table.
3. Merge it into an existing hook on the same event rather than adding an array entry.
4. Add `exit 0` and, if it can fail, a `systemMessage` payload.
5. Direct any cache or build artifact into `node_modules/.cache/`.
6. Test the failing path with a probe file, then confirm the clean path is silent.
7. Record it in [Current configuration](#current-configuration), because nobody else's clone will have it.
