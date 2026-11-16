# Exploration: End-to-End Release Automation

> Artifact type: Documentation + Plan (prose only, no implementation code).
>
> Goal: list everything a coding agent needs to run a full Fenmark release, from "the
> CHANGELOG has an `Unreleased` block" to "every channel has the new version, or its exact
> pending state is known", when the maintainer asks for it explicitly.

## Context

- **Why:** releases are done by hand today. Some parts are automated (`bump-version.sh` /
  `bump-version.ps1`, the `pre-release` runbook, `release.yml` and four channel workflows),
  but a human runs them and connects them.
- **Date:** 2026-11-15. Next release in `CHANGELOG.md`: `## [0.8.1] - Unreleased`.
- **Sources consulted:**
  - `docs/releasing/RELEASING.md`, `docs/releasing/SIGNPATH_FIRST_TIME_SETUP.md`
  - `.agents/skills/runbooks/skills/pre-release/ENTRY.md`
  - `bump-version.sh`, `bump-version.ps1`, `scripts/website-release-urls.sh`,
    `latest-changelog.template.md`
  - `.github/workflows/{release,ci,nix,winget-publish,homebrew-cask,flathub-publish,msstore-publish,indexnow}.yml`
  - `src/state/notifications.ts`, `src-tauri/tauri.conf.json`, `website/index.html`,
    `website/CLAUDE.md`
  - `git log` of the v0.7.6 and v0.8.0 releases; `gh run list` / `gh run view` of their
    release and channel runs; `gh api` ruleset and secret names
  - Flathub and WinGet PR history (`flathub/io.github.fjrevoredo.mini-diarium`,
    `microsoft/winget-pkgs`)
  - second-brain `project.mini-diarium`, `service.coolify-public-vps`
  - The maintainer (decisions below)
  - An independent read-only review of this document by a second agent (GPT-6.1 Sol). All
    its findings were checked against the sources and are included in this version.

## Maintainer Decisions

| Question | Answer |
|---|---|
| Can an agent commit, push to `master`, and push the release tag? | **Yes, only after an explicit request or command** from the maintainer for that release. The general rule "no autonomous commits" stays for all other work. |
| Can an agent merge the Flathub PR and the changelog cleanup PR? | Yes, but **not in iteration 1**. The maintainer clicks merge. |
| How is the website deployed? | **Manual re-deploy in Coolify.** There is no auto-deploy. |
| Output | This document. |

## Current Flow (as observed in v0.7.6 and v0.8.0)

```
 PREPARE (local, manual)                TAG (manual)          CI (automatic)                         AFTER (manual)
 ─────────────────────────              ────────────          ──────────────                         ───────────────
 1 Version X.Y.Z is in CHANGELOG        git tag -a vX.Y.Z ──▶ release.yml                            Merge cleanup PR
 2 bump-version.ps1 X.Y.Z               git push tag           ├ validate latest-changelog.md        Merge Flathub PR
 3 /runbooks pre-release (1-2 prompts)                         ├ draft release                       Wait for WinGet merge
 4 sync-languages, cargo audit                                 ├ build linux/macos/windows           website:build-static + Coolify re-deploy
 5 website:build-static (sitemap etc.)                         ├ SignPath sign (test cert)           IndexNow, Search Console
 6 commit + push master                                        ├ verify 5 installer names, publish   Installer smoke tests, announce
 7 Nix CI red → copy got: hash →                               ├ dispatch WinGet/Homebrew/
   commit → push → wait green                                  │   Flathub/MS Store (on master)
                                                               └ open cleanup PR
```

Observed preparation sequence (not the full history of each release):

- v0.7.6: `increase version` (bump script output) → `chore(release): pre-release checks`
  (CHANGELOG stamp, `latest-changelog.md`, `package-lock.json`, `notifications.json`) →
  `chore(nix): refresh npmDepsHash` (value read from the failed Nix CI annotation) → tag.
- v0.8.0: the preparation commit `d2afb76 chore(release): 0.8.0` (also `website/blog/*` and
  `website/sitemap.xml` from `website:build-static`) was made on the `rebrand/fenmark`
  branch. More commits and a merge from master followed, and the tag points to the
  squash-merge commit `a3a8cab` of PR #361. Then `chore(nix): refresh npmDepsHash`.
- Time from tag push to channel dispatch: about 20-30 minutes.

## Findings

