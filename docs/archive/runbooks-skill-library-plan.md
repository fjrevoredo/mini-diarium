# Mini Diarium Runbooks Skill Library Plan

## Metadata

- Plan Status: COMPLETED
- Created: 2026-06-21
- Last Updated: 2026-06-21
- Owner: Coding agent
- Approval: APPROVED

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Replace eight separately registered, low-frequency Mini Diarium workflow skills with one discoverable `runbooks` dispatcher that loads the selected complete skill on demand, while preserving every workflow, bundled resource, and project validation contract and replacing direct invocation with documented client-specific `runbooks` invocation.

## Scope

- Create `.agents/skills/runbooks/` as the canonical project skill library.
- Include these eight entries:
  - `add-locale`
  - `apply-dependency-prs`
  - `diagram-maintainer`
  - `implementation-review`
  - `integrate-stale-pr`
  - `pre-release`
  - `review-external-pr`
  - `update-app-icons`
- Preserve complete entry directories, including evals, scripts, assets, and `agents/openai.yaml` files.
- Update entry-local paths and invocation metadata that become invalid after nesting.
- Update Mini Diarium's skill synchronization so `.claude/skills/` exposes `runbooks` but not the eight former top-level entries.
- Update current, non-archived project instructions and documentation that directly reference the moved skills.
- Validate the library with both structural checks and fresh-client discovery/routing tests before removing the standalone sources.

## Non-Goals

- Moving any skill not explicitly listed above.
- Moving foundational or frequently automatic skills such as `manual-planning`, `todo-manager`, `sync-lockfiles`, `skill-improver`, `flathub-maintenance`, framework skills, or Rust plugin skills.
- Rewriting the workflows inside the eight entries except where nesting changes a path, invocation command, or mirror contract.
- Updating historical references under `docs/archive/`; those files document the repository state at the time they were written.
- Changing application behavior, user-facing documentation, release contents, or `CHANGELOG.md`.
- Introducing a duplicate machine-readable catalog or a custom library validator; the dispatcher table is the single catalog.

## Assumptions

- The dispatcher skill name will be `runbooks`, matching the user's requested terminology.
- Explicit activation is client-specific: Codex uses `$runbooks <entry>` in prompts, while Claude Code resolves project skills as `/runbooks <entry>`.
- `.agents/skills/` remains the canonical source and `.claude/skills/` remains the generated compatibility mirror.
- The eight selected workflows are intentionally manual or exceptional even where their existing descriptions contain broad automatic trigger phrases.
- All eight source skills passed the official `skills-ref` validator on 2026-06-21 before planning.
- The current clients are expected to discover direct skill children only, but this must be verified empirically before standalone registrations are removed.
- Existing unrelated worktree changes, if any appear during execution, belong to the user and must not be modified.

## Open Questions

- None.

## Tasks

### Task 1: Record the Baseline and Stage the Library Without Cutting Over

- Status: COMPLETED
- Objective: A testable `runbooks` library exists alongside the current standalone skills, with no original registration removed yet.
- Steps:
  1. Run `git status --short`, inventory the eight source directories, and record the current `.claude/skills/` entry type for each name (junction versus physical directory).
  2. Create `.agents/skills/runbooks/SKILL.md` with:
     - a concise manual-maintenance description;
     - routing instructions that load exactly one selected entry unless the request genuinely spans several;
     - explicit client-specific usage: `$runbooks <entry>` for Codex and `/runbooks <entry>` for Claude Code;
     - an `Available Skills` table containing all eight names, short routing descriptions, and `skills/<name>/ENTRY.md` paths;
     - unsupported-request behavior that does not invent entries.
  3. Create `.agents/skills/runbooks/agents/openai.yaml` with Codex display metadata and a default prompt using `$runbooks`.
  4. Copy each complete candidate directory into `.agents/skills/runbooks/skills/<name>/` for pre-cutover validation. Do not edit or remove the standalone source directories in this task.
- Validation:
  - `Get-ChildItem .agents/skills/runbooks/skills -Directory | Select-Object -ExpandProperty Name` returns exactly the eight approved names.
  - For every candidate, `git diff --no-index -- .agents/skills/<name> .agents/skills/runbooks/skills/<name>` reports no differences before path-specific nesting edits begin.
  - The original eight `.agents/skills/<name>/SKILL.md` files still exist.
- Notes: The temporary duplicate registration is intentional and exists only until the discovery gate passes. The dispatcher table is the single catalog; do not add `catalog.json`.

### Task 2: Make Nested Entry Resources and Invocations Relocatable

