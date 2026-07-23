# Apply Dependabot PR #228 — bump `fast-xml-parser` (transitive) to 5.10.1 (fixes GHSA-8r6m-32jq-jx6q / alert #27)

## Metadata

- Plan Status: COMPLETED
- Created: 2026-07-23
- Last Updated: 2026-07-23
- Owner: Coding agent
- Approval: APPROVED
- Source PR: https://github.com/fjrevoredo/mini-diarium/pull/228
- Security Advisory: https://github.com/fjrevoredo/mini-diarium/security/dependabot/27 (GHSA-8r6m-32jq-jx6q, high)
- Resulting Commit: `cfe3470` on master (not pushed)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Apply Dependabot PR #228 by landing `fast-xml-parser` 5.10.1 (currently 5.9.3 in `package-lock.json` and 5.9.0 in `bun.lock`) into both lockfiles on `master`, validated by the project's standard frontend checks, then commit with the canonical `Dependency Update:` message. **This is the patched version for GHSA-8r6m-32jq-jx6q (Dependabot alert #27) — applying it remediates the advisory.** No push.

## Scope

- One PR: #228 (Dependabot, `npm_and_yarn`, label `javascript`).
- Dependency: `fast-xml-parser`, bumped 5.9.3 → 5.10.1 inside the existing `^5.3.3` range.
- **Security remediation:** `fast-xml-parser` 5.9.3 – <5.10.1 is vulnerable to GHSA-8r6m-32jq-jx6q (high; CVSS v4 8.7; CWE-776 "Improper Restriction of Recursive Entity References in DTDs"). Repeated DOCTYPE declarations reset entity-expansion limits, enabling XML-entity-expansion DoS. Fixed in 5.10.1. PR #228 bumps to exactly the patched version, so it satisfies alert #27 — Dependabot will set `fixed_at` and auto-close alert #27 once the patched version lands on `master`'s `package-lock.json`.
- **Exploitability in this project (context, not a blocker):** `fast-xml-parser` is a transitive **dev-only** dependency (`edgedriver` → `@wdio/*`), used only when running `test:e2e`. Its only call site is `edgedriver`'s driver-manifest parser, which consumes Microsoft's edgedriver CDN XML — not user-supplied, not network-facing in the shipped Tauri app. Practical exploitability is therefore negligible, but patching is still correct hygiene.
- **Implementation approach (revised mid-execution — see Decision Log):** Add `"fast-xml-parser": "^5.10.1"` to `package.json`'s existing `overrides` block (alongside `serialize-javascript`, `uuid`, `basic-ftp`, `mermaid`). This is the project's established pattern for pinning transitive deps. The original plan said "no `package.json` edit" assuming `bun install` would re-resolve a bumped transitive — verified false: bun's lockfile is sticky for already-satisfied transitives, and `bun update <pkg>` actually inserts the package as a top-level dep + isolates the existing nested copy (leaving the vulnerable path in place). `overrides` is the only clean mechanism that forces both npm and bun to use the patched version everywhere.
- Files changed: `package.json` (one new `overrides` entry), `bun.lock`, `package-lock.json`. `nix/package.nix` is out of scope on Windows (auto-patched by Nix CI post-push).
- A pre-existing lockfile drift will be resolved as a side effect: `bun.lock` currently pins 5.9.0 while `package-lock.json` pins 5.9.3.

## Non-Goals

