# Release Automation (TODO-0163)

## Metadata

- Plan Status: READY FOR APPROVAL
- Plan Format: manual-planning v2.1.0
- Template: milestoned
- Tracking: tracked (by user request)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Resume

<!--
Written by `plan-status.py resume`; do not edit by hand. Restart prompt: "Continue <plan> from
its Resume block". Stop: done | ask | gate | question | context | limit.
-->

- Updated: 2026-11-16 22:33 UTC
- State: Plan written and reviewed by GPT-6.1 Sol (codex); review findings applied. No implementation yet.
- Green / Red: not run
- Next runnable: 1.1, 1.2, 1.3, 2.1, 3.1
- Live environment: none
- Next IDs: Task 6.3; DEC-001
- Risks: push principal may not be a ruleset bypass actor (Task 3.1 checks it); Store Submission 12 must publish before 0.8.1
- Stop: ask — plan waits for maintainer approval

## Context For A Clean Session

- Repository: `D:\Repos\mini-diarium`, branch `master` (trunk-based, no feature branches),
  clean at `90b3d13` when this plan was written.
- Design source: [`docs/explorations/2026-11-15-release-automation.md`](../explorations/2026-11-15-release-automation.md).
  It defines phases P0-P6, the resume table, gaps G1-G14, and the "Work Needed Before the
  First Agent Release" table. Read its "Plan: Agent-Run Release (iteration 1)" section before
  Milestone 3 or 4. This plan implements that section; it does not repeat it.
- Backlog item: TODO-0163 in `docs/todo/TODO.md`.
- Stack: Node v24 (`node --version`), bun, Rust (cargo workspace), GitHub Actions. Shells on
  this machine: PowerShell tool and Git Bash. In Git Bash, `cmd.exe /c` needs
  `MSYS_NO_PATHCONV=1` (root `CLAUDE.md` → Execution Environment).
- Exact commands:
  - Script tests: `cmd.exe /c bun run test:scripts` (runs `node --test` on every
    `scripts/*.test.{js,mjs,cjs}`, `scripts/run-script-tests.mjs:1-16`)
  - Lint: `cmd.exe /c bun run lint`
  - Type-check: `cmd.exe /c bun run type-check`
  - Frontend tests: `cmd.exe /c bun run test:run`
  - Backend tests: `cargo test --workspace`
  - Full local gate: `cmd.exe /c bun run pre-commit`

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| `release.yml` points at a template file that does not exist | `LATEST_CHANGELOG_TEMPLATE: latest-changelog.example.md`; only `latest-changelog.template.md` is tracked | `.github/workflows/release.yml:17`, `git ls-files 'latest-changelog*'` |
| The template check is skipped when the file is absent | `if [ -f "$LATEST_CHANGELOG_TEMPLATE" ] && cmp -s ...` | `.github/workflows/release.yml:54` |
| `RELEASING.md` copies the missing file | `cp latest-changelog.example.md latest-changelog.md` | `docs/releasing/RELEASING.md:23,134` |
| The real version heading is under `# Versions`; a template block is above it | template `## [X.Y.Z] - dd-mm-YYYY/Unreleased` at line 8, `# Versions` at line 35, `## [0.8.1] - Unreleased` at line 37 | `grep -n '^# \|^## \[' CHANGELOG.md` |
| `pre-release` Step 1 already uses "first heading under `# Versions`" | — | `.agents/skills/runbooks/skills/pre-release/ENTRY.md:17` |
| `pre-release` asks at Step 5 and Step 7, and skips a broken `notifications.json` | — | `ENTRY.md:128` (Step 5), `ENTRY.md:161-170` (Step 7), `ENTRY.md:201,254` (skip) |
| `bump-version.ps1` hides a failed `cargo build` and does not check the `cargo check` exit code | `$null = cargo build --quiet 2>$null` then `cargo check` | `bump-version.ps1:71-73` |
| `bump-version.sh` falls back to `cargo check` | `cargo build --quiet 2>/dev/null \|\| cargo check --quiet` | `bump-version.sh:58` |
| Both bump scripts always prepend a metainfo `<release>` entry | — | `bump-version.ps1:103-109`, `bump-version.sh:102-115` |
| Bump "Next steps" staging lists are incomplete | — | `bump-version.ps1:216-218`, `bump-version.sh:203+`, `docs/releasing/RELEASING.md:143` |
| Website download links use `releases/latest/download` with a versioned file name | `.../releases/latest/download/Mini-Diarium-0.8.0-windows.exe` | `website/index.html:291,299,307` |
| Bump scripts rewrite only the file-name version in download links | regex `Mini-Diarium-\d+\.\d+\.\d+-(windows\.exe\|macos\.dmg\|linux\.AppImage)` | `bump-version.ps1:83,150`, `bump-version.sh:79-81,147` |
| `website-release-urls.sh` matches only `releases/latest/download` URLs | — | `scripts/website-release-urls.sh:15-17` |
| `nix.yml` prints `npmDepsHash is stale. Set it to <hash>` only when a `got:` line exists | — | `.github/workflows/nix.yml:41-57` |
| Runbooks are nested entries listed in the dispatcher table | `pre-release` at `skills/pre-release/ENTRY.md` | `.agents/skills/runbooks/SKILL.md` "Available Skills" table |
| `docs/plans/` is excluded locally | this plan needs `git add -f` | `.git/info/exclude:18` |

