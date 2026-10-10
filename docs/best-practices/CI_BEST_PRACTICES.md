# GitHub CI Best Practices

Language-agnostic guidelines for GitHub Actions workflows. Applicable to any repo type.

---

## Triggers & Branch Strategy

- **CI runs on `push` + `pull_request` to `master`/`main` only** — avoids noisy runs on feature branches
- **Releases trigger on `v*.*.*` tags** — keeps the release pipeline separate from CI
- **Post-release automations trigger on `release: [published]`** — decouples store/registry publishing from the build pipeline. Use `[released]` instead to exclude pre-releases
- **Add `workflow_dispatch` to release automations** — enables manual re-runs without re-tagging

```yaml
# CI
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

# Release
on:
  push:
    tags:
      - 'v*.*.*'

# Post-release automation (e.g. publish to package registry)
on:
  release:
    types: [published]   # or [released] to exclude pre-releases
  workflow_dispatch:     # manual trigger as fallback
    inputs:
      tag:
        description: 'Release tag (e.g. v1.2.3)'
        required: true
```

---

## Permissions (Least Privilege)

- **Default `contents: read`** on every workflow — explicit minimum
- **Elevate only where needed**: `contents: write` + `pull-requests: write` only on release workflows
- **Never use write permissions globally** — scope elevated permissions to the job that needs them

```yaml
# Top of every workflow file
permissions:
  contents: read

# Override per-job only where needed
jobs:
  publish:
    permissions:
      contents: write
      pull-requests: write
```

---

## Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true   # CI: cancel superseded runs on the same branch
  # cancel-in-progress: false  # Release: never cancel mid-deploy
```

- **CI**: cancel in progress — fast feedback, no wasted runner time
- **Release**: never cancel — a partial release is worse than a slow one

---

## Job DAG (Dependency Ordering)

Structure jobs so expensive work is gated behind cheap, fast-failing work:

```
lint ──┐
       ├─→ build (per platform) ──→ e2e / integration tests
test ──┘
```

- **Gate builds behind lint + test** — catch cheap failures before spending minutes on platform builds
- **E2E / integration tests depend only on the artifact they need** — decouple from unrelated slow builds

```yaml
jobs:
  lint:
    ...
  test:
    ...
  build:
    needs: [lint, test]
    ...
  e2e:
    needs: build
    ...
```

---

## Caching Strategy

**Lock-file keyed cache for package managers:**

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('package-lock.json') }}
    restore-keys: ${{ runner.os }}-npm-
```

- **Key on the lockfile hash** — cache busts automatically when deps change
- **Add `restore-keys` fallback** — a partial cache hit is better than a cold start
- **Always install with a frozen/locked flag** to prevent silent dep drift:

```bash
npm ci                          # npm
yarn install --frozen-lockfile  # yarn
bun install --frozen-lockfile   # bun
pip install --require-hashes    # pip
```

**Caching external tools:**

```yaml
- uses: actions/cache@v4
  id: cache-my-tool
  with:
    path: ~/.local/bin/my-tool
    key: my-tool-v1.2.3-${{ runner.os }}  # bump this key when upgrading

- name: Install my-tool
  if: steps.cache-my-tool.outputs.cache-hit != 'true'
  run: <install command>
```

- **Pin tools to a specific version** in the cache key, with a comment to bump it on upgrade
- **Only install if cache missed** — skip install entirely on a hit
- **Disable caching for large release artifacts** (e.g. LTO/optimized builds) that are non-incrementally reusable
- **Pin `bunx`/`npx` invocations to an exact version** matching the lockfile (e.g. `bunx playwright@1.61.1 install`), not a bare package name. A bare name resolves to whatever the registry serves today, which SonarCloud flags as `githubactions:S8543` (installing unverified releases). Bump the pin alongside the corresponding dependency in `package.json`. **Bump the cache-key suffix in the same commit** — if only `package.json`/the lockfiles move, CI installs the previous release's browser build while the test runner resolved from `node_modules` expects the new revision, and the job fails with `Executable doesn't exist at .../chromium_headless_shell-<revision>` (the cache `restore-keys` partial-hit hides the staleness because the install step still runs on a suffix miss).
- **Never use `curl -L`/`--location` in CI downloads** (SonarCloud `githubactions:S6506`, former hotspot, flags every redirect-following `curl` invocation — and does **not** recognize `--proto-redir` as a mitigation). For GitHub release URLs (which 302 to a signed `release-assets.githubusercontent.com` URL), resolve the redirect manually with a HEAD request, assert the resolved URL is HTTPS, then GET it directly:

  ```bash
  URL="https://github.com/OWNER/REPO/releases/download/V/TARBALL"
  FINAL="$(curl -fsSI -o /dev/null -w '%{redirect_url}' "$URL")"
  case "$FINAL" in https://*) ;; *) echo "not HTTPS: $FINAL" >&2; exit 1 ;; esac
  curl -fsS -o /tmp/file "$FINAL"
  ```

---

## Dependency Management (Dependabot)

```yaml
version: 2

