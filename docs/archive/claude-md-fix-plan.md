# CLAUDE.md Audit Fix Plan

## Metadata

- Plan Status: COMPLETED
- Created: 2026-06-04
- Last Updated: 2026-06-04
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Fix every finding in `docs/claude-md-audit.md` so that all CLAUDE.md files and the two agent-read best-practices docs accurately reflect the current codebase, and add explicit drift-prevention rules so future feature additions don't silently break the docs again.

## Scope

- All 6 `CLAUDE.md` files: root, `src/`, `src-tauri/`, `e2e/`, `benchmarks/`, `website/`
- `docs/best-practices/RUST_BEST_PRACTICES.md` and `docs/best-practices/TAURI_BEST_PRACTICES.md`
- Agent Workflow Rules in root `CLAUDE.md` (drift prevention)
- `docs/claude-md-audit.md` (mark as superseded after fixes land)

## Non-Goals

- Fixing `docs/archive/` files — these are historical and are not read by agents
- Rewriting content that is correct but could be phrased differently
- Trimming the 68-command registry (P3) in the same PR as correctness fixes — that is an independent editorial decision
- Implementing any new features described in the audit (e.g., a CI lint script for file-structure drift — that is a separate TODO item if desired)

## Assumptions

- `D:\Repos\mini-diarium-2` is the correct repo root path for all agent-facing commands
- `LinkOverlay.tsx` is correctly located at `src/components/editor/LinkOverlay.tsx` (verified by Glob)
- The `src/state/fonts.ts` module is intentionally small (6 lines); its role is worth documenting even if minimal
- The `data-testid` table scope: `src/CLAUDE.md` will be the canonical E2E-critical table; `e2e/CLAUDE.md` will link to it instead of duplicating. Unit-test-only `data-testid` attributes are NOT added to the canonical table (they belong in component tests, not CLAUDE.md).
- The 68-command registry is kept as-is (P3 work) — this plan only fixes the factual errors in it (wrong module list in the description header)
- No Decision Log file is needed; deviations can be noted inline in task notes

## Open Questions

None.

---

## Milestones

### Milestone 1: P0 — Critical Path and Reference Fixes

- Status: COMPLETED
- Purpose: Fix factual errors that will send an agent to a nonexistent file or execute a broken command immediately.
- Exit Criteria: Every `cmd.exe` example in the target files uses `D:\Repos\mini-diarium-2`; the `LinkOverlay.tsx` path in `src/CLAUDE.md` Gotcha #8 is correct; all three files compile and format-check clean.

#### Task 1.1: Fix hardcoded repo paths in root `CLAUDE.md`

- Status: COMPLETED
- Objective: All five occurrences of `D:\Repos\mini-diarium\src-tauri` in root `CLAUDE.md` are replaced with `D:\Repos\mini-diarium-2\src-tauri`. A clarifying note is added to the Execution Environment section.
- Steps:
  1. Open `CLAUDE.md`.
  2. Replace every occurrence of `D:\Repos\mini-diarium\src-tauri` with `D:\Repos\mini-diarium-2\src-tauri` (5 occurrences: lines 30, 40, 206, 207, 225).
  3. After the first sentence of the Execution Environment section, add the inline note: `> **Path note:** All hardcoded paths below assume the repo is cloned at \`D:\Repos\mini-diarium-2\`. Substitute your own path if cloned elsewhere.`
- Validation: `grep -n "mini-diarium\\" CLAUDE.md` returns zero hits (only `mini-diarium-2` remains).
- Notes: Use the Edit tool, not find-and-replace-all, to avoid touching the domain-guide link text `[Frontend (src/)](src/CLAUDE.md)` etc.

#### Task 1.2: Fix hardcoded repo paths in `docs/best-practices/`

