# Flatpak CI Validation

## Metadata

- Plan Status: READY FOR APPROVAL
- Created: 2026-05-21
- Last Updated: 2026-05-21
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Add a Flatpak build validation job to the existing `ci.yml` workflow so that Flatpak compilation issues, dependency vendoring problems, manifest path errors, and AppStream metadata issues are caught on every PR before merge — not after the release PR is created on the Flathub repo. This makes Flatpak fixes cheap (pre-merge) instead of expensive (post-release PR deletion and re-release).

## Scope

- Add a new `flatpak` job to `.github/workflows/ci.yml`
- Generate `cargo-sources.json` and `node-sources.json` as CI steps (these are generated artifacts, not committed files)
- Use the official `flatpak/flatpak-github-actions/flatpak-builder@v6` action with the `gnome-50` container image
- Build for `x86_64` only initially (aarch64 can be added later)
- Job runs on all pushes and PRs to `master`
- Job is required (blocking) — PRs cannot merge if Flatpak build fails
- Skip bundle creation (`build-bundle: false`) for speed — we only validate the build succeeds
- Enable `.flatpak-builder` caching for faster subsequent runs
- Validate desktop file with `desktop-file-validate` before the build (fail fast)
- Validate AppStream metainfo with `appstreamcli validate` before the build (fail fast)

## Non-Goals

- Do NOT change the Flathub release publish workflow (`flathub-publish.yml`)
- Do NOT commit `cargo-sources.json` or `node-sources.json` to the repo
- Do NOT add aarch64 support in this plan (separate follow-up)
- Do NOT change the local Flatpak manifest (`flatpak/io.github.fjrevoredo.mini-diarium.yml`) — the existing `type: dir` with `path: ..` works correctly for CI
- Do NOT run Flatpak tests inside the sandbox (no `run-tests: true`)
- Do NOT change the existing `build-linux`, `build-other`, `lint`, `test`, or `e2e` jobs

## Assumptions

- The `ghcr.io/flathub-infra/flatpak-github-actions:gnome-50` container image is available and contains `flatpak`, `flatpak-builder`, Python 3, and Node.js
- The `flatpak/flatpak-github-actions/flatpak-builder@v6` action is the current stable release (v6.7 is latest)
- The local manifest's `type: dir` source with `path: ..` resolves correctly when the manifest is at `flatpak/io.github.fjrevoredo.mini-diarium.yml`
- `package-lock.json` is kept in sync with `bun.lock` (pre-release checklist already covers this)
- GitHub Actions `ubuntu-latest` runners have Python 3 and Node.js available for source generation
- The `flatpak-builder-tools` repo at `https://github.com/flatpak/flatpak-builder-tools.git` is accessible
- CI timeout of 60 minutes is sufficient for a full Flatpak build (runtime download + SDK extensions + npm tarball downloads + build)
- The `flatpak` job depends on `lint` and `test` passing first (same as `build-linux` and `build-other`)

## Open Questions

- None

## Milestones

### Milestone 1: Add Flatpak CI Job to ci.yml

- Status: TO BE DONE
- Purpose: Create the new `flatpak` job with source generation and flatpak-builder execution.
- Exit Criteria: The `flatpak` job is defined in `ci.yml`, runs on PRs/pushes to master, generates vendored sources, and invokes flatpak-builder successfully.

#### Task 1.1: Add the flatpak job to ci.yml

- Status: TO BE DONE
- Objective: Add a new `flatpak` job to `.github/workflows/ci.yml` that validates the Flatpak build on every PR.
- Steps:
  1. Open `.github/workflows/ci.yml` for editing.
  2. Add a new job `flatpak` after the existing `build-other` job (or at an appropriate position in the job graph).
  3. Configure the job with:
     - `name: Flatpak (x86_64)`
     - `runs-on: ubuntu-latest`
     - `needs: [lint, test]` (same dependency as other build jobs)
     - `timeout-minutes: 60`
     - Container: `image: ghcr.io/flathub-infra/flatpak-github-actions:gnome-50` with `options: --privileged`
   4. Add steps:
      a. `actions/checkout@v6` — checkout the repo
      b. Clone `flatpak-builder-tools` — `git clone --depth=1 https://github.com/flatpak/flatpak-builder-tools.git /tmp/flatpak-builder-tools`
      c. Install Python deps for cargo generator — `pip install aiohttp toml tomlkit`
      d. Generate `cargo-sources.json` — run `flatpak-cargo-generator.py` against `src-tauri/Cargo.lock`
      e. Generate `node-sources.json` — run `flatpak/generate-node-sources.mjs` against `package-lock.json`
      f. Validate desktop file — `desktop-file-validate data/linux/io.github.fjrevoredo.mini-diarium.desktop`
      g. Validate AppStream metainfo — `appstreamcli validate data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml`
      h. `flatpak/flatpak-github-actions/flatpak-builder@v6` with:
         - `manifest-path: flatpak/io.github.fjrevoredo.mini-diarium.yml`
         - `cache-key: flatpak-builder-${{ github.sha }}`
         - `build-bundle: false`
         - `arch: x86_64`
         - `verbose: true`
