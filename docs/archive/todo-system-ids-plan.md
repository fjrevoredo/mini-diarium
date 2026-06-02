# TODO System IDs & Manager Skill Plan

## Metadata

- Plan Status: COMPLETED
- Created: 2026-05-07
- Last Updated: 2026-05-07
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

1. Assign unique 4-digit IDs (`TODO-0001`–`TODO-0021`) to every top-level checkbox item in the main TODO file.
2. Restructure files into `docs/todo/` with a clear three-file system: `TODO.md` (active backlog), `TODO_ARCHIVE.md` (completed), `TODO_EXTRA.md` (structured implementation detail linked to parent TODOs via `TODO-XXXX-YY`).
3. Create a `.agents/skills/todo-manager/` skill that systematizes creation, tracking, archival, and validation of TODO items.

## Scope

- Design and document the full ID scheme:
  - `TODO-XXXX` (4-digit zero-padded, e.g. `TODO-0001`) for top-level TODO items
  - Indented sub-items under a TODO remain **unmarked** (free-form, no ID)
  - `TODO-XXXX-YY` (e.g. `TODO-0001-01`) for extra/implementation detail items linked to a parent TODO
- Restructure file layout: move `docs/TODO.md`, `docs/archive/TODO_ARCHIVE.md`, `docs/OPEN_TASKS.md` into `docs/todo/`
- Retool IDs onto all 19 top-level TODO items
- Rename `OPEN_TASKS.md` → `TODO_EXTRA.md` and add `TODO-XXXX-YY` IDs to its items, linking each to a parent TODO entry
- Create `.agents/skills/todo-manager/SKILL.md`
- Audit and update **all** cross-file path references (44 occurrences across 14 files)
- Update `AGENTS.md` to reference the new skill and new paths

## Non-Goals

- Changing the archival logic in the `pre-release` skill beyond path updates
- Adding IDs to indented sub-items in `TODO.md` (they stay free-form)
- Keeping OPEN_TASKS items that lack a TODO counterpart (they are removed)
- Creating automated scripts — the skill is an agent workflow skill, not executable code
- Modifying files under `.claude/agent-memory/` (historical audit records)

## Assumptions

- IDs are never reused
- Existing archived entries in `TODO_ARCHIVE.md` are left as-is (no retroactive IDs) — only forward-looking items get IDs
- Completed items still in `TODO.md` (currently 3 `[x]` items) DO get IDs so they carry them into the archive when eventually moved
- The next available ID is determined by scanning existing IDs at creation time — no separate counter file
- The pre-release skill's Step 4 pattern-based logic (`- [x] **...** — ...`) continues to work with `- [x] **TODO-XXXX: Title** — description`
- If `docs/archive/` becomes empty after the moves, remove the directory
- The 21 existing top-level items include 3 already-completed `[x]` items; they get IDs so they can be referenced in the archive

## Open Questions

None — all resolved:
1. ID format: `TODO-0001` (4-digit zero-padded) inside bold. ✅ Confirmed.
2. OPEN_TASKS items without TODO counterparts: remove them. ✅
3. Completed OPEN_TASKS items (59, 60, 71): remove them — they are implementation context, not TODOs. ✅
4. Existing archived entries in `TODO_ARCHIVE.md`: leave as-is, no retroactive IDs. ✅

## Milestones

### Milestone 1: Restructure File Layout

- Status: TO BE DONE
- Purpose: Consolidate TODO-related files into a single `docs/todo/` directory with clear roles.
- Exit Criteria:
  - `docs/todo/TODO.md` exists with the same content as the original `docs/TODO.md`
  - `docs/todo/TODO_ARCHIVE.md` exists with the same content as the original `docs/archive/TODO_ARCHIVE.md`
  - `docs/todo/TODO_EXTRA.md` exists with the renamed content from `docs/OPEN_TASKS.md` (header updated to reflect new name/role)
  - Original files at old paths are removed
  - `docs/archive/` directory is removed if empty; other files in `docs/archive/` that are NOT `TODO_ARCHIVE.md` (e.g. plans, reviews) stay where they are

#### Task 1.1: Create `docs/todo/` and move TODO.md