### What is already automated (keep it)

- `release.yml` on tag push `v*.*.*`, in this order: validates `latest-changelog.md`,
  creates a draft release, builds three platforms, signs the Windows `.msi`/`.exe` through
  SignPath, checks that the five installer **names** are on the draft, **publishes the
  release**, then dispatches WinGet, Homebrew, Flathub, and MS Store (the Store step is
  `continue-on-error`), then opens the `latest-changelog.md` cleanup PR.
  Important: publication happens **before** the dispatches and the cleanup PR. A failed
  `release.yml` run can therefore still have a public release (see P5).
- Channel workflows are dispatched with `--ref master` and a `tag` input. Their runs show
  `headBranch: master`, not the tag (for example the v0.8.0 Homebrew run `41544015568`).
- Homebrew: pushes directly to `fjrevoredo/homebrew-mini-diarium`. No human step.
- WinGet: opens a PR on `microsoft/winget-pkgs`. Microsoft merges it (v0.7.4 to v0.8.0 all
  merged). No maintainer step. An agent can only monitor it.
- Flathub: opens a PR on the Flathub repo. The maintainer merges it after the Flathub test
  build (v0.8.0: merged about 30 minutes after it opened). The app is available only after
  the Flathub production build that follows the merge.
- MS Store: a green workflow means "submitted", not "available". The v0.7.6 run
  (`40370631602`) ended with submission status **Certification**. Its final status step
  runs with `if: always()` and does not decide the result.
- `winget-publish.yml` and `homebrew-cask.yml` also subscribe to `release` events, but
  `release.yml` publishes with `GITHUB_TOKEN`, and events from `GITHUB_TOKEN` do not start
  other workflows. So only the dispatch path runs, and nothing runs twice. Do not move the
  publish step to a PAT unless those triggers are removed first.
- Release notifications are **bundled in the app**: `loadNotifications()` fetches the
  relative `/notifications.json` (`src/state/notifications.ts`), which comes from `public/`
  into `dist`. A website deploy does not change what installed apps show.

### Blockers and gaps