updates:
  - package-ecosystem: npm       # or pip, maven, gradle, go, etc.
    directory: /
    schedule:
      interval: weekly
      day: monday                # batch on a fixed day, not random noise
    open-pull-requests-limit: 10
    groups:
      dev-dependencies:
        dependency-type: development
      prod-dependencies:
        dependency-type: production

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:           # batch non-breaking updates together
        update-types:
          - minor
          - patch
```

- **Group minor + patch** (via `update-types`) — one PR for all non-breaking updates
- **Separate prod/dev into different groups** — different risk profiles, different review urgency
- **Set `open-pull-requests-limit`** — prevents a PR flood during ecosystem churn
- **Pin schedule to a specific day** — predictable, batched instead of continuous noise
- **Always include `github-actions`** as an ecosystem to keep action versions current

---

## Matrix Builds

```yaml
strategy:
  fail-fast: false    # a macOS flake shouldn't abort Windows
  matrix:
    include:
      - os: ubuntu-latest
        platform: linux
      - os: macos-latest
        platform: macos
      - os: windows-latest
        platform: windows
```

- **Use `fail-fast: false`** — one platform failure should not cancel others
- **Use explicit `include:` objects with named keys** — more readable than bare OS names
- **Gate platform-specific steps on named keys** (`if: matrix.platform == 'linux'`) rather than `runner.os`

---

## Artifact Passing Between Jobs

```yaml
# Producer job:
- uses: actions/upload-artifact@v4
  with:
    name: app-linux-binary
    path: dist/app
    if-no-files-found: error   # or 'ignore' for optional artifacts

# Consumer job (needs: producer):
- uses: actions/download-artifact@v4
  with:
    name: app-linux-binary
    path: dist/
- run: chmod +x dist/app  # restore executable bit — upload strips it
```

- **Upload the minimum needed** — binary only (not the full build dir) for fast inter-job handoff
- **`if-no-files-found: error`** for required artifacts; `ignore` for optional ones
- **Restore executable bit** after downloading binaries on Linux/macOS — it is stripped on upload

---

## Release Pipeline Safeguards

1. **Validate release notes before doing anything** — fail at `create-release`, not at publish
2. **Create release as `draft: true` first** — gate publishing behind an asset verification job
3. **Verify all expected assets exist before publishing** — explicit checklist per platform
4. **Generate SHA256 checksums** per artifact and upload them alongside the artifacts
5. **Automate post-publish cleanup** (changelog stubs, version files) via automated PR — never direct-commit to `master`

Release job order:
```
create-release (draft) → build-release (matrix) → publish-release (verify assets → publish)
```

**Validate release notes example:**

```yaml
- name: Validate release notes
  run: |
    if [ ! -f release-notes.md ] || ! grep -q '[^[:space:]]' release-notes.md; then
      echo "release-notes.md is missing or empty"
      exit 1
    fi
    if grep -q 'REPLACE BEFORE TAGGING' release-notes.md; then
      echo "release-notes.md still contains placeholder text"
      exit 1
    fi
```

---

## Secret Hygiene

- **Validate required secrets at job start** — fail with a clear message, not a cryptic 401/403

```yaml
- name: Verify token is configured
  run: |
    if [ -z "${{ secrets.MY_PUBLISH_TOKEN }}" ]; then
      echo "MY_PUBLISH_TOKEN is not set. Add it at Settings → Secrets → Actions."
      exit 1
    fi
```

- **Scope secrets to the minimum job** — publish tokens only in the publish job, not the build job
- **Use `github.token` for intra-repo operations** — only add PATs for cross-repo operations (e.g., pushing to another repo, updating a Homebrew tap)

---

## Linting in CI

Run all static checks in a **single `lint` job** to share toolchain and cache overhead:

- **Formatter** — `--check` mode only, never auto-fix in CI
- **Linter** — treat warnings as errors
- **Type checker**
- **Generated artifact verification** — lockfiles, generated code, diagrams

```yaml
- name: Format check
  run: prettier --check .         # or: black --check, gofmt -l, etc.

