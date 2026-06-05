# Editor Font Selection — Implementation Plan

## Metadata

- Plan Status: READY FOR APPROVAL
- Created: 2026-05-04
- Last Updated: 2026-05-04 (self-check: corrected Tasks 2/3/4/5/8 with platform-specific paths and CSS details; Assumptions aligned to resolved open questions)
- Owner: Coding agent
- Approval: PENDING

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Allow users to select the editor font from a curated list of open-source fonts bundled with the app. Fonts are enumerated from the bundled font directory at startup — no OS-level font API calls, no sandbox permissions required, no `font-kit` dependency. The selected font applies only to the TipTap editor and is persisted as a user preference.

## Scope

- Acquire five open-source font families (Regular + Bold variants each) covering multilingual, sans-serif, serif, and monospace categories — no duplicate categories, maximum use-case coverage
- Add font files to the Flatpak manifest so they are installed to `/app/share/fonts/` at build time
- For Windows/macOS/Linux native builds: include font files in the installer and place them in a known directory the Rust backend can enumerate
- Create `list_bundled_fonts` Tauri command in `src-tauri/src/commands/fonts.rs` that reads font filenames from the bundled fonts directory
- Add `editorFontFamily: string | null` field to the `Preferences` interface in `src/state/preferences.ts`
- Inject `--editor-font-family` CSS variable from the preference into `DiaryEditor.tsx`
- Add font family dropdown to `PreferencesWritingTab.tsx` (collocated with the existing font size control)
- Add i18n keys for the new preference label and placeholder
- No Flatpak sandbox permissions needed (fonts are bundled, not enumerated from host)

## Non-Goals

- OS-level font enumeration (no `font-kit`, no system font API calls)
- Any Flatpak sandbox permissions beyond what the app already has
- Changing the editor font size (already implemented)
- Changing the body/UI font (editor font selection is editor-only)
- Searchable/filterable font list — a simple `<select>` listing all bundled fonts is sufficient for v1
- Proprietary fonts; only OFL-licensed open-source fonts are bundled

## Assumptions

- Font files are placed in a directory that is accessible at runtime on all platforms (Flatpak: `/app/share/fonts/`, Windows: relative to exe or a known app data path, macOS: app bundle Resources, Linux native: conventional font directory or app share dir)
- The Rust command reads filenames from the bundled fonts directory and returns them as a sorted `Vec<String>`
- Font files are named descriptively (e.g., `NotoSans-Regular.ttf`, `DejaVuSerif-Regular.otf`) so the displayed name in the dropdown can be derived from the filename by stripping the `-Regular`, `-Bold`, etc. suffix and formatting as "Noto Sans", "DejaVu Serif"

## Open Questions

All resolved. See Task 1 for the definitive font list and licensing notes.

## Tasks

### Task 1: Select and acquire font files

- Status: TO BE DONE
- Objective: Five open-source font families (~3.5 MB total), chosen for maximum multilingual coverage and genuine category variety. Every family includes Regular + Bold variants.
- Font list (priority order):
  1. **Noto Sans** — `NotoSans-Regular.ttf`, `NotoSans-Bold.ttf` — multilingual sans-serif (140+ scripts). Role: primary general-writing font for all languages.
  2. **Source Sans 3** — `SourceSans3-Regular.ttf`, `SourceSans3-Bold.ttf` — Latin-optimized sans-serif with clearer letterforms than Noto. Role: nicer alternative for Latin-only users.
  3. **Noto Serif** — `NotoSerif-Regular.ttf`, `NotoSerif-Bold.ttf` — multilingual serif (broad Unicode coverage, literary aesthetic). Pairs visually with Noto Sans.
  4. **JetBrains Mono** — `JetBrainsMono-Regular.ttf`, `JetBrainsMono-Bold.ttf` — monospace designed for code (geometric, clear glyph disambiguation).
  5. **Fira Mono** — `FiraMono-Regular.ttf`, `FiraMono-Bold.ttf` — humanist monospace alternative (wider letterforms, different feel from JetBrains Mono).
- Steps:
  1. Create `fonts/` directory at repo root.
  2. Download each font from official upstream sources:
     - Noto Sans/Serif: Google Fonts (noto-fonts) or directly from fonts.google.com/specimen/Noto-Sans / Noto-Serif
     - Source Sans 3: fonts.google.com/specimen/Source+Sans+3
     - JetBrains Mono: github.com/JetBrains/JetBrainsMono/releases (OFL license)
     - Fira Mono: github.com/mozilla/FiraCode/releases or mozilla/FiraCode tree (MPL 2.0)
  3. Verify license file is included for each family.
  4. Place each `.ttf` file in `fonts/` with its license file alongside it (e.g. `fonts/NotoSans-LICENSE`, `fonts/SourceSans3-LICENSE`, etc.).
