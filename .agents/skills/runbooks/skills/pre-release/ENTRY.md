---
name: pre-release
description: "Pre-release checklist for Mini Diarium. Run before tagging a release: verifies version consistency, archives completed TODOs, generates latest-changelog.md, optionally adds a release notification, and stamps the CHANGELOG date. Use when preparing a feature branch for merge and tagging."
compatibility: Designed for Claude Code. Requires git.
---

# Pre-Release Skill

Automates the pre-release preparation steps for Mini Diarium. Run this on the feature branch before tagging.

**Stop immediately on any guard failure** — do not continue to later steps.

---

## Step 1 — CHANGELOG version check

Read `CHANGELOG.md`. Locate the first `## [X.Y.Z]` heading under `# Versions`.

- Extract `X.Y.Z` as `RELEASE_VERSION`.
- The heading must match `## [X.Y.Z] - [Unreleased]` (bracket-wrapped, not a date).
- If the heading already contains a date (e.g. `## [0.4.14] - 29-03-2026`) → **STOP** and tell the user the CHANGELOG appears already stamped for this release.

---

## Step 2 — Branch check

Run: `git rev-parse --abbrev-ref HEAD`

- The current branch must be `master` OR its name must contain `RELEASE_VERSION` as a substring.
  - Examples: branch `master` ✓; branch `release-v0.5.4` contains `0.5.4` ✓
- If not → **STOP** and ask the user to confirm they are on the correct branch.

---

## Step 3 — Version file consistency

Read all five files and verify each contains `RELEASE_VERSION`:

| File | What to check |
|------|---------------|
| `package.json` | `"version": "X.Y.Z"` field |
| `src-tauri/Cargo.toml` | first `version = "X.Y.Z"` under `[package]` |
| `src-tauri/tauri.conf.json` | `"version": "X.Y.Z"` field |
| `README.md` | badge string `version-X.Y.Z-blue` |
| `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml` | first `<release version="X.Y.Z">` under `<releases>` |

- If **any** file has a different version → **STOP**, report every discrepancy, and suggest running `./bump-version.sh X.Y.Z` (Linux/macOS) or `.\bump-version.ps1 X.Y.Z` (Windows).
- All five must match before continuing.

---

## Step 3b — Lockfile integrity check

Verify that `package-lock.json` is healthy before the Flathub publish workflow runs against the tagged commit. A stale lockfile causes `ENOTCACHED` failures in vorarbeiter builds (the app works locally via `bun.lock`, but Flathub only reads the npm lockfile).

Run both checks:

**(a) Every `node_modules/` entry has `resolved` and `integrity` fields:**

```bash
node -e "const l=JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); const m=Object.entries(l.packages||{}).filter(([k,v])=>k.startsWith('node_modules/')&&(!v.resolved||!v.integrity)); if(m.length){console.error('Stale lockfile — missing resolved/integrity:',m.map(([k])=>k).join(', '));process.exit(1)}else console.log('OK')"
```

**(b) No `package.json` dependency is absent from the lockfile:**

```bash
node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); const l=JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); const pkgs=l.packages||{}; const all=Object.assign({},p.dependencies||{},p.devDependencies||{},p.peerDependencies||{}); const missing=Object.keys(all).filter(d=>!pkgs['node_modules/'+d]); if(missing.length){console.error('Packages in package.json but not in lockfile:',missing.join(', '));process.exit(1)}else console.log('All deps accounted for')"
```

- If **either** check fails → **STOP** and tell the user: "`package-lock.json` is stale. Run `npm install --package-lock-only --ignore-scripts --legacy-peer-deps` to regenerate it, then re-run this step."
- If both pass → continue to Step 3c.

---

## Step 3c — Regenerate lockfile with npm

Regenerate `package-lock.json` using real npm (not bun) so the Flathub publish workflow generates correct vendored sources:

```bash
npm install --package-lock-only --ignore-scripts --legacy-peer-deps
```

- npm may say "up to date" but still modify the file if packages were added via bun since the last npm run.
- After running, re-run the Step 3b checks to confirm the lockfile is now healthy.
- If the lockfile was modified: note it in the completion report and include `package-lock.json` in the final `git add` command.

---

## Step 4 — Archive completed TODO items

Read `docs/todo/TODO.md`. Find all top-level `- [x]` items **and** their indented sub-items (lines indented under a checked top-level item).

**If no checked items are found:** note this in the completion report and continue without modifying either file.

**If checked items are found:**

