# Custom Fonts Implementation Review

Date: 2026-05-28

Scope:
- Reviewed the finished implementation against `docs/custom-fonts-plan.md`
- Cross-checked the recorded adjustments in `docs/custom-fonts-plan-decision-log.md`
- Inspected backend, frontend, schema, docs, and test changes
- Ran focused Rust/Vitest validation plus TypeScript type-checking

## Verdict

The feature is functionally in good shape and the decision-log items were applied correctly. I did not find a release-blocking runtime defect, but the implementation is not fully done to the quality bar described in the plan: there is one meaningful test-coverage gap, one user-facing i18n regression, and one error-handling gap in the font picker flow.

## Findings

1. **[P2] The new Rust tests do not exercise the command entry points they claim to validate**

   File references:
- `src-tauri/src/commands/fonts.rs:544`
- `src-tauri/src/commands/fonts.rs:603`
- `src-tauri/src/commands/fonts.rs:618`
- `src-tauri/src/commands/fonts.rs:658`
- `src-tauri/src/commands/fonts.rs:706`

   Details:
- `test_list_custom_fonts_aggregates_weights` rebuilds the aggregation logic manually from raw SQL rows instead of calling `list_custom_fonts`.
- `test_import_custom_font_rejects_invalid_magic` only checks `mime_from_bytes`, not `import_custom_font`.
- `test_import_custom_font_rejects_bold_before_regular` inspects raw DB state but never invokes `import_custom_font`.
- `test_delete_custom_font_family_removes_all_weights` performs a direct SQL `DELETE` instead of calling `delete_custom_font_family`.
- `test_get_font_data_bold_synthesized_false_for_bundled` constructs `FontFaceData` directly instead of calling `get_font_data`.

   Impact:
- The suite passes even if the actual command wiring, unlocked-state guard, SQL statements, or returned payload behavior regresses.
- This falls short of the plan’s stated exit criteria around command-level coverage for `list_custom_fonts`, `import_custom_font`, `delete_custom_font_family`, and `get_font_data`.

   Required fix:
- Replace these tests with command-level tests that call the public functions against a real test `DiaryState`/DB setup, or factor the logic into explicit helpers and test both helper behavior and command wrappers.

2. **[P2] Required-field validation in Preferences is hardcoded in English and bypasses i18n**

   File references:
- `src/components/overlays/preferences/PreferencesWritingTab.tsx:146`
- `src/components/overlays/preferences/PreferencesWritingTab.tsx:150`

   Details:
- The component builds validation messages by concatenating translated labels with the English suffix `' is required.'`.

   Impact:
- Non-English users get mixed-language error text.
- Languages with different grammar/order cannot translate this correctly.
- This is a user-facing regression in a repo that otherwise localizes UI copy through locale keys.

   Required fix:
- Move these messages into locale strings with interpolation, for example a single key like `prefs.writing.customFontFieldRequired`.

3. **[P3] File-picker failures are not sanitized or shown in the custom-font UI**

   File reference:
- `src/components/overlays/preferences/PreferencesWritingTab.tsx:108`
- `src/components/overlays/preferences/PreferencesWritingTab.tsx:131`

   Details:
- `pickRegular()` and `pickBold()` await `openDialog(...)` without `try/catch`.
- The upload and delete paths already map errors through `mapTauriError()`, but the file-picker path does not.

   Impact:
- If the Tauri dialog plugin rejects, the user gets no inline `fontManagerError`.
- The failure bypasses the project’s normal sanitized error-mapping path.

   Required fix:
- Wrap both picker helpers in `try/catch` and call `setFontManagerError(mapTauriError(err, t))`.

4. **[P3] Both font-family selectors render a custom-font optgroup even when it is empty**

   File references:
- `src/components/overlays/preferences/PreferencesWritingTab.tsx:422`
- `src/components/editor/EditorToolbar.tsx:415`

   Details:
- The `"Custom"` `<optgroup>` is unconditional in both selectors.

   Impact:
- Minor UX/accessibility rough edge: the UI exposes an empty group label when no eligible custom fonts exist.

   Suggested fix:
- Render the optgroup only when at least one custom family with `has_regular === true` exists.

## Decision Log Check

All three decision-log items are reflected correctly in the implementation:

- The schema-version assertions affected by the new migration were updated from v7 to v8.
- The ambiguous `getByText('TestFont')` case in the preferences test was corrected to tolerate multiple matches.
- The overall bold-synthesis direction from the plan remains implemented correctly in runtime code.

## What Is Correct

- `get_font_data` checks custom DB fonts before bundled fonts and returns `bold_synthesized`.
- `DiaryEditor.tsx` correctly omits the fake 700-weight `@font-face` when `bold_synthesized` is `true`, which preserves browser-side synthetic bold.
- `import_custom_font` enforces the Regular-before-Bold invariant.
- Custom fonts appear in both the Preferences selector and the toolbar selector, filtered to families that have a Regular weight.
- Deleting the currently selected custom font clears the persisted preference immediately.
- Schema v8 integration is complete across schema creation, migration registration, command registration, docs, and changelog updates.

## Validation Run

Executed during this review:

- `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test commands::fonts"`: passed
- `cmd.exe /c bun run test:run -- src/components/editor/EditorToolbar.test.tsx src/components/overlays/preferences/PreferencesWritingTab.test.tsx`: passed
- `cmd.exe /c bun run type-check`: passed

## Assumptions

- Assumed the editor and Preferences writing UI are only reachable while the journal is unlocked. If that changes later, `list_custom_fonts` and `get_font_data` will need a locked-state strategy instead of unconditional `with_unlocked_db`.