### Hard constraints

1. **Published releases and pushed tags are immutable.** Never edit, delete, re-tag, or
   re-run a published release — a changed release breaks checksums and channel manifests
   that already point at it.
2. **No network in the app.** Release scripts run only on the maintainer's machine or in CI
   and are never bundled — any import of them from `src/` or `src-tauri/` breaks the
   privacy guarantee (root `CLAUDE.md` → Security Rules).
3. **Helper scripts are read-only, except the Nix hash script, which edits only
   `nix/package.nix`.** A helper that commits, pushes, tags, or dispatches moves authority
   out of the runbook and past the stop points.
4. **Tests make no network calls.** Script tests use fixture JSON for `gh` output — a test
   that calls GitHub is flaky and needs credentials in CI.
5. **No agent attribution in commits** (no `Co-Authored-By`, no session footer) — the
   maintainer owns every commit.
6. **Implementation commits per milestone, no push.** The maintainer allowed one commit to
   `master` at the end of each milestone of this plan when its checks pass. Push happens
   only in the 0.8.1 release run (Milestone 5) or on request.

## Goal

On the maintainer's explicit request for one version, an agent runs a full Fenmark release
with the `release` runbook: from the `## [X.Y.Z] - Unreleased` CHANGELOG block to a final
report of every channel's state, stopping for approval before the tag push and at the
Coolify re-deploy. Version 0.8.1 is the first release run this way.

## Scope

- Release permission recorded in root `CLAUDE.md` and the "No Autonomous Commits" memory.
- G2: changelog template path and leftover-template checks in `release.yml` and
  `RELEASING.md`.
- G3: autonomous mode for the `pre-release` runbook.
- G6, G7: bump-script failure handling, `Cargo.lock` check, idempotent metainfo entry,
  correct staging lists.
- G9: version-pinned website download URLs.
- G4, G10: Node helper scripts for P0 preflight, the Nix hash correction, P5 verification
  (assets, checksums, release body, live site), and P6 channel status, with tests.
- The `release` runbook (P0-P6, resume, two stop points, Store guard at P4).
- A read-only test of the P0, P5 and P6 scripts against the published v0.8.0.
- The first agent-run release, 0.8.1.

## Non-Goals

- Merging the Flathub PR or the cleanup PR by agent (iteration 2).
- A Coolify deploy webhook or an `indexnow.yml` push trigger (iteration 2).
- A CI job that computes `npmDepsHash` (iteration 2).
- Partner Center automation or a Store status job; the P4 summary asks the maintainer.
- SignPath production certificate (TODO-0109) and macOS notarization (G13, G14).
- A fake version or a test tag to rehearse P1-P4.

## Assumptions

- The maintainer's Git credentials are a bypass actor on the `master` ruleset (Path A, G8);
  P0 checks the real push principal and stops if it is false or cannot be verified. Risk: a
  `GIT_SSH_COMMAND` agent key (global CLAUDE.md) maps to a deploy key or the `agent` user,
  not a bypass actor; then the run must push with the maintainer's own credentials.
- `gh` is logged in with access to `fjrevoredo/mini-diarium` (`gh auth status`).
- `cargo audit` is installed (`cargo audit --version`); if not, P0 reports it as a stop.
- Store Submission 12 (listing-only Fenmark rename) is published before 0.8.1 runs; the P4
  summary asks the maintainer to confirm that no Partner Center submission is pending,
  because CI `msstore publish` deletes pending submissions (`docs/releasing/RELEASING.md` →
  "Store listing edits and CI do not mix").

## Open Questions

None. Decided with the maintainer on 2026-11-16: 0.8.1 is the first agent release and waits
for all iteration-1 items; helper scripts are Node `.mjs` with tests; no extra stop before
the push to `master`; the Store guard is a confirmation in the P4 summary; the permission
goes in root `CLAUDE.md` and memory; this plan is committed; testing is read-only against
v0.8.0; implementation commits per milestone without push.

## Milestones

### Milestone 1: Permission And Changelog Fixes

- Status: TO BE DONE
- Purpose: Record the release authority and remove the two prompts and the silent template
  check that block an unattended `pre-release` run.
- Exit Criteria: `release.yml` and `RELEASING.md` name only `latest-changelog.template.md`;
  `pre-release` has an autonomous mode with no prompts; the permission rule is in root
  `CLAUDE.md` and memory; script tests and lint pass.

#### Task 1.1: Record The Release Permission

