# TODO-0042: Font System Implementation Plan

## Metadata

- Plan Status: COMPLETED
- Created: 2026-06-01
- Last Updated: 2026-06-03
- Owner: Coding agent
- Approval: APPROVED
- Source TODO: `docs/todo/TODO.md:44` (TODO-0042)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Rework Mini Diarium's font system so it behaves like a standard rich-text editor: app-level defaults stay in Preferences, each entry can carry its own default font family and size, and arbitrary text selections can carry inline font family and size marks. Entry-specific font state must round-trip through encrypted journal storage, custom font files remain journal-local, and the toolbar must stop treating font controls as global preference shortcuts.

## Research Summary

- Current implementation:
  - `src/state/preferences.ts` stores `editorFontFamily` and `editorFontSize` in `localStorage`; these are shared across journals and fit app-level defaults only.
  - `src/components/editor/DiaryEditor.tsx` applies those preferences as editor wrapper CSS variables and injects one selected font face through `getFontData`.
  - `src/components/editor/EditorToolbar.tsx` currently calls `setPreferences` from the font dropdowns, so toolbar use changes the whole app default.
  - `src-tauri/src/db/queries/entries.rs` stores encrypted title/text fields only; no entry metadata exists.
  - Schema version is currently v8 and already has the per-journal `custom_fonts` table.
- Tiptap research:
  - Tiptap 3's `TextStyle` mark renders styled spans and is the foundation for font family and font size attributes.
  - `FontFamily` and `FontSize` are exported from `@tiptap/extension-text-style`; do not introduce deprecated/separate font-family or font-size packages.
  - `FontFamily` provides `setFontFamily()` / `unsetFontFamily()`; `FontSize` provides `setFontSize()` / `unsetFontSize()`.
  - Local package verification: `node_modules/@tiptap/extension-text-style/package.json` exposes `./font-family`, `./font-size`, and root exports; `src/index.ts` re-exports both modules.