- name: Lint
  run: eslint . --max-warnings 0  # or: flake8, golint-ci run, etc.

- name: Type check
  run: tsc --noEmit               # or equivalent

- name: Verify generated files are up-to-date
  run: |
    make generate
    git diff --exit-code          # fails if generated output changed
```

---

## Local Pre-commit Hook

CI is the safety net, but a fast local hook catches style violations on the developer's machine before they ever push. The hook must stay **fast** (sub-second-to-low-seconds, scoped to staged files only) so it doesn't slow the commit cycle. Anything heavier (type-check, lint, tests, coverage) belongs in CI or a manual `pre-commit` script, not in the hook.

In this repo, `.githooks/pre-commit` runs Prettier on staged `src/**/*.{ts,tsx,css}` files and `cargo fmt` on staged `src-tauri/**/*.rs` files. It is activated automatically by setting `git config core.hooksPath .githooks`, which `scripts/install-hooks.js` does as the `postinstall` step of `bun install`. Manual install: `bun run hooks:install`. Bypass for a single commit: `git commit --no-verify`.

The hook is a complement to CI, not a replacement: it runs `--write`/auto-fix locally, while CI uses `--check` to fail on drift.

---

## Test Runner Ownership

**Every test file must belong to a runner that a gate executes.** A test file that no runner collects never fails, so it reports nothing when the code it covers breaks. It looks like protection, but it gives none.

- **Map each test location to one runner** — and map each runner to the CI job and the local gate that execute it
- **Exclude a path from one runner only when another runner owns it** — an exclude (for example, of a tooling folder) is a common way for tests to become orphans
- **Fail the build on orphans** — a cheap guard lists the tracked test files and fails when a file matches no runner's include rules. Keep its rules next to the runner configs and change both together
- **Pass explicit file lists to a runner when its directory or glob handling differs across versions or shells** — a pattern that silently matches nothing is a passing gate with zero tests
- **Fail a runner that finds zero tests** — an empty run must not report success

---

## Coverage Gating

Don't discover coverage failures only on CI. A global coverage threshold (e.g. "≥70% overall") catches gross regressions but misses the two checks coverage services actually enforce on PRs:

- **Patch coverage** — new/modified lines in the diff must be ≥ N% covered (typically 80%).
- **Project regression** — total coverage must not drop vs the base branch.

Both are computed from the diff against the base branch, so a suite that passes a global floor can still fail them. Mirror them locally with the same coverage artifact CI uploads (lcov) plus the diff against the merge-base:

```bash
# Compute patch coverage over new/changed lines, fail below threshold
diff-cover coverage/lcov.info --compare-branch=origin/main --fail-under=80
```

- **Reuse the exact lcov CI uploads** — local and CI numbers then match
- **Compare against the merge-base**, not `HEAD`, so only PR-side changes count
- **Run it as a pre-push gate**, not every commit — full coverage runs are slow
- **Surface uncovered new lines as `file:line`** so the fix is actionable, not just a percentage

> Mini Diarium: `bun run coverage:diff` (`scripts/check-diff-coverage.mjs`) implements this gate dependency-free over both `coverage/lcov.info` and `src-tauri/lcov.info`; threshold defaults to 80 to match `codecov.yml`. See root `CLAUDE.md` Gotcha #6.

---

## Rust CRAP Reports (Phase 0, Advisory)

The CI `test` job runs pinned `cargo-crap 0.6.1` after both Codecov upload attempts. It reuses successful same-run workspace coverage from `src-tauri/lcov.info`. Cache, install, analysis, and artifact upload failures are non-blocking. The `crap-report` artifact contains the JSON report and production-time provenance, including source commit, run URL, producer root, runner, tool versions, coverage command, analyzer flags, configuration, and UTC time. Analysis time is printed even on failure. If backend coverage did not succeed, analysis is explicitly skipped; a provenance-only artifact is not a usable baseline.

There is **no blocking CRAP gate yet**. Linux acceptance, a reviewed post-merge master baseline, and separate user approval must come first. No local report is a canonical baseline. Analysis retains the default exclusions and adds `--exclude '**/tests.rs' --exclude '**/test_support.rs'` for confirmed test-only sources. Record the same scope in provenance and verify it before baseline production; do not filter functions in the normalizer.

The normalizer changes paths only. Use the root from the report's provenance, not the machine that downloads it:

```powershell
node scripts/normalize-crap-baseline.mjs --input crap-report.json --root <producer-root> --for-baseline --output <normalized-report.json>
node scripts/normalize-crap-baseline.mjs --self-test
```

Baseline mode refuses paths outside that root, including diagnostic paths. It retains function order, duplicate names, schema, and all parsed numeric values without rounding. A canonical baseline must come from probe-free master Linux CI and must be committed with its production provenance in a dedicated reviewed change. Do not raise a baseline inside a feature change to make that change pass.

Limits of this analyzer: closure branches do not increase cyclomatic complexity, including `with_unlocked_db(|db| ...)`, although closure lines can affect coverage; macros are not expanded; cfg-dead function spans in matched files can show 100% coverage. Keep `--missing pessimistic` in CI. `skip` is for diagnosis only. A green report is not proof that these paths have tests. cargo-crap 0.6.1 also does not align relative baseline paths with absolute current paths; direct comparison can falsely mark repeated function names as new. Path alignment needs its own Linux acceptance control before a gate is added. See the [implementation plan](../plans/2026-10-10-crap-complexity-gates-plan.md) for the remaining acceptance and approval checks.

---

## CI vs Release Build Profiles

Use environment variables to tune build behavior — don't maintain separate config files:

```yaml
# CI job: faster iteration, validates correctness but not peak performance
- name: Build
  env:
    NODE_ENV: test
    BUILD_MODE: development     # or equivalent flag for your toolchain