- Status: COMPLETED
- Objective: All occurrences of `D:\Repos\mini-diarium\src-tauri` in `RUST_BEST_PRACTICES.md` and `TAURI_BEST_PRACTICES.md` are replaced with `D:\Repos\mini-diarium-2\src-tauri`.
- Steps:
  1. Open `docs/best-practices/RUST_BEST_PRACTICES.md`. Find and replace all occurrences of `D:\Repos\mini-diarium\src-tauri` → `D:\Repos\mini-diarium-2\src-tauri` (lines 205, 212, 213, 214).
  2. Open `docs/best-practices/TAURI_BEST_PRACTICES.md`. Find and replace all occurrences of `D:\Repos\mini-diarium\src-tauri` → `D:\Repos\mini-diarium-2\src-tauri` (lines 232, 251).
- Validation: `grep -rn "mini-diarium\\" docs/best-practices/` returns zero hits.
- Notes: Archive files in `docs/archive/` also have this error but are out of scope per Non-Goals.

#### Task 1.3: Fix wrong `LinkOverlay.tsx` path in `src/CLAUDE.md` Gotcha #8

- Status: COMPLETED
- Objective: Gotcha #8 in `src/CLAUDE.md` correctly references `src/components/editor/LinkOverlay.tsx` (no `extensions/` subdirectory).
- Steps:
  1. Open `src/CLAUDE.md`, line 266.
  2. Replace `src/components/editor/extensions/LinkOverlay.tsx` with `src/components/editor/LinkOverlay.tsx`.
- Validation: `grep "extensions/LinkOverlay" src/CLAUDE.md` returns zero hits. `grep "editor/LinkOverlay" src/CLAUDE.md` returns the one corrected reference.
- Notes: None.

---

### Milestone 2: P1 — Missing Module Documentation

- Status: COMPLETED
- Purpose: Update file structure sections to reflect the current codebase so agents can locate all modules.
- Exit Criteria: Every `.rs` file in `src-tauri/src/commands/` and `src-tauri/src/db/queries/` is listed in `src-tauri/CLAUDE.md`; every `.tsx` component in `src/components/` is listed in `src/CLAUDE.md`; every `.ts` file in `src/state/` is listed and counted correctly in `src/CLAUDE.md`; `auth_bench.rs` is listed in `benchmarks/CLAUDE.md`; migration range comment matches actual files.

#### Task 2.1: Update `src-tauri/CLAUDE.md` — command modules and related comments

- Status: COMPLETED
- Objective: Four missing command modules added to the file structure; `commands/mod.rs` description comment updated; migration range updated; duplicate gotcha #3 numbering fixed.
- Steps:
  1. Open `src-tauri/CLAUDE.md`.
  2. In the `commands/` file structure block (after `files.rs` line), add:
     ```
     │   ├── fonts.rs                       # list_bundled_fonts, get_font_data, list_custom_fonts, import_custom_font, delete_custom_font_family
     │   ├── images.rs                      # get_entry_images, list_journal_image_summaries, get_image_data
     │   ├── menu.rs                        # update_menu_locale
     │   └── tags.rs                        # create_tag, get_all_tags, rename_tag, delete_tag, add_tag_to_entry, remove_tag_from_entry, get_tags_for_entry, get_entry_dates_by_tag
     ```
     (Replace the existing `└── files.rs` with `├── files.rs` to accommodate the new trailing entries.)
  3. Update the `commands/mod.rs` description comment from:
     `# Re-exports: auth, entries, search, navigation, stats, import, export, plugin, files`
     to:
     `# Re-exports: auth, debug, entries, export, files, fonts, images, import, menu, navigation, plugin, search, stats, tags`
  4. Update the migrations directory comment from:
     `# v1_to_v2 … v6_to_v7 + apply_pending`
     to:
     `# v1_to_v2 … v9_to_v10 + apply_pending`
  5. Renumber the second gotcha labeled `3.` (Import behavior, no merge) to `4.` — adjust all subsequent numbering accordingly (current 4 → 5, current 5 → 6, etc., up to whatever the last gotcha is).