- Validation: All 10 font files exist; each family has its license documented; total bundle size ≤ 5 MB.
- Notes: Each font's license explicitly permits redistribution as part of a software bundle. MPL 2.0 (Fira Mono) and OFL/Apache 2.0 (others) are both compatible with closed-source bundled software.

### Task 2: Add font files to Flatpak manifest

- Status: TO BE DONE
- Objective: Font files are installed to `/app/share/fonts/` during Flatpak build, readable by the Rust command at runtime.
- Steps:
  1. Open `flatpak/io.github.fjrevoredo.mini-diarium.yml`.
  2. Add `fonts/` as a `type: dir` source: `- type: dir  path: ../fonts` (under `sources`).
  3. Add an install command to the `build-commands` list: `install -Dm644 ../fonts/*.ttf /app/share/fonts/` (install all `.ttf` files to the system font directory).
  4. Verify the manifest still passes `flatpak-builder --download`.
- Validation: After a local `flatpak-builder --user --install build-dir flatpak/io.github.fjrevoredo.mini-diarium.yml`, run `flatpak run io.github.fjrevoredo.mini-diarium` and confirm `/app/share/fonts/` contains all 10 font files.
- Notes: The `sources` section's `type: dir` with `path: ..` already includes everything in the repo root — fonts under `fonts/` will be available during build. No sandbox permissions needed — fonts are installed inside the sandbox at build time.

### Task 3: Add font files to Windows installer

- Status: TO BE DONE
- Objective: Font files are included in the Windows MSI/NSIS installer and placed in `fonts/` next to the executable.
- Steps:
  1. Open `src-tauri/tauri.conf.json`.
  2. Add `"resources": ["../fonts/*.ttf"]` under `bundle` (creates a `fonts/` directory next to the exe at build time).
  3. In `src-tauri/src/commands/fonts.rs`, resolve Windows font path as `exe_dir()/fonts/` where `exe_dir()` is `std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf()))`.
- Validation: Build the Windows app (`bun run build` with Tauri); verify `fonts/` directory alongside the `.exe` contains all 10 `.ttf` files.
- Notes: On Windows, `bundle.resources` paths are relative to the executable directory at runtime.

### Task 4: Add font files to macOS DMG

- Status: TO BE DONE
- Objective: Font files are included in the macOS app bundle under `Contents/Resources/fonts/`.
- Steps:
  1. Open `src-tauri/tauri.conf.json`.
  2. Add `"resources": ["../fonts/*.ttf"]` under `bundle` (same as Windows — Tauri places resources in `Contents/Resources/` on macOS).
  3. In `src-tauri/src/commands/fonts.rs`, resolve macOS font path as `bundle_dir()/Contents/Resources/fonts/` where `bundle_dir()` is `std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.parent().unwrap().to_path_buf()))` (exe is at `Mini Diarium.app/Contents/MacOS/mini-diarium`, so parent().parent() gives the bundle root).
- Validation: Build the macOS app; verify `Mini Diarium.app/Contents/Resources/fonts/` contains all 10 `.ttf` files.
- Notes: The `bundle_dir()` calculation must handle the macOS app bundle structure correctly — the binary lives two levels below the bundle root.

### Task 5: Create `src-tauri/src/commands/fonts.rs`

- Status: TO BE DONE
- Objective: A Tauri command `list_bundled_fonts` that enumerates font filenames from the bundled fonts directory and returns a sorted list of human-readable font family names.
- Steps:
  1. Create `src-tauri/src/commands/fonts.rs` with a `#[tauri::command] list_bundled_fonts() -> Result<Vec<String>, String>` function.
  2. Read font files from a platform-appropriate path using `std::env::current_exe()` and traversing to the `fonts/` directory:
     - Flatpak/Linux: `"/app/share/fonts/"` (hardcoded at build time via `cfg` attributes, no exe traversal needed)
     - Windows: `{exe_dir}/fonts/`
     - macOS: `{bundle_root}/Contents/Resources/fonts/` where bundle root is `current_exe`'s grandparent
  3. Filter for `.ttf` and `.otf` files; strip variant suffixes (`-Regular`, `-Bold`, `-Italic`, `-Light`, etc.) to derive the family name; replace hyphens with spaces (`"JetBrainsMono-Regular"` → `"JetBrains Mono"`).
  4. Sort and deduplicate the family name list.
  5. Register the module: add `pub mod fonts;` to `src-tauri/src/commands/mod.rs`.
  6. Add `commands::fonts::list_bundled_fonts` to the `generate_handler![]` macro in `src-tauri/src/lib.rs`.
