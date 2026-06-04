# Insert Existing Image Picker Plan

## Metadata

- Plan Status: COMPLETED
- Created: 2026-06-04
- Last Updated: 2026-06-04
- Owner: Coding agent
- Approval: APPROVED
- UX-GATE: REQUIRED

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Replace the current non-shippable "insert existing image" picker with a production-ready media picker that lets users visually identify saved journal images through encrypted thumbnails, meaningful metadata, filtering, selection preview, and explicit insertion without duplicating stored image data.

## Scope

- Add backend support for thumbnail and metadata-rich image summaries while preserving encrypted-at-rest guarantees.
- Migrate the image schema to store encrypted thumbnails and dimensions for new and existing journal images.
- Update the Tauri image commands and TypeScript wrappers to expose paginated summaries suitable for a media picker.
- Redesign `ImagePickerOverlay` into a visual image browser with thumbnail grid, selected preview, filters, loading states, keyboard handling, and explicit insert action.
- Update packaging dependency sources if the implementation adds a Rust image-processing crate.
- Add focused backend, frontend, and UI tests for summary metadata, migration/backfill behavior, and picker interactions.
- Update user-facing website docs for image insertion behavior.
- Run formatting and relevant validation commands after implementation.

## Non-Goals

- Do not add network image fetching, telemetry, cloud sync, or external image search.
- Do not expose plaintext image bytes or thumbnails on disk.
- Do not build a full media library manager with delete, rename, albums, captions, or bulk actions.
- Do not change export behavior except as needed to preserve existing `image-id://` resolution.
- Do not remove the existing image deduplication logic.

## Assumptions

- Thumbnails may be stored in the journal database if they are encrypted with the same journal key as image payloads.
- A 192-256 px maximum thumbnail edge is sufficient for identification in the picker.
- The first implementation may support date/month filtering and newest/oldest/most-used sorting without full-text search.
- Existing images can be lazily backfilled when summaries are requested, avoiding a long blocking migration.
- Existing entries and exports that use `image-id://N` references must continue to work.
- UI strings must be localized through existing i18n files.
- The current latest schema is v10; this plan's image summary migration is expected to become v11 unless another schema migration lands first.
- `src/i18n/locales/en.ts` is currently the only concrete locale file; `src/i18n/locales/index.ts` must still be checked for type/export impact.

## Open Questions

- None.

## UX Scenarios For Approval

Approval of this plan includes approval of these target interaction scenarios. If any scenario is rejected, update this plan before implementation.

- Empty journal image library: opening the picker shows a compact empty state and no insert button is enabled.
- Loading library: opening the picker shows skeleton/placeholder thumbnail cells without blocking the rest of the app.
- Browse many images: images appear in a scrollable thumbnail grid with stable tile sizes, newest first by default, and a visible "Load more" control when more pages exist.
- Identify one image among same-day images: each tile shows the actual thumbnail plus concise metadata, and the selected image shows a larger preview with created date, dimensions, format, usage count, and linked entry date context when available.
- Insert intentionally: single click selects an image, double click inserts it, and the primary `Insert` button inserts the selected image.
- Avoid accidental insert: first click never immediately inserts; pressing Escape closes without changing editor content.
- Filter by time: the user can filter by month/date range or at minimum narrow to a month from controls in the dialog.
- Sort results: the user can sort by newest, oldest, and most used.
- Failed thumbnail or data load: the tile shows a clear local error/fallback state and insertion failures keep the dialog open with an error message.
- Keyboard path: tab focus reaches filters, grid items, preview actions, close, and insert; Enter inserts the selected image; Escape closes.

## Milestones

### Milestone 1: Confirm Data Model And Backend Contract

- Status: COMPLETED
- Purpose: Establish the persisted encrypted thumbnail/metadata model and API shape before UI work depends on it.
- Exit Criteria: Schema changes, migration strategy, query signatures, and TypeScript API types are implemented and covered by backend tests.

#### Task 1.1: Inventory Current Image Pipeline

- Status: COMPLETED
- Objective: Confirm every path that creates, stores, resolves, lists, and cleans up journal images.
- Steps:
  1. Read `src-tauri/src/db/queries/images.rs`, `src-tauri/src/db/schema/create.rs`, `src-tauri/src/db/schema/migrations/v9_to_v10.rs`, `src-tauri/src/commands/images.rs`, `src/lib/tauri.ts`, and editor save/load code that handles `image-id://` references.
  2. Confirm whether any import/export path bypasses `extract_and_replace_image_refs`.
  3. Record any discovered affected files in this task's Notes before implementation proceeds.