| # | Gap | Evidence | Effect | Fix |
|---|---|---|---|---|
| G1 | **MS Store update fails since 0.8.0** | Run `41544022537`: `CommitFailed`, `InvalidParameterValue: This package uses a display name that you have not reserved: Fenmark` | The Store stayed on 0.7.6. The release was still green because the step is `continue-on-error`. | **Done 2026-11-15:** "Fenmark" reserved; the failed job was re-run and submission `1152921505702411676` reached Certification. 0.8.0 published 2026-11-16. Listing-only submission 12 (product name and description to Fenmark) submitted for certification 2026-11-16; it must publish before the 0.8.1 release dispatches the Store workflow. Note: `msstore publish` deletes any pending draft and recreates it from the last published submission, so browser edits to a draft are lost on the next CI publish. |
| G2 | **`latest-changelog.example.md` does not exist** | Only `latest-changelog.template.md` is tracked. `release.yml` sets `LATEST_CHANGELOG_TEMPLATE: latest-changelog.example.md`, and the "same as template" check runs only if that file exists. `RELEASING.md` says `cp latest-changelog.example.md latest-changelog.md`. | The template check is a silent no-op, and the documented copy command fails. Only the `REPLACE BEFORE TAGGING` check still works, and the current template does not contain that text. | Point the workflow and the guide at `latest-changelog.template.md`, and add a check for leftover HTML comments (`<!--`) and `<template>` tags. |
| G3 | **The pre-release runbook asks questions** | `ENTRY.md` Step 7 (release notification) always asks. Step 5 asks only when it finds user-facing rewrites. | An agent waits at a prompt. | Add an autonomous mode with fixed defaults (P2). |
| G4 | **Nix `npmDepsHash` round trip** | Both releases needed a separate commit with the hash from the failed Nix run. Nix is not available on this Windows machine. `nix.yml` writes a `npmDepsHash is stale. Set it to <hash>` annotation only when the log has a `got:` line. Any other failure is a real build error. | Extra pushes and CI waits before the tag. The runbook today only reports "pending". | A scripted loop that updates the hash **only** when that annotation is present (P3). Later: a CI job that computes the hash. |
| G5 | **Steps outside every script** | `RELEASING.md` checklist: `bun run sync-languages`, `cargo audit`, CI green on `master`, no known P0/P1 bugs, philosophy alignment review. The v0.8.0 commit also has `website:build-static` output. | Easy to skip. The order is not written down. | One release runbook with a fixed order (P0-P2). |
| G6 | **Staging lists are wrong** | `bump-version.sh` "Next steps" omits `CHANGELOG.md`, `latest-changelog.md`, `public/notifications.json`, `package-lock.json`, `nix/package.nix`, `website/sitemap.xml`, and describes only the PR path. `bump-version.ps1` also omits `website/encrypted-journal/index.html`. The `RELEASING.md` lists omit `website/encrypted-journal/index.html` and the runbook files. | An agent that copies them leaves files out of the release commit. | Stage the reviewed release changes (P3), not a fixed list. Correct the three texts. |
| G7 | **The bump script can pass when a step failed** | `bump-version.ps1` hides a failed `cargo build`, tries `cargo check`, and does not check its exit code. Neither script checks the app version in `Cargo.lock`. Both always prepend a new `<release>` entry to the metainfo file. | Exit 0 does not prove that `Cargo.lock` was updated. Running the script twice adds a second metainfo entry. | P1 checks `Cargo.lock` itself, and never runs the bump twice for one version. Later: make the script fail on these errors and skip an existing metainfo entry. |
| G8 | **Ruleset on `master` requires a PR** | `gh api .../rulesets`: rules `deletion`, `non_fast_forward`, `pull_request` on `refs/heads/master` | Direct push works only for a bypass actor. The maintainer is one; a bot token is not. | The agent pushes with the maintainer's own Git credentials (Path A). P0 checks the Git identity, which can differ from the `gh` login. Fallback: Path B (release branch + PR). |
| G9 | **Website deploy is manual, and download links break until it happens** | Maintainer answer. `website/index.html` uses `/releases/latest/download/Mini-Diarium-0.8.0-windows.exe`. When 0.8.1 becomes "latest", that URL asks the 0.8.1 release for a 0.8.0 file and fails. | Website download buttons are broken from release publication until the Coolify re-deploy. IndexNow must also wait for the deploy. | Iteration 1: P5 asks for the re-deploy as soon as the release is published and reports the broken-link window. Better: use version-pinned URLs (`/releases/download/vX.Y.Z/...`), so the old page keeps working. Later: a Coolify deploy webhook. |
| G10 | **No post-release verification** | `RELEASING.md` "Post-Release" is a manual checklist. `scripts/website-release-urls.sh` only prints the URLs from the local `website/index.html`; it makes no HTTP request and compares nothing. The publish gate checks installer names only, not checksums or the three checksum files. | Nobody checks that the assets are complete and correct, or that the live site and each channel serve the version. | A verify step that checks names, sizes, checksums, release body, live site, and channel state (P5, P6). |
| G11 | **No resume path** | A fresh run needs `Unreleased` and no tag. P2 stamps the CHANGELOG, and the runbook stops on a stamped CHANGELOG (`ENTRY.md` Step 1). | After a Nix failure, a long stop, or a build failure, a restart fails at once. A restart that runs the bump again corrupts the metainfo file. | Define fresh-run and resume checks from the visible state (see "Run state and resume"). |
| G12 | **Cleanup PR and Flathub PR need a merge** | `release.yml` opens the cleanup PR with `GITHUB_TOKEN` (no CI runs on it). The Flathub PR waits for the maintainer. | The release is not closed until both are merged. | Not in iteration 1 (maintainer decision). The agent reports both links. |
| G13 | **Windows installers have the SignPath test certificate** | TODO-0109. `release-signing` policy is `CSR PENDING`. | Windows SmartScreen does not trust the installers. Not a blocker for automation. | TODO-0109. |
| G14 | **macOS build is ad-hoc signed only** | `tauri.conf.json` `signingIdentity: "-"` asks for ad-hoc signing. | No Developer ID signature and no notarization, so Gatekeeper warns. Not a blocker for automation. | Out of scope. |

### Manual steps that stay manual

- **Version number:** fixed when the first `## [X.Y.Z] - Unreleased` heading is written in
  `CHANGELOG.md`. The agent reads it. It does not choose it.
- **Judgment gates before the tag:** "no known P0/P1 bugs" and the philosophy alignment
  review (`RELEASING.md` checklist). The agent prepares the data (open issues with priority
  labels; the unreleased CHANGELOG items next to the six `PHILOSOPHY.md` principles) and
  records any tradeoff in the P4 summary. The maintainer decides at P4.
