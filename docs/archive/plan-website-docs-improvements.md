# Website Docs Improvements Plan (TODO-0045, TODO-0047, TODO-0048)

## Metadata

- Plan Status: COMPLETED
- Created: 2026-06-04
- Last Updated: 2026-06-04
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Deliver three grouped website improvements:

1. **(TODO-0045)** Fix all 11 docs page meta descriptions to the 150–160 character target required by Bing Webmaster Tools.
2. **(TODO-0047)** Widen the docs content column to make better use of desktop viewport width, and produce a visual content audit that decides which pages need screenshots.
3. **(TODO-0048)** Verify the local Docker dev setup for the website is working and document the exact workflow in `website/CLAUDE.md`.

## Scope

- Update `description` front matter in all 11 `website/docs-src/*.md` files to 150–160 characters (exact replacement text is listed in Task 1).
- Regenerate all docs HTML with `bun run website:build-static` after each source change.
- Widen the docs content column by adding a `.container { max-width: 1400px; }` override to the inline style block in `scripts/generate-website-docs.mjs` (docs pages only, no global CSS change).
- Audit all 11 docs pages for screenshot/image needs and record the decision table in `website/CLAUDE.md`.
- Run `docker compose build` + `docker compose up -d` from `website/`, verify HTTP 200 response, stop the container, and document the verified workflow in `website/CLAUDE.md`.
- Mark TODO-0045, TODO-0047, TODO-0048 complete in `docs/todo/TODO.md`.
- Add a changelog entry for all three changes.

## Non-Goals

- Adding actual screenshots or images to any docs page (the visual audit decides which pages need them; implementation is a follow-on task).
- Modifying `website/css/style.css` globally (the container width override is scoped to the docs generator inline style only).
- Changing production Coolify configuration or any Nginx production settings.
- Implementing full-text search (covered by TODO-0026).

## Assumptions

- Docker Desktop is installed and running in the execution environment. If it is not, Task 4 is marked BLOCKED and the remaining tasks proceed.
- All `bun run` commands must be executed via the **PowerShell tool** (not Bash + cmd.exe), as required by `CLAUDE.md`.
- `website/nginx.conf` sets `server_name mini-diarium.com`. Local verification requires passing `Host: mini-diarium.com` with curl because the nginx config rejects requests to `localhost` directly.
- `box-sizing: border-box` applies globally (confirmed in `website/css/style.css` line 17). The current content column is approximately 500px (1100px container − 80px padding − 440px fixed columns − 80px gaps). Changing `max-width` to 1400px gives approximately 800px of content width.

## Open Questions

None.

---

## Tasks

### Task 1: Update meta descriptions for all 11 docs pages

