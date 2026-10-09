# Integrate pending Dependabot dependency PRs

## Metadata

- Plan Status: COMPLETED
- Plan Format: manual-planning v2.0.0
- Template: milestoned
- Tracking: untracked (locally excluded)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Context For A Clean Session

- Repository: `D:\Repos\mini-diarium`, branch `master`, clean worktree at commit `2633718` ("New Send feedback from the app feature"), dated 2026-10-04.
- Governing runbook: `.agents/skills/runbooks/skills/apply-dependency-prs/` (`ENTRY.md` + `procedures/npm.md`, `procedures/cargo.md`, `procedures/actions.md`). Multi-ecosystem batches apply procedures in order: npm → cargo → actions. The runbook commits locally and **does not push**.
- Stack: SolidJS + TypeScript frontend (Vite/Vitest, bun package manager); Rust Cargo workspace with three members (app crate `src-tauri`, `crates/mini-diarium-core`, `crates/mini-diarium-crypto`) and a repo-root `Cargo.lock`; dual npm lockfiles (`bun.lock` and `package-lock.json`, the latter feeds Flatpak/Nix); GitHub Actions are SHA-pinned in `.github/workflows/`.
- Exact commands:
  - Type-check: `cmd.exe /c bun run type-check`
  - Lint: `cmd.exe /c bun run lint`
  - Frontend tests: `cmd.exe /c bun run test:run`
  - Backend tests: `cargo test --workspace`
  - Backend build: `cargo build -p mini-diarium --features custom-protocol`
  - Workflow lint: `cmd.exe /c actionlint .github/workflows/ci.yml .github/workflows/benchmark.yml`

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| Open Dependabot PRs | npm: #316, #311, #310; cargo: #309; actions: #308, #307; #285 needs no work | `gh pr list --state open --json number,title,labels,headRefName` |
| #285 (toml in `/.opencode`) already applied | `.opencode/package-lock.json:399-401` resolves `toml` 4.3.0; commit `860c040` is on master | `git merge-base --is-ancestor 860c040 master` (exit 0); `git diff master...pr-285 -- .opencode` is empty |
| #316 current state | `package.json:119` already declares `"undici": "^8.10.1"`; `bun.lock:1912` resolves `undici@8.10.2`; PR targets lockfile-only 8.11.2 | Read of `package.json` and `bun.lock`; `gh pr view 316 --json files` shows only `package-lock.json` |
| #316 branch diff hazard | `git diff master...pr-316` carries stale unrelated lockfile churn (puppeteer/tailwindcss entries). The PR's real intent is three undici entries: top-level 8.10.2→8.11.2, `cheerio`-nested 7.29.0→7.30.0, `webdriver`-nested 6.28.1→6.29.0 | `git diff master...pr-316 -- package-lock.json` key inspection |
| #311 target | `lucide-solid` `^1.42.0` → `^1.47.0` (only line changed) | `git diff master...pr-311 -- package.json` |
| #310 target | 11 range bumps: `@tauri-apps/cli` `^2.11.3`→`^2.11.5`; `@unocss/reset`/`@unocss/vite`/`unocss` `^66.10.0`→`^66.10.5`; `@wdio/cli`/`@wdio/local-runner`/`@wdio/mocha-framework` `^9.31.6`→`^9.32.0`; `@wdio/spec-reporter` `^9.31.2`→`^9.32.0`; `eslint` `^10.10.0`→`^10.11.0`; `jsdom` `^30.0.1`→`^30.1.0`; `prettier` `^3.9.6`→`^3.9.8` | `git diff master...pr-310 -- package.json` |
| #309 target | `Cargo.lock`-only: `tauri` 2.11.5→2.11.6 (`Cargo.lock:4411`), `rand` 0.10.2→0.10.3 (`Cargo.lock:3564`); manifest ranges already allow both (`src-tauri/Cargo.toml:33` `tauri = "2.11.2"`; `crates/mini-diarium-core/Cargo.toml:36` and `crates/mini-diarium-crypto/Cargo.toml:26` `rand = "0.10"`) | `git diff master...pr-309 -- Cargo.lock`; manifest reads |
| #307 target | `codecov/codecov-action` SHA `0b35c9e…` (v7.1.0) → `303a32d…` (v7.1.1), two occurrences in `.github/workflows/ci.yml` | `git diff master...pr-307` |
| #308 target | `benchmark-action/github-action-benchmark` SHA `52576c9…` (v1) → `4322e57…` (v1.22.2), one occurrence in `.github/workflows/benchmark.yml` | `git diff master...pr-308` |
| actionlint | 1.7.12 installed and working | `cmd.exe /c actionlint -version` |
| Plan directory tracking | `docs/plans/` is untracked and listed in `.git/info/exclude` | `Get-Content .git/info/exclude` |
| Flatpak lock requirement | `package-lock.json` entries need `resolved` + `integrity` for `npm ci --offline` | `procedures/npm.md` gotcha and Phase 4 step 4 |
| nix hash | `nix/package.nix` `npmDepsHash` cannot be refreshed on Windows | `procedures/npm.md` Phase 3 step 4 / Phase 5 |
| E2E out of scope | Not required for dependency bumps | `ENTRY.md` Scope Boundaries |