# Release job: full optimization — omit the overrides, use production defaults
- name: Build
  # no env overrides — defaults from config files apply
```

The principle: CI builds should be fast enough to give quick feedback; release builds should be fully optimized. Control this through env vars at the job level.

---

## Debugging Failures

Add **conditional failure-only debug steps** — they run only on failure and dump internal state without cluttering normal logs:

```yaml
- name: Debug build failure
  if: failure() && matrix.platform == 'macos'
  run: |
    echo "=== Build logs ==="
    find . -name "*.log" -newer package.json -exec cat {} \;
```

Useful for: build tool scripts, generated configs, temp directories that vanish after the run.

---

## Auto-fix Steps

Some jobs can compute their own fix (a refreshed hash, a regenerated file). Treat such a step as a check first, a fixer second:

- **Fail the job when the fix cannot land.** A job that found a problem stays red until the fix is on the branch.
- **Never `exit 0` after an unchecked `git push`.** Branch protection, a race with another push, or a missing permission rejects the push; the job must not report success after that.
- **Prefer "fail and print the fix" over pushing to a protected branch.** Emit an `::error` annotation and a `$GITHUB_STEP_SUMMARY` entry that contains the exact fix, and let a human commit it. The job then needs only `contents: read`.

```yaml
- name: Build
  run: |
    set -o pipefail
    BUILD_EXIT=0
    ./build.sh 2>&1 | tee build.log || BUILD_EXIT=$?
    if [ "$BUILD_EXIT" -ne 0 ]; then
      # `|| true`: no match is normal; under `bash -e` + pipefail it would end the step early.
      FIX=$(grep -oE 'expected: [^ ]+' build.log | head -1 || true)
      echo "::error::Build failed. ${FIX:-See the log above.}"
      echo "Build failed. ${FIX:-See the job log.}" >> "$GITHUB_STEP_SUMMARY"
    fi
    exit "$BUILD_EXIT"
```

A push made with the default `GITHUB_TOKEN` also does not trigger new workflow runs, so an auto-fix commit is not verified automatically. If a job pushes anyway, arrange a separate check (a manual `workflow_dispatch` run or the next qualifying push).

---

## Step Output Passing

Prefer `$GITHUB_OUTPUT` over `echo ::set-output` (deprecated) and environment variables for passing values between steps:

```yaml
- name: Get version
  id: version
  run: echo "value=${GITHUB_REF#refs/tags/v}" >> "$GITHUB_OUTPUT"

- name: Use version
  run: echo "Building version ${{ steps.version.outputs.value }}"
```

Use `$GITHUB_ENV` to export environment variables across subsequent steps in the same job:

```yaml
- name: Set build env
  run: echo "BUILD_DATE=$(date -u +%Y-%m-%d)" >> "$GITHUB_ENV"
```