- **Partner Center** actions (G1).
- **Coolify re-deploy** (G9), in iteration 1.
- **Merging** the Flathub PR and the cleanup PR, in iteration 1.
- **Search Console** "Request indexing" (no public API for normal pages).
- **Hosting checks:** that `https://www.fenmark.app/` and `https://mini-diarium.com/`
  redirect to `https://fenmark.app/`, and that Cloudflare does not add the invalid
  `Content-Signal` line to `robots.txt`. The agent can check these with read-only HTTP
  requests and report them. The maintainer repairs them if needed.
- **Installer smoke tests** on real Windows, macOS, and Linux machines; **announcements**;
  **closing issues** and **milestone/project updates**.

## Plan: Agent-Run Release (iteration 1)

Prose only. Each phase ends with a check. **A failed check stops the run**, and the agent
reports what failed and what state is now visible. Published releases and pushed tags are
immutable: the agent never edits, deletes, re-tags, or re-runs them. After publication,
recovery means re-dispatching only the missing downstream workflow, or a new patch version.

### Trigger and authority

- The run starts only on an explicit maintainer request for one version (for example
  "release 0.8.1"). The permission covers that version only.
- Commits have no agent attribution (no `Co-Authored-By`, no session footer).
- Stop points: before the tag push (P4) and at the website re-deploy (P5). At each stop the
  agent shows a short summary and waits for "go" or "done".
- Do not break the implementation into one script per phase. Use one orchestrating runbook
  (`release`) and small read-only helper scripts for the checks.

### Run state and resume

The run state comes only from what is visible: the repo, the remote, and GitHub. No hidden
state file.

| Visible state | Phase to start from |
|---|---|
| CHANGELOG `Unreleased`, versions not bumped, no tag | P0 (fresh run) |
| Version files show X.Y.Z, CHANGELOG still `Unreleased` | P2 (skip the bump; never run it again) |
| CHANGELOG stamped for X.Y.Z, `latest-changelog.md` present, not pushed | P3 |
| Pushed to `master`, CI or Nix not green | P3 (Nix loop / wait) |
| CI green, no tag `vX.Y.Z` | P4 |
| Tag pushed, `release.yml` running or finished | P5 |
| Release published | P5 (verification) / P6 |

On resume, the agent checks the outputs of each phase it skips (versions, CHANGELOG stamp
format, `latest-changelog.md`, notification entry, `Cargo.lock`, a single metainfo
`<release version="X.Y.Z">` entry). It never undoes a date stamp and never runs the bump
again just to pass P0. It records the commit SHA, the tag SHA, and every workflow run ID in
its report as it goes.

### P0 — Preflight (read-only)

- `git fetch origin --tags`. Working tree is clean. Branch is `master`. Local `HEAD` equals
  the remote `master` SHA (from `git ls-remote origin refs/heads/master`).
- `CHANGELOG.md` first version heading is `## [X.Y.Z] - Unreleased`, and X.Y.Z is the
  requested version. Tag `vX.Y.Z` does not exist locally or on the remote. No GitHub release
  `vX.Y.Z` exists (draft or published).
- The latest `ci.yml` run **for that exact commit SHA** (event `push`) is green. The same for
  `nix.yml` if it ran for that SHA.
- `gh auth status` works. The Git push identity works and is a bypass actor on the `master`
  ruleset (check the remote URL and the credential or SSH key Git will use, separately from
  `gh`).
- `cargo audit` reports no vulnerabilities, or only known and documented ignores.
- Repo secrets exist by name (`gh secret list`): `WINGET_TOKEN`, `GH_PAT`, `FLATHUB_TOKEN`,
  the four `SIGNPATH_*`, the four `PARTNER_CENTER_*`, `MSSTORE_PRODUCT_ID`.
- Known channel blockers are reported, not hidden (today: G1).
- Data for the judgment gates: open issues labeled as P0/P1 or bugs, and the unreleased
  CHANGELOG items for the philosophy review. Shown at P4.

### P1 — Version bump

- Run `bump-version.ps1 X.Y.Z` from the PowerShell tool (or `bump-version.sh` from Git Bash
  with `MSYS_NO_PATHCONV=1` where needed). Run it **once** per version.