- Status: COMPLETED
- Objective: Every nested entry remains internally correct from its new canonical location.
- Steps:
  1. Update all `diagram-maintainer` references from `.agents/skills/diagram-maintainer/...` and clone-specific `/mnt/d/Repos/...` paths to repository-relative paths valid from the new location, including `.agents/skills/runbooks/skills/diagram-maintainer/scripts/render_diagram_previews.sh`.
  2. Update `.agents/skills/runbooks/skills/diagram-maintainer/agents/openai.yaml` so its default prompt activates `$runbooks diagram-maintainer`.
  3. Update `.agents/skills/runbooks/skills/implementation-review/agents/openai.yaml` so its default prompt activates `$runbooks implementation-review`.
  4. Search all eight nested directories for stale top-level skill paths and standalone invocation forms; update only references invalidated by the library migration.
  5. Preserve `add-locale/evals`, `pre-release/assets`, `review-external-pr/assets`, and every other bundled file unchanged unless a contained path is demonstrably stale.
- Validation:
  - `rg -n '\.agents/skills/(add-locale|apply-dependency-prs|diagram-maintainer|implementation-review|integrate-stale-pr|pre-release|review-external-pr|update-app-icons)' .agents/skills/runbooks/skills` returns no stale canonical paths.
  - `rg -n '/mnt/d/Repos/mini-diarium' .agents/skills/runbooks/skills` returns no matches.
  - `rg -n '\$(diagram-maintainer|implementation-review)' .agents/skills/runbooks/skills` returns no standalone invocation metadata.
  - `bash .agents/skills/runbooks/skills/diagram-maintainer/scripts/render_diagram_previews.sh --help` exits successfully.
- Notes: Generic prose such as “use the pre-release skill” may remain when it does not encode a broken path or unsupported invocation.

### Task 3: Validate the Staged Dispatcher and Every Nested Entry

- Status: COMPLETED
- Objective: The dispatcher and all eight entries comply with the Agent Skills specification and retain their complete resources.
- Steps:
  1. Validate `.agents/skills/runbooks/` with the current official `skills-ref`.
  2. Validate the staged nested entry documents by comparing them against the standalone sources, then preserve them as `ENTRY.md` after the discovery pivot.
  3. Verify each nested entry document still exists under the expected directory after the `SKILL.md` → `ENTRY.md` rename.
  4. Compare the staged directories against their standalone sources and confirm that differences are limited to the intentional relocation edits from Task 2.
  5. Validate `add-locale/evals/evals.json` as JSON and verify every expected bundled resource listed in Task 7 exists.
- Validation:
  - Run from PowerShell:
    ```powershell
    $env:PYTHONUTF8='1'
    uvx --from "git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref" skills-ref validate .agents/skills/runbooks
    python -m json.tool .agents/skills/runbooks/skills/add-locale/evals/evals.json > $null
    ```
  - All commands exit with code 0, and the staged diff audit shows only relocation edits plus the entrypoint rename.
- Notes: If an existing entry fails validation for a pre-existing reason unrelated to nesting, record and fix the smallest compliant defect before proceeding.

### Task 4: Prove Client Discovery Before Removing Standalone Skills

- Status: COMPLETED
- Objective: Both project skill consumers expose the dispatcher without recursively registering its nested entries.
- Steps:
  1. Create a temporary isolated Git repository outside the Mini Diarium worktree containing only:
     - `.agents/skills/runbooks/` copied from the staged library for Codex discovery;
     - `.claude/skills/runbooks/` copied from the staged library for Claude Code discovery;
     - a minimal `CLAUDE.md` stating that the test is read-only and asking clients not to modify files.
     Do not copy or expose the eight standalone skill directories.
  2. Start a fresh read-only Codex CLI process in the fixture and ask it to report the exact project skill names visible in its startup context:
     ```powershell
     codex -C <fixture> -s read-only -a never exec --ephemeral 'List only the project skill names available in this session.'
     ```
  3. Start a fresh read-only Claude Code print-mode process in the fixture and ask it to report the exact project skill names it can resolve:
     ```powershell
     Push-Location <fixture>
     try {
       claude -p --permission-mode plan --tools Read --no-session-persistence --setting-sources project 'List only the project skill names available in this session.'
     } finally {
       Pop-Location
     }
     ```
  4. Confirm `runbooks` appears once and no additional registration is created from `runbooks/skills/*`.
  5. In the fixture, invoke Codex with `$runbooks update-app-icons` and Claude Code with `/runbooks update-app-icons`. Require each client to report `skills/update-app-icons/ENTRY.md` and its first instruction without executing the workflow.
     ```powershell
     codex -C <fixture> -s read-only -a never exec --ephemeral '$runbooks update-app-icons. Do not execute the workflow. Report only the selected ENTRY.md path and its first instruction.'
     Push-Location <fixture>
     try {
       claude -p --permission-mode plan --tools Read --no-session-persistence --setting-sources project '/runbooks update-app-icons. Do not execute the workflow. Report only the selected ENTRY.md path and its first instruction.'
     } finally {
       Pop-Location
     }
     ```
  6. Attempt direct activation of the nested name with Codex `$update-app-icons` and Claude Code `/update-app-icons`. Require both to report that no such top-level skill is registered; instruct them not to search the filesystem.
  7. Test an unknown runbook entry and verify the dispatcher reports it as unsupported.
  8. Optionally test one natural-language request such as “use the app-icon maintenance runbook.” Record the result, but do not block cutover on automatic activation because this library is intentionally manual-first.
  9. Remove the temporary fixture after capturing the results.
  10. If either client directly activates a nested entry or cannot explicitly activate the dispatcher, mark the task `BLOCKED`, retain all standalone skills, and revise the layout before any cutover.