- Status: COMPLETED
- Objective: All 11 `website/docs-src/*.md` files have a `description:` front matter value that is 150–160 characters, specific about page content, and suitable as a Bing/Google search snippet.
- Steps:
  1. Edit each source file listed below: replace the `description:` value with the exact text in the table, and update the `updated:` field to `2026-06-04`. No other front matter or content should change.

     | File | Replacement `description` value | Chars |
     |------|----------------------------------|-------|
     | `website/docs-src/00-getting-started.md` | `Create your first encrypted journal, set a password, and start writing. Covers the welcome tour, multiple journals, key file auth, and local-only mode.` | 151 |
     | `website/docs-src/01-writing-entries.md` | `Mini Diarium's rich text editor supports formatting, images, named links, tags, and multiple entries per day. Auto-save and RTL language support are built in.` | 158 |
     | `website/docs-src/02-navigating.md` | `Navigate your journal using the sidebar calendar, keyboard shortcuts, and day-navigation buttons. Jump to any date, go to today, and browse your entry history.` | 159 |
     | `website/docs-src/03-search.md` | `Full-text search is not yet available in Mini Diarium due to its encryption model. Use the calendar, Go to Date shortcut, or export to find past entries.` | 153 |
     | `website/docs-src/04-import.md` | `Import journal entries from Mini Diary, Day One, jrnl, or plain text files. Mini Diarium includes built-in importers and supports custom Rhai import plugins.` | 157 |
     | `website/docs-src/05-export.md` | `Export your journal as JSON or Markdown. JSON preserves entry IDs, tags, and font metadata; Markdown is human-readable. Exported files are not encrypted.` | 153 |
     | `website/docs-src/06-plugins.md` | `Extend Mini Diarium with Rhai script plugins for custom import and export formats. Covers the plugins folder, writing your first plugin, and API helpers.` | 153 |
     | `website/docs-src/07-preferences.md` | `Configure Mini Diarium from the Preferences panel: choose a theme, set auto-lock timeout, adjust editor font and size, manage authentication methods, and more.` | 159 |
     | `website/docs-src/08-statistics.md` | `View your writing statistics: total entry and word counts, current and longest streaks, and a breakdown of your most active writing days, months, and years.` | 156 |
     | `website/docs-src/09-backups.md` | `Mini Diarium automatically backs up your encrypted journal on every unlock and keeps the 30 most recent copies in a backups folder next to your diary.db.` | 153 |
     | `website/docs-src/10-faq.md` | `Answers to common questions about Mini Diarium: password recovery, encryption model, cross-device sync, key files, authentication slots, and mobile support.` | 156 |

  2. Run `bun run website:build-static` using the PowerShell tool.

- Validation:
  - For each of the 11 generated HTML files under `website/docs/<slug>/index.html`, grep for `<meta name="description"` and confirm:
    - The `content` attribute matches the replacement text exactly.
    - Character count is 150–160.
  - PowerShell spot-check command (run from repo root):
    ```powershell
    Select-String -Path "website\docs\*\index.html" -Pattern '<meta name="description"'
    ```
- Notes:
  - Edit `website/docs-src/` source files only. Never edit `website/docs/` generated HTML directly.
  - For `03-search.md` and `06-plugins.md`, the replacement description text happens to be the same as the current value, but the `updated:` date must still be bumped to `2026-06-04`.
  - `bun run website:build-static` must run via PowerShell tool (see CLAUDE.md § Execution Environment).

---

### Task 2: Widen the docs content column

- Status: COMPLETED
- Objective: Docs pages display a noticeably wider content column on desktop viewports (≥1400px), giving text and code blocks approximately 800px of width instead of the current ~500px.
- Steps:
  1. Open `scripts/generate-website-docs.mjs`. Locate the template literal that contains the inline `<style>` block (around line 315). The block starts with `.docs-layout {`.
  2. Insert the following rule immediately before the `.docs-layout {` rule (on its own line):
     ```css
     .container { max-width: 1400px; }
     ```
     This overrides the global `max-width: 1100px` from `website/css/style.css` for docs pages only, because inline `<style>` has higher cascade precedence than a linked stylesheet.
  3. Run `bun run website:build-static` using the PowerShell tool.

- Validation:
  - Open `website/docs/export/index.html` (any docs page works). Confirm:
    - The inline `<style>` block contains the line `.container { max-width: 1400px; }` before the `.docs-layout` rule.
    - The `.docs-layout { grid-template-columns: 240px 1fr 200px; ... }` rule is still present and unchanged.
  - Confirm `scripts/generate-website-docs.mjs` shows the new `.container` override in the style block.
  - Estimated content column at 1400px container: `(1400px − 80px padding) − 240px sidebar − 200px TOC − 80px gaps = 800px` — approximately 60% wider than before.

