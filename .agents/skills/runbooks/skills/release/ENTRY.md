---
name: release
description: Run an explicitly requested Fenmark release through verification and channel reporting.
---

# Agent-run release

Start only when the maintainer explicitly requests release of one version. Authority is scoped to that version by the root `CLAUDE.md` release rule. Do not add agent attribution. Stop on a failed check and report the visible state. Never alter, delete, re-tag, or re-run a published release. Do not release a test tag.

Record the release commit SHA, tag SHA, workflow run IDs, checks, and channel links in the report. Long waits must not use sleep loops; use the harness's supported asynchronous waiting mechanism. Published-release recovery is a missing downstream dispatch or a new patch version.

## Resume

Inspect local and remote state before choosing a phase. Verify the outputs of every skipped phase: five version files, lockfile, both website pages, exactly one metainfo entry, dated CHANGELOG heading, release notes, and notification as applicable. Never run the bump twice or undo a date stamp.

| Visible state | Start |
|---|---|
| Unreleased heading, versions not bumped, no tag | P0 |
| Versions bumped, heading still Unreleased | P2 |
| Heading stamped and release notes present, not pushed | P3 |
| Pushed, CI or Nix not green | P3 wait / Nix loop |
| CI green, no tag | P4 |
| Tag pushed, release workflow running or finished | P5 |
| Release published | P5 verification / P6 |

## P0 — Preflight

Run `bun run release:preflight -- --version X.Y.Z`. Stop if any check fails. Review the reported unreleased changes, open P0/P1/bug issues, and known channel blockers for P4. The push identity must be verified separately from `gh` authentication; HTTPS push credentials cannot currently be verified, so use a verified SSH push remote. The push identity check runs `ssh` and `sh` only from trusted absolute paths (`C:\Windows\System32\OpenSSH\ssh.exe` and `C:\Program Files\Git\bin\sh.exe` on Windows, `/usr/bin/ssh` and `/bin/sh` elsewhere); a nonstandard installation sets `MINI_DIARIUM_SSH_EXECUTABLE` and `MINI_DIARIUM_SH_EXECUTABLE` to absolute paths. Record the exact HEAD and remote SHA.

## P1 — Bump

Run `./bump-version.ps1 X.Y.Z` in PowerShell once. Independently verify the five files in the pre-release Step 3 table, `Cargo.lock`'s `mini-diarium` version, exactly one matching metainfo release, and the version on both `website/index.html` and `website/encrypted-journal/index.html`. Stop on any mismatch.

## P2 — Prepare

Run `pre-release` in autonomous mode; its entry defines the fixed style and notification choices. Retain the suggested but unapplied rewrites for P4. Run `bun run sync-languages`, `bun run validate:locales`, and `bun run website:build-static` in PowerShell. Confirm `latest-changelog.md` is nonempty and contains no `<!--`, `<template>`, or `REPLACE BEFORE TAGGING`. Run type-check, lint, frontend tests, and `cargo test --workspace`. Stop on failure.

## P3 — Review, commit, push

Review the complete status and diff. Stage only expected release changes: version files, `Cargo.lock`, `package-lock.json`, CHANGELOG, `latest-changelog.md`, notification JSON, TODO and archive, `nix/package.nix`, README, metainfo, both website pages, and generated website output. Stop on an unexpected file. Commit `chore(release): X.Y.Z`, push master, and record the SHA.

If `package-lock.json` changed, wait for Nix on that exact SHA. Run `bun run release:nix-hash -- --sha <sha>`. For a stale hash only, run it with `--apply`, review `nix/package.nix`, commit `chore(nix): refresh npmDepsHash for X.Y.Z`, push, and wait again. Allow one correction; stop on any other failure or a second failure. Wait for green CI and, when it ran, Nix on the final SHA.

## P4 — Tag approval

Show the maintainer the version, final SHA, CI and Nix state, full release notes, open P0/P1 issues, philosophy review, unapplied style rewrites, channel blockers, and bootstrap deploy status if applicable. Include: **Confirm: no Partner Center submission is pending (CI deletes it).** Wait for explicit go and that confirmation.

After approval, recheck that remote master is still the approved SHA and that the tag and release are absent. Create annotated `vX.Y.Z` at that SHA and push only that tag. Record the tag SHA.

## P5 — Release and website

Wait for the tag's release workflow. Inspect the actual release state, assets, channel dispatches, and cleanup PR even if the workflow fails. If unpublished, stop and report the failed job; do not delete the tag or draft. If published and a downstream dispatch is missing, first verify no run exists for that tag, then dispatch only the missing workflow with `--ref master --field tag=vX.Y.Z`.

Ask the maintainer to redeploy Coolify. Run `bun run release:verify -- --version X.Y.Z`; after the maintainer says done, run it again with `--live-site`. Stop on failure. Once the live site verifies, dispatch `indexnow.yml`.

## P6 — Channels and report

Run `bun run release:channels -- --version X.Y.Z`. Runs without an explicit tag marker, including older runs, have unknown association and require manual investigation; do not infer that a dispatch is missing. Report GitHub, website, Homebrew, WinGet, Flathub, and Store as available, submitted / awaiting external review, awaiting maintainer, or failed, with evidence and run IDs. Store workflow status alone is not proof of publication; require Partner Center or public listing confirmation. Include skipped rewrites, failures, cleanup and Flathub PRs, and remaining smoke tests, announcements, Search Console, issues, and milestones.