- Status: TO BE DONE
- Depends On: none
- Objective: Root `CLAUDE.md` → Agent Workflow Rules has a rule: an agent may commit, push to
  `master`, and push the release tag only for the one version that the maintainer explicitly
  asked to release, through the `release` runbook, with no agent attribution.
- Steps:
  1. Add the rule to root `CLAUDE.md` → "Agent Workflow Rules" (after rule 1). Name the
     runbook path `.agents/skills/runbooks/skills/release/ENTRY.md`.
  2. Update memory `feedback_no_commits.md` and its `MEMORY.md` line with the same exception.
- Validation: `grep -n "release runbook\|runbooks/skills/release" CLAUDE.md` prints the new
  rule; the memory file names the same exception.
- Notes: Follow `docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md` (pointer, not copy).

#### Task 1.2: Fix The Changelog Template Check (G2)

- Status: TO BE DONE
- Depends On: none
- Objective: `release.yml` validates `latest-changelog.md` against
  `latest-changelog.template.md`, and fails on a leftover an HTML comment opener or `<template>`.
- Steps:
  1. `.github/workflows/release.yml:17`: set `LATEST_CHANGELOG_TEMPLATE:
     latest-changelog.template.md`.
  2. In the validate step (`release.yml:38-62`), add a check that fails when
     `latest-changelog.md` contains an HTML comment opener or `<template>`.
  3. Read `latest-changelog.template.md` and confirm that a correctly filled body has no
     an HTML comment opener or `<template>`; if the template keeps comments by design, the check must match
     only what the pre-release Step 6 output can leave behind. Record the result.
  4. `docs/releasing/RELEASING.md:23,134`: use `latest-changelog.template.md`.
- Validation: `grep -rn "latest-changelog.example" .github docs/releasing` prints nothing
  (exit 1 is the pass); the new check run locally on a copy with an HTML comment opener exits non-zero and on
  the published v0.8.0 body (`git show v0.8.0:latest-changelog.md`) exits 0.
- Notes: Workflow change takes effect at the next tag; there is no dry run for `release.yml`.

#### Task 1.3: Add Autonomous Mode To pre-release (G3)

- Status: TO BE DONE
- Depends On: none
- Objective: `pre-release` runs without prompts when the `release` runbook calls it in
  autonomous mode, and stays interactive otherwise.
- Steps:
  1. In `.agents/skills/runbooks/skills/pre-release/ENTRY.md`, add an "Autonomous mode"
     section with the exploration's P2 defaults: Step 5 applies only mechanical fixes and
     lists the user-facing rewrites in the report; Step 7 always adds the notification.
  2. In autonomous mode, a missing or unparseable `public/notifications.json` is a STOP (not a
     skip). An existing `vX.Y.Z-release` entry is checked field by field (`version`,
     `summary`, `body`, `date`, `linkUrl`); a mismatch is a STOP.
  3. Update the Error Reference table (`ENTRY.md:243+`) for both modes.
- Validation: read the entry; every question-tool call in Steps 5 and 7 has an autonomous-mode
  alternative; `grep -n "Autonomous mode" .agents/skills/runbooks/skills/pre-release/ENTRY.md`
  prints the section.
- Notes: Interactive behavior must not change.

#### Task 1.4: Commit Milestone 1

- Status: TO BE DONE
- Depends On: 1.1, 1.2, 1.3
- Objective: Milestone 1 is one commit on `master`.
- Steps:
  1. Run `cmd.exe /c bun run lint` and `cmd.exe /c bun run test:scripts`.
  2. Add a `### Internal` line under `## [0.8.1] - Unreleased` in `CHANGELOG.md` for the
     release-automation work (one line, extended in later milestones).
  3. Commit: `chore(release): changelog template check and pre-release autonomous mode`
     (include this plan with `git add -f`).
- Validation: `git log -1 --stat` shows only the Milestone 1 files and the plan.
- Notes: No push.

### Milestone 2: Bump Scripts And Pinned Download URLs

- Status: TO BE DONE
- Purpose: Make the version bump fail loudly and run safely twice, and make the website
  download links independent of the deploy time.
- Exit Criteria: Both bump scripts exit non-zero on a cargo failure or a wrong `Cargo.lock`,
  never add a second metainfo entry, print a correct staging list, and write pinned URLs;
  the live-site URL helper reads pinned URLs.

#### Task 2.1: Harden The Bump Scripts (G7)

- Status: TO BE DONE
- Depends On: none
- Objective: `bump-version.ps1` and `bump-version.sh` fail when cargo fails or when
  `Cargo.lock` does not show `mini-diarium` at the new version, and skip an existing
  `<release version="X.Y.Z">` metainfo entry.