- Check, independently of the script's exit code: the five version files in the runbook's
  Step 3 table show X.Y.Z; `Cargo.lock` shows `mini-diarium` at X.Y.Z; the metainfo file
  has exactly one `<release version="X.Y.Z">` entry; `website/index.html` and
  `website/encrypted-journal/index.html` show X.Y.Z.

### P2 — Pre-release runbook, autonomous mode

Run the `pre-release` runbook with these fixed defaults instead of prompts:

- Step 5: apply only the mechanical style fixes. Do not apply "user-facing language"
  rewrites. List them in the final report.
- Step 7: always add the release notification. `public/notifications.json` must parse;
  if it is missing or does not parse, **stop** (do not skip as the runbook does today).
  If an entry with id `vX.Y.Z-release` already exists, check that its `version`, `summary`,
  `body`, `date`, and `linkUrl` are correct for this release; stop if they are not.
- Step 3b/3c lockfile checks and npm regeneration, as today.
- Everything else as written (TODO archive, `latest-changelog.md`, CHANGELOG date stamp).

Then run `bun run sync-languages`, `bun run validate:locales`, and
`bun run website:build-static` (PowerShell tool), so the README, website, and sitemap match.

- Check: `latest-changelog.md` is not empty, has no `<!--`, no `<template>`, and no
  `REPLACE BEFORE TAGGING`. `bun run type-check`, `bun run lint`, `bun run test:run`, and
  `cargo test --workspace` pass.

### P3 — Commit, push, Nix hash loop

- Review `git status` and `git diff`. Stage only the files that the release steps are
  expected to change (version files, `Cargo.lock`, CHANGELOG, `latest-changelog.md`,
  `public/notifications.json`, TODO files, lockfiles, `nix/package.nix`, README, generated
  `website/` output). Any other changed file stops the run.
- Commit `chore(release): X.Y.Z`. Push to `master`. Record the SHA.
- If `package-lock.json` changed: wait for the `nix.yml` run for that exact SHA.
  - If it fails **and** its log has the `npmDepsHash is stale. Set it to <hash>` annotation,
    update `npmDepsHash` in `nix/package.nix`, commit
    `chore(nix): refresh npmDepsHash for X.Y.Z`, push, and wait again.
  - If it fails without that annotation, it is a real build error: stop and report it.
  - One hash correction only. If the next run fails, stop.
- Wait for `ci.yml` (and `nix.yml` when it ran) to be green for the final SHA.

### P4 — Tag (stop point)

- Show the maintainer: version, final SHA, CI and Nix status, the `latest-changelog.md`
  body, the open P0/P1 issues, the philosophy review notes, the skipped style rewrites, and
  the known channel blockers. Wait for "go".
- After "go", check again: remote `master` is still that SHA, tag `vX.Y.Z` and release
  `vX.Y.Z` still do not exist. Then `git tag -a vX.Y.Z -m "Release vX.Y.Z"` on that SHA and
  push only that tag. Record the tag SHA.

### P5 — Watch the release, verify, website (stop point)

- Wait for the `release.yml` run for the tag. Whatever its conclusion, inspect the real
  state: is the release draft or published, which assets exist, which channel runs were
  dispatched, is there a cleanup PR. Report each item as done or missing.
  - If the release is **not published**: stop and report the failed job and log. Do not
    delete the tag or the draft without the maintainer.
  - If the release **is published** but a later step failed: re-dispatch only the missing
    channel workflow (`gh workflow run <file> --ref master --field tag=vX.Y.Z`), after
    confirming that no run for that tag exists already.
- As soon as the release is published, ask the maintainer to re-deploy the website in
  Coolify (download links are broken until then, G9).
- Verify the release:
  - Five installers (`Mini-Diarium-X.Y.Z-windows.exe`, `-windows.msi`, `-macos.dmg`,
    `-linux.AppImage`, `-linux.deb`) and three checksum files (`checksums-linux.txt`,
    `checksums-macos.txt`, `checksums-windows.txt`) exist, and each installer is larger than
    zero bytes.
  - Download all eight files and check each installer against its checksum file.
  - The release body equals `git show vX.Y.Z:latest-changelog.md` (the tagged copy, not the
    working copy).