- Validation:
  - `grep -c "fonts.rs\|images.rs\|menu.rs\|tags.rs" src-tauri/CLAUDE.md` returns 4.
  - `grep "v6_to_v7" src-tauri/CLAUDE.md` returns zero hits.
  - `grep "v9_to_v10" src-tauri/CLAUDE.md` returns one hit.
  - Manually verify the gotcha numbers are sequential (1, 2, 3, 4, 5…) with no duplicates.
- Notes: The `files.rs` → `images.rs` ordering in the tree: alphabetical is fine. The existing `files.rs` line comes before `fonts.rs` alphabetically, so `files.rs` stays as-is (as `├──`) and the four new entries are appended after it.

#### Task 2.2: Update `src-tauri/CLAUDE.md` — add `db/queries/images.rs`

- Status: COMPLETED
- Objective: `db/queries/images.rs` is listed in the `db/queries/` file structure section.
- Steps:
  1. In the `db/queries/` block, after `db_settings.rs`, add:
     ```
     │       └── images.rs                  # Content-addressed encrypted image store CRUD + dedup helpers
     ```
     (Replace the existing `└── db_settings.rs` with `├── db_settings.rs`.)
- Validation: `grep "queries/images.rs" src-tauri/CLAUDE.md` returns one hit.
- Notes: The actual existing `└── db_settings.rs` must become `├── db_settings.rs` (not a trailing entry anymore).

#### Task 2.3: Update `src-tauri/CLAUDE.md` — add `cmd.exe /c` to verification commands

- Status: COMPLETED
- Objective: The Verification Commands section in `src-tauri/CLAUDE.md` uses `cmd.exe /c "cd /d D:\Repos\mini-diarium-2\src-tauri && ..."` syntax, consistent with the root CLAUDE.md rule.
- Steps:
  1. In `src-tauri/CLAUDE.md` Verification Commands section, replace:
     ```bash
     cd src-tauri && cargo test                  # All backend tests
     cd src-tauri && cargo test <module>         # Specific module (e.g., cargo test navigation)
     cd src-tauri && cargo bench                       # All Rust benchmarks (criterion)
     cd src-tauri && cargo bench --bench cipher_bench  # Specific benchmark
     ```
     with:
     ```bash
     cmd.exe /c "cd /d D:\Repos\mini-diarium-2\src-tauri && cargo test"                         # All backend tests
     cmd.exe /c "cd /d D:\Repos\mini-diarium-2\src-tauri && cargo test <module>"                # Specific module
     cmd.exe /c "cd /d D:\Repos\mini-diarium-2\src-tauri && cargo bench"                        # All Rust benchmarks (criterion)
     cmd.exe /c "cd /d D:\Repos\mini-diarium-2\src-tauri && cargo bench --bench cipher_bench"   # Specific benchmark
     ```
- Validation: `grep "cd src-tauri" src-tauri/CLAUDE.md` returns zero hits.
- Notes: None.

#### Task 2.4: Update `src/CLAUDE.md` — missing components in file structure

- Status: COMPLETED
- Objective: All 10 missing components are added to the appropriate sections of the `src/CLAUDE.md` file structure block.
- Steps:
  1. Open `src/CLAUDE.md`.
  2. In `components/overlays/`, after `AboutOverlay.tsx`, add:
     ```
     │   ├── ImagePickerOverlay.tsx     # Full-journal image browser for editor image insertion
     │   ├── NotificationsOverlay.tsx   # In-app notification feed (release notes, tips)
     │   ├── OnboardingOverlay.tsx      # First-run tour (multi-step card carousel)
     │   └── TagManager.tsx             # Tag create/rename/delete management panel
     ```
  3. In `components/editor/`, after `EntryNavBar.tsx` group, add:
     ```
     │   ├── EntryTags.tsx              # Inline tag pill row + tag assignment UI per entry
     │   ├── LinkOverlay.tsx            # Link insert/edit dialog (snapshot pattern — see Gotcha #8)
     │   └── TimestampOverlay.tsx       # Timestamp insert dialog (format + precision selectors)
     ```
  4. In `components/auth/`, after `PasswordPrompt.tsx` group, add:
     ```
     │   └── PasswordStrengthIndicator.tsx  # Visual password strength bar used in PasswordCreation
     ```
  5. In `components/overlays/preferences/`, after `PreferencesAdvancedTab.tsx`, add:
     ```
     │   ├── PreferencesCustomFontsSection.tsx  # Custom font family upload + management UI
     │   └── PreferencesFontFamilyField.tsx     # Editor font-family selector (bundled + custom)
     ```
