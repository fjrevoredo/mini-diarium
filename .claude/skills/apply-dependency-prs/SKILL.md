---
name: apply-dependency-prs
description: >
  Use this skill whenever the user asks you to apply dependency update PRs
  from GitHub — Dependabot bumps, version updates in package.json, or
  merging dependency PRs. Use this even if the user just says "apply this PR"
  or "merge these PRs" and the PRs change package.json. This skill handles
  the dual-lockfile setup (bun.lock + package-lock.json), detects
  partially-applied PRs, catches stale lockfiles, resolves overlapping
  version bumps across multiple PRs, and runs the full validation suite
  after applying. Do not apply Rust/Cargo dependency PRs with this skill.
---

# Apply Dependency PRs

Apply dependency update PRs from GitHub into the workspace, ensuring
correctness across the dual-lockfile setup and catching state mismatches.

## Quick Checklist

After loading this skill, the agent should follow these phases:

- [ ] Discovery: fetch PR diffs, compare against current workspace, detect stale
  lockfiles
- [ ] Planning: create a plan via `manual-planning`, surface open questions,
  get user approval
- [ ] Execution: edit `package.json`, run `bun install`, run
  `npm install --package-lock-only --legacy-peer-deps`
- [ ] Verification: grep lockfiles for correct versions, run type-check + lint
  + test:run, verify `git diff --stat` shows exactly 3 files

## Gotchas

These are the mistakes that happen most often when applying dependency PRs.
Read before starting.

- **`package-lock.json` can be stale.** If a previous PR was applied with
  `bun install` alone, `package-lock.json` may still show an old version
  number. Always read its first few lines to check. It will be regenerated as
  a side effect of execution.
- **Dependabot PRs only touch `package-lock.json`.** Dependabot uses npm, so
  its PRs leave `bun.lock` untouched. You must regenerate `bun.lock` locally.
- **The npm command is NOT `npm install`.** Use the canonical command:
  `npm install --package-lock-only --legacy-peer-deps`. The `--legacy-peer-deps`
  flag is mandatory because `eslint-plugin-solid` peers on `eslint@^9` but the
  project uses `eslint@10`.
- **One PR may already be applied.** Always compare each PR's `package.json`
  diff against the current `package.json`. Don't assume all PRs are pending.
- **Multiple PRs can overlap on the same dependency.** When two PRs bump the
  same package to different versions, take the highest version.
- **All project commands need `cmd.exe /c`.** This repo is worked on from WSL
  over a Windows checkout. Bare `bun`/`npm` from WSL may fail.

## Workflow

### Phase 1: Discovery

For each PR the user wants to apply:

1. **Fetch PR metadata and diff:**
   ```bash
   gh pr view <NUMBER> --repo <owner/repo> --json title,body,files,commits
   gh pr diff <NUMBER> --repo <owner/repo>
   ```
   If the user provides URLs instead of numbers, extract the owner, repo, and
   PR number from the URL. The owner/repo can be inferred from `git remote -v`
   when not explicitly provided.

2. **Extract the dependency versions from each PR diff.** Focus on the
   `package.json` changes: what packages are bumped, from what version to what
   version. Ignore `package-lock.json` hunks during this comparison — the
   lockfile is regenerated locally.

3. **Compare against the current workspace.** Read `package.json` and check
   each dependency version from the PR. Categorize each PR:
   - **Fully applied:** all version bumps already present in `package.json`
   - **Partially applied:** some bumps present, others not
   - **Not applied:** no bumps from this PR are present

4. **Check lockfile health.** Read the first few lines of `package-lock.json`
   to check its version. If it differs from the version in `package.json`,
   flag it as stale. It will be corrected during `npm install`.

5. **Check for overlapping changes.** If multiple PRs modify the same
   dependency to different versions, take the highest version from the
   superset of all PRs. The lower-version PR will be auto-closed by
   Dependabot once the base branch reflects the higher version — do not
   ask the user whether to close it; just note it in the plan.

### Phase 2: Planning

1. **Load the `manual-planning` skill** and produce a plan file in `docs/`
   with a descriptive kebab-case name. The plan must follow the
   manual-planning template structure exactly: metadata block with status,
   Goal/Scope/Non-Goals, Assumptions, Open Questions, numbered tasks each
   with Status/Objective/Steps/Validation/Notes, a Cleanup task, and a
   Final Verification section. Each task's Validation field must list the
   specific commands to run (not prose).

2. The plan must include these details:
   - Which PRs are already applied and which are pending
   - Which dependencies will change and their new versions
   - **Lockfile strategy:** both `bun install` and
     `npm install --package-lock-only --legacy-peer-deps` will be run
   - **Stale lockfile warning** if detected in Phase 1
   - **Expected changed files:** only `package.json`, `bun.lock`, and
     `package-lock.json`
   - **Validation tasks:** separate tasks for type-check, lint, and test:run,
     each with the exact `cmd.exe /c bun run <command>` as its Validation

3. Surface only blocking questions before marking the plan
   `READY FOR APPROVAL`:
   - Are there truly conflicting version bumps (two PRs targeting different
     major versions of the same package)?
   - Is there a major version bump that could break the app?
   - Does `Cargo.toml` also need updates?
   Do NOT ask operational questions (e.g., "should I close the superseded
   PR?") — Dependabot auto-closes PRs when their base branch no longer
   needs the bump after the higher version is applied.

4. Do not begin implementation until the user approves.

### Phase 3: Execution

1. **Edit `package.json`** to apply all pending version bumps. Change only
   version strings — do not reorder dependencies or alter formatting.

2. **Regenerate `bun.lock`:**
   ```bash
   cmd.exe /c bun install
   ```

3. **Regenerate `package-lock.json`:**
   ```bash
   cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"
   ```
   `--package-lock-only` prevents npm from touching `node_modules/`.
   `--legacy-peer-deps` handles the eslint-plugin-solid peer mismatch.

4. **Never manually edit lockfiles.** If either install command fails,
   diagnose and fix the error; do not hand-patch the lockfile.

### Phase 4: Verification

1. **Verify versions in both lockfiles.** For each bumped dependency, grep
   both lockfiles to confirm the resolved version matches:
   ```powershell
   Select-String -Path bun.lock -Pattern "<package>@<version>" -SimpleMatch
   Select-String -Path package-lock.json -Pattern "<package>" -SimpleMatch
   ```
   Also confirm the project version in `package-lock.json` now matches
   `package.json`:
   ```powershell
   Select-String -Path package-lock.json -Pattern '"version": "<expected>"'
   ```

2. **Run the full validation suite:**
   ```bash
   cmd.exe /c bun run type-check
   cmd.exe /c bun run lint
   cmd.exe /c bun run test:run
   ```
   All three must exit with code 0.

3. **Verify the file change set:**
   ```bash
   git diff --stat
   ```
   Should show exactly three files: `package.json`, `bun.lock`, and
   `package-lock.json`. Investigate any additional files.

4. **Update the plan** to mark all tasks completed and plan status to
   `COMPLETED`.

## Scope Boundaries

- **Only npm/bun dependencies.** For Cargo/Rust dependency updates, use
  separate handling — this skill does not touch `Cargo.toml` or `Cargo.lock`.
- **E2E tests are out of scope** for dependency bumps. Running
  `test:e2e` is not required unless the bumped dependency is a Tauri API or
  plugin that could affect IPC behavior.

## Reference

For full details on the dual-lockfile requirement and the Flatpak pipeline:
- Root `CLAUDE.md` — "Updating Dependencies (npm/bun)" section
- `docs/FLATPAK_MAINTENANCE.md` — why `package-lock.json` is required