- Status: TO BE DONE
- Objective: The main TODO file lives at `docs/todo/TODO.md`.
- Steps:
  1. Create `docs/todo/` directory.
  2. Move `docs/TODO.md` → `docs/todo/TODO.md`.
  3. Verify the move with file existence checks.
- Validation: `Test-Path -LiteralPath docs/todo/TODO.md` returns true; old path no longer exists.
- Notes: No content changes at this stage — pure file move.

#### Task 1.2: Move TODO_ARCHIVE.md into `docs/todo/`

- Status: TO BE DONE
- Objective: The archive file lives at `docs/todo/TODO_ARCHIVE.md`.
- Steps:
  1. Move `docs/archive/TODO_ARCHIVE.md` → `docs/todo/TODO_ARCHIVE.md`.
  2. Check if `docs/archive/` is now empty; if so, remove `docs/archive/`.
- Validation: `Test-Path -LiteralPath docs/todo/TODO_ARCHIVE.md` returns true.
- Notes: Other files in `docs/archive/` (plans, reviews) stay where they are. Only remove `docs/archive/` if it becomes an empty directory.

#### Task 1.3: Rename OPEN_TASKS.md → TODO_EXTRA.md

- Status: TO BE DONE
- Objective: `docs/todo/TODO_EXTRA.md` exists with a header explaining its role.
- Steps:
  1. Move `docs/OPEN_TASKS.md` → `docs/todo/TODO_EXTRA.md`.
  2. Update the file's header (first 10 lines) to reflect the new name and the `TODO-XXXX-YY` linking convention.
  3. Retain all existing content below the header unchanged (ID assignment happens in Milestone 2).
- Validation: File exists at new path. Header explains the `TODO-XXXX-YY` linking convention.
- Notes: Do not modify body content in this task — that's Task 2.3.

---

### Milestone 2: Assign IDs to All Items

- Status: TO BE DONE
- Purpose: Every top-level TODO item gets a unique `TODO-XXXX` ID; every EXTRA item gets a `TODO-XXXX-YY` ID linked to its parent.
- Exit Criteria:
  - `TODO.md` has exactly 21 top-level items with `TODO-XXXX` IDs, sequential from `TODO-0001` to `TODO-0021`
  - No ID is duplicated
  - `TODO_EXTRA.md` items have `TODO-XXXX-YY` IDs linking to their parent TODOs
  - The TODO.md format header is updated to document the new conventions

#### Task 2.1: Add TODO-XXXX IDs to Top-Level Items in TODO.md

- Status: TO BE DONE
- Objective: Every top-level `- [` line in `docs/todo/TODO.md` carries a `**TODO-XXXX: Title**` ID.
- Steps:
  1. Read `docs/todo/TODO.md`.
  2. From the first `- [` line to the last, assign `TODO-0001` through `TODO-0021` sequentially (21 top-level items, 3 already `[x]`).
  3. Transform each top-level line: `- [ ] **Title** — description` → `- [ ] **TODO-XXXX: Title** — description`.
  4. Completed items keep `[x]` prefix: `- [x] **TODO-XXXX: Title** — description`.
  5. Indented sub-items (2 lines) remain unchanged — no ID, same format as before.
  6. Preserve all blank lines and section headers exactly.
- Validation:
  - `rg -c '\*\*TODO-\d{4}:' docs/todo/TODO.md` returns exactly 21.
  - `rg -o 'TODO-\d{4}' docs/todo/TODO.md | sort | Get-Unique` shows all 21 IDs (001 to 021) exactly once each.
  - Indented sub-items show 0 matches for `TODO-` pattern.
- Notes:
  - The TODO item about "TODO system IDs and E2E skill" itself gets an ID (likely `TODO-0010`).
  - Affected file: `docs/todo/TODO.md`.

#### Task 2.2: Update TODO.md Format Header

- Status: TO BE DONE
- Objective: The "TODO entry format" section documents the new ID conventions.
- Steps:
  1. In `docs/todo/TODO.md` (the format documentation section near the top), add a bullet describing the `TODO-XXXX` ID requirement for top-level items.
  2. Add a bullet clarifying that indented sub-items are free-form and do not carry IDs.
  3. Add a note referencing `docs/todo/TODO_EXTRA.md` as the place for structured implementation detail.