- Validation: All 10 new file names can be found with `grep -l "OnboardingOverlay\|TagManager\|NotificationsOverlay\|ImagePickerOverlay\|EntryTags\|TimestampOverlay\|LinkOverlay\|PasswordStrengthIndicator\|PreferencesCustomFontsSection\|PreferencesFontFamilyField" src/CLAUDE.md`.
- Notes: Ordering within each group: alphabetical or by feature proximity — either is fine. The existing `└──` entries that gain new siblings must become `├──`.

#### Task 2.5: Update `src/CLAUDE.md` — missing state modules and fix count

- Status: COMPLETED
- Objective: `fonts.ts` and `onboarding.ts` are added to the state management table; the section header count changes from "Nine" to "Eleven".
- Steps:
  1. Change the header from `Nine signal-based state modules in \`src/state/\`:` to `Eleven signal-based state modules in \`src/state/\`:`.
  2. Add two rows to the state table:

     | Module | Signals | Key Functions |
     |--------|---------|---------------|
     | `fonts.ts` | `customFontsVersion: number` | `incrementCustomFontsVersion()` — bumps version to invalidate cached font loads across components |
     | `onboarding.ts` | `onboardingMode: OnboardingMode`, `onboardingStep: number` | `startOnboarding()`, `showOnboardingIfFirstRun()`, `nextStep(total)`, `prevStep()`, `minimizeOnboarding()`, `dismissOnboarding()` |

- Validation: `grep "Eleven signal-based" src/CLAUDE.md` returns one hit. `grep "fonts.ts\|onboarding.ts" src/CLAUDE.md` returns matches in the state table rows.
- Notes: `fonts.ts` is intentionally minimal — its only job is version-counter invalidation.

#### Task 2.6: Update `src/CLAUDE.md` — fix verification commands and data-testid table

- Status: COMPLETED
- Objective: Verification commands use `cmd.exe /c` prefix; the `data-testid` table has the `onboarding-next-btn` row added and the mid-table `> **Note:**` formatting bug fixed.
- Steps:
  1. In the Verification Commands section, prefix each bare `bun run ...` command with `cmd.exe /c `:
     - `bun run test:run` → `cmd.exe /c bun run test:run`
     - `bun run test` → `cmd.exe /c bun run test`
     - `bun run test:coverage` → `cmd.exe /c bun run test:coverage`
     - `bun run lint` → `cmd.exe /c bun run lint`
     - `bun run lint:fix` → `cmd.exe /c bun run lint:fix`
     - `bun run format:check` → `cmd.exe /c bun run format:check`
     - `bun run format` → `cmd.exe /c bun run format`
     - `bun run type-check` → `cmd.exe /c bun run type-check`
  2. In the `data-testid` table, add a row for `OnboardingOverlay.tsx` at the top (before `PasswordCreation.tsx`):
     ```
     | `OnboardingOverlay.tsx` | Next / Done button in tour card | `onboarding-next-btn` |
     ```
  3. Fix the mid-table formatting bug: move the `> **Note:** The active entry's number button has \`aria-current="true"\`.` out from inside the table rows. Place it as a standalone paragraph *after* the full table, with the `aria-current` note attached to the `entry-number-button-{N}` row as an inline note instead:
     - Change the `entry-number-button-{N}` row description to: `Entry number button N (1-based); active entry has \`aria-current="true"\``
     - Remove the stray `> **Note:**` blockquote that currently breaks the table.
