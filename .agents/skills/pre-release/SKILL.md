---
name: pre-release
description: "Pre-release checklist for Mini Diarium. Run before tagging a release: verifies version consistency, archives completed TODOs, generates latest-changelog.md, and stamps the CHANGELOG date. Use when preparing a feature branch for merge and tagging."
user-invocable: true
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

- The current branch name must contain `RELEASE_VERSION` as a substring.
  - Example: branch `feature-v0.4.14` contains `0.4.14` ✓
- If not → **STOP** and ask the user to confirm they are on the correct branch.

---

## Step 3 — Version file consistency

Read all four files and verify each contains `RELEASE_VERSION`:

| File | What to check |
|------|---------------|
| `package.json` | `"version": "X.Y.Z"` field |
| `src-tauri/Cargo.toml` | first `version = "X.Y.Z"` under `[package]` |
| `src-tauri/tauri.conf.json` | `"version": "X.Y.Z"` field |
| `README.md` | badge string `version-X.Y.Z-blue` |

- If **any** file has a different version → **STOP**, report every discrepancy, and suggest running `./bump-version.sh X.Y.Z` (Linux/macOS) or `.\bump-version.ps1 X.Y.Z` (Windows).
- All four must match before continuing.

---

## Step 4 — Archive completed TODO items

Read `docs/TODO.md`. Find all top-level `- [x]` items **and** their indented sub-items (lines indented under a checked top-level item).

**If no checked items are found:** note this in the completion report and continue without modifying either file.

**If checked items are found:**

1. **Transform each checked item** for the archive:
   - Find lines of the form `- [x] **Title** — description`
   - Insert `(YYYY-MM-DD)` (today's ISO date, e.g. `(2026-03-29)`) between the closing `**` of the title and the ` — ` separator.
   - Result: `- [x] **Title** (2026-03-29) — description`
   - Indented sub-items are copied verbatim (no date inserted on sub-items).

2. **Prepend the block** to `docs/archive/TODO_ARCHIVE.md`:
   - Insert the archived items immediately after the `## Completed` heading line.
   - Add a single blank line between the new block and any pre-existing entries.
   - Do not add a blank line between the `## Completed` heading and the first new item.

3. **Remove the lines from `docs/TODO.md`**:
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

## Step 6 — Stamp CHANGELOG date

In `CHANGELOG.md`, replace the `[Unreleased]` token in the first version heading:

- Find: `## [X.Y.Z] - [Unreleased]`
- Replace with: `## [X.Y.Z] - DD-MM-YYYY` where `DD-MM-YYYY` is today's date in day-month-year format with leading zeros (e.g. `29-03-2026`).
- Only this one line changes — no other edits to CHANGELOG.md.

---

## Completion Report

After all steps complete, print a summary including:

- `RELEASE_VERSION` found and confirmed
- Which version files were checked (all four pass)
- Whether TODO items were archived (count, or "none found")
- Confirmation that `latest-changelog.md` was written
- Confirmation that CHANGELOG was date-stamped

End the report with the exact `git add` command listing only the files that were actually modified:

```
git add CHANGELOG.md latest-changelog.md <include docs/TODO.md and docs/archive/TODO_ARCHIVE.md only if TODO items were archived>
```

Also remind the user to:
- Run `cargo audit` (requires `cargo-audit`) as a manual security check before tagging
- Review `latest-changelog.md` before pushing — it will be used by the release workflow

---

## Error Reference

| Situation | Behaviour |
|-----------|-----------|
| CHANGELOG top entry already has a date | STOP — ask user |
| Branch doesn't contain RELEASE_VERSION | STOP — ask user |
| Any version file mismatch | STOP — report all, suggest bump-version |
| No checked TODO items | Note it, continue |
| `latest-changelog.md` already exists | Overwrite silently |
| CHANGELOG section missing/empty | Omit that section heading from output |

## Format Reference

| Field | Format | Example |
|-------|--------|---------|
| CHANGELOG date stamp | `dd-mm-YYYY` | `29-03-2026` |
| TODO archive date | `(YYYY-MM-DD)` | `(2026-03-29)` |
| Archive date position | between `**title**` and ` — ` | `**Title** (2026-03-29) — desc` |
| latest-changelog.md | no HTML comments | all placeholders replaced with real content |
| Empty CHANGELOG section | omit heading entirely | no `### Fixed` if no Fixed entries |