- Steps:
  1. `bump-version.ps1:68-75`: run `cargo check` (or `cargo update -p mini-diarium
     --offline` if it is enough to refresh the lock entry; verify on this machine) and stop on
     a non-zero exit code.
  2. `bump-version.sh:58`: the same, with `set -e`-safe error handling.
  3. Add to both validation blocks: the `Cargo.lock` `[[package]] name = "mini-diarium"`
     entry has `version = "X.Y.Z"`.
  4. Metainfo (`bump-version.ps1:103-109`, `bump-version.sh:102-115`): if `<release
     version="X.Y.Z"` exists, skip with a message; the later count check must be exactly 1.
- Validation: `pwsh -NoProfile -Command "[ScriptBlock]::Create((Get-Content bump-version.ps1
  -Raw)) | Out-Null"` and `bash -n bump-version.sh` both exit 0. Behavior is proven in
  Task 2.4, never by running the scripts in the implementation checkout.
- Notes: Never run a bump script in `D:\Repos\mini-diarium` during this plan: both scripts
  also stamp today's date into the website (`bump-version.ps1:79-80`, `bump-version.sh:67`),
  so a same-version run is not a no-op, and restoring whole files would discard Task 2.3
  edits in `website/index.html`.

#### Task 2.2: Correct The Staging Lists (G6)

- Status: TO BE DONE
- Depends On: 2.1
- Objective: The "Next steps" in both bump scripts and the staging lists in `RELEASING.md`
  name every file the release steps change, and say that the `release` runbook stages
  reviewed changes instead.
- Steps:
  1. List the files: version files, `Cargo.lock`, `website/index.html`,
     `website/encrypted-journal/index.html`, `README.md`, the metainfo file, `CHANGELOG.md`,
     `latest-changelog.md`, `public/notifications.json`, `package-lock.json`,
     `nix/package.nix`, `docs/todo/TODO.md`, `docs/todo/TODO_ARCHIVE.md`, generated
     `website/` output (`website/sitemap.xml`, `website/blog/*`, `website/docs/*`).
  2. Update `bump-version.ps1:216-218`, `bump-version.sh:203+`, and both staging blocks in
     `docs/releasing/RELEASING.md` (Path A at `:43-46` and the PR path at `:143`).
- Validation: read each of the four staging lists (two scripts, two `RELEASING.md` blocks)
  and confirm every file from step 1 is in it; `grep -n "encrypted-journal"` alone is not
  enough because it matches anywhere in the file.
- Notes: None.

#### Task 2.3: Pin The Website Download URLs (G9)

- Status: TO BE DONE
- Depends On: 2.1
- Objective: Website download links use `/releases/download/vX.Y.Z/Mini-Diarium-X.Y.Z-...`,
  and the bump scripts update both the tag and the file name.
- Steps:
  1. Find every download URL: `grep -rn "releases/latest/download" website docs README.md
     scripts` (include `website/docs-src/` and generated pages).
  2. Change `website/index.html:291,299,307` (and any other hits) to
     `releases/download/v0.8.0/Mini-Diarium-0.8.0-...`.
  3. Update the bump-script rewrite (`bump-version.ps1:83`, `bump-version.sh:79-81`) to
     accept either the legacy `releases/latest/download/Mini-Diarium-A.B.C-<platform>` or the
     pinned `releases/download/vA.B.C/Mini-Diarium-A.B.C-<platform>` form and always write the
     pinned form for the new version.
  4. Replace the validators (`bump-version.ps1:150`, `bump-version.sh:147-149`), which today
     accept zero matches: require exactly three download links (windows `.exe`, macOS
     `.dmg`, Linux `.AppImage`), each pinned, with tag version = file-name version =
     requested version; fail on a missing, extra, legacy, or mismatched link.
  5. Update `scripts/website-release-urls.sh:15-17` to match pinned URLs.
  6. Bump `HOMEPAGE_UPDATED` in `scripts/generate-website-blog.mjs` (website `CLAUDE.md`:
     content change on a static page), then run `bun run website:build-static` with the
     PowerShell tool.
- Validation: `grep -rn "releases/latest/download" website README.md scripts` prints nothing
  (exit 1 is the pass); each pinned v0.8.0 URL answers `302` (`curl -sI <url>`). Script
  behavior is proven in Task 2.4.
- Notes: Check `website/privacy/index.html` claims about external resources still hold (only
  GitHub links, no new host). The deployed site keeps `latest/download` links until the next
  Coolify re-deploy; Task 5.2 deploys the pinned page before the 0.8.1 tag.

#### Task 2.4: Prove The Bump Scripts In A Disposable Clone

- Status: TO BE DONE
- Depends On: 2.1, 2.2, 2.3
- Objective: Offline evidence that both bump scripts fail loudly, stay idempotent, and handle
  every download-link shape, without touching the implementation checkout.
