# TODO-0023: Add Amiri and Tajawal Bundled Fonts

## Metadata

- Plan Status: READY FOR APPROVAL
- Created: 2026-05-11
- Last Updated: 2026-05-11
- Owner: Coding agent
- Approval: PENDING
- Parent TODO: TODO-0023 (Medium Priority)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Add two new open-source fonts (Amiri and Tajawal) to the bundled font collection, expanding the font selection beyond the current monospace-heavy set. Both fonts support Arabic script and use the SIL Open Font License 1.1, matching the licensing of existing bundled fonts.

## Scope

- Download Amiri Regular and Bold TTF files from Google Fonts repository
- Download Tajawal Regular and Bold TTF files from Google Fonts repository
- Add font files to the `fonts/` directory
- Update `fonts/LICENSES.md` with the new font entries
- Verify fonts appear in the editor font family dropdown
- No code changes required — the existing font loading system (`fonts.rs`, `DiaryEditor.tsx`) discovers fonts automatically from the `fonts/` directory
- No bundle config changes required — `src-tauri/tauri.conf.json` uses `"../fonts/*.ttf"` glob pattern

## Non-Goals

- Adding Noto Naskh Arabic (uses variable font format requiring code changes)
- Adding Cairo (only available as variable font `Cairo[slnt,wght].ttf` in Google Fonts repo, incompatible with current static font loading)
- Changing the font loading architecture
- Adding italic or other weight variants beyond Regular/Bold
- Modifying the font selection UI beyond what already exists

## Assumptions

- Amiri and Tajawal TTF files from Google Fonts are compatible with the existing `family_from_stem()` parsing logic (filenames follow `FontName-Weight.ttf` pattern)
- The current bundle glob `../fonts/*.ttf` will automatically include new fonts
- Font files are under 1MB each (current largest is NotoSerif-Bold at ~730KB)
- The user confirmed Amiri and Tajawal as acceptable choices (Tajawal was in the original suggestion list: "Amiri, Noto Naskh Arabic, Tajawal Medium or Cairo will suffice")

## Open Questions

- None

## Tasks

### Task 1: Download and Add Amiri Font Files

- Status: TO BE DONE
- Objective: Add Amiri Regular and Bold TTF files to the fonts directory
- Steps:
  1. Download `Amiri-Regular.ttf` from https://github.com/google/fonts/tree/main/ofl/amiri
  2. Download `Amiri-Bold.ttf` from https://github.com/google/fonts/tree/main/ofl/amiri
  3. Place both files in `D:\Repos\mini-diarium\fonts\`
  4. Verify file sizes are reasonable (< 1MB each)
- Validation: Files exist in `fonts/` directory with correct names and non-zero sizes
- Notes: Amiri is a classic Arabic serif font, SIL OFL 1.1 licensed

### Task 2: Download and Add Tajawal Font Files

- Status: TO BE DONE
- Objective: Add Tajawal Regular and Bold TTF files to the fonts directory
- Steps:
  1. Download `Tajawal-Regular.ttf` from https://github.com/google/fonts/tree/main/ofl/tajawal
  2. Download `Tajawal-Bold.ttf` from https://github.com/google/fonts/tree/main/ofl/tajawal
  3. Place both files in `D:\Repos\mini-diarium\fonts\`
  4. Verify file sizes are reasonable (< 1MB each)
- Validation: Files exist in `fonts/` directory with correct names and non-zero sizes
- Notes: Tajawal is a modern Arabic sans-serif font, SIL OFL 1.1 licensed. Has static Regular/Bold variants compatible with existing font loading system. Cairo was replaced with Tajawal because Cairo only provides a variable font file.

### Task 3: Update Font Licenses Documentation

- Status: TO BE DONE
- Objective: Add Amiri and Tajawal entries to `fonts/LICENSES.md`
- Steps:
  1. Read `fonts/LICENSES.md`
  2. Add two new rows to the license table:
     - Amiri | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Amiri
     - Tajawal | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Tajawal
  3. Verify table formatting is correct
- Validation: `fonts/LICENSES.md` contains entries for all 7 font families
- Notes: Keep the table sorted alphabetically or grouped by license type

### Task 4: Verify Bundle Configuration

- Status: TO BE DONE
- Objective: Confirm the Tauri bundle glob includes new fonts
- Steps:
  1. Read `src-tauri/tauri.conf.json`
  2. Verify the `resources` field contains `"../fonts/*.ttf"` (glob pattern)
  3. No changes needed — the glob automatically includes new `.ttf` files
- Validation: Bundle configuration will include `Amiri-*.ttf` and `Tajawal-*.ttf`
- Notes: Current config uses glob, so no changes are required

### Task 5: Test Font Discovery and Loading

- Status: TO BE DONE
- Objective: Verify the new fonts are discovered and can be selected in the editor
- Steps:
  1. Run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test fonts"` to ensure existing font tests pass
  2. Verify font naming: `family_from_stem("Amiri-Regular")` should return `"Amiri"`, `family_from_stem("Tajawal-Regular")` should return `"Tajawal"`
  3. Add unit tests for the new font stems if not covered by existing generic tests
  4. Build and run the app to verify fonts appear in the dropdown
- Validation: 
  - Rust tests pass
  - `list_bundled_fonts()` returns "Amiri" and "Tajawal" in the sorted list
  - Fonts are selectable in the editor preferences
- Notes: The existing `family_from_stem()` tests cover the pattern; explicit tests for new fonts are optional but recommended

### Task 6: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation
- Steps:
  1. Inspect the worktree for temporary files, scripts, or test data
  2. Remove only artifacts not part of the intended final state
  3. Keep font files, license updates, and any new tests
- Validation: Worktree diff contains only intended final changes
- Notes: Do not remove font files or license documentation

## Final Verification

- `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` — all Rust tests pass
- `cmd.exe /c bun run type-check` — TypeScript type checking passes
- `cmd.exe /c bun run lint` — linting passes
- `cmd.exe /c bun run build` — build succeeds
- Verify `fonts/` directory contains 14 TTF files (10 existing + 4 new)
- Verify `fonts/LICENSES.md` lists all 7 font families
- Manual: Run app and confirm Amiri and Tajawal appear in font family dropdown

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/` directory).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] No unresolved open questions remain.
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
- After completion, mark TODO-0023 as `[x]` in `docs/todo/TODO.md` and archive it using the `todo-manager` skill.