- Validation: File inspection confirms all image creation/list/resolve paths are known; no image path that writes plaintext to disk is introduced.
- Notes: Security invariant: no plaintext diary content or image bytes may be written to disk. Affected files confirmed during inventory: `src-tauri/src/db/queries/images.rs`, `src-tauri/src/db/queries/entries.rs`, `src-tauri/src/db/schema/create.rs`, `src-tauri/src/db/schema/migrations/v9_to_v10.rs`, `src-tauri/src/commands/images.rs`, `src-tauri/src/commands/export.rs`, `src-tauri/src/commands/plugin.rs`, `src-tauri/src/commands/import.rs`, `src/lib/tauri.ts`, `src/lib/image-refs.ts`, `src/components/layout/editor-panel/useEntryLifecycle.ts`, `src/components/layout/editor-panel/useMultiEntryNav.ts`, `src/components/editor/DiaryEditor.tsx`, `src/components/overlays/ImagePickerOverlay.tsx`, and related tests. Confirmed import path uses `insert_entry_with_images()` and does not bypass `extract_and_replace_image_refs`; JSON/Markdown/plugin export paths all use `resolve_image_refs_in_entries()`.

#### Task 1.2: Add Image Metadata And Thumbnail Schema

- Status: COMPLETED
- Objective: Persist enough encrypted metadata for visual picker summaries.
- Steps:
  1. Add `src-tauri/src/db/schema/migrations/v10_to_v11.rs` unless the latest schema version has changed before implementation.
  2. Register the migration in `src-tauri/src/db/schema/migrations/mod.rs` and add it to `apply_pending`.
  3. Bump `SCHEMA_VERSION` in `src-tauri/src/db/schema/mod.rs` and update schema-version tests that currently assert `10`.
  4. Add fields for encrypted thumbnail bytes, thumbnail MIME type, width, height, byte size, and thumbnail generation version.
  5. Update fresh database creation SQL in `src-tauri/src/db/schema/create.rs` to match the migrated schema.
  6. Keep fields nullable where needed so old rows can be lazily backfilled.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test db::schema"` passes or, if module-level filtering differs, the closest schema migration test command passes.
- Notes: Thumbnails must be encrypted BLOBs, not base64 text stored in plaintext.

#### Task 1.3: Generate Thumbnails And Dimensions On Image Upsert

- Status: COMPLETED
- Objective: New images have encrypted thumbnail data and dimensions immediately after storage.
- Steps:
  1. Add image dimension detection and thumbnail generation to the backend image storage path.
  2. Inspect `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` before adding dependencies; there is currently no obvious image-processing crate in the manifest.
  3. Prefer a Rust image processing crate already present in the project if available; otherwise add the smallest suitable crate and update `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`.
  4. If a Rust dependency is added, update `flatpak/cargo-sources.json` according to the Flatpak maintenance workflow so offline Flatpak builds keep working.
  5. Generate thumbnails from validated plaintext bytes in memory, then encrypt thumbnail bytes before database write.
  6. Store original byte size, original width, original height, thumbnail MIME type, and thumbnail generation version.
- Validation: Add or update backend tests proving supported image formats store dimensions and encrypted thumbnail bytes; run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test images"`.
- Notes: If Flatpak source regeneration requires extra tooling, use the `flathub-maintenance` skill during implementation.

#### Task 1.4: Lazy Backfill Existing Images

- Status: COMPLETED
- Objective: Existing journals with images gain thumbnails without a blocking full migration.
- Steps:
  1. Implement a backend helper that detects image rows missing thumbnail/metadata fields.
  2. When summaries are requested, decrypt only the page of rows being listed and backfill missing thumbnail/metadata for those rows.
  3. Keep failures per-row isolated: a corrupt image should show a fallback summary rather than failing the whole picker when possible.
  4. Add tests for old rows with null thumbnail fields.
- Validation: Backend tests prove `list_image_summaries` backfills old rows and returns summary data without duplicating image rows.
- Notes: Do not backfill orphaned images that cleanup would remove unless they appear in the selected summary page.