- Validation: Reading the header section of `docs/todo/TODO.md` shows the updated conventions.
- Notes: Affected file: `docs/todo/TODO.md` (header only, ~lines 5–12).

#### Task 2.3: Prune and Add TODO-XXXX-YY IDs to TODO_EXTRA.md

- Status: TO BE DONE
- Objective: `TODO_EXTRA.md` contains only items that have a TODO counterpart, each with a `TODO-XXXX-YY` ID linking to its parent. Unlinked and completed items are removed.
- Steps:
  1. Read `docs/todo/TODO_EXTRA.md` (the renamed `OPEN_TASKS.md`).
  2. Identify items that map to an existing TODO:
     - "PDF Export" (Task 42) → links to `TODO-XXXX` for "PDF export"
     - "Text Input Extension Point" (Task 67) → links to `TODO-XXXX` for "Text input extension point"
     - "Deferred: Per-post OG Images (P4-F)" → links to `TODO-XXXX` for "Website SEO/GEO follow-up backlog"
  3. Remove all other items (no TODO counterpart, or completed):
     - Tasks 47, 48 (i18n — no TODO counterpart)
     - Task 52 (Accessibility Audit — no TODO counterpart)
     - Task 53 (Legacy Migration — no TODO counterpart)
     - Task 58 (QA Pass — no TODO counterpart)
     - Tasks 59, 60, 71 (completed — implementation context, not TODOs)
     - Task 66 (Extension System — no TODO counterpart)
  4. Update `TODO_EXTRA.md` header to explain the `TODO-XXXX-YY` linking format and that items without a parent TODO are not retained.
  5. Assign `TODO-XXXX-YY` IDs: e.g. `### TODO-0007-01 PDF Export`, `### TODO-0008-01 Text Input Extension Point`, `### TODO-0014-01 Deferred: Per-post OG Images`.
  6. Replace the old "Progress Summary" table at the bottom with a brief footer or remove it entirely.
- Validation:
  - Every remaining section heading in `TODO_EXTRA.md` has a `TODO-XXXX-YY` prefix.
  - No `TODO-XXXX-YY` ID repeats.
  - All parent `TODO-XXXX` IDs referenced actually exist in `docs/todo/TODO.md`.
  - No completed task sections (59, 60, 71) remain.
  - No orphan items (without a TODO counterpart) remain.
- Notes:
  - The exact `XXXX` numbers depend on the IDs assigned in Task 2.1.

---

### Milestone 3: Create the TODO Manager Skill

- Status: TO BE DONE
- Purpose: A reusable agent skill that covers the full TODO lifecycle.
- Exit Criteria:
  - `.agents/skills/todo-manager/SKILL.md` exists with valid YAML frontmatter
  - All four operations (Create, Track, Archive, Validate) have concrete, actionable instructions
  - The skill references the correct file paths (`docs/todo/`)

#### Task 3.1: Create `.agents/skills/todo-manager/SKILL.md`

