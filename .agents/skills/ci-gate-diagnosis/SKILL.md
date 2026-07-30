---
name: ci-gate-diagnosis
description: Diagnose a failing SonarCloud quality gate or Codecov patch-coverage check on a Mini Diarium PR, and mirror the Codecov patch gate locally before pushing. Use when the "SonarCloud Code Analysis" check fails, when Codecov reports patch or project coverage below threshold, or when the user asks why CI coverage/duplication is red. Triggers: SonarCloud, quality gate, new_duplicated_lines_density, new_coverage, Codecov, patch coverage, coverage:diff, lcov, cargo-llvm-cov.
---

# CI gate diagnosis (SonarCloud + Codecov)

Two gates fail most often on Mini Diarium PRs. Both are diagnosable without logging into anything.

## SonarCloud quality gate — read the API, don't guess

When the "SonarCloud Code Analysis" check fails on a PR, the PR comment gives only a summary. To find which files are responsible, use the public API directly — no login required:

```bash
# Which condition failed and by how much
curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=fjrevoredo_mini-diarium&pullRequest=<PR>" | jq .

# Per-file breakdown (replace metric key as needed: new_duplicated_lines_density, new_coverage, etc.)
curl -s "https://sonarcloud.io/api/measures/component_tree?component=fjrevoredo_mini-diarium&pullRequest=<PR>&metricKeys=new_duplicated_lines_density,new_duplicated_lines&strategy=leaves&ps=50" | jq '.components[] | select(.measures[].value != "0.0") | {name: .name, measures: .measures}'
```

Common failures and their usual causes:

- **`new_duplicated_lines_density` > 3%**: copy-pasted test helpers or fixture objects — extract to a shared constant/function in the same file.
- **`new_coverage` < threshold**: new logic in a file that `generatePdfFromElement`-style functions (html2canvas/jsPDF) can't be tested in JSDOM — mock the module boundary instead.

Note: `website/**/*.html` is excluded from duplication detection — every new blog post would otherwise fail the gate.

## Codecov patch check — mirror it locally before pushing

CI uploads `coverage/lcov.info` (frontend) and `src-tauri/lcov.info` (backend) to Codecov, which enforces `patch ≥ 80%` (new/changed lines) and `project: auto` (no total regression) per `codecov.yml`.

**The Vitest thresholds in `vitest.config.ts` are a coarse frontend-only global floor and do NOT catch patch/project failures — you can pass locally and still fail Codecov.**

Run the local mirror:

```bash
cmd.exe /c bun run coverage:diff       # gate existing lcov files
cmd.exe /c bun run coverage:check      # generate coverage (--generate), then gate
cmd.exe /c bun run coverage:self-test  # parser self-test
```

`scripts/check-diff-coverage.mjs` consumes the same lcov files plus `git diff origin/master`, fails below 80%, and lists every uncovered new line as `file:line`. This mirrors the **patch** check (the most common CI failure); the **project** total-regression check needs a base-branch coverage baseline and is not replicated locally.

The gate also runs as step 9 of `bun run pre-commit` (via `--working-tree`, so it checks not-yet-committed changes against `origin/master`); that run generates both lcov files by running the frontend/backend tests with coverage.

Generating the lcov files by hand:

- **Frontend**: `bun run test:coverage`
- **Backend**: requires `cargo-llvm-cov` + `cargo-nextest` (`cargo install cargo-llvm-cov cargo-nextest --locked`), then from `src-tauri/`:
  `cargo llvm-cov nextest --workspace --lcov --output-path lcov.info`
  (`--workspace` so the `mini-diarium-core` and `mini-diarium-crypto` crates are covered; lcov still lands at `src-tauri/lcov.info`.)

Flags for `coverage:diff`: `--generate` (run both), `--base <ref>`, `--fail-under <pct>`, `--no-fail`, `--frontend`/`--backend`.

See [CI Best Practices → Coverage Gating](../../../docs/best-practices/CI_BEST_PRACTICES.md#coverage-gating).