- Validation:
  - Fixture-based fresh-session evidence shows one `runbooks` registration and no nested `runbooks/skills/*` registrations.
  - Codex `$runbooks update-app-icons` and Claude Code `/runbooks update-app-icons` both route to `skills/update-app-icons/ENTRY.md`.
  - Codex `$update-app-icons` fails as an unavailable top-level skill in the fixture, and Claude Code's read-only fixture checks do not expose nested entries as top-level skills.
  - Unknown names such as `$runbooks nonexistent-runbook` and `/runbooks nonexistent-runbook` are rejected without loading an unrelated entry.
- Notes: This is a hard cutover gate required by `skill-library-creator`. Testing inside the live repository before cutover is insufficient because the existing standalone registrations use the same entry names and can mask recursive nested discovery.
  Pivot 2026-06-21: fresh Codex fixture discovery recursively registered `runbooks/skills/*` as top-level skills when nested entrypoints were named `SKILL.md`. Renaming the nested entrypoints to `ENTRY.md` resolved that Codex discovery issue in the isolated fixture.

### Task 5: Make Skill Synchronization Library-Aware and Cut Over Canonical Sources

- Status: COMPLETED
- Objective: Re-running skill synchronization deterministically removes stale direct mirrors and exposes only the `runbooks` dispatcher.
- Steps:
  1. Update `scripts/sync-skills.js` with an explicit `LIBRARY_SKILLS` set containing the eight entries now owned by `runbooks`.
  2. Implement a type-aware stale-mirror cleanup helper that accepts the mirror root and skill-name set as parameters so it can be tested without touching the repository:
     - construct destinations only as `join(target, knownName)`;
     - verify the destination's resolved parent is exactly `.claude/skills`;
     - use `lstatSync` rather than `existsSync` so broken junctions are still detected after their old `.agents/skills/<name>` targets are removed;
     - distinguish a junction/symlink from a physical directory;
     - remove a junction/symlink with `unlinkSync` so its target is never traversed;
     - remove a physical stale mirror with `rmSync(..., { recursive: true, force: true })`.
  3. Export the cleanup helper behind an ESM main-module guard so importing `scripts/sync-skills.js` from a test does not run the real repository sync.
  4. Add `scripts/sync-skills.test.js` using `node:test`. Cover a live directory symlink/junction, a broken directory symlink/junction, and a physical directory in a temporary fixture. The test must prove the live source target survives junction cleanup, broken links are removed, only known stale destinations are removed, and an out-of-scope sibling is untouched.
  5. Run the cleanup only for `LIBRARY_SKILLS`, before linking direct children. Refuse cleanup for a name while `.agents/skills/<name>` still exists, so an incomplete cutover fails visibly rather than silently hiding a canonical source.
  6. Preserve the existing `PLUGIN_SKILLS` exclusion behavior unchanged.
  7. Ensure the normal direct-child loop links `.agents/skills/runbooks` to `.claude/skills/runbooks`.
  8. After the Task 4 gate passes, move/remove the eight standalone `.agents/skills/<name>/` directories so the nested copies become canonical.
  9. Run `cmd.exe /c bun run sync-skills` twice to prove idempotency.