- Status: TO BE DONE
- Objective: A complete skill file modeled after existing repo skills.
- Steps:
  1. Create `.agents/skills/todo-manager/` directory.
  2. Write `SKILL.md` with:
     - YAML frontmatter (`name: todo-manager`, `description` with trigger keywords).
     - **Create** operation: validate format, scan for highest `TODO-XXXX`, increment, insert in correct priority section, format per conventions.
     - **Track** operation: report open/closed counts by section, list stale items, confirm ID uniqueness and sequential order.
     - **Archive** operation: move completed items from `docs/todo/TODO.md` to `docs/todo/TODO_ARCHIVE.md` (insert today's date between `**...**` and ` — `), remove lines from TODO.md, preserve indented sub-items as part of the archived block. Note this complements the pre-release skill.
     - **Validate** operation: check all `TODO-XXXX` IDs are unique, sequential (no gaps), and properly formatted; verify no item in TODO.md carries `[x]` without an archive date; verify `TODO_EXTRA.md` IDs all reference valid parent IDs.
  3. Include a Format Reference table, Key Files table, and Common Pitfalls section (following the pattern from `add-locale/SKILL.md`).
- Validation:
  - File exists at `.agents/skills/todo-manager/SKILL.md`.
  - YAML frontmatter is valid.
  - All four operations have step-by-step instructions.
  - File paths in the skill match post-restructure locations (`docs/todo/` prefix).
- Notes: Model structure after `.agents/skills/add-locale/SKILL.md` and `.agents/skills/pre-release/SKILL.md`.

---

### Milestone 4: Update All Cross-File Path References

- Status: TO BE DONE
- Purpose: Every file in the repo that references old paths is updated to the new `docs/todo/` locations.
- Exit Criteria:
  - `rg 'docs/TODO\.md' --iglob '!docs/todo/**' --iglob '!docs/archive/**'` returns zero results (excluding the plan file and the todo files themselves)
  - `rg 'docs/archive/TODO_ARCHIVE'` returns zero results in active files
  - `rg 'docs/OPEN_TASKS\.md'` returns zero results (excluding archive docs and the plan file)
  - Pre-release skill references updated in both `.agents/skills/` and `.claude/skills/` copies

#### Task 4.1: Audit All Path References

- Status: TO BE DONE
- Objective: A complete inventory of every line that needs updating.
- Steps:
  1. Run `rg 'docs/TODO\.md' --iglob '!docs/todo/**'` to find all references to the old TODO path.
  2. Run `rg 'docs/archive/TODO_ARCHIVE'` for old archive path references.
  3. Run `rg 'docs/OPEN_TASKS\.md'` for old OPEN_TASKS path references.
  4. Compile a list of files and line numbers. Known files (from initial audit):
     - `AGENTS.md` — 2 occurrences (lines 9, 303)
     - `CLAUDE.md` (root) — 1 occurrence
     - `PHILOSOPHY.md` — 1 occurrence
     - `.agents/skills/pre-release/SKILL.md` — 3 occurrences
     - `.claude/skills/pre-release/SKILL.md` — 3 occurrences (mirror copy)
     - `.claude/agents/github-issue-tracker.md` — 5 occurrences
     - `.claude/agents/docs-sync-guardian.md` — 2 occurrences
     - `.claude/agent-memory/docs-sync-guardian/TODO-audit-2026-02-23.md` — 1 occurrence (historical — consider skipping)
     - `docs/archive/seo-geo-implementation-plan.md` — 2 occurrences (archive doc — consider skipping)
     - `docs/wip/text-input-extension-design.md` — 2 occurrences (WIP doc)
     - `docs/wip/PRODUCING_OSS_INSIGHTS_2026-03-28.md` — 1 occurrence (WIP doc)
  5. Mark which files to update and which to skip (archive/historical docs).
- Validation: The inventory list is complete and matches the grep results.
- Notes: Historical files (`.claude/agent-memory/`, `docs/archive/`) may be left unmodified.

#### Task 4.2: Update Pre-Release Skill (Both Copies)

- Status: TO BE DONE
- Objective: The pre-release skill references `docs/todo/TODO.md` and `docs/todo/TODO_ARCHIVE.md`.
- Steps:
  1. Update `.agents/skills/pre-release/SKILL.md`:
     - `docs/TODO.md` → `docs/todo/TODO.md` (lines 54, 71, 120)
     - `docs/archive/TODO_ARCHIVE.md` → `docs/todo/TODO_ARCHIVE.md` (lines 66, 120)
  2. Update `.claude/skills/pre-release/SKILL.md` with the same changes (lines 63, 75, 80, 130).
- Validation: `rg 'docs/TODO\.md' .agents/skills/pre-release/SKILL.md` returns zero matches. Same for `.claude/skills/pre-release/SKILL.md`.
- Notes: These are the most critical path updates — the pre-release skill runs automatically.

#### Task 4.3: Update Core Docs (AGENTS.md, CLAUDE.md, PHILOSOPHY.md)

- Status: TO BE DONE
- Objective: Root-level documentation references the new paths.
- Steps:
  1. `AGENTS.md` (lines 9, 303): `docs/OPEN_TASKS.md` → `docs/todo/TODO_EXTRA.md`, `docs/TODO.md` → `docs/todo/TODO.md`.
  2. `CLAUDE.md` (line 9): same update.
  3. `PHILOSOPHY.md` (line 244): `docs/TODO.md` → `docs/todo/TODO.md`.
- Validation: `rg 'docs/(TODO|OPEN_TASKS)\.md' AGENTS.md CLAUDE.md PHILOSOPHY.md` returns zero.
- Notes: Keep the prose meaning intact; only update paths.

#### Task 4.4: Update Agent Definitions and WIP Docs

- Status: TO BE DONE
- Objective: Agent definitions and working documents reference the new paths.
- Steps:
  1. `.claude/agents/github-issue-tracker.md` (5 occurrences): update all TODO and OPEN_TASKS path references.
  2. `.claude/agents/docs-sync-guardian.md` (2 occurrences): update references.
  3. `docs/wip/text-input-extension-design.md` (2 occurrences): update `docs/OPEN_TASKS.md` → `docs/todo/TODO_EXTRA.md`.
  4. `docs/wip/PRODUCING_OSS_INSIGHTS_2026-03-28.md` (1 occurrence): update.
- Validation: Grep for old paths in these files returns zero.
- Notes: Skip `.claude/agent-memory/` and `docs/archive/` files — they are historical snapshots.

---

### Milestone 5: Cleanup and Final Verification

- Status: TO BE DONE
- Purpose: Ensure the complete change is valid and the worktree is clean.
- Exit Criteria:
  - All IDs unique and sequential
  - All path references updated
  - No stale files remain
  - Format and lint pass

#### Task 5.1: Final Validation

- Status: TO BE DONE
- Objective: The complete system passes all correctness checks.
- Steps:
  1. Verify TODO.md IDs: `rg -o 'TODO-\d{4}' docs/todo/TODO.md | sort` — expect `TODO-0001` through `TODO-0021` with no gaps.
  2. Verify no duplicate IDs: `rg -o 'TODO-\d{4}' docs/todo/TODO.md | sort | Get-Unique` matches count from step 1.
  3. Verify TODO_EXTRA.md IDs follow `TODO-XXXX-YY` pattern and parent IDs all exist in TODO.md.
  4. Run full path audit: zero references to old paths in active files.
  5. Run `cmd.exe /c bun run format` — no unexpected changes.
  6. Run `cmd.exe /c bun run lint` — passes.
  7. Run `cmd.exe /c bun run type-check` — passes.
  8. Manually trace one archive operation using the `todo-manager` skill instructions.
  9. Verify `docs/archive/` state: either removed (if empty) or contains only non-TODO files.
- Validation: All checks pass.

#### Task 5.2: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary files, scratch scripts, or notes.
  2. Remove only artifacts not part of the intended final state.
  3. Keep this plan file (`docs/todo-system-ids-plan.md`) until the plan is COMPLETED.
- Validation: `git status` shows only intended final changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

## Final Verification

```bash
# ID count (21 top-level TODO items)
cmd.exe /c "rg -c '\*\*TODO-\d{4}:' docs/todo/TODO.md"

# Duplicate check
cmd.exe /c "rg -o 'TODO-\d{4}' docs/todo/TODO.md | sort | Get-Unique | measure-object"

# Zero stale paths in active files
cmd.exe /c "rg 'docs/TODO\.md' --iglob '!docs/todo/**' --iglob '!docs/archive/**' --iglob '!docs/todo-system-ids-plan.md'"

# Zero stale OPEN_TASKS references
cmd.exe /c "rg 'docs/OPEN_TASKS\.md' --iglob '!docs/todo/**' --iglob '!docs/archive/**' --iglob '!docs/todo-system-ids-plan.md'"

# Format and lint
cmd.exe /c bun run format
cmd.exe /c bun run lint
cmd.exe /c bun run type-check
```

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/todo-system-ids-plan.md`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] All open questions are resolved and documented.
- [x] Tasks are grouped into milestones because the plan has more than 10 tasks.
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