#### Task 1.5: Extend Summary Query With Usage And Entry Context

- Status: COMPLETED
- Objective: Return summaries that help users distinguish images beyond date and MIME type.
- Steps:
  1. Extend `ImageSummary` in Rust and TypeScript to include thumbnail data URL inputs, dimensions, byte size, usage count, first linked entry date, and latest linked entry date.
  2. Update `list_image_summaries` SQL to join `entry_images` and `entries` for usage and linked-date context.
  3. Keep pagination parameters and add a deterministic sort parameter for newest, oldest, and most used.
  4. Add optional month/date-range filters at the query layer if doing so is simpler and more robust than frontend filtering.
- Validation: Backend tests cover sorting, pagination, usage count, and linked entry date context.
- Notes: Do not decrypt entry title/text for this picker; linked dates are enough for the first production version.

### Milestone 2: Build The Production Picker UI

- Status: COMPLETED
- Purpose: Replace the current guessing UI with a visual, accessible, intentional picker workflow.
- Exit Criteria: Users can identify, filter, select, preview, and insert existing images without guessing or accidental insertion.

#### Task 2.1: Update Tauri TypeScript Wrapper And i18n

- Status: COMPLETED
- Objective: Frontend code has typed access to the richer image summary API and localized UI strings.
- Steps:
  1. Update `ImageSummary` and `listJournalImageSummaries` in `src/lib/tauri.ts`.
  2. Add new i18n keys for picker filters, sorting, preview metadata, loading, load-more, empty, and error states.
  3. Add the keys to every locale file and validate locale completeness.
- Validation: `cmd.exe /c bun run validate:locales` and `cmd.exe /c bun run type-check` pass.
- Notes: Keep UI copy concise; this is a tool dialog, not onboarding text.

#### Task 2.2: Redesign ImagePickerOverlay Layout

- Status: COMPLETED
- Objective: Replace generic icon cards with thumbnail grid plus selected preview.
- Steps:
  1. Convert `ImagePickerOverlay` to use the existing Kobalte `Dialog` pattern used by other overlays where practical.
  2. Use a wider responsive dialog with a toolbar row, thumbnail grid, and preview/details pane.
  3. Render thumbnails with stable aspect-ratio boxes and fallback icons only when thumbnail data is missing or fails to load.
  4. Make single click select and double click insert.
  5. Add explicit close and insert buttons; disable insert until an image is selected or while insert is loading.
- Validation: Component tests confirm thumbnails render, first click selects without inserting, double click inserts, and the insert button inserts the selected image.
- Notes: Do not nest UI cards inside other cards; keep tile radius at 8px or less.

#### Task 2.3: Add Filtering, Sorting, And Pagination State

- Status: COMPLETED
- Objective: Make large image libraries navigable.
- Steps:
  1. Add sort control for newest, oldest, and most used.
  2. Add a month/date filter control using existing date utilities where possible.
  3. Request summaries in pages with a fixed page size.
  4. Add a `Load more` button that appends the next page without losing the current selection when still present.
  5. Reset pagination when filters or sort order change.
- Validation: Component tests cover sort/filter parameter changes, load-more behavior, and selection retention/reset behavior.
- Notes: Prefer explicit `Load more` over infinite scroll for deterministic testing and keyboard accessibility.

#### Task 2.4: Improve Selection Preview And Metadata

- Status: COMPLETED
- Objective: Give users enough context to choose between similar images.
- Steps:
  1. Show a larger preview of the selected thumbnail or full image preview if already fetched.
  2. Show created date, dimensions, format, byte size, usage count, and linked entry date range.
  3. Add selected tile styling and accessible selected state.
  4. Keep long metadata values from overflowing on narrow viewports.
- Validation: Component tests and a responsive visual inspection confirm selected metadata renders and does not overlap at desktop and narrow widths.
- Notes: Component tests for preview metadata pass. Real-app verification in the Tauri dev sandbox confirmed the selected preview and metadata render coherently at desktop width, and narrow-width screenshots confirmed the thumbnail grid remains readable without overlap; do not expose encrypted fingerprints or internal implementation IDs as primary UI labels.

#### Task 2.5: Preserve Insert Semantics Safely