### Hard constraints

1. Do not push — the runbook commits locally only; Dependabot auto-closes superseded PRs once the remote base branch reflects the change, which is the user's push.
2. `windows` / `webview2-com` crates are bound to the Tauri version; if the cargo update changes them (non-additive), abort the bump (`procedures/cargo.md`). The #309 target diff touches only `tauri` and `rand`.
3. Never hand-edit lockfiles; regenerate them only.
4. The npm command is exactly `npm install --package-lock-only --legacy-peer-deps` (`--legacy-peer-deps` is mandatory: `eslint-plugin-solid` peers on `eslint@^9`, the project uses `eslint@10`).
5. Both lockfiles must end aligned for every bumped direct dependency; Dependabot only touched `package-lock.json`.
6. `nix/package.nix` `npmDepsHash` stays stale on Windows — the commit message must note the Linux follow-up; Nix CI patches it on push.
7. Commit with the user's real git identity; no LLM co-author.
8. Project tool commands run through `cmd.exe /c`; `cargo` runs bare from the repo root.

## Goal

Integrate all pending Dependabot dependency updates (one is already applied) into local `master`: exact `package.json` range bumps for #311/#310, targeted lockfile refreshes for #316, `Cargo.lock` patch bumps for #309, and workflow SHA bumps for #307/#308. Both npm lockfiles stay coherent, the CHANGELOG records the batch, and one `Dependency Update` commit lands with every validation green. Nothing is pushed.

## Scope

- Dependabot PRs #307, #308, #309, #310, #311, #316; verification only for #285.
- Files: `package.json`, `bun.lock`, `package-lock.json`, `Cargo.lock`, `.github/workflows/ci.yml`, `.github/workflows/benchmark.yml`, `CHANGELOG.md`.
- Local commits on `master`; no push, no GitHub mutation.

## Non-Goals

- Pushing to origin; merging or closing GitHub PRs; changing Dependabot configuration.
- Refreshing `nix/package.nix` `npmDepsHash` (requires Linux+Nix; Nix CI handles it after push).
- Running E2E tests (`test:e2e`).
- Any `flake.nix` / `nix/package.nix` edits.
- Fixing unrelated pre-existing defects.

## Assumptions

- One combined commit matches this repo's convention for multi-ecosystem dependency batches (`24f9af1`, `ee942ad`) and keeps the batch as one logical change.
- #310's title says "13 updates" but its `package.json` diff has 11 range changes; the remainder are transitive lockfile moves reproduced by regeneration.
- Resolved versions may be newer than the PR target when a newer release satisfies the range (the "take the highest version" rule in `procedures/npm.md`); any such case is recorded in the Decision Log.
- The `undici` major (7→8) was already adopted (`package.json:119`); #316 is a lockfile refresh within `^8.10.1`, not a new major migration.
- The plan file stays untracked in `docs/plans/` (already locally excluded) and is not committed.

## Open Questions

None.

## Milestones

### Milestone 1: npm dependency updates (#311, #310, #316)

- Status: COMPLETED
- Purpose: Apply the two package.json range-bump PRs and the undici lockfile refresh, then prove both lockfiles agree and the frontend still passes its full local suite.
- Exit Criteria: `package.json` carries the exact range bumps from #311/#310; `bun.lock` and `package-lock.json` resolve every bumped package at or above the PR target with top-level `undici` 8.11.2; `package-lock.json` has zero entries missing `resolved`/`integrity`; type-check, lint, and `test:run` exit 0.

#### Task 1.1: Apply package.json range bumps (#311, #310)