- After the maintainer says "done" for the deploy: the live `https://fenmark.app/` shows
  `app-version` X.Y.Z, and every download URL on the live page names X.Y.Z and resolves to
  the matching asset of release `vX.Y.Z`. Check the canonical-host redirects and
  `robots.txt` (see "Manual steps that stay manual") and report them.
- Then dispatch `indexnow.yml` (or run `bun run website:submit-indexnow`).

### P6 — Channel status and final report

Find channel runs by workflow, event `workflow_dispatch`, branch `master`, and the `tag`
input or log (not by branch name `vX.Y.Z`). Record their run IDs.

Report each channel with one of four states: **available**, **submitted / awaiting
external review**, **awaiting maintainer**, or **failed**.

| Channel | "Available" means | Usual state at the end of the run |
|---|---|---|
| GitHub Releases | Published, eight files, checksums match | Available |
| Website | Live page shows X.Y.Z, links resolve | Available after the re-deploy |
| Homebrew | The tap's `Casks/mini-diarium.rb` shows X.Y.Z and the matching sha256 | Available |
| WinGet | The `microsoft/winget-pkgs` PR is merged | Submitted / awaiting external review |
| Flathub | The Flathub PR is merged and the production build has finished | Awaiting maintainer (merge) |
| MS Store | The submission is published, not "Certification" | Submitted, or failed (G1 today) |

The Store step is `continue-on-error`, so the agent reads the Store run conclusion and its
log; a green `release.yml` does not mean the Store worked.

The final report lists: what shipped, all links and run IDs, the state of each channel,
failures, the skipped style rewrites, and the manual items left (cleanup PR merge, Flathub
merge, Search Console, smoke tests, announcements, issues and milestones).

## Work Needed Before the First Agent Release

| Item | Type | Owner |
|---|---|---|
| ~~Reserve "Fenmark" in Partner Center; re-dispatch the Store workflow for v0.8.0 or v0.8.1~~ Done 2026-11-15/16 (G1) | Manual | Maintainer |
| Point `release.yml` and `RELEASING.md` at `latest-changelog.template.md`; add the `<!--` / `<template>` check (G2) | Workflow + docs | Agent |
| Add the autonomous-mode defaults to the `pre-release` runbook, and make a missing or broken `notifications.json` a stop (G3) | Runbook edit | Agent |
| Write the `release` runbook (P0-P6, run state and resume) under `.agents/skills/runbooks/skills/` | Runbook | Agent |
| Script the Nix hash loop, keyed on the stale-hash annotation (G4) | Script | Agent |
| Read-only helper scripts: P0 preflight, P5 asset and checksum verification, live-site check, P6 channel status (G10) | Scripts | Agent |
| Make the bump scripts fail when `cargo` fails, check `Cargo.lock`, and skip an existing metainfo entry (G7) | Script fix | Agent |
| Correct the staging lists and "Next steps" in `bump-version.sh`, `bump-version.ps1`, and `RELEASING.md` (G6) | Docs / script text | Agent |
| Version-pinned download URLs on the website (`/releases/download/vX.Y.Z/...`) (G9) | Website + bump script | Agent |
| Record the "release only on explicit request" permission in the agent instructions | Instructions | Agent |

## Later Iterations

- The agent merges the Flathub PR after its test build passes, and the cleanup PR.
- Coolify deploy webhook, then turn on the `indexnow.yml` push trigger.
- A CI job that refreshes `npmDepsHash`, so the push loop is not needed on Windows.
- Read-only availability checks for WinGet (`winget show`) and the Store listing version.
- Installer smoke tests in CI (install and start on each runner OS).
- SignPath production certificate (TODO-0109), and Developer ID signing plus notarization
  on macOS.

## Risks

- **Partial release:** a channel can fail after the GitHub release is public. Recovery is a
  re-dispatch of that channel only, or a new patch version. Never a re-tag.
- **False green:** a green `release.yml` does not prove that the Store, Flathub, or WinGet
  has the version. P6 reports the real state of each channel.
- **Broken download window:** until G9 is fixed, the website download buttons fail from
  publication until the Coolify re-deploy.
- **Interrupted run:** without the resume rules, a restart repeats the bump and corrupts the
  metainfo file, or stops at P0. The resume table is required, not optional.
- **Credentials:** the agent uses the maintainer's `gh` login and Git credentials. Nothing
  new is stored.
- **Lockfile drift:** the Flathub build reads `package-lock.json`, not `bun.lock`. The
  Step 3b/3c checks stay required.