- No `package.json` dependency edit (i.e., no new entry under `dependencies` or `devDependencies`). The only `package.json` change is adding one line to the existing `overrides` block.
- No `nix/package.nix` `npmDepsHash` refresh — Windows/WSL environment. Tracked by the Nix CI auto-patch workflow on push (see `procedures/npm.md` Phase 5).
- No Cargo, GitHub Actions, or other ecosystem changes.
- No E2E run (`test:e2e` is out of scope per `ENTRY.md`; `fast-xml-parser` only feeds `edgedriver`'s driver-manifest download, not Tauri IPC).
- No push, no PR merge — the user merges #228 separately.

## Assumptions

- Worktree is clean at start (verified: `git status` shows `nothing to commit, working tree clean`, on `master`, up to date with `origin/master`).
- The bumped version satisfies `edgedriver`'s `^5.3.3` constraint (it does: 5.10.1 ≥ 5.3.3, < 6.0.0).
- Dependabot's PR only touches `package-lock.json` (verified via `gh pr view 228 --json files`); `bun.lock` must be regenerated locally per the npm procedure gotcha.
- `--legacy-peer-deps` is required for `npm install --package-lock-only` due to the `eslint-plugin-solid` ↔ `eslint@10` peer mismatch (project convention, see `procedures/npm.md`).

## Open Questions

- None. The bump is a patch-level (5.9.3 → 5.10.1) update to a transitive dev-only dependency; no major-version risk, no `@tiptap/*` monorepo concern, no Cargo coupling.

## Tasks

### Task 1: Add `fast-xml-parser` override to `package.json`

- Status: COMPLETED
- Objective: Pin `fast-xml-parser` to `^5.10.1` everywhere via the existing `overrides` block, so both npm and bun resolve the patched version.
- Steps:
  1. Open `package.json`, locate the `"overrides"` block (currently contains `serialize-javascript`, `uuid`, `basic-ftp`, `mermaid`).
  2. Add one entry: `"fast-xml-parser": "^5.10.1"` (keep alphabetical-ish ordering with existing entries).
  3. Save.
- Validation: `Select-String -Path package.json -Pattern '"fast-xml-parser": "\^5.10.1"'` returns a match inside the `overrides` block; `dependencies` and `devDependencies` blocks are unchanged.
- Notes: Uses `^5.10.1` (not exact `5.10.1`) to allow future 5.x patch picks while excluding the vulnerable range — matches the `uuid`/`basic-ftp` style already in the file.

### Task 2: Regenerate `bun.lock`

- Status: COMPLETED
- Objective: `bun.lock` reflects `fast-xml-parser` 5.10.1 at every resolution site (top-level and `edgedriver/*`), with no isolated 5.9.0 nested copies.
- Steps:
  1. From the repo root, run `cmd.exe /c bun install`.
  2. Confirm the command exits 0.
- Validation: `Select-String -Path bun.lock -Pattern 'fast-xml-parser@5\.' -SimpleMatch` shows only `5.10.1` entries; no `5.9.0` or `5.9.3` matches remain.
- Notes: The `overrides` entry forces bun to re-resolve and bump the transitive copy. Do not use `bun update fast-xml-parser` — that mutates `package.json` (verified). Do not hand-edit `bun.lock`. The `postinstall` hook (git hooks + skill sync) runs as a side effect and is idempotent.

### Task 3: Regenerate `package-lock.json`

- Status: COMPLETED
- Objective: `package-lock.json` reflects `fast-xml-parser` 5.10.1 with full `resolved` + `integrity` fields (Flatpak-safe), driven by the new override.
- Steps:
  1. From the repo root, run `cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"`.
  2. Confirm the command exits 0.
- Validation:
  - `Select-String -Path package-lock.json -Pattern 'fast-xml-parser-5.10.1.tgz'` returns a match.
  - Flatpak integrity check (Phase 4 step 4 of the procedure):
    ```powershell
    $pkg = Get-Content package-lock.json | ConvertFrom-Json -AsHashtable | % packages
    ($pkg.Keys | ? { $_ -like 'node_modules/*' } | % { $pkg[$_].resolved -and $pkg[$_].integrity }).Count
    ```
    If any `node_modules/*` entry is missing `resolved` or `integrity`, fall back to a full `npm install --legacy-peer-deps` (delete `node_modules/` first), then re-run `bun install` to keep `bun.lock` in sync.
- Notes: `--legacy-peer-deps` is mandatory (`eslint-plugin-solid` peers on `eslint@^9`, project uses `eslint@10`). `--package-lock-only` is preferred but can drop `resolved`/`integrity` fields for some transitive entries — that fallback is the documented fix. Do not skip the integrity check.

### Task 4: Run the validation suite

- Status: COMPLETED
- Objective: All three project checks pass against the new lockfile state.
- Steps:
  1. `cmd.exe /c bun run type-check`
  2. `cmd.exe /c bun run lint`
  3. `cmd.exe /c bun run test:run`
- Validation: Each command exits 0.
- Notes: All three must pass — these are the primary validations listed in `procedures/npm.md`'s routing table. If any fails, mark BLOCKED and diagnose before proceeding; do not commit broken state.

### Task 5: Verify the file change set

- Status: COMPLETED
- Objective: Only the intended files belong to this dependency commit.
- Steps:
  1. Run `git diff --stat` to inspect unstaged changes.
  2. Confirm the relevant changes are limited to `package.json`, `bun.lock`, and `package-lock.json` for this task. **Note:** the worktree contains unrelated in-progress refactor work (Cargo workspace split into `crates/mini-diarium-crypto/`, `Cargo.lock`, `codecov.yml`, `nix/package.nix`, `scripts/*`, staged renames) from a separate session. That work is intentionally left untouched; the commit step must scope to only the three dependency files via path-scoped `git commit <paths>` (default `--only` semantics).
- Validation: `git diff --stat` includes the three dependency files. The unrelated in-progress changes are present but will be excluded from the dependency commit by the path-scoped commit in Task 6.
- Notes: `package.json`'s diff is exactly the one-line addition to the `overrides` block. The pre-existing in-progress refactor is the user's other work and is out of scope for this task.

### Task 6: Cleanup and commit

- Status: COMPLETED
- Objective: Commit ONLY the three dependency files (`package.json`, `bun.lock`, `package-lock.json`), using the user's git identity. Leave the unrelated in-progress refactor changes (staged renames + unstaged Cargo/scripts modifications) untouched. No push.
- Steps:
  1. Inspect the worktree for stray scratch files/logs produced by this task (the plan file `docs/plan-dependabot-228-fast-xml-parser.md` is intentional and stays). Remove only artifacts that are not part of the intended final state.
  2. Make a **path-scoped** commit (default `--only` semantics) so the pre-staged renames for the other work remain staged and are not included:
     ```
     git commit package.json bun.lock package-lock.json -m "Dependency Update: pin fast-xml-parser to ^5.10.1 (#228, GHSA-8r6m-32jq-jx6q)"
     ```
     The user's identity from `git config user.name` / `git config user.email` is already configured (`Francisco J. Revoredo <fjrevoredo@gmail.com>`), so no `GIT_AUTHOR_*` overrides are needed. No LLM user, no co-author trailer.
- Validation: `git log -1 --format='%an <%ae>%n%s'` shows `Francisco J. Revoredo <fjrevoredo@gmail.com>` and the exact subject above; `git show --stat HEAD` shows only `package.json`, `bun.lock`, and `package-lock.json`; the unrelated staged renames remain staged in the index (`git diff --cached --stat`).
- Notes: Per `procedures/npm.md` Phase 4 step 6. No CHANGELOG entry needed — transitive dev-only dependency bump with no user-facing change (the security advisory affects a dev-only path). No TODO to close (no originating TODO item). The commit subject explicitly references the GHSA so future audits can trace the remediation. Verb "pin" reflects the `overrides`-based approach (vs. the Dependabot PR's "bump").

## Final Verification

- Commit `cfe3470` on `master` (not pushed), authored by `Francisco J. Revoredo <fjrevoredo@gmail.com>`, subject `Dependency Update: pin fast-xml-parser to ^5.10.1 (#228, GHSA-8r6m-32jq-jx6q)`.
- `git show --stat HEAD` confirms the commit contains only `package.json`, `bun.lock`, `package-lock.json` (3 files, +46/-24).
- `package.json`'s `overrides` block contains `"fast-xml-parser": "^5.10.1"`; `dependencies`/`devDependencies` are unchanged.
- Both lockfiles resolve `fast-xml-parser` to 5.10.1 at every site — no surviving 5.9.0/5.9.3 entries (verified via `Select-String` against both lockfiles; the `edgedriver/fast-xml-parser` nested copy is gone).
- The three validation commands all pass: `type-check` (clean), `lint` (clean), `test:run` (756/756 tests, 81 files).
- `npm audit` shows zero remaining `fast-xml-parser` advisories (unrelated `brace-expansion` + `js-yaml` high-severity items are out of scope for this task).
- Flatpak lockfile integrity verified: all 1138 `node_modules/*` entries in `package-lock.json` have `resolved` + `integrity` fields (no fallback `npm install` needed).
- The unrelated in-progress refactor (Cargo workspace split into `crates/mini-diarium-crypto/`) is preserved in the index as 6 staged renames, plus its unstaged modifications — all untouched by the path-scoped commit.
- PR #228 remains open for the user to merge (Dependabot will auto-close it once `master` reflects 5.10.1).
- **Post-push follow-up (out of scope for this commit, but tracked here):** once the commit is pushed to `master`, GitHub's advisory scanner will detect `fast-xml-parser` 5.10.1 in `package-lock.json` and auto-close Dependabot alert #27 (`fixed_at` populates). Verify after push with `gh api /repos/fjrevoredo/mini-diarium/dependabot/alerts/27 --jq '.state'` (expect `fixed`); if it remains `open` after ~15 minutes, file a manual follow-up — do not dismiss the alert manually.

## Decision Log

- **2026-07-23 — Switched from "regenerate lockfiles only" to `package.json` `overrides` approach.** During Task 1 execution, `bun install` was found to be a no-op for already-satisfied transitive deps (it left `fast-xml-parser` at 5.9.0). Attempting `bun update fast-xml-parser` then mutated `package.json` to add `fast-xml-parser` as a top-level dependency AND isolated `edgedriver`'s nested copy at 5.9.0 — leaving the vulnerable path in place. Reverted both files via `git checkout`. The new approach adds `"fast-xml-parser": "^5.10.1"` to the existing `overrides` block (same pattern as `serialize-javascript`, `uuid`, `basic-ftp`, `mermaid`), which forces both bun and npm to resolve the patched version at every site. This changes the file set from 2 (`bun.lock`, `package-lock.json`) to 3 (+ `package.json`), and changes the commit verb from "bump" to "pin". The user's intent (apply PR #228, remediate alert #27) is preserved; the new approach is more correct because the override is durable.

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`, kebab-case name).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Any unresolved open questions have been surfaced to the user (none unresolved).
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [x] (If dialog/interaction feature) N/A — no UX changes.
- [x] (If Tauri WebView behavior) N/A — no WebView/IPC surface touched.

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
- Project commands MUST be routed through `cmd.exe /c` (Windows checkout from WSL).
- If Task 2's integrity check fails, run the documented `npm install --legacy-peer-deps` fallback, then re-run `bun install` before continuing.