- Validation:
  - `grep "bun run test:run" src/CLAUDE.md` should show `cmd.exe /c bun run test:run`.
  - `grep "onboarding-next-btn" src/CLAUDE.md` returns one hit.
  - `grep "> \*\*Note:" src/CLAUDE.md` returns zero hits (blockquote removed).
- Notes: Do not add unit-test-only `data-testid` attributes to this table — E2E-critical only.

#### Task 2.7: Update root `CLAUDE.md` — fix incomplete state layer in architecture diagram

- Status: COMPLETED
- Objective: The state layer line in root `CLAUDE.md`'s ASCII architecture diagram lists all 11 state modules, not just 6.
- Steps:
  1. Open root `CLAUDE.md`, locate the ASCII art state layer (line ~74):
     ```
     │ auth.ts · entries.ts · journals.ts · search.ts · ui.ts · preferences.ts │
     ```
  2. Replace with:
     ```
     │ auth · entries · journals · search · ui · preferences · tags · session · notifications · fonts · onboarding │
     ```
     (Drop `.ts` suffix for brevity since the line is already long; the preceding text makes it clear these are TS modules.)
- Validation: `grep "notifications" CLAUDE.md` returns a hit inside the architecture block.
- Notes: If the line becomes too wide for the ASCII box, wrap to a second line inside the same box row.

#### Task 2.8: Update `benchmarks/CLAUDE.md` — add `auth_bench.rs` to file structure

- Status: COMPLETED
- Objective: `auth_bench.rs` is listed in the File Structure section of `benchmarks/CLAUDE.md`.
- Steps:
  1. Open `benchmarks/CLAUDE.md`.
  2. In the `src-tauri/benches/` section, add `auth_bench.rs` in alphabetical order:
     ```
       auth_bench.rs          ← Argon2id wrap/unwrap benchmarks (sample_size 10 — ~30–60 s per run)
     ```
