# Port todo-manager Skill to agent-skills Repo

## Metadata

- Plan Status: COMPLETED
- Created: 2026-05-17
- Last Updated: 2026-05-17
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Create a repo-agnostic version of the `todo-manager` skill at `D:\Repos\agent-skills\todo-manager\SKILL.md` that matches the structure and patterns of the existing `manual-planning` skill in that repo, removing all Mini Diarium-specific file paths and conventions.

## Scope

- Port the four operations (Create, Track, Archive, Validate) from the Mini Diarium skill
- Remove hardcoded path references from the skill body (operations, validation, key files sections)
- Make file paths configurable via YAML frontmatter defaults (`todo_path`, `archive_path`, `extra_path`)
- Match the `manual-planning` skill's structure: metadata-driven, lifecycle states, task/milestone rules, self-check, approval gate patterns where applicable
- Preserve the core TODO format rules (sequential IDs, em-dash, archive date position, no IDs on sub-items)
- Replace toolchain-specific validation commands with shell-agnostic descriptions
- Include full YAML frontmatter with `name`, `description` (with trigger keywords), and path configuration fields

## Non-Goals

- Modifying the original Mini Diarium `todo-manager` skill (it stays as-is for that repo)
- Adding new features beyond what the current skill provides
- Changing the TODO file format itself
- Creating a generic skill loader or installer

## Assumptions

- The target repo `D:\Repos\agent-skills` uses the same `SKILL.md` format with YAML frontmatter as the source
- The `manual-planning` skill's structural patterns (lifecycle, self-check, task rules) are the reference model
- The skill should work for any repo that uses a `TODO.md`-based backlog system, not just Mini Diarium's specific layout

## Open Questions

- None — all questions answered below.

### Resolved Questions

1. **File path discovery:** Configurable via frontmatter. The skill will define default paths in its YAML frontmatter (e.g., `todo_path: docs/todo/TODO.md`), and agents can override these if the target repo uses a different layout.
2. **Validation commands:** Shell-agnostic descriptions. Replace `rg`/PowerShell-specific commands with descriptive validation steps (e.g., "verify no duplicate IDs exist", "confirm IDs are sequential") and let the agent adapt to the local toolchain.
3. **Frontmatter style:** With frontmatter. The ported skill will include YAML frontmatter (`---` block) like the current Mini Diarium skill, even though `manual-planning` doesn't use it — this is intentional to preserve the skill's metadata-driven configuration.
4. **TODO_EXTRA.md support:** Keep as standard. The `TODO_EXTRA.md` integration remains a standard part of the skill with full validation checks. Repos that don't use it can ignore those sections.

## Tasks

### Task 1: Draft the Repo-Agnostic SKILL.md

- Status: COMPLETED
- Objective: Write `D:\Repos\agent-skills\todo-manager\SKILL.md` with all Mini Diarium-specific paths removed and patterns aligned to the agent-skills repo conventions.
- Steps:
  1. Create the directory `D:\Repos\agent-skills\todo-manager\`
  2. Write YAML frontmatter with `name: todo-manager`, `description` (with broad trigger keywords), and path config fields (`todo_path: docs/todo/TODO.md`, `archive_path: docs/todo/TODO_ARCHIVE.md`, `extra_path: docs/todo/TODO_EXTRA.md`)
  3. Write a repo-agnostic skill description and quick reference table (adapted from the source)
  4. Port all four operations (Create, Track, Archive, Validate) replacing hardcoded paths with frontmatter variable references
  5. Keep `TODO_EXTRA.md` integration as a standard part of the skill (all four operations reference it where applicable)
  6. Replace `rg`/PowerShell validation commands with shell-agnostic descriptions (e.g., "verify no duplicate IDs exist", "confirm IDs are sequential from the first ID to the highest")
  7. Remove Mini Diarium-specific content: the `pre-release` skill compatibility note, the "Latest TODO ID" marker reference, and any diary/journal-specific language
  8. Add a "Key Files Reference" table using the frontmatter path variables
  9. Preserve all format rules (ID sequencing, em-dash, archive date position, sub-item rules, no IDs on sub-items)
  10. Include the Common Pitfalls section, adapted to be repo-agnostic
- Validation: The skill file exists at `D:\Repos\agent-skills\todo-manager\SKILL.md` and can be read end-to-end without any reference to "Mini Diarium", "diary", "diarium", or "journal" in the skill body. Path references appear only in frontmatter as configurable defaults, not hardcoded in operation steps or validation sections.
- Notes: This is the core deliverable. The structural analysis from the source vs target patterns is already captured in the plan's assumptions.

### Task 2: Validate Against Target Patterns

- Status: COMPLETED
- Objective: Ensure the new skill matches the structural conventions of the agent-skills repo.
- Steps:
  1. Compare the new `todo-manager/SKILL.md` frontmatter against `skill-improver/SKILL.md` (both have frontmatter) for consistency in `name` and `description` format
  2. Compare section organization against `manual-planning/SKILL.md` for structural alignment
  3. Verify trigger keywords in the description follow the same pattern as other skills in the repo
  4. Confirm the skill's lifecycle references, self-check patterns, and task rules are consistent with the repo's conventions
- Validation: Side-by-side comparison confirms: (a) frontmatter `name`/`description` format matches `skill-improver`, (b) section structure is consistent with `manual-planning`, (c) no structural contradictions between skills.
- Notes: None.

### Task 3: Cross-Repo Consistency Check

- Status: COMPLETED
- Objective: Verify the original Mini Diarium skill is unaffected and the new skill is fully independent.
- Steps:
  1. Confirm `D:\Repos\mini-diarium\.agents\skills\todo-manager\SKILL.md` is unchanged
  2. Search the new skill for residual Mini Diarium references: "mini-diarium", "diary", "diarium", "journal"
  3. Verify the new skill's trigger keywords are broad enough to fire in any repo context
  4. Confirm no hardcoded path references remain in the skill body (paths appear only in frontmatter as configurable defaults)
- Validation: `grep` for "mini-diarium", "diary", "diarium", "journal" in the new skill returns zero matches. Original file is untouched.
- Notes: None.

### Task 4: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect both repos for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep the plan file itself if the user wants it retained; otherwise remove it.
- Validation: The only new file in `D:\Repos\agent-skills` is `todo-manager/SKILL.md`. No temporary files remain.
- Notes: Do not remove user-provided files or unrelated worktree changes.

## Final Verification

- The new skill exists at `D:\Repos\agent-skills\todo-manager\SKILL.md`
- No references to "Mini Diarium", "diary", "diarium", or "journal" remain in the skill body
- Path references appear only in frontmatter as configurable defaults, not hardcoded in operation steps or validation sections
- YAML frontmatter includes `name`, `description` with trigger keywords, and path config fields
- The skill structure matches the conventions of existing skills in the agent-skills repo
- The original Mini Diarium skill at `D:\Repos\mini-diarium\.agents\skills\todo-manager\SKILL.md` is unchanged
- All open questions have been answered and incorporated
- No temporary files or artifacts remain in either repo

## Plan Self-Check

- [x] Plan location follows the default location rule.
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] All open questions have been asked via the question tool, answered by the user, and recorded in the plan.
- [x] Zero unanswered questions remain.
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Approval Gate

Implementation must not start until the user approves this plan AND all open questions are answered.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