- Validation: The YAML is syntactically valid (can be parsed by any YAML parser). The job definition matches the flatpak-builder action's documented inputs.
- Notes: The `build-bundle: false` flag skips the final `.flatpak` bundle creation, saving several minutes. The build still compiles and installs everything.

#### Task 1.2: Verify job placement in the CI dependency graph

- Status: TO BE DONE
- Objective: Ensure the flatpak job fits correctly into the existing CI job dependency graph.
- Steps:
  1. Review the full `ci.yml` to confirm:
     - `lint` and `test` jobs have no `needs` (they run first)
     - `build-linux` and `build-other` have `needs: [lint, test]`
     - `e2e` has `needs: build-linux`
     - The new `flatpak` job has `needs: [lint, test]` (parallel with `build-linux` and `build-other`)
  2. Confirm the `concurrency` group at the top of the workflow applies to the new job.
- Validation: The job graph is: `lint` + `test` → `build-linux` + `build-other` + `flatpak` (parallel) → `e2e` (after `build-linux`).
- Notes: The flatpak job does NOT need to wait for `build-linux` or `build-other`. It only needs lint and test to pass.

### Milestone 2: Update Documentation

- Status: TO BE DONE
- Purpose: Document the new Flatpak CI validation in the maintenance guide and AGENTS.md.
- Exit Criteria: `docs/FLATPAK_MAINTENANCE.md` and `AGENTS.md` reference the new CI validation job.

#### Task 2.1: Update FLATPAK_MAINTENANCE.md

- Status: TO BE DONE
- Objective: Add a section to `docs/FLATPAK_MAINTENANCE.md` describing the CI validation job.
- Steps:
  1. Open `docs/FLATPAK_MAINTENANCE.md`.
  2. Add a new section "CI Validation" (or update the "Current Automation Caveat" section) that explains:
     - The `ci.yml` workflow now includes a `flatpak` job that builds the Flatpak on every PR/push to master.
     - This catches build issues before release, not after the Flathub PR is created.
     - The job generates `cargo-sources.json` and `node-sources.json` on-the-fly (not committed).
     - If the CI Flatpak job fails, fix the issue in the main repo — do NOT wait for the Flathub PR.
  3. Update the "Current Automation Caveat" section to note that the CI job now provides pre-release validation.
- Validation: The document accurately describes the new CI behavior. No contradictions with existing content.
- Notes: This is a documentation-only change.

#### Task 2.2: Update AGENTS.md

- Status: TO BE DONE
- Objective: Add a note to `AGENTS.md` about the Flatpak CI validation job.
- Steps:
  1. Open `AGENTS.md`.
  2. In the "Command Registry" or "Testing" section, add a brief note that Flatpak builds are now validated in CI.
  3. Or add to the "Gotchas and Pitfalls" section: "Flatpak builds are validated in CI on every PR. If the flatpak job fails, fix the issue before merging — do not wait for the Flathub release PR."
- Validation: The AGENTS.md file references the new CI job.
- Notes: Keep it brief — agents should know that Flatpak issues are caught early.

### Milestone 3: Cleanup And Final Verification

- Status: TO BE DONE
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified.
- Exit Criteria: Intermediate artifacts are removed, all final verification passes, and the plan status is COMPLETED.

#### Task 3.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract.
- Validation: Worktree diff contains only intended final changes (`ci.yml`, `docs/FLATPAK_MAINTENANCE.md`, `AGENTS.md`).
- Notes: Do not remove user-provided files or unrelated worktree changes.

#### Task 3.2: Final Verification

- Status: TO BE DONE
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Validate the YAML syntax: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
  2. Verify the workflow triggers correctly by reviewing the `on:` block.
  3. Verify the flatpak-builder action inputs match the documented API.
  4. Run `cmd.exe /c bun run lint` to ensure no lint issues.
  5. Run `cmd.exe /c bun run format` to ensure formatting is correct.
- Validation: YAML parses without errors. All lint and format checks pass. The workflow file is syntactically and semantically correct.
- Notes: Cannot actually run the Flatpak build locally without `flatpak-builder` installed, but the YAML and action inputs can be validated.

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED or requesting final approval.
Fix all failures before proceeding.

- [ ] YAML syntax is valid for `.github/workflows/ci.yml`
- [ ] `bun run lint` passes
- [ ] `bun run format` passes
- [ ] `bun run type-check` passes
- [ ] The flatpak job definition matches the `flatpak-builder@v6` action API
- [ ] Documentation updates are consistent with existing content
- [ ] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/flatpak-ci-validation-plan.md`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] All open questions have been asked and answered by the user.
- [x] Tasks are grouped into milestones (6 tasks across 3 milestones).
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- The `flatpak-builder` action uses `flatpak/flatpak-github-actions/flatpak-builder@v6` — pin to `v6` tag, not a commit hash, for maintainability.
- If the `gnome-50` container image is not available, fall back to `gnome-48` and note the discrepancy.
- CI time estimate: ~15-30 minutes per run (runtime download + SDK extensions + npm tarball downloads + sandboxed build). First runs are slower; subsequent runs benefit from `.flatpak-builder` caching.
- The `build-bundle: false` flag is critical for keeping CI time reasonable — we only need to validate the build succeeds, not produce a distributable bundle.
- Desktop file and AppStream validation steps run BEFORE flatpak-builder to fail fast on metadata issues (~1 minute combined).