- Status: COMPLETED
- Objective: Existing image insertion remains deduplicated and does not regress editor save/load behavior.
- Steps:
  1. Keep the initial implementation compatible with the existing `onInsert(dataUrl)` contract unless switching to `image-id://N` is done end-to-end in the same task.
  2. If switching to direct `image-id://N` insertion, update editor display resolution so the editor still shows the selected image immediately.
  3. Keep insertion failures inside the dialog with a visible error state.
  4. Confirm save still rewrites and links image IDs correctly after insertion.
- Validation: Existing image picker tests pass, new tests cover insertion failure, and existing image ref tests in `src/lib/image-refs.test.ts` plus backend image tests pass.
- Notes: A direct `image-id://N` insert is architecturally cleaner, but only do it if it does not expand scope beyond this plan.

### Milestone 3: Verification, Docs, And Product Readiness

- Status: COMPLETED
- Purpose: Ensure the picker is documented, tested, accessible, and ready for production use.
- Exit Criteria: Automated tests, formatting, docs, and manual UI verification all pass with no known shippability gaps.

#### Task 3.1: Expand Automated Test Coverage

- Status: COMPLETED
- Objective: Cover the new backend contract and critical picker interactions.
- Steps:
  1. Add Rust tests for migration, thumbnail generation, summary backfill, sorting, filtering, usage counts, and pagination.
  2. Add frontend tests for empty, loading, thumbnail render, select, insert button, double-click insert, load-more, filter/sort changes, and error states.
  3. Add focused tests for i18n keys if existing locale validation does not catch missing nested keys.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` and `cmd.exe /c bun run test:run` pass.
- Notes: Added backend coverage for schema v11 migration, thumbnail generation, backfill, corruption isolation, sorting, filtering, and pagination; added overlay tests for empty/loading/select/insert/load-more/filter/error flows. Full `cargo test` and `bun run test:run` now pass.

#### Task 3.2: Manual UI Verification In The Tauri App

- Status: COMPLETED
- Objective: Confirm the picker works in the real desktop WebView, not only jsdom.
- Steps:
  1. Use the project Tauri agent workflow to launch the dev app with a test journal containing multiple same-day images and enough images to require pagination.
  2. Verify every UX scenario listed in `UX Scenarios For Approval`.
  3. Capture or inspect desktop and narrow viewport states for thumbnail grid, preview pane, filter controls, and error-safe layout.
  4. Confirm keyboard navigation and Escape behavior.
- Validation: Manual verification notes confirm all approved UX scenarios pass in the real app.
- Notes: Executed the `.agents/skills/tauri-agent-dev/SKILL.md` workflow with a sandbox journal in the live Tauri app. Verified real WebView behavior for: visual thumbnail rendering, load-more pagination, preview metadata, non-destructive single-click selection, month filtering, sort control changes, Escape close, explicit insert from a blank entry, and responsive layout screenshots at desktop and narrow widths. The sandbox was seeded through the live Tauri invoke bridge; forced failure scenarios remained covered by automated tests per the decision log.

#### Task 3.3: Update User-Facing Documentation

- Status: COMPLETED
- Objective: Keep website docs accurate for the changed image insertion workflow.
- Steps:
  1. Locate the relevant `website/docs-src/` page that describes editor images or media insertion.
  2. Update it to explain inserting an existing saved image without duplicating storage.
  3. Regenerate static docs if required by the website workflow.
- Validation: PowerShell tool direct `bun run website:build-static` completes when docs generation is required, and generated docs diff matches the source change.
- Notes: Updated `website/docs-src/01-writing-entries.md` and regenerated static website docs with direct PowerShell `bun run website:build-static` per root `CLAUDE.md`.

#### Task 3.4: Changelog And Cleanup

- Status: COMPLETED
- Objective: Leave only intentional final artifacts and record the user-facing change.
- Steps:
  1. Add a concise changelog entry for the improved existing-image picker.
  2. Inspect the worktree for temporary scripts, fixtures, screenshots, generated debug output, and obsolete notes.
  3. Remove only temporary artifacts that are not part of the final implementation.
  4. Keep maintainable tests, docs, migrations, fixtures, and generated website files that are part of the repository contract.
- Validation: Worktree diff contains only intended final changes.
- Notes: Updated the unreleased changelog entry for the picker. Worktree inspection found unrelated pre-existing modifications outside this task's scope; no temporary artifacts from this task were left behind, and unrelated user changes were preserved.

#### Task 3.5: Final Verification

- Status: COMPLETED
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run frontend formatting.
  2. Run Rust formatting.
  3. Run backend tests.
  4. Run frontend tests.
  5. Run type-check and lint.
  6. Run locale validation.
  7. Run build if previous checks pass.
  8. If website docs were regenerated, run the website static build from the PowerShell tool directly, not through Bash plus `cmd.exe`.
  9. Fix failures and rerun the relevant command until passing or record a blocker.
- Validation: All applicable commands/checks below pass:
  - `cmd.exe /c bun run format`
  - `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo fmt"`
  - `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
  - `cmd.exe /c bun run test:run`
  - `cmd.exe /c bun run type-check`
  - `cmd.exe /c bun run lint`
  - `cmd.exe /c bun run validate:locales`
  - `cmd.exe /c bun run build`
  - PowerShell tool direct: `bun run website:build-static` when website docs generation is required
- Notes: Passed final checks: `bun run format`, `cargo fmt`, `cargo test`, `bun run test:run`, `bun run type-check`, `bun run lint` (1 pre-existing warning only in `src/state/auth.ts`), `bun run validate:locales`, `bun run build`, and PowerShell direct `bun run website:build-static`. Commands were run via Windows tooling as required by root `CLAUDE.md`.

## Decision Log

Pre-implementation decisions are recorded in [`insert-existing-image-picker-plan-decision-log.md`](insert-existing-image-picker-plan-decision-log.md).

**During execution:** write a new entry in that file **before moving to the next task** whenever implementation diverges from what this plan specifies. Do not log deviations retrospectively.

A log entry is required when:
- A different file path, rule, function signature, or approach was used than what the plan specified.
- A validation step reveals the plan's approach is incorrect and you adapt.
- A step is skipped for a reason not already covered by the task's BLOCKED handling.

A log entry is **not** required for:
- Execution that matches the plan exactly.
- Trivial wording differences that don't change meaning or outcome.

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the plan COMPLETED. Fix all failures before proceeding, unless a blocker is explicitly recorded.

- [x] `cmd.exe /c bun run format`
- [x] `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo fmt"`
- [x] `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
- [x] `cmd.exe /c bun run test:run`
- [x] `cmd.exe /c bun run type-check`
- [x] `cmd.exe /c bun run lint`
- [x] `cmd.exe /c bun run validate:locales`
- [x] `cmd.exe /c bun run build`
- [x] PowerShell tool direct: `bun run website:build-static` if website docs generation is required
- [x] Manual Tauri UI verification covers all approved UX scenarios
- [x] Website docs are updated and regenerated if required
- [x] Plan status updated to COMPLETED

## Plan Self-Check

- [x] Plan location follows the default location rule.
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Any unresolved open questions have been surfaced to the user.
- [x] Tasks are grouped into milestones because the plan has more than 10 tasks.
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.
- [x] UX-GATE: interaction scenarios are listed for explicit approval before implementation.
- [x] No Tauri WebView navigation/new-window behavior is introduced by this plan.
- [x] Schema-version, dependency-lockfile, Flatpak cargo-source, changelog, and website-doc generation requirements are explicit.

## Execution Notes

- Update the plan status to `APPROVED`, then `IN PROGRESS`, only after the user approves implementation.
- Update milestone and task status before starting and after validation.
- Update each task to `COMPLETED` immediately after its validation passes.
- Mark tasks or milestones `BLOCKED` with a short reason when progress cannot continue.
- Validate after each completed task before moving to the next task.
- Run `cmd.exe /c bun run format` after code changes, per root `CLAUDE.md`.
- Run Rust formatting after Rust changes.
- Before any dependency addition, inspect current dependency files and prefer existing crates/packages.
- If a Rust dependency is added, update Flatpak cargo sources before final verification.
- Run `bun run website:build-static` directly through the PowerShell tool, not through Bash plus `cmd.exe`, if website docs are regenerated.
- If implementation diverges from the plan, write a new entry in `insert-existing-image-picker-plan-decision-log.md` **before starting the next task** (see Decision Log section for what qualifies).
- Do not edit `AGENTS.md` compatibility symlinks directly.