- Source references:
  - [Tiptap FontFamily](https://tiptap.dev/docs/editor/extensions/functionality/fontfamily)
  - [Tiptap FontSize](https://tiptap.dev/docs/editor/extensions/functionality/fontsize)
  - [Tiptap TextStyle](https://tiptap.dev/docs/editor/extensions/marks/text-style)
  - [Tiptap text-style changelog](https://tiptap.dev/docs/resources/changelog/extension-text-style)

## Scope

- Keep app defaults in `localStorage['preferences']`: `editorFontFamily` and `editorFontSize`.
- Add encrypted per-entry font metadata: `fontFamily: string | null`, `fontSize: number | null`.
- Add a schema v9 migration with a nullable encrypted metadata BLOB on `entries`.
- Extend Rust entry queries, commands, JSON import/export, Rhai plugin conversion, and frontend Tauri types to carry metadata.
- Register Tiptap `FontFamily` and `FontSize` from `@tiptap/extension-text-style`.
- Rework toolbar font controls so dropdown changes apply inline formatting to the selection/cursor.
- Add explicit entry-default controls/actions so users can set or clear the current entry's default font without confusing that with inline formatting.
- Inject `@font-face` rules for every bundled/custom family referenced by the active app default, entry default, or inline styled spans.
- Update tests, docs, changelog, and TODO bookkeeping.

## Non-Goals

- No network font loading, OS font discovery, analytics, telemetry, or update checks.
- No change to custom font file storage; `custom_fonts` remains per-journal unencrypted BLOB storage.
- No migration that writes the current app default into every existing entry.
- No Markdown preservation of font styling. Markdown has no portable native font family/size syntax; JSON remains the rich export path.
- No full document style system beyond app default, entry default, and inline overrides.
- No E2E test unless implementation uncovers behavior that Rust/Vitest/manual verification cannot cover.

## Assumptions

- Per-entry font metadata is entry content and should be encrypted at rest.
- A nullable encrypted `entry_metadata_encrypted` column is safer and clearer than encoding entry defaults into TipTap document attributes while the app persists HTML strings.
- Existing entries with no metadata inherit the app default.
- Inline font overrides belong in the encrypted `text` HTML field as Tiptap text-style spans.
- Toolbar dropdown changes should follow common editor behavior by applying to the current selection or stored marks at the cursor. Whole-entry default changes should be explicit actions.
- Missing/deleted custom fonts should fall back visually without rewriting entry metadata or inline HTML.

## Open Questions

None.

## Current Status

The plan is ready for approval. Implementation has not started.

## Tasks

### Task 1: Define Entry Font Metadata

- Status: COMPLETED
- Objective: A validated Rust representation exists for per-entry font defaults.
- Steps:
  1. Add an `EntryMetadata` or `EntryFontMetadata` struct near `DiaryEntry`.
  2. Include optional `font_family` and `font_size` fields with serde names compatible with frontend `fontFamily` / `fontSize`.
  3. Add normalization helpers that trim empty family strings to `None` and clamp or reject unsupported sizes outside 12-24 px.
  4. Add `metadata` to `DiaryEntry`, defaulting to no override.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test db::queries::entries"` passes.
- Notes: Keep the existing title/text encryption and word-count behavior unchanged.

### Task 2: Add Schema v9 And Encrypted Metadata Storage

- Status: COMPLETED
- Objective: Existing and new journals can store entry metadata encrypted at rest.
- Steps:
  1. Bump `SCHEMA_VERSION` from `8` to `9` in `src-tauri/src/db/schema/mod.rs`.
  2. Add nullable `entry_metadata_encrypted BLOB` to the `entries` table in `src-tauri/src/db/schema/create.rs`.
  3. Add `src-tauri/src/db/schema/migrations/v8_to_v9.rs` to add the column and update `schema_version` to `9`.
  4. Wire the migration into `src-tauri/src/db/schema/migrations/mod.rs`.
  5. Update schema tests that assert v8 and add a v8 -> v9 migration test with existing rows.
  6. Extend `ENTRY_SELECT`, row decoding, insert, and update logic to encrypt/decrypt metadata JSON with an `"entry_metadata"` context.
  7. Add a test proving raw DB bytes do not contain a test font family string.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test db::schema"` and `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test db::queries::entries"` pass.
- Notes: `NULL` metadata means no entry override.

### Task 3: Extend Entry IPC And Frontend State Flow

- Status: COMPLETED
- Objective: The frontend can read and save per-entry font metadata through normal entry workflows.
- Steps:
  1. Update `create_entry` to return default metadata.
  2. Update `save_entry_inner` and `save_entry` to accept optional metadata and persist it with title/text updates.
  3. Update `src/lib/tauri.ts` `DiaryEntry` and `saveEntry`.
  4. Update `EditorPanel`, lifecycle hooks, navigation hooks, and tests that create or save `DiaryEntry`.
  5. Update every Rust `DiaryEntry` literal/helper across commands, auth tests, stats/debug tests, import/export tests, plugin tests, and tag tests so compilation cannot drift.
  6. Keep delete-empty behavior based on title/text only so a blank styled entry is still blank.
- Validation: `cmd.exe /c bun run type-check` and `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test commands::entries"` pass.
- Notes: Preserve existing debounce and navigation behavior.

### Task 4: Preserve Metadata In JSON And Plugin Surfaces

- Status: COMPLETED
- Objective: Full-fidelity JSON export/import and plugin APIs can carry font metadata without breaking old formats.
- Steps:
  1. Add a `metadata` or `font` object to Mini Diarium JSON export entries when an entry has font overrides.
  2. Update the built-in Mini Diary/Mini Diarium JSON importer to support both shapes it needs to handle:
     - Legacy Mini Diary date-keyed object format currently parsed by `src-tauri/src/import/minidiary.rs`.
     - Current Mini Diarium array export format emitted by `src-tauri/src/export/json.rs`, including `id`, `date`, `title`, `text`, `dateUpdated`, `tags`, and the new optional font metadata.
  3. Preserve backward compatibility: old Mini Diary imports and old Mini Diarium JSON exports with no metadata still import with no entry override.
  4. Update Rhai `entries_to_rhai_array` and `convert_to_entries` to include optional metadata fields while tolerating old scripts.
  5. Add tests for JSON export/import and Rhai conversion.
  6. Leave Markdown export intentionally text-focused; add/adjust tests to confirm styled spans do not corrupt text output.
- Validation: `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test export"`, `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test import"`, and `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test plugin"` pass.
- Notes: Document JSON as the full-fidelity path for font metadata.

### Task 5: Register Tiptap Font Extensions And Inline Commands

- Status: COMPLETED
- Objective: Inline font family and size marks are supported and controlled by the toolbar.
- Steps:
  1. Import and register `FontFamily` and `FontSize` from `@tiptap/extension-text-style` in `DiaryEditor`.
  2. Keep the existing `TextStyle` and `Color` behavior working on the same mark.
  3. Update `EditorToolbar` active-state tracking to read `editor.getAttributes('textStyle').fontFamily` and `.fontSize`.
  4. Replace toolbar calls to `setPreferences` with `setFontFamily`, `unsetFontFamily`, `setFontSize`, and `unsetFontSize`.
  5. Update toolbar tests for visibility, active values, and command calls.
- Validation: `cmd.exe /c bun run test:run -- src/components/editor/EditorToolbar.test.tsx` passes.
- Notes: Do not add `@tiptap/extension-font-family` or `@tiptap/extension-font-size`.

### Task 6: Add Explicit Entry Default UX

- Status: COMPLETED
- Objective: Users can set/clear the current entry's default font family and size as an explicit action.
- Steps:
  1. Add `entryMetadata` and `onEntryMetadataChange` props to `DiaryEditor`.
  2. Add compact entry-default actions near the font controls, such as "Set entry default" and "Clear entry default", using i18n strings.
  3. Wire entry-default changes through `EditorPanel` state and the existing debounced save path.
  4. Apply entry defaults as editor wrapper CSS variables for only the active entry.
  5. Add integration tests for loading, setting, clearing, saving, and navigating between entries with different defaults.
- Validation: `cmd.exe /c bun run test:run -- src/components/layout src/components/editor` passes.
- Notes: Direct dropdown changes remain inline formatting; entry defaults require explicit action.

### Task 7: Implement Font Precedence And Multi-Font Loading

- Status: COMPLETED
- Objective: The editor renders app defaults, entry defaults, and inline overrides with correct precedence and local font faces.
- Steps:
  1. Compute wrapper CSS variables as `entry default ?? app default ?? system fallback`.
  2. Ensure inline `font-family` and `font-size` span styles naturally override wrapper variables.
  3. Extract referenced font families from current entry HTML and combine them with app and entry defaults.
  4. Replace the single `editor-font-face` injection with a helper that emits multiple local `@font-face` rules through `getFontData`.
  5. Subscribe to `customFontsVersion` so custom font replacement/deletion refreshes injected styles.
  6. Add tests for font-family extraction, style generation, missing font fallback, and wrapper precedence.
- Validation: `cmd.exe /c bun run test:run -- src/components/editor src/state` passes.
- Notes: All fonts must come from bundled files or the active journal DB.

### Task 8: Update Preferences, I18n, And Focused Tests

- Status: COMPLETED
- Objective: App-default copy and all localized UI strings match the new model.
- Steps:
  1. Rename preference labels/hints from generic editor font wording to default editor font wording where needed.
  2. Keep Preferences controls as app-default controls that persist to `localStorage`.
  3. Add new English i18n keys in `src/i18n/locales/en.ts`.
  4. Add matching keys to `de.json`, `es.json`, `fr.json`, `it.json`, and `hi.json`.
  5. Update preference and editor tests for the new labels and behavior.
- Validation: `cmd.exe /c bun run test:run` and `cmd.exe /c bun run validate:locales` pass.
- Notes: The current repo allows some translated files to contain English fallback text; follow the existing convention if full translation is not available.

### Task 9: Update Documentation And Changelog

- Status: COMPLETED
- Objective: User-facing and agent-facing docs describe the new behavior and schema correctly.
- Steps:
  1. Update `website/docs-src/01-writing-entries.md` with app default, entry default, inline override, and custom font fallback behavior.
  2. Update `website/docs-src/07-preferences.md` to clarify Preferences controls are app defaults.
  3. Update `website/docs-src/05-export.md` to explain that JSON is the full-fidelity export path for entry font metadata and inline styled HTML; Markdown remains text-focused.
  4. Run `cmd.exe /c bun run website:build-static` from PowerShell and inspect generated website docs.
  5. Update `src/CLAUDE.md` if it documents editor/font behavior.
  6. Update `src-tauri/CLAUDE.md` schema note from v8 to v9 and mention encrypted entry metadata.
  7. Update `docs/decisions/2026-05-settings-storage-taxonomy.md` if needed for per-entry metadata guidance.
  8. Add an `[Unreleased]` changelog entry.
- Validation: Website build succeeds; file inspection confirms docs and changelog mention the three-level font model and schema v9.
- Notes: Generated website docs are intentional final artifacts after docs-src changes.

### Task 10: Cleanup And Final Verification

- Status: COMPLETED
- Objective: Remove intermediate artifacts, mark TODO-0042 complete, and verify the integrated change.
- Steps:
  1. Inspect `git status` for temporary files, scratch scripts, logs, and generated outputs.
  2. Remove only artifacts that are not intended final repository state.
  3. Mark TODO-0042 as `[x]` in `docs/todo/TODO.md`.
  4. Run final commands: `cmd.exe /c bun run format`, `cmd.exe /c bun run type-check`, `cmd.exe /c bun run lint`, `cmd.exe /c bun run test:run`, `cmd.exe /c bun run validate:locales`, `cmd.exe /c bun run build`, and `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`.
  5. Manually verify in a disposable journal: app default applies to entries without overrides; entry default affects only one entry; inline selected text overrides both; navigation away/back preserves all three levels; missing custom fonts fall back visually without data loss.
- Validation: All final commands pass, manual verification is recorded, and `git diff -- docs/todo/TODO.md` shows TODO-0042 checked off.
- Notes: Per manual-planning rules, TODO completion happens after implementation and validation, not while creating this plan.

## Approval Gate

Implementation must not start until the user approves this plan.

## Pre-flight Checks

Run these commands before marking the implementation completed. Fix all failures before proceeding.

- [ ] `cmd.exe /c bun run format`
- [ ] `cmd.exe /c bun run type-check`
- [ ] `cmd.exe /c bun run lint`
- [ ] `cmd.exe /c bun run test:run`
- [ ] `cmd.exe /c bun run validate:locales`
- [ ] `cmd.exe /c bun run build`
- [ ] `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"`
- [ ] Manual UI verification completed for app default, entry default, and inline override flows
- [ ] Website docs regenerated if docs-src changed
- [ ] CHANGELOG entry added
- [ ] TODO-0042 checked off
- [ ] Plan status updated to COMPLETED after implementation

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Plan status is `READY FOR APPROVAL`.
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] Zero unresolved open questions remain.
- [x] The plan has 10 concrete tasks, so milestone grouping is optional.
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Execution Notes

- Set Plan Status to `IN PROGRESS` before implementation starts.
- Update each task to `IN PROGRESS` before starting it and `COMPLETED` immediately after its validation passes.
- Mark tasks `BLOCKED` with a short reason when progress cannot continue.
- Preserve unrelated worktree changes; do not revert user work.