- Notes:
  - Change is confined to `scripts/generate-website-docs.mjs` only. Do not edit `website/css/style.css`.
  - The existing mobile breakpoints in the inline style (`@media (max-width: 1099px)` and `@media (max-width: 899px)`) remain correct; the wider container only applies at desktop widths above 1099px.
  - **`no-toc` pages**: `.docs-layout.no-toc { grid-template-columns: 240px 1fr; }` will give a 1fr of ~1040px at the 1400px container. All 11 current docs pages have H2/H3 headings and therefore generate a TOC, so this edge case does not affect any existing page. A future page with no headings would get a very wide content area; if that becomes a concern, add `max-width: 800px; margin: 0 auto;` to the `.docs-content` (or equivalent) element in the generator.
  - Always run the full `bun run website:build-static` (not the partial `website:docs` script alone) so the asset fingerprinter also processes the updated files.

---

### Task 3: Docs page visual content audit

- Status: COMPLETED
- Objective: `website/CLAUDE.md` contains a new `## Docs Page Visual Content Audit` section with an 11-row decision table recording which pages need screenshots and which are fine as text-only.
- Steps:
  1. Read all 11 `website/docs-src/*.md` files in full.
  2. For each page, assess:
     - Does the page describe a UI workflow, dialog, or setting panel that a screenshot would make clearer?
     - Would a screenshot reduce reader ambiguity (e.g., "which button?", "what does this look like?")?
     - Or is the page purely conceptual/reference content where a screenshot adds little value?
  3. Append the following section to `website/CLAUDE.md` (at the end of the file, after all existing content):

     ```markdown
     ---

     ## Docs Page Visual Content Audit

     Decision record for which pages need screenshots or inline images. See GitHub issue #153. Last reviewed: 2026-06-04.

     | Page slug | Decision | Rationale |
     |-----------|----------|-----------|
     | getting-started | Needs screenshots | Journal Picker, password creation screen, welcome tour — UI-heavy flow |
     | writing-entries | Needs screenshots | Editor toolbar, tag panel, multiple-entries-per-day view |
     | navigating | Needs screenshots | Calendar widget and keyboard shortcut reference |
     | search | Text-only is fine | Explains a known limitation; no UI element to show |
     | import | Needs screenshots | Import dialog and file-picker steps for each supported format |
     | export | Needs screenshots | Export dialog and side-by-side JSON vs Markdown output |
     | plugins | Text-only is fine | Code-heavy API reference; code blocks are more useful than screenshots |
     | preferences | Needs screenshots | Each preference panel section (Theme, Security, Editor, Authentication) |
     | statistics | Needs screenshots | Statistics overlay with sample entry data visible |
     | backups | Text-only is fine | Background process; folder path reference is sufficient |
     | faq | Text-only is fine | Pure Q&A; no UI elements to show |
     ```

  4. After appending, review the table against the content read in step 1. Update any cell that conflicts with the actual page content. The column names (Page slug, Decision, Rationale) must be kept as-is.

- Validation:
  - Confirm `website/CLAUDE.md` contains the `## Docs Page Visual Content Audit` section.
  - Confirm the table has exactly 11 data rows (one per docs page).
  - Confirm no files under `website/docs/` were modified by this task.

- Notes:
  - This task produces a decision record only — no screenshots or images are added.
  - If the audit reveals that a page's screenshot needs are clearly high-priority, add a new TODO entry to `docs/todo/TODO.md` (use the `todo-manager` skill for ID assignment) for the screenshot implementation work. Do not start that work within this plan.

---

### Task 4: Verify and document local Docker dev setup