- Validation:
  - `node --check scripts/sync-skills.js` exits successfully.
  - `node --test scripts/sync-skills.test.js` passes and confirms the junction target remains intact.
  - `cmd.exe /c npx prettier --check scripts/sync-skills.js scripts/sync-skills.test.js` exits successfully.
  - Two consecutive `cmd.exe /c bun run sync-skills` runs succeed; the second creates no new links.
  - The eight direct `.claude/skills/<name>` paths do not exist.
  - `.claude/skills/runbooks` resolves to `.agents/skills/runbooks`.
  - The eight direct `.agents/skills/<name>` paths do not exist.
  - `PLUGIN_SKILLS` contents are unchanged.
- Notes: `.claude/skills/` contains both junction-backed and physical tracked mirrors today. Recursive deletion must never be used on a junction path; unlink the junction itself.

### Task 6: Update Current Routing Instructions and Live References

- Status: COMPLETED
- Objective: Current project guidance points agents and maintainers to the dispatcher or the new canonical nested paths without duplicating the runbook catalog.
- Steps:
  1. Update root `CLAUDE.md` in accordance with `docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md`:
     - add one concise cross-cutting pointer that low-frequency manual workflows live under `$runbooks <entry>`;
     - note the Claude Code equivalent `/runbooks <entry>` once, without repeating the full entry catalog;
     - update the icon checklist to `$runbooks update-app-icons`;
     - update release guidance to `$runbooks pre-release`;
     - mention `$runbooks apply-dependency-prs` only for GitHub dependency PR application, while keeping `sync-lockfiles` authoritative for ordinary `package.json` edits;
     - update the skill-sync gotcha to state that library entries are not mirrored individually.
  2. Update `docs/RELEASING.md` live references from `.agents/skills/pre-release/SKILL.md` to the dispatcher invocation and/or `.agents/skills/runbooks/skills/pre-release/ENTRY.md`.
  3. Update `docs/best-practices/WRITING_STYLE.md` to point to `.agents/skills/runbooks/skills/review-external-pr/ENTRY.md`, avoiding the generated `.claude` mirror as canonical documentation.
  4. Update the active `docs/todo/TODO_EXTRA.md` reference for `apply-dependency-prs` to its nested canonical path.
  5. Search current non-archive files for the eight old canonical paths and unsupported standalone invocation forms. Leave `docs/archive/` unchanged.
- Validation:
  - `rg -n '\.agents/skills/(add-locale|apply-dependency-prs|diagram-maintainer|implementation-review|integrate-stale-pr|pre-release|review-external-pr|update-app-icons)' --glob '!docs/archive/**' --glob '!docs/runbooks-skill-library-plan.md' --glob '!.git/**' .` returns no stale live references.
  - `rg -n '\.claude/skills/(add-locale|apply-dependency-prs|diagram-maintainer|implementation-review|integrate-stale-pr|pre-release|review-external-pr|update-app-icons)' --glob '!docs/archive/**' --glob '!docs/runbooks-skill-library-plan.md' --glob '!.git/**' .` returns no stale live references.
  - Root `CLAUDE.md` contains a pointer to `$runbooks` but does not duplicate all eight workflows or their procedures.
- Notes: `AGENTS.md` is a symlink to `CLAUDE.md` and must not be edited directly.

### Task 7: Run Integrated Routing, Resource, and Sync Regression Checks

- Status: COMPLETED
- Objective: The cut-over repository has one dispatcher registration, eight reachable entries, intact resources, and no stale direct mirrors.
- Steps:
  1. Re-run official validation for the dispatcher after cutover.
  2. Verify the dispatcher table contains exactly the eight approved entries and each listed `ENTRY.md` exists.
  3. Verify all expected bundled resources remain present:
     - `add-locale/evals/evals.json`
     - `diagram-maintainer/scripts/render_diagram_previews.sh`
     - both nested `agents/openai.yaml` files
     - `pre-release/assets/notification.template.json`
     - both `review-external-pr/assets` templates
  4. Re-run fresh-client discovery inspection after standalone removal.
  5. Exercise representative explicit routes for an implementation review, release preparation, diagram maintenance, and external PR review in both clients without executing their destructive or external-write actions.
  6. Inspect `git diff --summary`, `git diff --stat`, and `git diff` to confirm the migration is a scoped skill-library change.
  7. Inspect Git rename detection for `.agents/skills/` and `.claude/skills/`; confirm every old tracked file is represented as a deletion/rename and every nested canonical/mirror file is added.