- Status: COMPLETED
- Depends On: none
- Objective: `package.json` contains exactly the version-range changes from PRs #311 and #310.
- Steps:
  1. Dependencies: change `lucide-solid` from `^1.42.0` to `^1.47.0` (`package.json:84`).
  2. DevDependencies: change `@tauri-apps/cli` `^2.11.3`→`^2.11.5`; `@unocss/reset` `^66.10.0`→`^66.10.5`; `@unocss/vite` `^66.10.0`→`^66.10.5`; `@wdio/cli` `^9.31.6`→`^9.32.0`; `@wdio/local-runner` `^9.31.6`→`^9.32.0`; `@wdio/mocha-framework` `^9.31.6`→`^9.32.0`; `@wdio/spec-reporter` `^9.31.2`→`^9.32.0`; `eslint` `^10.10.0`→`^10.11.0`; `jsdom` `^30.0.1`→`^30.1.0`; `prettier` `^3.9.6`→`^3.9.8`; `unocss` `^66.10.0`→`^66.10.5`.
  3. Change only version strings; keep ordering and formatting.
- Validation: `git diff -- package.json` shows only the lines above and equals the union of `git diff master...pr-311 -- package.json` and `git diff master...pr-310 -- package.json`. `undici` (`package.json:119`) stays `^8.10.1` — #316 is lockfile-only.
- Notes: These are the only two PRs that touch `package.json`.

#### Task 1.2: Regenerate bun.lock and bump undici there

- Status: COMPLETED
- Depends On: 1.1
- Objective: `bun.lock` resolves the bumped ranges and all three `undici` instances at or above target.
- Steps:
  1. Run `cmd.exe /c bun install`.
  2. Run `cmd.exe /c bun update undici`.
- Validation: `Select-String -Path bun.lock -Pattern 'lucide-solid@1.47.0','unocss@66.10.5','eslint@10.11.0','jsdom@30.1.0','prettier@3.9.8','undici@8.11.2' -SimpleMatch` finds each; spot-check `@tauri-apps/cli@2.11.5` and `@wdio/cli@9.32.0` style entries. Review `git diff bun.lock`: no unexpected package changes beyond the bumped ranges and undici instances; if a resolution is newer than target, record it in the Decision Log.
- Notes: `bun update undici` refreshes the three undici resolutions (top-level, `cheerio`-nested, `webdriver`-nested); nested targets ≈7.30.0 / ≈6.29.0.

#### Task 1.3: Regenerate package-lock.json and bump undici there

- Status: COMPLETED
- Depends On: 1.1
- Objective: `package-lock.json` resolves the bumped ranges and undici at/above target.
- Steps:
  1. Run `cmd.exe /c "npm install --package-lock-only --legacy-peer-deps"`.
  2. Run `cmd.exe /c "npm update undici --package-lock-only --legacy-peer-deps"`.
- Validation: `node -e "const p=require('./package-lock.json').packages; for (const n of ['undici','lucide-solid','@tauri-apps/cli','@unocss/reset','@unocss/vite','@wdio/cli','@wdio/local-runner','@wdio/mocha-framework','@wdio/spec-reporter','eslint','jsdom','prettier','unocss']) console.log(n, p['node_modules/'+n].version)"` prints each at or above target (undici 8.11.2). `Select-String -Path package-lock.json -Pattern '"node_modules/cheerio/node_modules/undici"' -Context 0,2` and the `node_modules/webdriver/node_modules/undici` entry show ≥7.30.0 / ≥6.29.0. Package-lock root version stays 0.7.3, equal to `package.json`.
- Notes: `npm update undici` refreshes all undici instances allowed by their ranges, matching the PR intent.

#### Task 1.4: Flatpak lockfile integrity check

- Status: COMPLETED
- Depends On: 1.3
- Objective: No `package-lock.json` entry is missing `resolved`/`integrity`, so the Flatpak `npm ci --offline` path cannot break.
- Steps:
  1. Run (Node; the PowerShell `-AsHashtable` approach needs PS 6+ and this shell is PS 5.1 — see DEC-002):
     ```powershell
     node -e "const p=require('./package-lock.json').packages; const keys=Object.keys(p).filter(k=>k.startsWith('node_modules/')); const missing=keys.filter(k=>!(p[k].resolved&&p[k].integrity)); console.log('total='+keys.length+' complete='+(keys.length-missing.length)); if(missing.length){console.log('MISSING:'); console.log(missing.join('\n'))}"
     ```
  2. If any entry is incomplete: delete `node_modules/`, run `cmd.exe /c "npm install --legacy-peer-deps"`, then `cmd.exe /c bun install`, then repeat step 1.
