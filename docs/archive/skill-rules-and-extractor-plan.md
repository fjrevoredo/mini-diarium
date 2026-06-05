# Create SKILL_RULES.md and Skill Extractor

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

Create two deliverables in the `agent-skills` repo:

1. **`SKILL_RULES.md`** — A repo-wide standards document that defines the rules, format, best practices, and conventions all skills in this repo must adhere to. This serves as the single source of truth for skill quality, derived from the agentskills.io documentation, the existing skill-creator skill, and lessons learned from porting `todo-manager`.

2. **`skill-extractor/SKILL.md`** — A new "meta" skill that takes a repo-specific skill (like the original Mini Diarium `todo-manager`) and transforms it into a generic, reusable skill for this repo. It uses the rules from `SKILL_RULES.md` plus additional extraction logic to produce skills in the best possible shape.

## Scope

- `SKILL_RULES.md` covers: frontmatter format, description optimization, progressive disclosure, gotchas, templates, validation, testing, scripts, and quality gates
- `skill-extractor/SKILL.md` covers: the full extraction workflow from source skill analysis to generic skill creation, including template usage, path generalization, and description optimization
- Both deliverables follow the agentskills.io best practices for skill creation
- The skill extractor should be usable with any repo-specific skill, not just Mini Diarium's

## Non-Goals

- Modifying existing skills in the repo (they stay as-is unless the extractor is run on them)
- Creating automated tooling or scripts for extraction (the extractor is a skill, not a script)
- Building a skill registry, installer, or loader
- Changing the agentskills.io specification or conventions

## Assumptions

- The `agent-skills` repo is the canonical location for reusable, repo-agnostic skills
- All future skills added to this repo should conform to `SKILL_RULES.md`
- The skill extractor will be used by agents (not humans directly) to port skills
- The agentskills.io documentation represents the current best practices for skill creation
- The existing three skills (`manual-planning`, `skill-improver`, `todo-manager`) serve as reference implementations

## Open Questions

- None — all questions answered below.

### Resolved Questions

1. **SKILL_RULES.md location:** Repo root (`D:\Repos\agent-skills\SKILL_RULES.md`) — visible to all agents working in this repo, not hidden in a subdirectory.
2. **Skill extractor output scope:** SKILL.md + optional dirs checklist. The extractor creates the SKILL.md and provides a checklist of optional directories (`assets/`, `references/`, `scripts/`) the agent should consider creating based on the source skill's needs, rather than always creating the full structure.
3. **Description optimization depth:** Two distinct, separate steps. Step 1 (creation) writes a first-pass description following SKILL_RULES.md principles. Step 2 (optimization) is a separate phase that runs the full optimization loop (train/val split, iterative refinement, eval queries) after the skill is created. These must not be mixed — the extraction workflow produces the skill first, then the optimization phase refines the description.
4. **SKILL_RULES.md enforcement:** Both advisory and enforced. SKILL_RULES.md serves as the reference document for any agent creating skills manually in this repo. Additionally, the skill extractor validates against SKILL_RULES.md as a mandatory step (Step 7), blocking completion if rules are violated.
5. **Version field in frontmatter:** All skills in this repo must include `version: X.Y.Y` in their frontmatter (established by the `todo-manager` port). `SKILL_RULES.md` mandates this with semantic versioning guidance.

## Tasks

### Task 1: Draft SKILL_RULES.md

