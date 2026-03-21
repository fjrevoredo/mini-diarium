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
  run: eslint . --max-warnings 0  # or: flake8, golangci-lint, etc.

- name: Type check
  run: tsc --noEmit               # or equivalent

- name: Verify generated files are up-to-date
  run: |
    make generate
    git diff --exit-code          # fails if generated output changed
```

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