- Steps:
  1. Commit nothing yet. Create `git clone --local --no-checkout D:\Repos\mini-diarium
     <TEMP>\bump-proof`, check out `HEAD`, and copy the edited working-tree files
     (`bump-version.ps1`, `bump-version.sh`, `website/index.html`) over it.
  2. Cargo failure: put a fake `cargo` (exits 1) first on `PATH`; each script must exit
     non-zero and name the cargo step.
  3. Wrong lock: a fake `cargo` that exits 0 and changes nothing; each script must exit
     non-zero on the `Cargo.lock` check.
  4. Success and idempotence: with real cargo, run each script for `9.9.9` twice on the same
     day. The first run must pass; the second run must exit 0 and leave the files
     byte-identical to after the first run (one `<release version="9.9.9"` entry).
  5. Link shapes: run against `index.html` variants for legacy input (converted to pinned),
     pinned input (updated), mismatched tag and file versions (fail), and zero links (fail).
  6. Delete the clone.
- Validation: record the exit code and the one-line result of each case with
  `plan-status.py note --task 2.4`; every case matches the expectation above.
- Notes: The clone is disposable; `9.9.9` exists only there, never as a tag or a commit in
  the real repository. Real cargo in the clone compiles from scratch (slow, offline-safe).

#### Task 2.5: Commit Milestone 2

- Status: TO BE DONE
- Depends On: 2.4
- Objective: Milestone 2 is one commit on `master`.
- Steps:
  1. Run `cmd.exe /c bun run lint` and `cmd.exe /c bun run test:scripts`.
  2. Extend the `CHANGELOG.md` `### Internal` line if needed.
  3. Commit: `chore(release): harden bump scripts and pin website download URLs`.
- Validation: `git log -1 --stat` shows only the Milestone 2 files.
- Notes: No push.

### Milestone 3: Helper Scripts

- Status: TO BE DONE
- Purpose: Read-only Node helpers that give the runbook machine-checked results for P0, P3
  (Nix), P5 and P6.
- Exit Criteria: Each script has unit tests on fixtures, prints a human summary and a
  `--json` result, exits 0 only on pass, and gives correct results against the live repo
  and the published v0.8.0 (Task 3.6).

#### Task 3.1: Shared Library And P0 Preflight

- Status: TO BE DONE
- Depends On: none
- Objective: `scripts/release-lib.mjs` (shared `gh`/`git` runners, CHANGELOG parser, result
  formatting) and `scripts/release-preflight.mjs --version X.Y.Z` that run every P0 check.