- Validation: `cd src-tauri && cargo test` passes; manually verify the binary on each platform returns the expected 5 family names.
- Notes: Function must return `Result<Vec<String>, String>` for error handling consistency. No `State<DiaryState>` needed — this command doesn't access the journal. Use `cfg(target_os = "linux")`, `cfg(target_os = "windows")`, `cfg(target_os = "macos")` for platform-specific paths.

### Task 6: Add TypeScript wrapper in `src/lib/tauri.ts`

- Status: TO BE DONE
- Objective: `listBundledFonts(): Promise<string[]>` callable from the frontend.
- Steps:
  1. Open `src/lib/tauri.ts`.
  2. Add `listBundledFonts` invoke wrapper matching the Rust command signature.
- Validation: `bun run type-check` passes with no new type errors.
- Notes: Use the existing `invoke<T>` pattern from this file.

### Task 7: Add `editorFontFamily` to `Preferences` interface

- Status: TO BE DONE
- Objective: The font preference is persisted in `localStorage` alongside other preferences.
- Steps:
  1. Open `src/state/preferences.ts`.
  2. Add `editorFontFamily: string | null` to the `Preferences` interface (default `null` means system default / inherit).
  3. Add to `DEFAULT_PREFERENCES` with value `null`.
- Validation: `bun run type-check` passes.
- Notes: `null` represents "no preference set" which maps to the current CSS default.

### Task 8: Inject `--editor-font-family` CSS variable in `DiaryEditor.tsx`

- Status: TO BE DONE
- Objective: The TipTap editor container receives the font family as a CSS variable, and `editor.css` consumes it for `font-family`.
- Steps:
  1. Open `src/components/editor/DiaryEditor.tsx`.
  2. Add `style={{ '--editor-font-family': preferences().editorFontFamily ?? 'inherit' }}` to the existing `style` attribute on the editor container div (line 381, alongside the existing `--editor-font-size`).
  3. Open `src/styles/editor.css` line 11–14. Add `font-family: var(--editor-font-family, inherit);` to the `.ProseMirror.journal-editor-content` rule.
- Validation: `bun run type-check` passes; no new ESLint errors; verify in dev tools that the editor element has `font-family` resolving to the selected font name (or `inherit` when unset).

### Task 9: Add font family selector to `PreferencesWritingTab.tsx`

- Status: TO BE DONE
- Objective: Users can choose an editor font from a dropdown populated by `listBundledFonts()`.
- Steps:
  1. In `PreferencesWritingTab.tsx`, add a `createResource` that calls `listBundledFonts()` on mount to fetch font list.
  2. Add a local signal `localEditorFontFamily` and sync it in `createEffect` (matching the pattern used for `localEditorFontSize`).
  3. Add a `<select>` element for font family in the Writing tab, below the font size slider.
  4. Include an `<option value="">System Default</option>` as the null option.
  5. Register a commit callback that calls `setPreferences({ editorFontFamily: ... })`.
  6. Add data-testid `editor-font-family-select` to the select element for E2E coverage.
- Validation: `bun run type-check` passes; `bun run lint` passes.
- Notes: Font list is fetched asynchronously; show a disabled loading state while fonts load.

### Task 10: Add i18n keys for font family preference

- Status: TO BE DONE
- Objective: The font family dropdown label and system-default option are translatable.
- Steps:
  1. Open `src/i18n/locales/en.ts`.
  2. Add keys `prefs.writing.fontFamilyLabel` and `prefs.writing.fontFamilySystemDefault` (or similar) under the `writing` namespace.
  3. Update `PreferencesWritingTab.tsx` to use `t('prefs.writing.fontFamilyLabel')` for the label and the system-default option text.
- Validation: `bun run validate:locales` passes.
- Notes: Follow the existing key naming pattern from the writing tab.

### Task 11: Cleanup intermediate artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for any temporary test files, scratch scripts, or debug logs created during implementation.
  2. Remove only artifacts that are not part of the intended final repository state.
- Validation: Worktree diff contains only intended final changes.
- Notes: None.

## Final Verification

Run the full test suite:
```bash
cmd.exe /c bun run type-check
cmd.exe /c bun run lint
cmd.exe /c bun run test:run
cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"
```

Open the app in dev mode, navigate to Preferences → Writing tab, verify:
1. Font family dropdown appears with the list of bundled fonts.
2. Selecting a font and saving, then re-opening preferences, shows the selected font.
3. The editor uses the selected font.

## Plan Self-Check

- [x] Plan location follows the default location rule (`docs/`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] No unresolved open questions.
- [x] Every task has concrete steps and validation.
- [x] Cleanup and final verification are included.
- [x] The plan avoids vague actions without concrete targets.
- [x] The plan can be executed by a coding agent without reading the original conversation.

## Approval Gate

Implementation must not start until the user approves this plan.