- Status: COMPLETED
- Objective: Write `D:\Repos\agent-skills\SKILL_RULES.md` as the repo-wide standards document for all skills.
- Steps:
  1. Create the file at the repo root
  2. Structure it as a reference document (not a skill — no YAML frontmatter needed) with clear sections
  3. Include these sections, synthesized from agentskills.io docs + lessons from this repo:
     - **Frontmatter Standards:** Required fields (`name`, `description`, `version`), optional fields (`compatibility`), description character limit (1024), description writing principles (imperative, user-intent focused, pushy but precise)
     - **Description Optimization:** Trigger eval queries, train/validation splits, optimization loop, avoiding overfitting (from optimizing-descriptions.md)
     - **Skill Structure:** Progressive disclosure rules (SKILL.md under 500 lines, 5000 tokens), when to use `references/`, `scripts/`, `assets/`, directory layout conventions
     - **Writing Guidelines:** Start from real expertise, refine with real execution, spending context wisely, calibrating control (specificity vs freedom), gotchas sections, templates for output, checklists, validation loops, plan-validate-execute patterns (from best-practices.md)
     - **Scripts Standards:** One-off commands vs bundled scripts, self-contained scripts with inline dependencies, agentic script design (no interactive prompts, --help, structured output, meaningful exit codes, idempotency, dry-run support) (from using-scripts.md)
     - **Evaluation Standards:** Test case design (prompts, expected output, input files), workspace structure, assertions, grading, aggregation, human review, iteration loop (from evaluating-skills.md)
     - **Quality Gates:** Pre-commit checklist for new skills (all items that must pass before a skill is added to the repo)
     - **Versioning:** Semantic versioning convention for skills, when to bump major/minor/patch
  4. Cross-reference the agentskills.io source pages for each section
  5. Include concrete examples drawn from the existing three skills in this repo (showing good patterns)
  6. Include anti-examples (what not to do) where helpful
- Validation: The file exists at `D:\Repos\agent-skills\SKILL_RULES.md`, covers all eight sections with examples, references the agentskills.io source pages, and is scannable (use a table of contents if it approaches 500 lines — as a reference document it can exceed the skill line limit, but should remain navigable).
- Notes: This is a reference document, not a skill. It should be scannable and easy to navigate.

### Task 2: Draft the Skill Extractor SKILL.md