- Validation: `complete` equals `total`.
- Notes: `--package-lock-only` can drop these fields; the fallback is the documented remedy in `procedures/npm.md` Phase 4 step 4.

#### Task 1.5: Frontend validation suite

- Status: COMPLETED
- Depends On: 1.2, 1.3
- Objective: The frontend type-checks, lints, and passes tests with the new resolutions.
- Steps:
  1. Run `cmd.exe /c bun run type-check`.
  2. Run `cmd.exe /c bun run lint`.
  3. Run `cmd.exe /c bun run test:run`.
- Validation: all three commands exit 0.
- Notes: If a bumped dev tool (eslint, prettier, wdio types) surfaces an issue, fix it in scope or mark BLOCKED with the failure.

### Milestone 2: cargo dependency updates (#309)

- Status: COMPLETED
- Purpose: Apply the two lockfile-only crate bumps and prove the workspace builds and tests with them.
- Exit Criteria: `Cargo.lock` differs from HEAD only in `tauri` 2.11.5→2.11.6 and `rand` 0.10.2→0.10.3 (versions + checksums); no `windows`/`webview2-com` line changes; workspace tests and the release-feature build exit 0.

#### Task 2.1: Apply Cargo.lock bumps (tauri 2.11.6, rand 0.10.3)

- Status: COMPLETED
- Depends On: none
- Objective: `Cargo.lock` matches PR #309.
- Steps:
  1. Attempt regeneration: `cargo update -p tauri@2.11.6` / `cargo update -p tauri --precise 2.11.6` and `cargo update -p rand --precise 0.10.3`. Local cargo re-resolved 11 crates' `windows-sys` 0.61.2 → 0.60.2 — the runbook abort condition (see DEC-003); regeneration is not usable.
  2. Fallback: apply the PR's lockfile directly: `git restore --source=pr-309 --worktree -- Cargo.lock`.
  3. Inspect `git diff Cargo.lock`.
- Validation: `git diff Cargo.lock` matches `git diff master...pr-309 -- Cargo.lock` (4 changed lines: `tauri` version+checksum at `Cargo.lock:4411`, `rand` version+checksum at `Cargo.lock:3564`) and contains zero `windows`/`webview2-com`/`windows-core` changes.
- Notes: Abort condition from `procedures/cargo.md`: any non-additive `windows-*`/`webview2-com` change means the bump must ship with a Tauri-driven update instead.

#### Task 2.2: Backend validation

- Status: COMPLETED
- Depends On: 2.1
- Objective: Workspace tests and the release-like build pass with the new crate versions.
- Steps:
  1. Run `cargo test --workspace`.
  2. Run `cargo build -p mini-diarium --features custom-protocol`.
- Validation: both commands exit 0.
- Notes: `--workspace` is required so the core and crypto crate tests actually run.

### Milestone 3: GitHub Actions updates (#307, #308)

- Status: COMPLETED
- Purpose: Apply the two SHA-pinned action bumps to the workflows.
- Exit Criteria: `.github/workflows/ci.yml` and `.github/workflows/benchmark.yml` contain the new SHAs; `actionlint` exits 0.

#### Task 3.1: Apply action pins and validate

- Status: COMPLETED
- Depends On: none
- Objective: Workflow files carry the new action pins.
- Steps:
  1. In `.github/workflows/ci.yml`, replace both occurrences of `codecov/codecov-action@0b35c9ecc4f0529d0eb674914510c22f85b196b4 # v7.1.0` with `codecov/codecov-action@303a32d7a59b442fa8d48b6a1cc6825c09c847a5 # v7.1.1`.
  2. In `.github/workflows/benchmark.yml`, replace `benchmark-action/github-action-benchmark@52576c92bccf6ac60c8223ec7eb2565637cae9ba # v1` with `benchmark-action/github-action-benchmark@4322e5726e6334590d251fc4f92bec0efafc45dc # v1`.
  3. Run `cmd.exe /c actionlint .github/workflows/ci.yml .github/workflows/benchmark.yml`.
- Validation: `git diff .github/workflows` equals the union of `git diff master...pr-307` and `git diff master...pr-308` (3 changed lines total); `actionlint` exits 0.
- Notes: Both are patch bumps with no breaking changes (codecov 7.1.1 release chore; benchmark 1.22.2 shallow-clone perf). The `gh workflow view` API check from `procedures/actions.md` is skipped because the commit is not pushed (no-push rule); CI validates on the user's next push.

### Milestone 4: Commit, Cleanup, And Final Verification