- Validation:
  - The dispatcher `skills-ref` check passes.
  - Run this exact catalog/path check:
    ```powershell
    $expected = @(
      'add-locale',
      'apply-dependency-prs',
      'diagram-maintainer',
      'implementation-review',
      'integrate-stale-pr',
      'pre-release',
      'review-external-pr',
      'update-app-icons'
    ) | Sort-Object
    $actual = Get-ChildItem .agents/skills/runbooks/skills -Directory |
      Select-Object -ExpandProperty Name |
      Sort-Object
    if (Compare-Object $expected $actual) {
      throw 'Nested runbook directories do not match the approved catalog.'
    }
    $dispatcher = Get-Content .agents/skills/runbooks/SKILL.md -Raw
    foreach ($name in $expected) {
      $relativePath = "skills/$name/ENTRY.md"
      if (-not $dispatcher.Contains($relativePath)) {
        throw "Dispatcher is missing $relativePath"
      }
      if (-not (Test-Path ".agents/skills/runbooks/$relativePath")) {
        throw "Missing nested entry: $relativePath"
      }
    }
    ```
  - Fresh clients list `runbooks` and do not list the eight former standalone names.
  - Representative routing reads the correct nested entry document and bundled resources.
  - `git diff --summary -M` shows no unexplained lost resource files.
  - `git diff --check` exits successfully.
- Notes: Do not post PR comments, create releases, apply dependency PRs, or regenerate app assets merely to test routing.

### Task 8: Cleanup Intermediate Artifacts and Finalize the Plan Ledger

- Status: COMPLETED
- Objective: The worktree contains only the intended library, mirror, sync, and live-reference changes, with the plan accurately recording completion.
- Steps:
  1. Remove any temporary discovery fixtures, copied logs, scratch scripts, or routing-test outputs created during implementation.
  2. Confirm there are no duplicate standalone skill directories or stale `.claude/skills/` entries.
  3. Keep the dispatcher, nested complete skills, required mirror, durable sync behavior, and this plan.
  4. Keep `scripts/sync-skills.test.js`; it is a durable regression test, not an intermediate artifact.
  5. Do not add a changelog entry because this is internal agent tooling and does not change Mini Diarium user-facing behavior.
  6. Reconcile every task status and validation result in this plan; set `Plan Status` to `COMPLETED` only after final verification passes.
- Validation:
  - `git status --short` and `git diff --stat` contain only intentional final files.
  - No temporary files or directories remain.
  - The plan contains no stale “pending validation” statements after checks complete.
- Notes: Do not remove unrelated user changes.

## Final Verification

Run or complete all of the following after Task 8:

```powershell
$env:PYTHONUTF8='1'
uvx --from "git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref" skills-ref validate .agents/skills/runbooks
node --check scripts/sync-skills.js
node --test scripts/sync-skills.test.js
cmd.exe /c npx prettier --check scripts/sync-skills.js scripts/sync-skills.test.js
cmd.exe /c bun run sync-skills
cmd.exe /c bun run sync-skills
git diff --check
git status --short
```

Additionally verify:

- `.agents/skills/runbooks/skills/` contains exactly the eight approved entries.
- `.claude/skills/runbooks` is the only mirror registration for those workflows.
- Fresh Codex sessions expose `runbooks` but not the eight former standalone skills, and the read-only Claude Code fixture routes through `/runbooks` without exposing nested library entries as separate top-level skills.
- Codex `$runbooks <entry>` and Claude Code `/runbooks <entry>` route to the requested nested entry document, and unknown entries fail closed.
- All live non-archive path references resolve.

## Plan Self-Check

- [x] Plan location follows the default location rule.
- [x] Plan status is `READY FOR APPROVAL`.
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Zero unanswered questions remain.
- [x] Every task has concrete steps and validation.
- [x] The plan has eight tasks, so the simple-plan format is appropriate.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [x] No UX dialog or Tauri WebView behavior is involved; UX-GATE and PLATFORM-VERIFY are not applicable.
- [x] The `skill-library-creator` requirements are covered: coherent boundary, complete entry preservation, pre-cutover discovery proof, routing tests, mirror cleanup, and final catalog inspection.
- [x] Root context-file edits are limited to stable pointers and gotchas rather than duplicated runbook procedures.
- [x] Client-specific activation syntax is explicit, consistent with the installed CLI conventions, and scheduled for empirical verification in Task 4.
- [x] Junction cleanup is type-aware, path-scoped, and tested before operating on the real mirror.

Self-check result: PASS.

## Approval Gate

The original approval gate has been satisfied. Keep this section only as historical context for how execution started.

## Execution Notes

- Update task status to `IN PROGRESS` before starting each task.
- Update task status to `COMPLETED` immediately after its validation passes.
- Mark tasks `BLOCKED` with a short reason when progress cannot continue.
- Task 4 is a hard gate: do not remove standalone skills unless both client discovery checks prove nested entries are not separately registered.
- Preserve unrelated user changes and keep the migration as one logical implementation scope.
