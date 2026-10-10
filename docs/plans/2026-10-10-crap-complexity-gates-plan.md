# crap-complexity-gates

## Metadata

- Plan Status: IN PROGRESS
- Plan Format: manual-planning v2.0.0
- Template: milestoned
- Tracking: tracked (by user request)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Context For A Clean Session

- Repository: `C:\Users\Francisco\.herdr\worktrees\mini-diarium\worktree-silver-meadow-f82f` (Mini Diarium worktree), branch `worktree/silver-meadow-f82f`, clean at `da8c19b` (only the untracked proposal doc and this plan file).
- Originating design document (read first): `docs/explorations/2026-10-10-crap-cyclomatic-complexity-integration.md` — contains the verified findings, the measured baseline census, the coding agent's agree-with-changes second-opinion review, and the agreed scope revisions this plan implements.
- Stack: Rust 1.95 (`rust-toolchain.toml:2`) Cargo workspace — `src-tauri/` app crate + `crates/mini-diarium-core` + `crates/mini-diarium-crypto`; SolidJS/TypeScript frontend (Node v24.21.0, bun 1.4.2, Vitest 5.0.3 with v8 coverage); CI: GitHub Actions (`.github/workflows/ci.yml`); Codecov + SonarCloud (SonarCloud analyzes TS only).
- Key tools: `cargo-crap` **pinned 0.6.1** (installed and verified locally on Windows: `cargo install cargo-crap --locked`, 2m19s compile); `cargo-llvm-cov` 0.9.0; `cargo-nextest` 0.9.138; Python 3.13.4 (plan scripts only).
- Exact commands (this shell is Windows — route bun/vitest via `cmd.exe /c` per root `CLAUDE.md`; bare `cargo` is fine):
  - Frontend tests+coverage: `cmd.exe /c bun run test:coverage` → writes `coverage/lcov.info`
  - Backend tests+coverage: `cargo llvm-cov nextest --workspace --no-fail-fast --lcov --output-path lcov.info` run from `src-tauri/` → writes `src-tauri/lcov.info` (workspace-wide results land there)
  - CRAP report: `cargo crap --workspace --lcov src-tauri/lcov.info --format json --sort file --missing pessimistic --epsilon 0.01 --output <file>` from repo root
  - Lint: `cmd.exe /c bun run lint`; type-check: `cmd.exe /c bun run type-check`; frontend tests: `cmd.exe /c bun run test:run`
  - Backend: `cargo test --workspace`; `cargo clippy --workspace --all-targets -- -D warnings`; `cargo fmt --all --check`
  - Coverage gate: `cmd.exe /c bun run coverage:diff`

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| Backend lcov already produced in CI | `.github/workflows/ci.yml:199` (`cargo llvm-cov nextest --workspace ... --output-path lcov.info`) | grep of ci.yml anchors |
| Frontend coverage produced in CI | `.github/workflows/ci.yml:187` (`bun run test:coverage`) | same |
| Codecov uploads | `.github/workflows/ci.yml:204–215` (two `codecov-action` steps: `./coverage/lcov.info`, `./src-tauri/lcov.info`) | same |
| Binary-cache pattern to copy | `.github/workflows/ci.yml:175–184` (caches `~/.cargo/bin/cargo-llvm-cov`, key `llvm-cov-Linux-v0.6`) | same |
| Pre-commit backend coverage = step 7 | `scripts/pre-commit.js:156–177` (skip-with-warning pattern at 176–177 when `cargo llvm-cov` absent — model for Task 2.3) | grep |
| Pre-commit diff-coverage gate = step 11 | `scripts/pre-commit.js:238` (`node scripts/check-diff-coverage.mjs --working-tree`) | grep |
| Policy-script style model | `scripts/check-diff-coverage.mjs` — parses only `SF:`/`DA:` lcov records, has `--self-test` wired as `package.json:23` `coverage:self-test` | earlier exploration |
| Vitest coverage config | `vitest.config.ts:17–36` — provider `v8`, reporters `text/json/html/lcov`, thresholds 76/62/80/77; **no `reportOnFailure`** (default false → lcov silently skipped when any test fails) | file read; empirically confirmed (failed run produced no lcov) |
| ESLint config | `eslint.config.js` — flat config; `@eslint/js` + `typescript-eslint` recommended + `eslint-plugin-solid`; **no `complexity` rule** | file read |
| Clippy complexity config dormant | `src-tauri/.clippy.toml:1–2` — `msrv = "1.75"`, `cognitive-complexity-threshold = 30`; not inherited by `crates/*`; `cognitive_complexity` is a nursery lint that nothing enables | file read |
| No workspace lint tables | no `[workspace.lints]` in root `Cargo.toml`; no `[lints]` in any of the three member crates | grep of all four Cargo.toml |
| Clippy blast radius measured | `cargo clippy --workspace --all-targets -- -A clippy::all -W clippy::cognitive_complexity` → exactly 1 warning: `crates/mini-diarium-core/src/import/jrnl.rs:342` (26/25 at default threshold); **0 violations at threshold 30** | local run 2026-10-10 |
| cargo-crap baseline census (Windows) | 630 functions → 18 above CRAP 30 (app 14, core 4, crypto 0); worst `build_menu` 600.0 (CC 24, 0% cov, `src-tauri/src/menu.rs:27`); path matching 118/122 (misses: `config/tests.rs`, `commands/fonts/tests.rs`, `build.rs`, `webview_security/macos.rs` — all benign) | local run 2026-10-10 |
| lcov files carry function records | backend 4,607 `FN`/`FNDA` pairs; frontend 2,581 across 131 files | local runs |
| cargo-crap 0.6.1 CLI contract | `--workspace`, `--lcov`, `--baseline <json>`, `--fail-regression`, `--fail-above`, `--missing pessimistic|optimistic|skip`, `--epsilon` (default 0.01), `--format human|json|github|markdown|pr-comment|sarif|shields`, `--sort crap|file`, `--output`, config `.cargo-crap.toml`; default-excludes `tests/**`, `benches/**`, `examples/**` | local `cargo crap --help` |
| cargo-crap gate semantics | `--fail-regression` does NOT trip on brand-new functions; `--fail-above` checks ALL functions incl. legacy → native flags cannot express "new ≤ 30, existing no-regress" → custom delta-JSON policy script required | coding-agent source reading of 0.6.1, recorded in proposal doc |
| cargo-crap scoring blind spots | closures not scored (matters for the `with_unlocked_db(..., |db| ...)` command pattern), macro bodies not expanded, function spans with no instrumented lines in a matched file show 100% coverage (cfg-dead code looks healthy) | coding-agent source reading of 0.6.1, recorded in proposal doc |
| Baseline JSON path shape | measured Windows output contains absolute `C:\Users\...` paths → normalization to repo-relative forward-slash form is mandatory before committing | local run |
| SonarCloud ruled out for CRAP | API-verified: no CRAP metric among 165; Rust not analyzed (`q=.rs` → total 0); project `coverage` metric absent | live API queries, recorded in proposal doc |
| CHANGELOG exists at root | `CHANGELOG.md` with `## [X.Y.Z] - dd-mm-YYYY/Unreleased` convention | file read |
| Skill mirrors are generated | canonical `.agents/skills/` only; `.claude/skills/` + `.pi/skills/` must never be edited or committed (root `CLAUDE.md` gotcha #3; DRIFT failure in sync-skills) | root `CLAUDE.md` |
| lcov files are gitignored | generated `coverage/lcov.info` and `src-tauri/lcov.info` do not appear in `git status` | `git status --porcelain` after generation |
| `docs/plans/` is tracked | existing committed plan `docs/plans/2026-10-10-core-write-contract-follow-ups-w-03-to-w-06-plan.md` | `git ls-files docs/plans` |

### Hard constraints

1. **Never block Codecov uploads on a CRAP failure** — the CRAP gate step goes after `ci.yml:204–215` and report artifacts upload with `if: always()`; violating this hides the coverage state the existing patch ≥ 80% gate depends on.
2. **Canonical baseline is Linux-CI-produced with normalized repo-relative forward-slash paths** — a Windows-produced baseline bakes in absolute paths and different cfg-compiled code; gating Linux PRs with it produces phantom regressions.
3. **Baseline updates only in dedicated reviewed commits** — a feature PR that raises its own baseline defeats the gate entirely.
4. **Scratch acceptance probes never merge to master and never enter the canonical baseline** — probes contain deliberately pathological functions; merging would pollute both codebase and gate.
5. **Edit only `.agents/skills/ci-gate-diagnosis/`** — `.claude/skills/` and `.pi/skills/` are generated mirrors; direct edits cause `sync-skills` DRIFT failures.
6. **`cargo clippy --workspace --all-targets -- -D warnings` must stay green** — it is the enforcement backbone of Task 3.2; breaking it breaks every PR.
7. **The policy script must not compute metrics** — cargo-crap stays the single metrics source; the script only interprets its delta JSON. A second metrics implementation would drift.
8. **Route `bun`/`vitest`/`vite` through `cmd.exe /c` from this shell** — bare invocations from WSL silently misbehave in this repo (root `CLAUDE.md`, Execution Environment).
9. **The local Windows CRAP check is advisory-only** — it must print as non-blocking and must not be documented as a blocking CI mirror until cross-platform acceptance (Task 1.2) establishes that Windows-vs-Linux-baseline comparisons are reliable.

## Goal

CI computes per-function CRAP scores for the whole Rust workspace from the existing `cargo llvm-cov` lcov and gates them against a reviewed Linux baseline: new functions must score ≤ 30; existing functions must not regress beyond epsilon 0.01 (whole-function, repo-wide — explicitly accepted as stricter than patch-scoped). TypeScript gains a McCabe cyclomatic-complexity lint (warn, max 15, test files exempt from that rule only) and Rust gains clippy `cognitive_complexity` enabled workspace-wide (threshold 30; measured 0 violations today). The gate's blind spots (closures, macros, cfg-dead code) are documented wherever the gate is documented.

## Scope

- **M1 (Phase 0, advisory)**: pinned cargo-crap 0.6.1 in `ci.yml` with binary cache keyed on exact version+OS+arch; non-blocking JSON report step AFTER Codecov uploads with elapsed-time echo, producer provenance, and best-effort artifact upload; acceptance probes on a draft scratch PR (closure scoring, cfg-dead code, Linux path matching, repeatability across two freshly regenerated coverage runs, test-helper exclusion decision); `scripts/normalize-crap-baseline.mjs` (standalone, self-tested: Windows+Linux roots, slash conversion, outside-repo rejection in baseline mode, duplicate function names; preserves parsed non-path values; no rounding); reviewed advisory-only merge checkpoint (Task 1.4), including CI self-test wiring and any required analyzer exclusions; canonical post-merge master Linux baseline committed at `ci/crap-baseline.json` with durable production-time provenance in `ci/crap-baseline.provenance.md` (Task 1.5); explicit user approval recorded before any M2 task starts (Task 1.6).
- **M2 (Phase 1, gating)**: `scripts/check-crap-gate.mjs` (Node .mjs styled after `check-diff-coverage.mjs`; distinct exit codes pass=0 / policy-fail=1 / input-or-tool-fail=2; missing or invalid input FAILS in CI; emits GitHub annotations from the same delta JSON; `--self-test` covering new functions above and exactly at 30, regressions above and exactly at epsilon, improvements, moved/renamed/ambiguous entries, missing/malformed/incompatible reports, built on captured real 0.6.1 delta shapes); gated CI step placed after Codecov uploads; pre-commit step requiring fresh same-run lcov with explicit "CRAP check skipped" notice when cargo-crap is absent (no auto-install; advisory-only on Windows); baseline-maintenance policy + whole-function repo-wide wording + blind-spot disclosure in `docs/best-practices/CI_BEST_PRACTICES.md`, `.agents/skills/ci-gate-diagnosis/`, and short root `CLAUDE.md` pointers.
- **M3 (Phase 2, lints)**: root `clippy.toml` with `cognitive-complexity-threshold = 30` and **no `msrv` key** (documented as removing an obsolete setting, not declaring an MSRV); delete `src-tauri/.clippy.toml`; `[workspace.lints.clippy]` `cognitive_complexity = "warn"` in root `Cargo.toml` (blocking in CI via the existing `-D warnings`) plus `[lints] workspace = true` in all three member crates; `eslint.config.js` `complexity: ["warn", { max: 15, variant: "classic" }]` with a per-file override disabling only that rule for `*.test.ts(x)`/`*.spec.ts(x)` and durable documentation of the temporary non-blocking exception in `docs/best-practices/FRONTEND_BEST_PRACTICES.md`; `vitest.config.ts` `coverage.reportOnFailure: true` in its own scoped commit; CHANGELOG entry under Unreleased / Internal.
- **M4**: cleanup and final verification.

## Non-Goals

- TypeScript CRAP (no verified mature tool; ESLint CC + Codecov patch LINE coverage are independent controls, not an equivalent per-function CRAP check — per agreed scope).
- SonarCloud lcov import (separate work; requires scanner access to lcov files, not just a property).
- Lizard, SARIF upload lane, `--duplicates` analysis.
- Refactoring the 18 legacy offenders (grandfathered via the baseline; metrics identify review candidates, not proven defects — per scope agreement).
- Per-offender TODO entries. Optionally ONE separate follow-up TODO ("command-layer testability and coverage") may be proposed via todo-manager **after user approval** — not a task of this plan.
- The `prosemirror-dedup.test.ts` timeout fix (removed from this plan per scope agreement; handle separately after confirming the cause).
- Any change to Codecov or SonarCloud gate configuration.

## Assumptions

- `cargo install cargo-crap --version 0.6.1 --locked` works on the Ubuntu CI runner (verified on Windows: 2m19s from source; CI binary cache makes it once-per-version).
- cargo-crap 0.6.1's delta-JSON shape is stable while the version is pinned; policy-script self-tests use fixtures captured from real 0.6.1 runs (Task 2.1).
- The Windows-measured 18 legacy offenders carry over to Linux in similar magnitude; cfg-gated platform code will shift some entries — the Task 1.5 Linux baseline is authoritative and the Windows census is planning-grade only.
- ESLint `warn` without `--max-warnings 0` is non-blocking in `bun run lint` — accepted temporary exception until promotion to `error` (documented in Task 3.3).
- Plan and baseline files are committed per repo convention (`docs/plans/` tracked; `ci/` to be created as tracked).

## Open Questions

- None — all eight design questions were resolved in the scope-agreement round with the coding agent (tab wK:t4, 2026-10-10); the resolutions are reflected in Scope, Non-Goals, and Hard Constraints above.

## Milestones

### Milestone 1: Phase 0 — advisory CRAP report + canonical Linux baseline

- Status: TO BE DONE
- Purpose: prove the toolchain end-to-end on Linux CI without gating anything, and produce the reviewed baseline M2 gates against.
- Exit Criteria: the M1 advisory PR (Task 1.4) is merged and its master CI run produces the report artifact; acceptance probes document closure, cfg-dead-code, path-matching, and numeric repeatability behavior; `ci/crap-baseline.json` + `ci/crap-baseline.provenance.md` committed — Linux-produced, normalized (`--for-baseline` rejects outside-repo paths), probe-free, with the test-helper exclusion list applied; **Task 1.6 approval gate passed**: user reviewed the Linux results (unexplained coverage mismatches, runtime cost, repeatability) and the explicit approval is recorded in the Decision Log before any M2 task starts.

#### Task 1.1: Pin cargo-crap + advisory CI step

- Status: TO BE DONE
- Depends On: none
- Objective: CI `test` job produces a best-effort cargo-crap JSON report artifact that can never fail the job or interfere with Codecov uploads, with elapsed time and producer-root provenance echoed.
- Steps:
  1. In `.github/workflows/ci.yml` test job, add a binary-cache step modeled on lines 175–184: path `~/.cargo/bin/cargo-crap`, key including exact version + OS + arch (e.g. `cargo-crap-Linux-x86_64-v0.6.1`); install step `cargo install cargo-crap --version 0.6.1 --locked` guarded on cache miss. BOTH steps carry `continue-on-error: true` — advisory means non-blocking for ALL failure modes (install, analysis, metric), not just "no fail flags".
  2. AFTER the Codecov uploads (line 215+), add a step with `if: always()` and `continue-on-error: true` that times (`date +%s` start/end echo) and runs `cargo crap --workspace --lcov src-tauri/lcov.info --format json --sort file --missing pessimistic --epsilon 0.01 --output crap-report.json`; NO `--fail-above` / `--fail-regression` flags. Placement after Codecov means even a hard step crash cannot affect the uploads.
   3. Add `actions/upload-artifact` with `if: always()` AND `if-no-files-found: ignore` for `crap-report.json` (`always()` cannot upload a report that was never generated — e.g. an earlier test failure skipped the llvm-cov step — so the upload must tolerate absence). In the best-effort report step, write `crap-report.provenance.txt` AT PRODUCTION TIME with the producer root (`$GITHUB_WORKSPACE`), analyzed source commit SHA (including a PR merge SHA when applicable), CI run ID/URL, runner OS/architecture, actual `rustc --version`, cargo-crap/cargo-llvm-cov/nextest versions, exact coverage command/configuration and analyzer flags/exclusions, and UTC date/time. Include the provenance file in the artifact; Tasks 1.3 and 1.5 consume it without guessing runner facts later.
  4. Add narrow `.gitignore` entries for `crap-report.json`, `crap-delta.json`, `crap-report.provenance.txt` (NOT currently ignored — local runs would dirty `git status`).
- Validation: a workflow run shows the new steps green with a downloadable artifact containing per-function entries for all three crates, the elapsed-time echo, and the provenance file. On a scratch PR with a deliberately failing test: Codecov uploads still occur; the CRAP step is skipped-or-errored without changing the job conclusion beyond the test failure; the artifact step completes via `if-no-files-found: ignore` (absence of the report is acceptable when coverage never ran — this validation asserts job flow and uploads, NOT artifact presence, which is impossible to guarantee on the failure path).
- Notes: affects `.github/workflows/ci.yml` and `.gitignore`; keep step names greppable (e.g. "CRAP report (advisory)").

#### Task 1.2: Acceptance probes on a scratch branch

- Status: TO BE DONE
- Depends On: 1.1
- Objective: empirically document cargo-crap's behavior for the three known blind spots plus score repeatability, on Linux, before any gate exists.
- Steps:
  1. Create a scratch branch and open it as a DRAFT PR targeting master (NEVER merged): `ci.yml` triggers on `push`/`pull_request` for master — ordinary branch pushes to other refs do not run the workflow, so probes need a PR to execute on Linux CI. Add probe functions — (a) a low-complexity function whose real logic lives in a closure (mimicking `with_unlocked_db(|db| ...)`), (b) a function under `#[cfg(target_os = "macos")]` containing branches (dead on Linux), (c) a mixed covered/uncovered function as sanity control.
   2. Let the draft PR's CI run the advisory step; record: does the closure body affect the enclosing function's CC/CRAP? Does the cfg-dead function report 100% coverage or go missing? Do probe files path-match in the Linux lcov? Also record whether confirmed test-helper sources that cargo-crap's default excludes miss (e.g. `config/tests.rs`-style files — the Windows census showed two such files among the 4 unmatched) appear in the Linux report; if so, define the consistent `--exclude`/`--allow` list HERE, before baseline production. Apply it to the analyzer commands in Task 1.4 before merging and verify that scope in Task 1.5; use the same list in the Task 2.2 CI gate and local report commands.
  3. Repeatability with a NUMERIC criterion: regenerate coverage TWICE (two fresh runs — comparing the same lcov twice only proves parsing determinism), run cargo-crap on each, parse both JSON reports and compute max |CRAP_a(f) − CRAP_b(f)| over all shared function identities; requirement: max delta ≤ 0.01 AND identical function sets. A textual diff alone does not establish epsilon compliance.
  4. Record all findings in this plan's `## Execution Notes` and mirror them into the proposal doc's Phase-0 section (findings only — no probe data into the baseline).
- Validation: written findings answer all probe questions including the test-helper exclusion decision; repeatability reports a numeric max-delta ≤ 0.01 with identical function sets (otherwise documented and the plan goes BLOCKED); probe isolation proven via `git merge-base --is-ancestor <each-probe-commit> origin/master` exiting NON-ZERO for every probe commit (exit 1 = not an ancestor = PASS; any other non-zero code is a command error, not a pass — read the specific exit code, never branch on "non-zero").
- Notes: probe code is disposable; the draft PR is closed, never merged. If repeatability fails, M2's gate design is invalid — mark BLOCKED and write a Decision Log entry immediately.

#### Task 1.3: `scripts/normalize-crap-baseline.mjs`

- Status: TO BE DONE
- Depends On: 1.1
- Objective: standalone Node script converting cargo-crap JSON report paths to repo-relative forward-slash form, preserving all parsed non-path values exactly.
- Steps:
  1. Write `scripts/normalize-crap-baseline.mjs`: input = cargo-crap `--format json` report + `--root <producer-workspace-root>` (the runner root recorded in Task 1.1's `crap-report.provenance.txt` — when normalizing on Windows, the script cannot guess the Linux producer's root, so it MUST be supplied explicitly); output = same JSON schema/version with all path fields (function locations AND retained diagnostics) repo-relative with forward slashes; scores, thresholds, and function identities untouched; NO rounding of any numeric field (gate inputs must not be lossy).
  2. Handle: absolute paths under the producer root (strip root + slash conversion), already-relative paths (slash-normalize only), repeated function names within one file (preserve order/identity — no dedup), and paths OUTSIDE the producer root: in `--for-baseline` mode REJECT them (non-zero exit listing offenders) — the all-relative baseline is a hard constraint, so outside-repo paths must fail baseline production rather than persist as absolute; in plain report mode keep them absolute with a stderr warning.
  3. Add `--self-test` following the `scripts/check-diff-coverage.mjs` convention (`package.json:23`) with inline fixtures covering every case in step 2 (Windows roots, Linux roots, outside-root rejection, duplicates, already-relative); add a `package.json` script entry following the `coverage:self-test` naming precedent. Scripts-only `package.json` edits add no dependencies: verify `bun.lock` and `package-lock.json` remain byte-identical (no sync-lockfiles run needed) and `nix/package.nix` `npmDepsHash` untouched (it changes only when `package-lock.json` does).
- Validation: `node scripts/normalize-crap-baseline.mjs --self-test` exits 0; round-tripping a real Task 1.1 report (supplying its provenance root) yields identical parsed scores, thresholds, and function counts (parsed-JSON comparison excluding path fields); a seeded outside-root path makes `--for-baseline` exit non-zero with the offender listed.
- Notes: pure path/syntax transformation — must not filter, sort, or re-score entries.

#### Task 1.4: M1 merge checkpoint (advisory-only PR to master)

- Status: TO BE DONE
- Depends On: 1.1, 1.2, 1.3
- Objective: the advisory infrastructure is reviewed and merged to master, because the canonical baseline can only come from a master CI run — master does not have the advisory step until this merge lands.
- Steps:
   1. Open the M1 PR containing: advisory CI step + binary cache and production-time provenance capture (Task 1.1), normalizer script + self-test + `package.json` entry (Task 1.3), `.gitignore` additions, and a lint-job CI step running `node scripts/normalize-crap-baseline.mjs --self-test` (script self-tests are outside ESLint's `src` scope and Vitest excludes `scripts/**` — without explicit wiring the normalizer could rot silently). Apply any test-helper analyzer exclusions decided in Task 1.2 to the report command before merging; record the exact exclusion list with the report provenance so Task 1.5 receives an already correctly scoped report.
  2. User review; merge to master. This merge IS the checkpoint — no canonical master artifact can exist before it.
- Validation: the M1 PR is green (advisory step + normalizer self-test visible in the run) and merged; the subsequent master CI run produces the report artifact.
- Notes: the PR is advisory-only — nothing gates, nothing can fail beyond what already could.

#### Task 1.5: Canonical Linux baseline `ci/crap-baseline.json`

- Status: TO BE DONE
- Depends On: 1.4
- Objective: reviewed, normalized, Linux-produced baseline committed with durable provenance.
- Steps:
  1. From the post-merge **master** CI run (never the probe branch), download `crap-report.json` and `crap-report.provenance.txt`.
   2. Verify that the downloaded report was generated with the test-helper analyzer exclusion list decided in Task 1.2 and applied in Task 1.4 (if any). Run the normalizer with `--root <producer-root-from-provenance>` and `--for-baseline`. The normalizer must NOT apply analyzer exclusions or filter entries. If provenance is incomplete or the analyzer scope differs, obtain a new correctly scoped master CI report; do not regenerate the canonical report on Windows or infer missing producer facts.
  3. Review: function count (≈630 expected), crappy count, zero probe entries, spot-check worst offenders against the Windows census (platform-code differences acceptable, unexplained mismatches are not).
   4. Commit `ci/crap-baseline.json` in a DEDICATED commit/PR together with the durable provenance sidecar `ci/crap-baseline.provenance.md`. Copy the producer facts captured AT PRODUCTION TIME in Task 1.1: source commit SHA, CI run ID/URL, runner OS/architecture and workspace root, actual `rustc --version` (CI selects stable — do NOT assume the local 1.95 toolchain), cargo-llvm-cov + nextest versions, exact coverage command/config, cargo-crap version + flags/exclusions, and UTC date/time. Also record the normalization command and review outcome. Provenance is committed with the baseline here, not deferred to M2 docs.
- Validation: `node -e "JSON.parse(require('fs').readFileSync('ci/crap-baseline.json','utf8'))"` succeeds; grep of the baseline for backslashes and absolute-root patterns (`/home/`, drive letters) finds nothing (grep exiting 1 on no-match is the PASS signal here — state that explicitly when running it); no Task 1.2 probe function name appears; the sidecar contains every required producer fact and agrees with the downloaded provenance, including the runner's actual rustc version and exclusion list.
- Notes: Hard constraint 3 applies from day one: the baseline changes only via dedicated reviewed commits.

#### Task 1.6: M1→M2 approval gate

- Status: TO BE DONE
- Depends On: 1.5
- Objective: explicit user go/no-go for enabling blocking checks, based on actual Linux results.
- Steps:
  1. Present to the user: Task 1.2 probe findings (closure scoring, cfg-dead code, path matching, numeric repeatability), the Task 1.5 baseline review summary (counts, worst offenders, any unexplained mismatches), CI runtime cost measured in Task 1.1, and the exclusion list decided in 1.2.
  2. Ask for explicit approval to enable the blocking gate; record the decision as a `## Decision Log` entry (approval, or plan BLOCKED with reason).
- Validation: a dated Decision Log entry names this task and records the user's explicit approval to enable blocking checks. Only affirmative approval completes Task 1.6; refusal or pending approval leaves M2 blocked. Task 2.1 depends on completion of Task 1.6, and no M2 task may start before approval.
- Notes: this task exists because milestone prose alone does not constrain the dependency graph — Task 2.1 hard-depends on it.

### Milestone 2: Phase 1 — CRAP policy gate

- Status: TO BE DONE
- Purpose: convert the advisory report into a blocking, correctly-scoped gate with a local advisory mirror and full documentation.
- Exit Criteria: Linux CI fails on a seeded new function with CRAP > 30 and on a seeded regression of an existing function, and the policy script exits 0 on unchanged code in that canonical CI environment; artifacts still upload when the gate fails; Codecov uploads unaffected; pre-commit prints a clearly labeled advisory CRAP verdict locally (explicit skip notice when the tool is missing or has the wrong version), without requiring local policy exit 0 against the Linux baseline; docs state the gate mechanics, the whole-function repo-wide policy, the baseline-update rules, and the blind spots; M1→M2 user approval recorded in the Decision Log.

#### Task 2.1: `scripts/check-crap-gate.mjs` + self-tests

- Status: TO BE DONE
- Depends On: 1.6
- Objective: small policy interpreter over cargo-crap delta JSON: fail on new functions with CRAP > 30 or existing functions regressed beyond epsilon 0.01; never computes metrics itself.
- Steps:
  1. Write `scripts/check-crap-gate.mjs` styled after `check-diff-coverage.mjs`: args `--report <delta-json>` (from `cargo crap ... --baseline ci/crap-baseline.json --format json`), `--threshold 30`, `--epsilon 0.01`, `--self-test`.
  2. Exit codes: 0 = pass; 1 = policy violation; 2 = input/tool failure (missing file, malformed JSON, schema/version incompatibility). In CI, missing/invalid input MUST exit 2 — never silently pass. Local optional-skip logic lives in the caller (Task 2.3), not here.
  3. Emit GitHub Actions annotations (`::error`/`::warning` with file/line from the delta JSON) for every offender so gate verdict and annotations come from the SAME data; print each offender as `file:line function CRAP old→new` on stdout.
   4. Capture real 0.6.1 delta-JSON fixtures (Task 1.5 baseline + seeded changes) and build `--self-test` coverage: new function above AND exactly at 30; regression above AND exactly at epsilon; improvements; moved/renamed/ambiguous entries; missing, malformed, and version-incompatible reports.
  5. Add a `crap:gate-self-test` entry to `package.json` following the `coverage:self-test` precedent.
- Validation: `node scripts/check-crap-gate.mjs --self-test` exits 0 on every supported local platform; against an unchanged tree with a fresh delta report the policy script exits 0 on Linux CI; against a deliberately seeded offender in that same environment it exits 1 with an accurate stdout list. Windows-versus-Linux baseline comparisons are advisory and are not required to exit 0.
- Notes: Hard constraint 7 — no metrics computation. Policy wording in all output: whole-function, repo-wide — explicitly stricter than patch-scoped, by decision.

#### Task 2.2: CI gating step

- Status: TO BE DONE
- Depends On: 2.1
- Objective: `ci.yml` runs cargo-crap against the committed baseline and gates via the policy script, without endangering Codecov uploads or artifacts.
- Steps:
   1. Add a step AFTER the Codecov uploads (line 215+): `cargo crap --workspace --lcov src-tauri/lcov.info --baseline ci/crap-baseline.json --format json --sort file --missing pessimistic --epsilon 0.01 --output crap-delta.json` (plus the analyzer exclusions recorded with the canonical baseline, if any), then `node scripts/check-crap-gate.mjs --report crap-delta.json`.
  2. Add a SEPARATE artifact-upload step for `crap-delta.json` placed AFTER delta generation and gate evaluation, with `if: always()` and `if-no-files-found: ignore` — extending the Task 1.1 upload step would execute before the delta file exists. Reports must survive gate failure.
  3. Wire `node scripts/check-crap-gate.mjs --self-test` into the ci.yml lint job (next to the normalizer self-test from Task 1.4) and into `scripts/pre-commit.js` as part of the comprehensive local check — otherwise the policy interpreter can regress without any test failure (ESLint targets `src` only; Vitest excludes `scripts/**`).
  4. Verify by seeded scratch PRs: gate failure does not prevent Codecov uploads (ordering) and both artifacts upload.
- Validation: scratch PR with a seeded new crappy function (> 30) fails the gate step with exit 1 and visible annotations; scratch PR with a seeded regression of an existing function fails; unchanged code passes with exit 0 **on Linux CI**; artifacts and Codecov uploads present in all three runs; the lint job visibly runs both script self-tests.
- Notes: do NOT add a second cargo-crap `--format github` pass unless the script's annotations prove insufficient; if added, its output must be visibly distinct from the gate verdict (scope agreement).

#### Task 2.3: Pre-commit advisory step

- Status: TO BE DONE
- Depends On: 2.1
- Objective: `bun run pre-commit` includes a CRAP check that requires fresh coverage, degrades loudly, and is advisory-only on Windows.
- Steps:
  1. In `scripts/pre-commit.js` after step 7 (lines 156–177): if `cargo crap --version` unavailable → skip with explicit warning "CRAP check skipped (install cargo-crap 0.6.1 for the local advisory check)" plus a `results.warnings` entry, mirroring the step-7 pattern at lines 176–177. No auto-install. If installed but the version is NOT 0.6.1 → also skip with an explicit version-mismatch notice (baseline comparability requires the pinned version; never silently gate on a different scorer).
  2. Freshness: run only when step 7 regenerated `src-tauri/lcov.info` in the SAME run (track the step result; a pre-existing file on disk is not fresh input).
  3. Run cargo-crap with `--baseline ci/crap-baseline.json` plus the policy script in ADVISORY mode: print the verdict, never fail the pre-commit run. This applies on Windows AND on non-Windows local machines for now — the baseline is Linux-CI-produced and cross-platform score comparability is only established for the CI environment itself (Task 1.2 findings); promoting any local platform to blocking is a documented follow-up decision, not part of this plan. Output states that the blocking comparison is Linux CI.
- Validation: `cmd.exe /c bun run pre-commit` on an unchanged local tree prints a clearly labeled advisory CRAP verdict and does not fail because the policy script returns 1 against the Linux baseline; policy exit 0 is NOT required locally. With cargo-crap removed from PATH the exact skip notice appears and the run continues; when step 7 did not regenerate lcov, the CRAP check refuses with a stale-input notice.
- Notes: Hard constraint 9 — never document this as a blocking mirror of CI.

#### Task 2.4: Policy + docs

- Status: TO BE DONE
- Depends On: 2.2, 2.3
- Objective: the gate, its whole-function policy, baseline-maintenance rules, and blind spots are documented where devs and agents look.
- Steps:
  1. `docs/best-practices/CI_BEST_PRACTICES.md`: new "CRAP gate" section — mechanics; policy (new functions ≤ 30; existing functions no regression beyond epsilon 0.01; whole-function repo-wide, explicitly stricter than patch-scoped); baseline-update rules (dedicated reviewed commits; reviewed improvements and identity updates permitted; unexplained score increases prohibited; policy-only enforcement acceptable initially); provenance requirements; blind-spots paragraph (closures unscored — incl. `with_unlocked_db(|db| ...)`; macros unexpanded; cfg-dead spans may show 100%; `--missing pessimistic` mandatory in CI, `skip` for diagnosis only).
  2. `.agents/skills/ci-gate-diagnosis/SKILL.md`: add failure recipes (gate exit 1 → read stdout offender list / delta JSON artifact; exit 2 → input/tool problem; all-0% table → path mismatch, see cargo-crap troubleshooting). Edit ONLY `.agents/` (Hard constraint 5), then `cmd.exe /c bun run sync-skills`.
  3. Root `CLAUDE.md`: short pointers only (Verification Commands: `node scripts/check-crap-gate.mjs --self-test`; one gotcha-style line pointing at CI_BEST_PRACTICES) per `docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md`.
- Validation: the three files contain the new sections (grep anchors); `cmd.exe /c bun run sync-skills` exits 0 without DRIFT; the CLAUDE.md diff is pointers only — no copied tables.
- Notes: no `website/docs-src/` change — this is a dev/CI gate, not a user-facing feature (scope agreement).

### Milestone 3: Phase 2 — complexity lints + adjacent fix

- Status: TO BE DONE
- Purpose: cyclomatic/cognitive complexity lints active in both languages with measured-zero legacy debt, plus the coverage-reporting fix discovered during verification.
- Exit Criteria: `cargo clippy --workspace --all-targets -- -D warnings` green with `cognitive_complexity` enabled and a positive control proving the wiring live; `bun run lint` emits complexity warnings without failing; test files exempt from the complexity rule only; a failing test run still writes lcov; CHANGELOG updated.

#### Task 3.1: Root `clippy.toml`, delete `src-tauri/.clippy.toml`

- Status: TO BE DONE
- Depends On: none
- Objective: one workspace-level clippy config with the cognitive threshold; obsolete crate-local file removed entirely.
- Steps:
  1. Create root `clippy.toml` containing `cognitive-complexity-threshold = 30`. NO `msrv` key — write a Decision Log entry recording that this removes an obsolete setting (`src-tauri/.clippy.toml` had `msrv = "1.75"` matching no declared policy) and does NOT declare an MSRV.
  2. Delete `src-tauri/.clippy.toml` (no pointer file — a leftover could silently take precedence over the root config for the app crate).
- Validation: the clippy invocation itself completes successfully (cargo exit 0 — establish this BEFORE interpreting absent warnings; a crashed run also produces no warnings) and its output contains no `jrnl.rs:342` warning (26 ≤ 30; the previous 26/25 warning is gone — this check passes by producing no matching output, so grep exiting 1 on no-match is the PASS signal; read it explicitly, never branch on bare non-zero); `git ls-files` filtered for `*clippy.toml` lists exactly one entry, the root `clippy.toml` (scoped to tracked project files — a recursive filesystem search would also hit `target/` and dependency directories).
- Notes: clippy reads config from the linted package directory upward — root placement covers all three crates (this is precisely why the old `src-tauri/` file never applied to `crates/*`).

#### Task 3.2: Enable `cognitive_complexity` workspace-wide

- Status: TO BE DONE
- Depends On: 3.1
- Objective: the nursery lint is genuinely enabled for all three crates and enforced by existing CI via `-D warnings`.
- Steps:
  1. Root `Cargo.toml`: add `[workspace.lints.clippy]` with `cognitive_complexity = { level = "warn", priority = -1 }` (nursery lints need explicit per-lint opt-in — verify the mechanism enables the lint without pulling in the rest of the nursery group; if per-lint nursery opt-in is rejected by the toolchain, record the alternative in the Decision Log before proceeding).
  2. Add `[lints]` + `workspace = true` to ALL THREE members: `src-tauri/Cargo.toml`, `crates/mini-diarium-core/Cargo.toml`, `crates/mini-diarium-crypto/Cargo.toml` (without this the workspace table is inert — scope agreement).
  3. Confirm no pre-existing `[lints]` tables conflict (exploration verified none exist).
- Validation: `cargo clippy --workspace --all-targets -- -D warnings` exits 0 (measured 0 violations at threshold 30); POSITIVE CONTROL: temporarily set threshold 25 in root `clippy.toml` → the `jrnl.rs:342` warning appears → wiring proven live → restore 30 and re-verify green.
- Notes: `warn` level is deliberate — `-D warnings` in CI (ci.yml:72) and pre-commit step 8 (scripts/pre-commit.js:195) already make it blocking (scope agreement Q4).

#### Task 3.3: ESLint `complexity` rule

- Status: TO BE DONE
- Depends On: none
- Objective: TS/JSX functions linted for McCabe cyclomatic complexity; test files exempt from that rule only.
- Steps:
  1. `eslint.config.js`: add `complexity: ["warn", { max: 15, variant: "classic" }]` to the base rules block.
  2. Add a config override for `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx` setting ONLY `complexity: "off"` — all other rules stay active for tests.
   3. Write a Decision Log entry: warn is intentionally non-blocking today (`lint` script has no `--max-warnings 0`); promotion to `error` is a follow-up once the warning backlog burns down — documented temporary exception to CI guidance (scope agreement).
   4. Update `docs/best-practices/FRONTEND_BEST_PRACTICES.md` with durable guidance for this temporary exception: classic complexity max 15 runs at `warn`, `bun run lint` has no `--max-warnings 0`, and complexity warnings therefore do not block CI or the comprehensive local check. Test files are exempt from ONLY the complexity rule; other lint errors remain blocking. Promotion to `error` requires a separate decision after reviewing the measured warning backlog. Link to the CI guidance rather than duplicating its general lint policy.
- Validation: `cmd.exe /c bun run lint` exits 0 while printing complexity warnings; the warning count and top files are captured in `## Execution Notes` (expect hot spots `DiaryEditor.tsx`, `EditorToolbar.tsx`, `BackupsPanel.tsx` per SonarCloud data — but THIS run is the calibration measurement, not Sonar's file totals); a scratch test file containing a high-CC function produces NO complexity warning while still producing other lint errors when seeded; the `FRONTEND_BEST_PRACTICES.md` diff states the temporary non-blocking exception, test-only rule exemption, and separate promotion decision.
- Notes: exclude tests from the complexity rule ONLY (scope agreement Q6/5).

#### Task 3.4: `coverage.reportOnFailure: true` (own scoped commit)

- Status: TO BE DONE
- Depends On: none
- Objective: Vitest writes a fresh `coverage/lcov.info` even when tests fail; this reporting fix does not replace the caller's freshness checks.
- Steps:
  1. `vitest.config.ts` coverage block (lines 17–36): add `reportOnFailure: true`.
  2. Commit as its own scoped commit (scope agreement: included, but not mixed into feature commits).
- Validation: create a disposable scratch test with a failing assertion (a missing `--testNamePattern` is NOT a failing test). Delete ONLY the generated `coverage/lcov.info` before the forced-failure run, verify it is absent, then record the run-start UTC timestamp. Run `cmd.exe /c bun run test:coverage` and verify a non-zero test exit with the scratch assertion shown as failed. Require that `coverage/lcov.info` was recreated by this run: it exists and its UTC last-write timestamp is NEWER than the recorded run-start timestamp. Mere file existence does not pass. Remove only the disposable scratch test, then run normal coverage again; require exit 0 and a newly written lcov. Do not revert unrelated source or user changes.
- Notes: complements — does not replace — Task 2.3's freshness requirement. The `prosemirror-dedup` timeout fix is explicitly OUT of this plan.

#### Task 3.5: CHANGELOG entry

- Status: TO BE DONE
- Depends On: 2.2, 2.4, 3.2, 3.3, 3.4
- Objective: the new gates/lints are recorded per repo convention.
- Steps:
   1. Add entries under `### Internal` in the Unreleased section of `CHANGELOG.md` following the existing template: CI CRAP gate for Rust (advisory→gated), clippy `cognitive_complexity` enabled workspace-wide, ESLint `complexity` rule, Vitest `reportOnFailure` fix. These changes are developer-only; do not place them under user-facing Added/Fixed/Changed sections.
- Validation: the `CHANGELOG.md` diff shows the entries under Unreleased / Internal in the established format.
- Notes: none.

### Milestone 4: Cleanup And Final Verification

- Status: TO BE DONE
- Purpose: ensure the repository contains only intentional final artifacts and the complete change is verified.
- Exit Criteria: intermediate artifacts removed, every `## Pre-flight Checks` item passes, and Task 4.2 final verification passes (including Linux CI policy exit 0 and the successful local advisory analysis). After these criteria pass and task/milestone statuses are reconciled, set Plan Status to COMPLETED; that status change is the consequence of verification, not a prerequisite.

#### Task 4.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Depends On: 2.2, 2.3, 3.5
- Objective: remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree: scratch probe branch deleted (never merged); stray local `crap-report.json`/`crap-delta.json` files removed (gitignored, but confirm none got staged); no leftover temp fixtures beyond the scripts' inline self-tests; no debug logging added to `pre-commit.js`.
   2. Keep: `ci/crap-baseline.json`, `ci/crap-baseline.provenance.md`, the two new scripts and their self-tests, docs updates, this plan file, the proposal doc.
- Validation: worktree diff contains only intended final changes; `git branch --list` shows no scratch branch; `git status --porcelain` shows no unintended `??` entries.
- Notes: do not remove user-provided files or unrelated worktree changes.

#### Task 4.2: Final Verification

- Status: TO BE DONE
- Depends On: 4.1
- Objective: validate the integrated change after cleanup.
- Steps:
   1. Regenerate both lcov files using the frontend/backend coverage commands in `## Context For A Clean Session`, requiring successful test runs, then run every item in `## Pre-flight Checks` against those fresh inputs.
   2. Local advisory dry run from repo root: run `cargo crap --workspace --lcov src-tauri/lcov.info --baseline ci/crap-baseline.json --format json --sort file --missing pessimistic --epsilon 0.01 --output crap-delta.json` (plus any analyzer exclusions recorded with the canonical baseline), then `node scripts/check-crap-gate.mjs --report crap-delta.json`. Require cargo-crap analysis exit 0 and a valid fresh delta report. Capture and clearly label the policy verdict as ADVISORY: script exit 0 (no violations) OR exit 1 (reported violations) is acceptable locally; exit 2 is an input/tool failure and must be diagnosed, not counted as a successful analysis. In particular, Windows comparison against the Linux baseline does NOT require policy exit 0; platform differences are legitimate under Hard constraint 9. Run all three platform-independent self-tests locally (`coverage:self-test`, `crap:gate-self-test`, normalizer `--self-test`), requiring exit 0 for each.
   3. Confirm one green Linux CI run for a PR targeting master with the blocking gate active, on code without seeded offenders. Require the policy script to exit 0 in that canonical CI environment, both script self-tests to pass, and report artifacts plus Codecov uploads to be present. This is the REQUIRED blocking unchanged-code check; the local Windows advisory dry run cannot replace it.
- Validation: successful fresh coverage generation and all pre-flight commands exit 0; local analysis exits 0 and prints a clearly labeled advisory policy verdict (policy exit 0 or 1, never an unhandled input/tool failure); all three local self-tests exit 0; the Linux CI run is green with the blocking policy script exiting 0 and the new steps verified.
- Notes: known limitation — the gate does not see closure bodies or macro expansions (documented per Task 2.4). Do not promote the local advisory comparison to a blocking check as part of final verification.

## Project Gates

- `cmd.exe /c bun run type-check`
- `cmd.exe /c bun run lint`
- `cmd.exe /c bun run format:check` and `cargo fmt --all --check`
- `cmd.exe /c bun run test:run`
- `cargo test --workspace` (all three crates — `--manifest-path src-tauri/...` alone silently skips core/crypto)
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cmd.exe /c bun run coverage:diff` (after generating both lcov files — mirrors Codecov patch ≥ 80%)
- `cmd.exe /c bun run validate:locales`
- CHANGELOG entry required (root `CHANGELOG.md` exists)
- Scoped commits: one logical change per commit — dedicated commits at minimum for the baseline and provenance sidecar (Task 1.5) and `reportOnFailure` (Task 3.4); root `CLAUDE.md` Agent Workflow Rule 6
- Skills: edit only `.agents/skills/`, then `cmd.exe /c bun run sync-skills`
- Per-task completion checklist per `docs/best-practices/POST_TASK_BEST_PRACTICES.md`

## Pre-flight Checks

- [ ] `cmd.exe /c bun run type-check`
- [ ] `cmd.exe /c bun run lint`
- [ ] `cmd.exe /c bun run format:check`
- [ ] `cargo fmt --all --check`
- [ ] `cmd.exe /c bun run test:run`
- [ ] `cargo test --workspace`
- [ ] `cargo clippy --workspace --all-targets -- -D warnings`
- [ ] `cmd.exe /c bun run coverage:diff` (with both lcov files freshly generated)
- [ ] `node scripts/check-crap-gate.mjs --self-test`
- [ ] `node scripts/normalize-crap-baseline.mjs --self-test`
- [ ] `cmd.exe /c bun run sync-skills` (no DRIFT)
- [ ] `cmd.exe /c bun run validate:locales`

## Decision Log

Write an entry **before moving to the next task**, never retrospectively. An entry is required when implementation diverges from what this plan specifies, when a validation failure forces the plan to adapt, when an unplanned problem is found, or when a validation is deliberately deferred. No entry is needed when execution matches the plan.

### DEC-001 — Initial approval and separate blocking approval

- Date: 2026-10-10
- Task: 1.1
- Decision: The user's request to explore and then implement approves initial execution. It does not replace Task 1.6's separate approval after Linux acceptance. Execute Tasks 1.1 and 1.3 and the independent Tasks 3.1 to 3.4 first.
- Rationale: The dependency graph permits the independent lint work, but forbids all M2 work before Task 1.6.

### DEC-002 — Coverage upload failure path

- Date: 2026-10-10
- Task: 1.1
- Decision: Add `if: always()` to the two existing Codecov upload steps, without changing their inputs or gate configuration.
- Rationale: Current uploads use the default success condition, so they do not run after a failed test. Task 1.1 explicitly requires upload attempts on that path. The CRAP cache and install can also run after uploads, so their runtime cannot delay coverage uploads.

### DEC-003 — Verify relative baseline comparison before M2

- Date: 2026-10-10
- Task: 1.2
- Decision: Include an unchanged-code comparison against a normalized report in Linux acceptance. Do not assume absolute current paths match the committed relative baseline.
- Rationale: Installed cargo-crap 0.6.1 `src/delta.rs:150–179` normalizes slashes but does not remove producer roots. Exact matches include file, function, and line; fallback name matching can be ambiguous. Resolve the comparison approach from real reports before M2 implementation.

## Final Verification

Task 4.2: successful fresh coverage generation, the full pre-flight list, all three platform-independent local script self-tests (exit 0), and a successful local CRAP analysis with a clearly reported ADVISORY policy verdict. Local policy exit 0 is NOT required: exit 1 may reflect legitimate platform differences against the Linux baseline; exit 2 is an input/tool failure to diagnose. The REQUIRED blocking unchanged-code check is a green Linux CI PR run with the gating step active and the policy script exiting 0. Complete verification before setting Plan Status to COMPLETED.

## Approval Gate

Approved by the user on 2026-10-10: “Do an exploration on the plan … Then implement it.” The additional M1→M2 gate still requires explicit user approval after review of the Linux acceptance results. No M2 task may start before that approval.

## Plan Self-Check

```
$ python "C:\Users\Francisco\.config\opencode\skills\manual-planning\scripts\check-plan.py" "docs/plans/2026-10-10-crap-complexity-gates-plan.md"
W001 warning 0: Tracking says tracked but git does not track this file
0 error(s), 1 warning(s)
```

Run: 2026-10-10 (fresh check after applying the remaining plan-review fixes)

Checker exit code: 2 (warnings only).

W001 is accepted: `docs/plans/` is a tracked directory by repo convention (an existing plan is committed there), so `Tracking: tracked` is the correct stamp; the file itself is not yet `git add`-ed because the research session that produced this plan does not commit (exploration-mode guardrail). The executing session commits the plan as its first action after approval, which resolves the warning.

## Execution Notes

- Update milestone and task status before starting and after validation (`plan-status.py <plan> set <id> "<STATUS>"`).
- Task numbering is not execution order; follow `Depends On` (e.g. Tasks 3.1/3.3/3.4 can start before Milestone 1 finishes).
- Record here as they arise: Task 1.2 probe findings and repeatability diffs; Task 3.3 ESLint warning counts and top files; any CI runtime measurements from Task 1.1.
- Write `## Decision Log` entries **before starting the next task** whenever execution diverges, an unplanned problem is found, or a validation is deferred — never retrospectively.