- Validation: `grep "auth_bench.rs" benchmarks/CLAUDE.md` returns one hit.
- Notes: The gotcha section already mentions `sample_size(10)` for auth bench — the file structure entry should reference that via the gotcha number (#7).

---

### Milestone 3: P2 — Quality, Consistency, and SEO Data

- Status: COMPLETED
- Purpose: Fix consistency issues, eliminate duplication, and remove volatile data that will mislead agents.
- Exit Criteria: `e2e/CLAUDE.md` no longer owns a separate copy of the `data-testid` table; `website/CLAUDE.md` no longer contains GSC position numbers or baseline click metrics inline; root `CLAUDE.md` architecture state layer is accurate.

#### Task 3.1: Eliminate `data-testid` table duplication in `e2e/CLAUDE.md`

- Status: COMPLETED
- Objective: `e2e/CLAUDE.md` replaces its standalone `data-testid` table with a link to the canonical table in `src/CLAUDE.md`.
- Steps:
  1. Open `e2e/CLAUDE.md`.
  2. Replace the entire `## data-testid Attributes` section (table + introductory paragraph) with:
     ```markdown
     ## data-testid Attributes

     The canonical `data-testid` inventory lives in [`src/CLAUDE.md — data-testid Attributes`](../src/CLAUDE.md#data-testid-attributes). The E2E specs use a subset of those attributes. Do not add a new `data-testid` selector to a spec without first adding it to the canonical table.
     ```
- Validation: `grep "OnboardingOverlay\|PasswordCreation\|PasswordPrompt" e2e/CLAUDE.md` returns zero hits (the table rows are gone). The link to `src/CLAUDE.md#data-testid-attributes` is present.
- Notes: The `onboarding-next-btn` row must be present in `src/CLAUDE.md` (Task 2.6) before this task runs.

#### Task 3.2: Remove volatile GSC metrics from `website/CLAUDE.md`

- Status: COMPLETED
- Objective: The Keyword Map position numbers and Monitoring Cadence baseline metrics are removed. Guidance to check `docs/seo/` replaces them.
- Steps:
  1. Open `website/CLAUDE.md`, Content Strategy → Keyword Map section.
  2. Replace the full table:
     ```
     | Query | Current Pos | Approach |
     ...
     ```
     with a shorter format that keeps the topic intent but removes position numbers:
     ```markdown
     | Query | Approach |
     |-------|----------|
     | `encrypted diary` | "What Is an Encrypted Diary" — foundational explainer |
     | `private journal app` | "How to Choose a Private Journal App" — buyer's checklist |
     | `encrypted journal` | Owned by `/encrypted-journal/` landing page |
     | `desktop diary app` | Targeted by `desktop-diary-app` post |
     | `private offline journal` | Owned by `private-diary-app-for-desktop` post |

     > **Current positions:** Check [`docs/seo/Queries.csv`](../docs/seo/Queries.csv) (updated quarterly) for live ranking data before writing a new post. Do not rely on inline numbers here — they are stale within days.
     ```
  3. In the Monitoring Cadence section, remove the specific baseline numbers (`~120 clicks/month`, `~2,200 impressions/month`, `9.5% CTR`, `avg position 5.9`) and replace the line:
     `- Compare against the [last audit baseline](../docs/seo/): ~120 clicks/month, ~2,200 impressions/month, 9.5% CTR, avg position 5.9`
     with:
     `- Compare against the last baseline in [`docs/seo/`](../docs/seo/) (see the most recent `Pages.csv` and `Queries.csv` — do not inline numbers here).`
- Validation: `grep "26\.7\|57\.5\|120 clicks\|2,200\|9\.5%\|position 5\.9" website/CLAUDE.md` returns zero hits.
- Notes: Keep all non-numerical strategy guidance in place. Only remove the specific metric numbers.

---

### Milestone 4: Drift Prevention

- Status: COMPLETED
- Purpose: Add explicit agent workflow rules that prevent the next round of drift.
- Exit Criteria: Root `CLAUDE.md` Agent Workflow Rules section contains a new rule #7 covering file structure maintenance; the rule is actionable and cites the three documents that require updates.

#### Task 4.1: Add Agent Workflow Rule #7 — CLAUDE.md file structure maintenance

- Status: COMPLETED
- Objective: Root `CLAUDE.md` Agent Workflow Rules gain an explicit rule instructing agents to update CLAUDE.md file structure sections when they add new files.
- Steps:
  1. Open root `CLAUDE.md`, Agent Workflow Rules section.
  2. Add rule **#7** after the existing rule 6:
     ```markdown
     7. **Keep CLAUDE.md file structure sections in sync.** Whenever you add, rename, or remove a source file, immediately update the relevant file structure section in the nearest CLAUDE.md:
        - New file in `src/components/` or `src/state/` → update `src/CLAUDE.md` (File Structure or State Management table).
        - New file in `src-tauri/src/commands/`, `src-tauri/src/db/queries/`, or `src-tauri/benches/` → update `src-tauri/CLAUDE.md` or `benchmarks/CLAUDE.md`.
        - New `data-testid` attribute used by E2E tests → add it to the `data-testid` table in `src/CLAUDE.md`.
        - New schema migration (`vN_to_vN+1.rs`) → update the migration range comment in `src-tauri/CLAUDE.md` and bump the schema version description in Gotcha #1.
        - New Tauri command → update the Command Registry in root `CLAUDE.md` and `commands/mod.rs` description comment in `src-tauri/CLAUDE.md`.
     ```
- Validation: `grep "Keep CLAUDE.md file structure" CLAUDE.md` returns one hit. The rule lists all five triggers.
- Notes: This rule is the primary drift-prevention mechanism. The rule is deliberately prescriptive so an agent knows exactly what to update in each case.

#### Task 4.2: Add path-robustness note to root `CLAUDE.md` Execution Environment

- Status: COMPLETED
- Objective: A visible callout at the top of the Execution Environment section warns that hardcoded paths must be updated if the repo is cloned to a different location, reducing the risk of recurrence.
- Steps:
  1. Open root `CLAUDE.md`, immediately before the `Operational rule for agents in this environment:` bullet list.
  2. Add:
     ```markdown
     > **Hardcoded path note:** All `cmd.exe` examples below use `D:\Repos\mini-diarium-2`. If the repo is cloned elsewhere, find-and-replace `D:\Repos\mini-diarium-2` with your actual checkout path in this file and in `docs/best-practices/RUST_BEST_PRACTICES.md` and `docs/best-practices/TAURI_BEST_PRACTICES.md`.
     ```
- Validation: `grep "Hardcoded path note" CLAUDE.md` returns one hit.
- Notes: This is a human/agent self-service instruction, not a script. It explicitly names the three files that need updating.

---

### Milestone 5: Cleanup and Final Verification

- Status: COMPLETED
- Purpose: Ensure no intermediate artifacts remain and the full change is coherent.
- Exit Criteria: `docs/claude-md-audit.md` is marked as superseded; no other stale references remain; all changed files pass a quick format check.

#### Task 5.1: Mark audit report as superseded

- Status: COMPLETED
- Objective: `docs/claude-md-audit.md` has a header note that the findings have been addressed, so a future agent reading it knows not to re-open the same issues.
- Steps:
  1. Open `docs/claude-md-audit.md`.
  2. Add at the top of the file, after the `# CLAUDE.md Audit Report` heading:
     ```markdown
     > **Status: ADDRESSED** — All findings in this report were fixed as part of `docs/claude-md-fix-plan.md` (completed 2026-06-04). This file is retained as a historical record.
     ```
- Validation: `grep "Status: ADDRESSED" docs/claude-md-audit.md` returns one hit.
- Notes: Do not delete the audit file — it is a useful historical reference.

#### Task 5.2: Final verification

- Status: COMPLETED
- Objective: All targeted changes are in place, no introduced regressions, and the plan is marked complete.
- Steps:
  1. Run `cmd.exe /c bun run type-check` — must pass.
  2. Run `cmd.exe /c bun run lint` — must pass.
  3. Spot-check each milestone's key validation commands (listed in each task above).
  4. Verify `grep "mini-diarium\\" CLAUDE.md docs/best-practices/RUST_BEST_PRACTICES.md docs/best-practices/TAURI_BEST_PRACTICES.md` returns zero hits.
  5. Verify `grep "extensions/LinkOverlay" src/CLAUDE.md` returns zero hits.
  6. Verify `grep "cd src-tauri && cargo" src-tauri/CLAUDE.md` returns zero hits.
  7. Verify `grep "Nine signal-based" src/CLAUDE.md` returns zero hits.
  8. Mark this plan's status as COMPLETED.
- Validation: All 7 grep checks return zero hits; type-check and lint pass; plan status is COMPLETED.
- Notes: Frontend tests and Rust tests do not need to run — this plan touches only documentation files.

---

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

- [ ] `cmd.exe /c bun run type-check` passes
- [ ] `cmd.exe /c bun run lint` passes
- [ ] `grep "mini-diarium\\" CLAUDE.md docs/best-practices/RUST_BEST_PRACTICES.md docs/best-practices/TAURI_BEST_PRACTICES.md` → zero hits
- [ ] `grep "extensions/LinkOverlay" src/CLAUDE.md` → zero hits
- [ ] `grep "cd src-tauri && cargo" src-tauri/CLAUDE.md` → zero hits
- [ ] `grep "Nine signal-based" src/CLAUDE.md` → zero hits
- [ ] `grep "26\.7\|57\.5\|120 clicks\|2,200\|9\.5%" website/CLAUDE.md` → zero hits
- [ ] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] No open questions remain.
- [x] Tasks are grouped into milestones (> 10 tasks).
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions — every step names exact file, line, and content.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [x] No Tauri WebView or dialog interactions involved.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
- Milestone 2 tasks can be executed in any order (2.1–2.8 are independent).
- Task 3.1 (eliminate e2e duplication) depends on Task 2.6 (add `onboarding-next-btn` to src/ table) — do not do 3.1 before 2.6.
- Milestone 4 and Milestone 3 are independent of each other.