1. **Transform each checked item** for the archive:
   - Find lines of the form `- [x] **Title** — description`
   - Insert `(YYYY-MM-DD)` (today's ISO date, e.g. `(2026-03-29)`) between the closing `**` of the title and the ` — ` separator.
   - Result: `- [x] **Title** (2026-03-29) — description`
   - Indented sub-items are copied verbatim (no date inserted on sub-items).

2. **Prepend the block** to `docs/todo/TODO_ARCHIVE.md`:
   - Insert the archived items immediately after the `## Completed` heading line.
   - Add a single blank line between the new block and any pre-existing entries.
   - Do not add a blank line between the `## Completed` heading and the first new item.

3. **Remove the lines from `docs/todo/TODO.md`**:
   - Delete the checked items and their indented sub-items.
   - Do not introduce extra blank lines where they were removed (collapse consecutive blank lines to at most one).

---

## Step 5 — Generate `latest-changelog.md`

1. Read `latest-changelog.template.md`. Extract the content between `<template>` and `</template>` tags (exclude the tags themselves and the HTML comment block above them).

2. Read `CHANGELOG.md`. Extract the unreleased section: everything after the `## [X.Y.Z] - [Unreleased]` heading line up to (but not including) the next `## [` heading.

3. Build `latest-changelog.md` at the repo root:

   - Start with `## What's Changed` heading.
   - On the next line: write 1–2 sentence synthesis of all the changes (no HTML comments — replace the `<!-- COMPACT SUMMARY -->` placeholder with real prose).
   - Then output sections in this fixed order: **Added → Changed → Fixed → Removed**.
   - For each section:
     - Copy the heading (`### Added`, etc.) and all its entries verbatim from the CHANGELOG unreleased block.
     - **If a section is absent or has no entries in the CHANGELOG: omit the section heading entirely** — do not write an empty `### Section` heading.
   - The output must contain **no HTML comments** whatsoever.

4. Write the result to `latest-changelog.md` (overwrite if it already exists — no prompt needed).

---

## Step 6 — Add release notification (ask user)

Before stamping the CHANGELOG, ask the user whether they want to add a release notification to `public/notifications.json`. Use the question tool:

- **Question:** "Add a release notification for vX.Y.Z to public/notifications.json?"
- **Options:**
  - "Yes, add notification" — proceed to add the entry
  - "No, skip" — skip to Step 7

**If the user chooses "Yes, add notification":**

1. Read `public/notifications.json` and parse it.
2. Read `latest-changelog.md` and extract the **compact summary** (the 1–2 sentence line immediately after the `## What's Changed` heading).
3. Build the new notification entry using the template in `assets/notification.template.json` (see the `<template>` block for the exact structure). Replace all placeholders:

```json
{
  "id": "vX.Y.Z-release",
  "type": "release",
  "version": "X.Y.Z",
  "title": "What's new in X.Y.Z",
  "body": "<compact summary from latest-changelog.md>",
  "date": "YYYY-MM-DD",
  "linkUrl": "https://github.com/fjrevoredo/mini-diarium/releases/tag/vX.Y.Z",
  "linkLabel": "Full release notes"
}
```

- Use `X.Y.Z` (without the `v` prefix in the `version` field, but **with** the `v` prefix in `id` and `linkUrl`).
- `date` uses today's date in `YYYY-MM-DD` format.
- `body` should be the exact compact summary text (no quotes or extra wrapping).

4. **Prepend** the new entry to the `entries` array (newest first, matching the existing order).
5. Write the updated JSON back to `public/notifications.json` (use 2-space indentation, matching the existing format — a trailing newline at end of file is expected).

**If the user chooses "No, skip":** do nothing and proceed to Step 7.

**Edge cases:**
- If `public/notifications.json` is missing or cannot be parsed: note the error and skip (do not block the release).
- If an entry with the same `id` already exists: warn the user and skip (do not create a duplicate).

---

## Step 7 — Stamp CHANGELOG date

In `CHANGELOG.md`, replace the `[Unreleased]` token in the first version heading:

- Find: `## [X.Y.Z] - [Unreleased]`
- Replace with: `## [X.Y.Z] - DD-MM-YYYY` where `DD-MM-YYYY` is today's date in day-month-year format with leading zeros (e.g. `29-03-2026`).
- Only this one line changes — no other edits to CHANGELOG.md.

---

## Completion Report

After all steps complete, print a summary including:

- `RELEASE_VERSION` found and confirmed
- Which version files were checked (all five pass)
- Lockfile integrity check result (pass / regenerated / N/A)
- Whether TODO items were archived (count, or "none found")
- Confirmation that `latest-changelog.md` was written
- Whether a release notification was added to `public/notifications.json` (or "user skipped" / "not added")
- Confirmation that CHANGELOG was date-stamped

End the report with the exact `git add` command listing only the files that were actually modified:

```
git add CHANGELOG.md latest-changelog.md <include package-lock.json only if regenerated by Step 3c> <include public/notifications.json only if a notification was added> <include docs/todo/TODO.md and docs/todo/TODO_ARCHIVE.md only if TODO items were archived>
```

Also remind the user to:
- Run `cargo audit` (requires `cargo-audit`) as a manual security check before tagging
- Review `latest-changelog.md` before pushing — it will be used by the release workflow

---

## Error Reference

| Situation | Behaviour |
|-----------|-----------|
| CHANGELOG top entry already has a date | STOP — ask user |
| Branch is not `master` and doesn't contain RELEASE_VERSION | STOP — ask user |
| Any version file mismatch | STOP — report all, suggest bump-version |
| No checked TODO items | Note it, continue |
| `latest-changelog.md` already exists | Overwrite silently |
| Notification with same id already exists | Warn, skip adding |
| `public/notifications.json` missing/unparseable | Note error, skip adding |
| CHANGELOG section missing/empty | Omit that section heading from output |
| User skips release notification | Note it, continue |
| Lockfile integrity check fails (Step 3b) | STOP — tell user to run `npm install --package-lock-only --ignore-scripts --legacy-peer-deps` |
| Lockfile was regenerated (Step 3c) | Include `package-lock.json` in `git add` |

## Format Reference

| Field | Format | Example |
|-------|--------|---------|
| CHANGELOG date stamp | `dd-mm-YYYY` | `29-03-2026` |
| TODO archive date | `(YYYY-MM-DD)` | `(2026-03-29)` |
| Archive date position | between `**title**` and ` — ` | `**Title** (2026-03-29) — desc` |
| Notification date | `YYYY-MM-DD` | `2026-04-27` |
| latest-changelog.md | no HTML comments | all placeholders replaced with real content |
| Empty CHANGELOG section | omit heading entirely | no `### Fixed` if no Fixed entries |