- Status: COMPLETED
- Objective: Write `D:\Repos\agent-skills\skill-extractor\SKILL.md` — the meta skill that ports repo-specific skills into generic reusable ones.
- Steps:
  1. Create the directory `D:\Repos\agent-skills\skill-extractor\`
  2. Write YAML frontmatter with `name: skill-extractor`, `version: 1.0.0`, and a description that covers: extracting skills from repos, removing repo-specific context, generalizing paths and conventions, optimizing descriptions, and validating against SKILL_RULES.md. Make it pushy — trigger when the user wants to port a skill, generalize a skill, extract a reusable pattern, or convert a project-specific skill into a repo-agnostic one.
  3. Write the skill body with two distinct phases:
     - **Phase 1 — Extraction Workflow:** Step-by-step process from source skill analysis to generic skill creation:
       - Analyze source skill: read the source SKILL.md, identify repo-specific elements (hardcoded paths, project names, domain-specific conventions, toolchain assumptions)
       - Classify elements: categorize each as (a) keep as-is (universal), (b) generalize (make configurable), (c) remove (repo-specific noise), (d) extract to template (repo bootstrap files)
       - Generalize: replace hardcoded paths with frontmatter-configurable defaults, replace project names with generic terms, replace domain-specific conventions with configurable options, replace toolchain-specific commands with shell-agnostic descriptions
       - Create templates: if the source skill references files the agent should create in the target repo, create template versions in `assets/`
       - Write generic SKILL.md: compose the new skill following SKILL_RULES.md standards, with proper frontmatter, progressive disclosure, gotchas, and validation
       - Provide optional dirs checklist: list which of `assets/`, `references/`, `scripts/` should be created based on the source skill's needs, with guidance on when each is warranted
      - **Phase 2 — Description Optimization:** Separate optimization step after the skill is created. Use the `skill-creator` skill's optimization loop if available (it automates eval query generation, train/val splitting, iterative refinement, and HTML report generation). If not available, perform the optimization manually:
        - Design trigger eval queries (20 queries: 8-10 should-trigger, 8-10 should-not-trigger)
        - Run the optimization loop (train/validation split, iterative refinement)
        - Select the best description by validation pass rate
        - Update the SKILL.md frontmatter with the optimized description
  4. Add a **Gotchas** section covering common extraction pitfalls:
     - Over-generalizing (losing valuable domain-specific guidance that applies broadly)
     - Under-generalizing (leaving hardcoded paths or project names in the body)
     - Description creep (descriptions growing beyond 1024 characters during optimization)
     - Template bloat (creating templates for files that the target repo likely already has)
     - Mixing phases (optimizing the description before the skill body is finalized)
  5. Add a **Validation Checklist** at the end that the agent runs before declaring the extraction complete — this checklist references SKILL_RULES.md rules
  6. Reference `SKILL_RULES.md` explicitly throughout the skill, especially in the validation step
- Validation: The skill file exists at `D:\Repos\agent-skills\skill-extractor\SKILL.md`, follows all SKILL_RULES.md standards, and can be read end-to-end without any reference to a specific repo.
- Notes: This is the core deliverable. The extraction workflow should be concrete enough that an agent can execute it without additional guidance. The two phases must be clearly separated — Phase 1 produces the skill, Phase 2 optimizes its description.

### Task 3: Validate SKILL_RULES.md Against Existing Skills

- Status: COMPLETED
- Objective: Ensure SKILL_RULES.md is consistent with and applicable to the existing three skills in the repo.
- Steps:
  1. Read each existing skill (`manual-planning`, `skill-improver`, `todo-manager`) and check against SKILL_RULES.md standards
  2. Note any gaps where SKILL_RULES.md doesn't cover something the existing skills do well
  3. Note any contradictions where an existing skill violates a SKILL_RULES.md rule (these are candidates for future improvement, not blocking)
  4. Update SKILL_RULES.md to cover any gaps found
- Validation: A written evaluation table listing each existing skill and each SKILL_RULES.md section, with pass/fail status and notes. Any gaps (sections that don't cover something an existing skill does well) are filled in SKILL_RULES.md.
- Notes: This is a quality check, not a requirement to fix existing skills.

### Task 4: Validate Skill Extractor Against the Todo-Manager Port

- Status: COMPLETED
- Objective: Test the skill extractor's workflow against the actual todo-manager port that was just completed, to verify the extraction steps would have produced the same result.
- Steps:
  1. Read the original Mini Diarium `todo-manager` SKILL.md
  2. Read the ported `todo-manager` SKILL.md in agent-skills
  3. Walk through the extractor's Phase 1 workflow (Analyze → Classify → Generalize → Create Templates → Write SKILL.md → Optional Dirs Checklist) and verify each step would produce the correct transformation
  4. Note any gaps in the extractor's workflow that the actual port revealed
  5. Update the extractor SKILL.md to cover any gaps found
- Validation: The extractor's Phase 1 workflow, when applied to the original Mini Diarium todo-manager, would produce a skill matching (or exceeding) the quality of the ported version.
- Notes: This is a dry-run validation, not an actual re-extraction.

### Task 5: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep the plan file itself if the user wants it retained.
- Validation: The only new files in `D:\Repos\agent-skills` are `SKILL_RULES.md` and `skill-extractor/SKILL.md` (plus any bundled resources). No temporary files remain.
- Notes: Do not remove user-provided files or unrelated worktree changes.

## Final Verification

- `SKILL_RULES.md` exists at `D:\Repos\agent-skills\SKILL_RULES.md` and covers all eight sections with examples
- `skill-extractor/SKILL.md` exists at `D:\Repos\agent-skills\skill-extractor\SKILL.md` and follows all SKILL_RULES.md standards
- `skill-extractor/SKILL.md` is under 500 lines (progressive disclosure rule for skills)
- The skill extractor's Phase 1 workflow is validated against the actual todo-manager port
- No temporary files or artifacts remain in the repo
- Existing skills (`manual-planning`, `skill-improver`, `todo-manager`) are unchanged

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

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