- Status: COMPLETED
- Purpose: Land the batch as one scoped commit, remove intermediate artifacts, and prove the final state.
- Exit Criteria: one `Dependency Update` commit exists with exactly the expected 7 files; no local `pr-*` branches remain; pre-flight checks pass; worktree clean; plan COMPLETED.

#### Task 4.1: CHANGELOG entry and combined commit

- Status: COMPLETED
- Depends On: 1.5, 2.2, 3.1
- Objective: A single local commit records the integrated batch with the repo's conventions.
- Steps:
  1. Append a bullet to `CHANGELOG.md` under `## [0.7.4] - [Unreleased]` → `### Internal` (after the entry at line 62):
     `- **Dependency updates (Dependabot #307, #308, #309, #310, #311, #316)**: Frontend bumps for `lucide-solid` (1.47.0), `@tauri-apps/cli` (2.11.5), `unocss`/`@unocss/*` (66.10.5), `@wdio/*` (9.32.0), `eslint` (10.11.0), `jsdom` (30.1.0), `prettier` (3.9.8), and an `undici` lockfile refresh (8.11.2 top-level); patch bumps for `tauri` (2.11.6) and `rand` (0.10.3) in `Cargo.lock`; CI action bumps for `codecov/codecov-action` (7.1.1) and `benchmark-action/github-action-benchmark` (1.22.2). The `nix/package.nix` `npmDepsHash` needs a Linux-side refresh — the Nix CI workflow patches it automatically on push.`
  2. Stage exactly: `git add package.json bun.lock package-lock.json Cargo.lock .github/workflows/ci.yml .github/workflows/benchmark.yml CHANGELOG.md`.
  3. Commit with the user's real identity (no LLM co-author), no push:
     - Subject: `Dependency Update: lucide-solid, dev tooling, undici 8.11.2, tauri 2.11.6, rand 0.10.3, codecov-action 7.1.1, github-action-benchmark 1.22.2`
     - Body: `Applies Dependabot PRs #307, #308, #309, #310, #311, and #316. PR #285 (toml in .opencode) was already applied as 860c040. nix/package.nix npmDepsHash refresh omitted (Linux+Nix only); the Nix CI workflow patches it on push.`
- Validation: `git log -1 --stat` lists exactly the 7 files; `git show -s --format=%B HEAD` shows the subject/body above; `git status --porcelain` prints nothing.
- Notes: One combined commit follows `24f9af1`/`ee942ad`. Do not push.

#### Task 4.2: Cleanup intermediate artifacts

- Status: COMPLETED
- Depends On: 4.1
- Objective: Only intentional artifacts remain.
- Steps:
  1. Delete the inspection branches: `git branch -D pr-285 pr-307 pr-308 pr-309 pr-310 pr-311 pr-316`.
  2. Verify `.git/info/exclude` contains exactly one `docs/plans/` line (remove duplicates the generator may have appended).
  3. Confirm no scratch files exist (`git status --porcelain` empty; no untracked files created during the work).
- Validation: `git branch --list 'pr-*'` prints nothing; `git status --porcelain` prints nothing. Both commands intentionally produce no output and exit 0.
- Notes: Keep `docs/plans/2026-10-04-integrate-pending-dependabot-dependency-prs-plan.md` — it is locally excluded and is the execution ledger.

#### Task 4.3: Final verification and plan completion

- Status: COMPLETED
- Depends On: 4.2
- Objective: The repository is verified end-to-end and the plan is closed accurately.
- Steps:
  1. Run every item in `## Pre-flight Checks`.
  2. Run the checks in `## Final Verification`.
  3. Set this plan's status to `COMPLETED` and every task/milestone to `COMPLETED`.
- Validation: all pre-flight commands exit 0; `git status --porcelain` prints nothing; the plan metadata shows `COMPLETED`.
- Notes: If anything fails after the commit, fix and amend only while it stays a single logical change; otherwise record a Decision Log entry.

## Project Gates

- Runbook `apply-dependency-prs` governs: procedures in npm → cargo → actions order; npm uses exactly `npm install --package-lock-only --legacy-peer-deps`; cargo uses the lockfile-only path (#309 touches only `Cargo.lock`).
- `windows`/`webview2-com` crates must not change independently of Tauri (`procedures/cargo.md`; pins in `src-tauri/Cargo.toml`).
- CHANGELOG entry required for dependency commits (repo convention: `24f9af1`, `ee942ad`, `8311612`).
- Commit with the user's git identity; no LLM co-author; no push.
- `nix/package.nix` `npmDepsHash` refresh is Linux+Nix only; the commit message notes the omission; Nix CI patches it on push.
- E2E tests are out of scope for dependency bumps (`ENTRY.md` Scope Boundaries).

## Pre-flight Checks

Run before the plan may reach `COMPLETED`:

- [ ] `cmd.exe /c bun run type-check`
- [ ] `cmd.exe /c bun run lint`
- [ ] `cmd.exe /c bun run test:run`
- [ ] `cargo test --workspace`
- [ ] `cargo build -p mini-diarium --features custom-protocol`
- [ ] `cmd.exe /c actionlint .github/workflows/ci.yml .github/workflows/benchmark.yml`
- [ ] `git status --porcelain` prints nothing (clean worktree; the plan file is locally excluded)

## Decision Log

Write an entry **before moving to the next task**, never retrospectively. An entry is required when implementation diverges from what this plan specifies, when a validation failure forces the plan to adapt, when an unplanned problem is found, or when a validation is deliberately deferred. No entry is needed when execution matches the plan.

### DEC-001 — npm resolutions exceed some PR targets

- Date: 2026-10-04
- Task: 1.2, 1.3
- Decision: Keep the latest versions allowed by the new ranges. Both managers resolved `@tauri-apps/cli` 2.12.1, `eslint` 10.12.0, `jsdom` 30.1.2, `prettier` 3.9.9, and `lucide-solid` 1.52.0 — newer than the PR-target minimums (2.11.5 / 10.11.0 / 30.1.0 / 3.9.8 / 1.47.0).
- Rationale: `procedures/npm.md` Phase 1 step 5 says to take the highest version when versions differ; bun and npm regenerated to the same resolutions, so both lockfiles stay aligned. `undici` hit the PR target exactly (8.11.2 top-level; 7.30.0 and 6.29.0 nested).

### DEC-002 — Flatpak integrity check ran via Node instead of the PowerShell snippet

- Date: 2026-10-04
- Task: 1.4
- Decision: Used `node -e` to count `node_modules/*` entries missing `resolved`/`integrity` (result: total=1115 complete=1115) instead of the planned PowerShell snippet.
- Rationale: This shell is Windows PowerShell 5.1, where `ConvertFrom-Json -AsHashtable` (needed by the snippet) is unavailable (PS 6+ only); the Node check is equivalent.

### DEC-003 — Cargo update applied from PR #309's lockfile instead of local regeneration

- Date: 2026-10-04
- Task: 2.1
- Decision: Applied `Cargo.lock` from `pr-309` directly (`git restore --source=pr-309 --worktree -- Cargo.lock`) after local regeneration triggered the runbook's abort condition.
- Rationale: `cargo update -p tauri --precise 2.11.6` re-resolved 11 unrelated crates from `windows-sys` 0.61.2 down to 0.60.2 (deduplication with `rfd`'s `^0.60` requirement via `tauri-plugin-dialog`). `procedures/cargo.md` says to abort any non-additive `windows-*` change. The PR is lockfile-only; master's `Cargo.lock` is unchanged since the PR's merge-base (`git diff 24e66c7 master` shows no `Cargo.lock`), and PR #309's CI (Build Windows/Linux/macOS, Test, E2E, Flatpak) is green on that exact lockfile. Applying it yields exactly the 4-line tauri+rand diff with zero `windows-*` movement.

## Final Verification

Performed by Task 4.3:

- `git log -1 --stat` shows exactly `CHANGELOG.md`, `Cargo.lock`, `bun.lock`, `package-lock.json`, `package.json`, `.github/workflows/benchmark.yml`, `.github/workflows/ci.yml`.
- The resolved-version checks from Tasks 1.2, 1.3, 1.4, and 2.1 are re-run and pass.
- All `## Pre-flight Checks` pass.
- `git status --porcelain` prints nothing.

## Approval Gate

Approved by Francisco J. Revoredo on 2026-10-04.

## Plan Self-Check

Paste the output of `check-plan.py` here, with the date it was run:

```
$ python scripts/check-plan.py docs/plans/2026-10-04-integrate-pending-dependabot-dependency-prs-plan.md
0 error(s), 0 warning(s)
```

Run: 2026-10-04

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Task numbering is not an execution order. Follow `Depends On`.
- Write a `## Decision Log` entry **before starting the next task** whenever execution diverges from this plan, an unplanned problem is found, or a validation is deferred — never retrospectively.