- Status: COMPLETED
- Objective: The local Docker dev workflow is verified to produce HTTP 200, and the commands and troubleshooting steps are documented in `website/CLAUDE.md` under a `## Local Docker Dev` section.
- Steps:
  1. Verify Docker is available: run `docker --version` in PowerShell. If the command fails, mark this task BLOCKED with reason "Docker not available in execution environment" and skip to Task 5.
  2. From the `website/` directory, build the image:
     ```powershell
     Set-Location website
     docker compose build
     ```
     Confirm exit code 0.
  3. Start the container:
     ```powershell
     docker compose up -d
     ```
  4. Verify the site is served. The nginx config uses `server_name mini-diarium.com`, so include the Host header:
     ```powershell
     $status = (Invoke-WebRequest -Uri "http://localhost:80/" -Headers @{"Host"="mini-diarium.com"} -UseBasicParsing -ErrorAction Stop).StatusCode
     Write-Output "HTTP status: $status"
     ```
     Expected: `200`. Also spot-check a docs page:
     ```powershell
     $resp = (Invoke-WebRequest -Uri "http://localhost:80/docs/export/" -Headers @{"Host"="mini-diarium.com"} -UseBasicParsing).Content
     $resp | Select-String -Pattern "<title>"
     ```
     Confirms: title line contains "Exporting Data".
  5. Stop the container:
     ```powershell
     docker compose down
     Set-Location ..
     ```
  6. Append the following section to `website/CLAUDE.md` at the end of the file (after all existing content, including any section added by Task 3 if it has already run):

     ```markdown
     ---

     ## Local Docker Dev

     Use the Docker Compose setup in `website/` to build and preview the site locally before committing or deploying.

     ### Prerequisites

     Docker Desktop must be installed and its daemon must be running.

     ### Commands (run from `website/` directory)

     ```bash
     # Build the Docker image
     docker compose build

     # Start the container (serves at http://localhost:80)
     docker compose up -d

     # Stop the container
     docker compose down
     ```

     ### Verifying the site

     The nginx config uses `server_name mini-diarium.com`. Browsers and curl reject requests to `localhost` unless you either:

     - Pass the `Host` header explicitly:
       ```bash
       curl -H "Host: mini-diarium.com" http://localhost:80/
       ```
       On Windows PowerShell:
       ```powershell
       Invoke-WebRequest -Uri "http://localhost:80/" -Headers @{"Host"="mini-diarium.com"} -UseBasicParsing
       ```
     - Or add `127.0.0.1 mini-diarium.com` to your hosts file (`C:\Windows\System32\drivers\etc\hosts` on Windows, `/etc/hosts` on Linux/macOS) for full browser testing.

     ### Troubleshooting

     | Symptom | Fix |
     |---------|-----|
     | Port 80 already in use | Change `"80:80"` to `"8080:80"` in `docker-compose.yml` (local testing only; revert before committing) |
     | Stale cached layers | `docker compose build --no-cache` |
     | Container starts but returns 404 | Check that `bun run website:build-static` ran and `website/docs/` and `website/blog/` are populated |
     | `www.mini-diarium.com` redirects | The nginx config redirects `www.*` to the non-www host — expected behavior |

     > **Note:** This compose file is for local preview only. Production runs through Coolify with separate TLS, redirect, and caching configuration. Changes to `nginx.conf` here do not affect production.
     ```

- Validation:
  - `docker compose build` exits 0 (or task is BLOCKED if Docker unavailable).
  - HTTP 200 returned for `http://localhost:80/` **with `Host: mini-diarium.com` header** (without it, nginx defaults to the `www` server block and returns a redirect to `https://mini-diarium.com`, not 200).
  - `docker compose down` exits 0.
  - `website/CLAUDE.md` contains the `## Local Docker Dev` section with all sub-sections listed in step 6.

- Notes:
  - All Docker commands must be run from the `website/` directory (where `docker-compose.yml` lives).
  - If port 80 is in use, temporarily change the compose port mapping to `"8080:80"` for verification, then revert before committing.
  - Do not commit any temporary `docker-compose.yml` port changes.

---

### Task 5: Cleanup and mark TODOs done