- Steps:
  1. CHANGELOG parser: the first `## [X.Y.Z] - Unreleased` heading **under `# Versions`**
     (skip the template block above it, `CHANGELOG.md:8` vs `:37`); it must equal
     `--version`.
  2. P0 checks from the exploration: clean tree, branch `master`, `HEAD` equals
     `git ls-remote origin refs/heads/master`; no local or remote tag `vX.Y.Z`; no GitHub
     release `vX.Y.Z` (draft or published); latest `ci.yml` push run for `HEAD` is green, and
     `nix.yml` if it ran; `gh auth status`; `cargo audit`; required secret names
     (`gh secret list`). Local commits ahead of `origin/master` are a named failure ("unpushed
     commits"), not a silent pass.
  3. Push authority (G8): resolve the principal that `git push` really uses — for an SSH
     remote, run `ssh -T git@github.com` with the same `GIT_SSH_COMMAND`/`core.sshCommand`
     Git uses and parse `Hi <login>!`; for HTTPS, the credential helper's login. Read the
     `master` ruleset bypass actors (`gh api repos/{owner}/{repo}/rulesets` and the ruleset
     detail) and pass only when that login is covered (for example a repository-admin role
     and `gh api repos/{owner}/{repo}/collaborators/<login>/permission` says `admin`). A
     deploy key, an agent key, or an unverifiable principal is a named failure. Never treat
     the `gh` login or `user.name`/`user.email` as push authority.
  4. Report-only data: open issues labeled P0/P1/bug, the unreleased CHANGELOG items.
  5. Tests in `scripts/release-lib.test.mjs` and `scripts/release-preflight.test.mjs` with
     fixture output (CHANGELOG with template block, run lists, secret list).
- Validation: `cmd.exe /c bun run test:scripts` passes; `node scripts/release-preflight.mjs
  --version 0.8.1` on the current tree reports each check (a dirty tree or unpushed commits
  are expected failures and must be named as such).
- Notes: No writes. Fixtures live next to the tests or under `scripts/fixtures/release/`.

#### Task 3.2: Nix Hash Helper (G4)

- Status: TO BE DONE
- Depends On: 3.1
- Objective: `scripts/release-nix-hash.mjs --sha <sha>` reads the `nix.yml` run for that SHA
  and reports one of: green, running, stale-hash (with the hash), real failure, no run. With
  `--apply` and a stale-hash result only, it writes the hash into `nix/package.nix`.
- Steps:
  1. Find the run by `headSha`; read the annotation `npmDepsHash is stale. Set it to <hash>`
     (`nix.yml:41-57`) from the run's check annotations or log.
  2. `--apply` edits only the `npmDepsHash = "...";` line and refuses any other result.
  3. Tests with fixtures for each result.
- Validation: tests pass; `node scripts/release-nix-hash.mjs --sha $(git rev-parse HEAD)`
  reports the current state.
- Notes: The runbook does the commit and push and allows one correction only.

#### Task 3.3: P5 Release Verification

- Status: TO BE DONE
- Depends On: 3.1
- Objective: `scripts/release-verify.mjs --version X.Y.Z` checks the GitHub release and,
  with `--live-site`, the website.
- Steps:
  1. Release: published (not draft); five installers and three checksum files by exact name;
     each installer size > 0; download all eight to a temp dir and check every installer
     against its checksum file; release body equals `git show vX.Y.Z:latest-changelog.md`.
  2. `--live-site`: `https://fenmark.app/` shows `app-version` X.Y.Z; every download URL on
     the page names `vX.Y.Z` and resolves (HTTP 302) to an asset of release `vX.Y.Z`;
     `https://www.fenmark.app/` redirects to `https://fenmark.app/`; the legacy
     `https://mini-diarium.com/` homepage answers 200 with the transition page (a link to
     `https://fenmark.app/`), and a legacy deep link (for example
     `https://mini-diarium.com/docs/`) answers 301 to the same path on `https://fenmark.app`
     (`website/nginx.conf:8-26`); `robots.txt` has no `Content-Signal` line (report only).
  3. Tests on fixtures (asset lists, checksum files, HTML snippets).
- Validation: tests pass.
- Notes: Temp downloads go to the OS temp dir and are deleted at exit.

#### Task 3.4: P6 Channel Status

- Status: TO BE DONE
- Depends On: 3.1
- Objective: `scripts/release-channels.mjs --version X.Y.Z` reports each channel as
  available, submitted/awaiting external review, awaiting maintainer, or failed.
- Steps:
  1. Find channel runs by workflow, event `workflow_dispatch`, branch `master`, and the `tag`
     input or log (not by branch `vX.Y.Z`); record run IDs.
  2. Evidence per channel (only fresh evidence may say "available"):
     - Homebrew: the tap's `Casks/mini-diarium.rb` shows X.Y.Z and the release sha256 →
       available.
     - WinGet: the `microsoft/winget-pkgs` PR merged → available; open → submitted.
     - Flathub: PR open → awaiting maintainer; PR merged → submitted until the public
       Flathub appstream API (`https://flathub.org/api/v2/appstream/io.github.fjrevoredo.mini-diarium`)
       lists release X.Y.Z → available.
     - Store: read the `msstore-publish.yml` run itself, because the parent dispatch step in
       `release.yml:391` is `continue-on-error`. A green run with a submission id means
       submitted; its status line is a snapshot taken during CI
       (`msstore-publish.yml:193`), never proof of publication. "Available" only on the
       maintainer's confirmation from Partner Center or the public listing.
  3. Find the `latest-changelog.md` cleanup PR.
  4. Tests on fixtures.
- Validation: tests pass, including a fixture where a historical Store "Certification"
  status still reports "submitted".
- Notes: Read-only.

#### Task 3.5: Package Scripts

- Status: TO BE DONE
- Depends On: 3.1, 3.2, 3.3, 3.4
- Objective: `package.json` has `release:preflight`, `release:nix-hash`, `release:verify`,
  `release:channels`.
- Steps:
  1. Add the four scripts.
  2. Run `node scripts/check-test-runners.mjs` so every new test file is inside a runner.
- Validation: `cmd.exe /c bun run release:preflight -- --help` prints usage.
- Notes: `package.json` change → no lockfile change expected; if one appears, use the
  `sync-lockfiles` skill.

#### Task 3.6: Read-Only Test Against v0.8.0

- Status: TO BE DONE
- Depends On: 3.5
- Objective: The P5 and P6 scripts give correct results for the published v0.8.0, and P0
  gives correct results for 0.8.1 on the current tree.
- Steps:
  1. `bun run release:verify -- --version 0.8.0`: expect pass (eight files, checksums match,
     body matches `git show v0.8.0:latest-changelog.md`).
  2. `bun run release:verify -- --version 0.8.0 --live-site`: expect the live-site check to
     report the current deploy truthfully (until Task 2.3 is deployed the URLs are not
     pinned; that must be reported, not crash).
  3. `bun run release:channels -- --version 0.8.0`: expect Homebrew available, WinGet
     available (#469106 merged), Flathub available if the appstream API lists 0.8.0 (PR #28
     merged), Store submitted (re-run attempt 2 of run `41544022537`; the maintainer confirmed
     publication on 2026-11-16, which the script must not infer by itself).
  4. `bun run release:preflight -- --version 0.8.1`: expect named failures only for the
     known state (for example unpushed Milestone 1-3 commits), and a correct push-authority
     result for this machine's real `git push` principal.
  5. Compare each result with the known facts; fix the script on any mismatch.
- Validation: each result matches the facts in step 3; record the outputs with
  `plan-status.py note --task 3.6`.
- Notes: Read-only; no tag, no release, no dispatch.

#### Task 3.7: Commit Milestone 3

- Status: TO BE DONE
- Depends On: 3.6
- Objective: Milestone 3 is one commit on `master`.
- Steps:
  1. Run `cmd.exe /c bun run lint` and `cmd.exe /c bun run test:scripts`.
  2. Commit: `feat(release): read-only release helper scripts`.
- Validation: `git log -1 --stat` shows only the Milestone 3 files.
- Notes: No push.

### Milestone 4: The release Runbook

- Status: TO BE DONE
- Purpose: One orchestrating runbook that runs P0-P6 with the helpers, the resume table, and
  the two stop points.
- Exit Criteria: `/runbooks release` loads the entry; the entry covers every phase and
  resume row of the exploration; `RELEASING.md` points to it.

#### Task 4.1: Write The release Runbook

- Status: TO BE DONE
- Depends On: 1.3, 2.1, 3.5
- Objective: `.agents/skills/runbooks/skills/release/ENTRY.md` implements the exploration's
  "Plan: Agent-Run Release (iteration 1)".
- Steps:
  1. Trigger and authority: explicit request for one version; reference the root
     `CLAUDE.md` rule from Task 1.1.
  2. Resume: the visible-state table; on resume, check the outputs of every skipped phase;
     never run the bump twice; record SHAs and run IDs.
  3. P0 `release:preflight`; P1 bump once + independent checks (five version files,
     `Cargo.lock`, one metainfo entry, both website pages); P2 `pre-release` in autonomous
     mode, then `sync-languages`, `validate:locales`, `website:build-static`, and the test
     gates; P3 review and stage only expected files (Task 2.2 list), commit
     `chore(release): X.Y.Z`, push, Nix loop with `release:nix-hash` (one correction),
     wait for green.
  4. P4 stop: show version, SHA, CI/Nix state, `latest-changelog.md`, open P0/P1 issues,
     philosophy notes, skipped style rewrites, known channel blockers, and the line
     "Confirm: no Partner Center submission is pending (CI deletes it)". Wait for "go";
     re-check remote SHA, tag and release absence; tag and push only the tag.
  5. P5: watch `release.yml`; inspect real state; re-dispatch only a missing channel after
     checking that no run exists; ask for the Coolify re-deploy; `release:verify`, then
     `release:verify --live-site` after "done"; dispatch `indexnow.yml`.
  6. P6: `release:channels`; final report in the exploration's format.
  7. Waiting: long waits run as background commands; no sleep loops.
  8. Register `release` in the `.agents/skills/runbooks/SKILL.md` table.
- Validation: `grep -n "| \`release\`" .agents/skills/runbooks/SKILL.md` prints the row;
  every resume row and phase P0-P6 of the exploration has a section in the entry (manual
  read against the exploration).
- Notes: Run `cmd.exe /c bun run sync-skills` if the mirror needs it; never edit
  `.claude/skills/` directly.

#### Task 4.2: Point The Docs At The Runbook

- Status: TO BE DONE
- Depends On: 4.1
- Objective: `RELEASING.md` describes the agent-run path, and the exploration says iteration 1
  is implemented.
- Steps:
  1. Add an "Agent-run release" section near `docs/releasing/RELEASING.md:30` ("Release
     Paths") that points to the runbook and lists the two stops and the Store confirmation.
  2. Update root `CLAUDE.md` → "Creating a Release" with one pointer line.
  3. Add a status line at the top of the exploration.
- Validation: `grep -n "runbooks release\|skills/release" docs/releasing/RELEASING.md CLAUDE.md`
  prints the pointers.
- Notes: None.

#### Task 4.3: Commit Milestone 4

- Status: TO BE DONE
- Depends On: 4.2
- Objective: Milestone 4 is one commit on `master`.
- Steps:
  1. Run `cmd.exe /c bun run lint` and `cmd.exe /c bun run test:scripts`.
  2. Commit: `docs(release): agent-run release runbook`.
- Validation: `git log -1 --stat` shows only the Milestone 4 files.
- Notes: No push.

### Milestone 5: First Agent Release (0.8.1)

- Status: TO BE DONE
- Purpose: Prove the runbook end to end on a real release.
- Exit Criteria: v0.8.1 is published by the runbook, the final report lists every channel's
  state, and no step needed an undocumented manual fix.

#### Task 5.1: Gate — Ready To Release 0.8.1

- Status: TO BE DONE
- Depends On: 1.4, 2.4, 3.7, 4.3
- Objective: The maintainer confirms that Store Submission 12 is published and asks for
  "release 0.8.1".
- Steps:
  1. Ask the maintainer. Do not start without the explicit request.
- Validation: the request is in the conversation.
- Notes: Gate (see `## Project Gates`).

#### Task 5.2: Run The release Runbook For 0.8.1

- Status: TO BE DONE
- Depends On: 5.1
- Objective: v0.8.1 is released by the runbook with both stops respected.
- Steps:
  1. Bootstrap (part of the authorized 0.8.1 run, before P0): push the Milestone 1-4
     commits to `master`; wait until `ci.yml` (and `nix.yml` if it runs) is green for that
     `HEAD`. Ask the maintainer to re-deploy Coolify, so the live download page uses the
     pinned 0.8.0 links before the 0.8.1 tag exists. This closes the broken-link window of
     the first pinned release: the first deploy happens while v0.8.0 is still the latest
     release, so the pinned links resolve at once.
  2. `/runbooks release` for 0.8.1. P0 must now pass without an "unpushed commits" failure;
     the P4 summary confirms the bootstrap deploy.
  3. Record every SHA, run ID and channel state with `plan-status.py note --task 5.2`.
  4. Write a Decision Log entry for every deviation from the runbook, and fix the runbook or
     a script in the same task when the fix is small.
- Validation: `release:verify -- --version 0.8.1 --live-site` passes after the deploy;
  `release:channels -- --version 0.8.1` reports every channel.
- Notes: Never re-tag or edit the published release (Hard constraint 1).

### Milestone 6: Cleanup And Final Verification

- Status: TO BE DONE
- Purpose: Ensure the repository contains only intentional final artifacts and the complete
  change is verified.
- Exit Criteria: Intermediate artifacts are removed, the `## Pre-flight Checks` list passes,
  TODO-0163 is closed, and the plan status is COMPLETED.

#### Task 6.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Depends On: 5.2
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests,
     downloaded release files, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep the helper scripts, their tests and fixtures, and the runbook.
- Validation: `git status --porcelain` shows only intended changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

#### Task 6.2: Final Verification

- Status: TO BE DONE
- Depends On: 6.1
- Objective: Validate the integrated change after cleanup and close TODO-0163.
- Steps:
  1. Run every item in `## Pre-flight Checks`.
  2. Confirm the `CHANGELOG.md` `### Internal` entry for this work is in the 0.8.1 section.
  3. Mark TODO-0163 done with the `todo-manager` skill; update the exploration status line.
  4. Commit: `docs(release): close TODO-0163`.
- Validation: all pre-flight checks pass; `grep -n "\[x\] \*\*TODO-0163" docs/todo/TODO.md
  docs/todo/TODO_ARCHIVE.md` prints the closed item.
- Notes: None.

## Project Gates

- Before Task 5.2: the maintainer's explicit request "release 0.8.1", and confirmation that
  Store Submission 12 is published.
- Inside the 0.8.1 run: the bootstrap Coolify re-deploy (Task 5.2 step 1), the stop before
  the tag push (P4), and the Coolify re-deploy (P5).
- Each milestone ends with a commit on `master` without push, after lint and script tests
  pass (maintainer permission for this plan).
- Agent rules: post-task checklist (`docs/best-practices/POST_TASK_BEST_PRACTICES.md`),
  `CHANGELOG.md` entry, TODO closed with `todo-manager`, docs updated in the same task.

## Pre-flight Checks

- [ ] `cmd.exe /c bun run type-check`
- [ ] `cmd.exe /c bun run lint`
- [ ] `cmd.exe /c bun run test:run`
- [ ] `cmd.exe /c bun run test:scripts`
- [ ] `cargo test --workspace`
- [ ] `node scripts/check-test-runners.mjs`

## Decision Log

No entries yet.

## Final Verification

Task 6.2, plus the 0.8.1 final report from Task 5.2: GitHub release verified by
`release:verify`, live site on 0.8.1 with pinned URLs, and every channel in a reported state.

## Approval Gate

Implementation must not start until the user approves this plan.

## Plan Self-Check

```
$ python3 scripts/check-plan.py docs/plans/2026-11-16-release-automation-plan.md
W001 warning 0: Tracking says tracked but git does not track this file
0 error(s), 1 warning(s)
```

Run: 2026-11-16. W001 is expected: the plan is committed in the same step as this check.
Reviewed by GPT-6.1 Sol (codex, high effort) on 2026-11-16; all findings applied (bump-script
test isolation, both staging lists, pinned-link proof, P0 unpushed-commit and push-principal
checks, legacy-domain behavior, channel evidence, bootstrap deploy before 0.8.1).

## Execution Notes

- Start each session with `plan-status.py <plan> brief`. Before stopping, run `plan-status.py <plan>
  resume` and end with `Stop: <reason> — <detail>`.
- Set status with `plan-status.py set` before starting a task and right after its validation passes.
- Follow `Depends On`, not task numbering.
- Write a `## Decision Log` entry **before starting the next task** whenever execution diverges from
  this plan, an unplanned problem is found, or a validation is deferred — never retrospectively.
