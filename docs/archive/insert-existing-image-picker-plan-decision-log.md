# Insert Existing Image Picker Plan - Decision Log

Companion to [`insert-existing-image-picker-plan.md`](insert-existing-image-picker-plan.md).

Add a new entry here before moving to the next task whenever implementation diverges from the approved plan. Do not add entries for routine execution that matches the plan exactly.

## D-01: Flatpak cargo sources are generated artifacts, not tracked repo files

Date: 2026-06-04

Plan step affected: Task 1.3 step 4 (`update flatpak/cargo-sources.json`)

Decision: Do not create or hand-edit `flatpak/cargo-sources.json` in this repo while adding the Rust `image` dependency.

Why: The repo's Flatpak guidance contradicts the plan's concrete file assumption:
- `.agents/skills/flathub-maintenance/SKILL.md` states vendored source files such as `cargo-sources.json` do not exist in the main repo and must never be edited by hand.
- `docs/FLATPAK_MAINTENANCE.md` says these files are generated for Flathub updates from lockfiles.
- `.gitignore` ignores `flatpak/cargo-sources.json`.

Implementation consequence:
- Update `Cargo.toml` and `Cargo.lock` in this repo as part of the feature work.
- Do not add a tracked `flatpak/cargo-sources.json` file that the repo intentionally excludes.
- Preserve the requirement in docs and final notes that any Flathub update/release flow must regenerate `cargo-sources.json` from the final `Cargo.lock`.

## D-02: Cleanup validation must account for an already-dirty worktree

Date: 2026-06-04

Plan step affected: Task 3.4 validation (`Worktree diff contains only intended final changes`)

Decision: Treat Task 3.4 cleanup validation as "this task left no temporary artifacts and only intentional task files were added or edited by the implementation" rather than requiring a globally clean worktree.

Why:
- The repo already contains unrelated modified files outside this feature's scope.
- Root `CLAUDE.md` explicitly warns that the worktree may be dirty and instructs agents not to revert unrelated user changes.
- Forcing the literal plan wording would either misreport status or require undoing user work, which the repo rules forbid.

Implementation consequence:
- Inspect the worktree and confirm this task did not leave temporary fixtures, debug files, or scratch artifacts behind.
- Keep unrelated pre-existing modifications untouched.
- Report the remaining unrelated worktree modifications in final notes instead of treating them as cleanup failures for this feature.

## D-03: Real-app verification used a seeded sandbox and left fault injection to automated tests

Date: 2026-06-04

Plan step affected: Task 3.2 (`Verify every UX scenario listed in UX Scenarios For Approval`)

Decision: Complete real-app verification in the Tauri dev sandbox by seeding representative image data through the live WebView's Tauri invoke bridge, and rely on automated tests for forced failure scenarios rather than manually corrupting image rows or intercepting backend reads in the desktop session.

Why:
- The review blocker was specifically about proving real WebView sizing, focus handling, pagination, filter controls, preview rendering, Escape behavior, and explicit insertion in the desktop app.
- Those runtime behaviors are meaningfully verifiable with a seeded sandbox journal.
- Manually forcing thumbnail/data-read failures in the live desktop session would require destructive test-only backend manipulation that is already covered by targeted Rust and frontend tests added for this feature.

Implementation consequence:
- Manual verification notes should describe the seeded sandbox workflow and list the real-app scenarios that were exercised directly.
- Error-state confidence continues to come from the automated coverage added in `db::queries::images` tests and `ImagePickerOverlay` tests.

## D-04: Narrow picker layout uses mutually exclusive library and preview panels

Date: 2026-06-04

Plan step affected: Task 2.2 (`use a wider responsive dialog with a toolbar row, thumbnail grid, and preview/details pane`)

Decision: On narrow viewports, do not keep the library grid and preview pane stacked in one vertical flow. Render a mobile-specific overlay mode with two tabs, `Library` and `Preview`, and show only one panel at a time below the shared controls.

Why:
- The original responsive interpretation of Task 2.2 kept both panels visible by collapsing the desktop side-by-side layout into a vertical stack.
- In the real Tauri WebView at narrow widths, that layout became cramped and visually unstable because the grid, preview metadata, and footer all competed for the same vertical space.
- The mobile-tab approach keeps the dialog usable on small windows without changing the desktop interaction model.

Implementation consequence:
- Desktop (`>= lg`) still renders the grid and preview together.
- Narrow viewports render the shared sort/month controls plus a `Library` / `Preview` tab switcher.
- Only one panel is mounted at a time in the mobile layout, which also avoids duplicate DOM content in component tests.