- Status: COMPLETED
- Objective: TODO-0045, TODO-0047, and TODO-0048 are marked complete; a changelog entry is added; no intermediate artifacts remain.
- Steps:
  1. In `docs/todo/TODO.md`, change `[ ]` to `[x]` for each of the three TODOs:
     - `TODO-0045: Improve meta descriptions on docs pages`
     - `TODO-0047: Website docs layout and visual audit`
     - `TODO-0048: Verify and document local dev Docker for website`
  2. Inspect the worktree for any temporary files created during this task (scratch scripts, debug output, test logs). Remove any found.
  3. In `CHANGELOG.md`, append the following entries under `## [0.5.3] - [Unreleased]` in the appropriate section(s):

     Under `### Changed`:
     ```
     - **Website docs**: Improved meta descriptions on all 11 docs pages to 150–160 characters to resolve Bing Webmaster Tools flags (TODO-0045)
     - **Website docs**: Widened docs content column from ~500px to ~800px on desktop viewports by increasing the docs-page container max-width to 1400px (TODO-0047)
     ```

     Under `### Added`:
     ```
     - **Website**: Documented local Docker dev workflow in `website/CLAUDE.md` with build, serve, troubleshooting steps, and Host header note (TODO-0048)
     - **Website**: Added visual content audit decision table to `website/CLAUDE.md` recording which docs pages need screenshots (TODO-0047)
     ```

- Validation:
  - `docs/todo/TODO.md`: `TODO-0045`, `TODO-0047`, and `TODO-0048` all show `[x]`.
  - `CHANGELOG.md` contains the four new bullet entries.
  - No temporary artifacts in the worktree diff.

- Notes:
  - Do not remove this plan file. It serves as a permanent execution record.
  - If Task 4 was BLOCKED, still mark TODO-0048 as in-progress (not complete) and note the blocker in the TODO entry.

---

## Final Verification

Run the following sequence after all tasks are complete:

1. **Rebuild**: `bun run website:build-static` via PowerShell tool — must exit 0.
2. **Meta descriptions spot-check**: Open three generated HTML files and verify the `<meta name="description">` is 150–160 chars:
   - `website/docs/getting-started/index.html` → expect 151 chars
   - `website/docs/navigating/index.html` → expect 159 chars
   - `website/docs/preferences/index.html` → expect 159 chars
3. **Layout spot-check**: Open `website/docs/export/index.html`. Confirm the inline `<style>` block contains `.container { max-width: 1400px; }`.
4. **CLAUDE.md sections**: Confirm `website/CLAUDE.md` contains both `## Local Docker Dev` and `## Docs Page Visual Content Audit` sections.
5. **TODO status**: Confirm `docs/todo/TODO.md` shows `[x]` for TODO-0045, TODO-0047, and TODO-0048.

---

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] No open questions remain — none surfaced because all unknowns are either discoverable from the repo or safely handled as explicit assumptions.
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets — all descriptions include exact replacement text, character counts, CSS rules, and PowerShell commands.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [ ] (If dialog/interaction feature) N/A — no new UI interactions.
- [ ] (If Tauri WebView behavior) N/A — website-only changes.

---

## Decision Log

Pre-implementation decisions are recorded in [`plan-website-docs-improvements-decisions.md`](plan-website-docs-improvements-decisions.md) (entries D-01 through D-08).

**During execution:** if implementation diverges from what this plan specifies — different file location, different CSS approach, different description text, different Docker command — write a new entry in that file **before moving to the next task**. Do not log deviations retrospectively at the end.

A log entry is required whenever:
- You choose a different file, CSS rule, or command than what the plan specified.
- A validation step reveals the plan's approach is incorrect and you adapt.
- You skip a step with a rationale not already captured in the task's BLOCKED handling.

A log entry is **not** required for:
- Routine task execution that matches the plan exactly.
- Trivial wording differences that don't change meaning or outcome.

---

## Approval Gate

Implementation must not start until the user approves this plan.

---

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
- Run `bun run website:build-static` via the PowerShell tool every time docs-src or the generator script changes.
- If implementation diverges from the plan, write a new entry in `plan-website-docs-improvements-decisions.md` **before starting the next task** (see Decision Log section above for what qualifies).
