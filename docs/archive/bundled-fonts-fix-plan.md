# Fix Bundled Fonts Not Working in macOS/Windows Release Builds

## Metadata

- Plan Status: APPROVED
- Created: 2026-05-07
- Last Updated: 2026-05-07
- Owner: Coding agent
- Approval: APPROVED

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Root Cause Analysis

Tauri v2's resource bundler **replaces `..` in relative paths with `_up_`** when using the array notation for `resources` in `tauri.conf.json`. The current configuration:

```json
"resources": ["../fonts/*.ttf"]
```

causes Tauri v2 to place font files at `$RESOURCE/_up_/fonts/` on macOS and Windows:

| Platform | Expected path (`installed_font_dir()`) | Actual path (Tauri v2 bundler) |
|---|---|---|
| macOS | `Contents/Resources/fonts/` | `Contents/Resources/_up_/fonts/` |
| Windows | `{exe_dir}/fonts/` | `{exe_dir}/_up_/fonts/` |
| Linux (Flatpak) | `/app/share/fonts` | Flatpak manifest copies directly — works |

The `installed_font_dir()` function in `src-tauri/src/commands/fonts.rs:67-93` hardcodes paths that do not include the `_up_/` prefix Tauri v2 adds. Since the directory doesn't exist, `list_bundled_fonts()` returns an error, causing the frontend font family selector to show only "System Default".

**Why dev mode works:** The `MINI_DIARIUM_FONTS_DIR` env var points directly to the repo-level `fonts/` directory, bypassing Tauri resource resolution entirely.

**Why Flatpak works:** The Flatpak manifest (`flatpak/io.github.fjrevoredo.mini-diarium.yml:37`) copies fonts directly via `install -Dm644 fonts/*.ttf -t /app/share/fonts/`, which matches the hardcoded Linux path of `/app/share/fonts`.

**Reference:** Tauri v2 resource docs state:
> `..` in a relative path will be replaced by `_up_`, so `jsonfile.json` will be placed to `$RESOURCE/_up_/relative/path/to/jsonfile.json`

## Goal

Make bundled fonts work in macOS and Windows release builds by using Tauri's `PathResolver::resolve()` API (`app.path().resolve()`) for font directory resolution instead of hardcoded platform paths.

## Scope

- Replace hardcoded paths in `installed_font_dir()` with `tauri::AppHandle.path().resolve("../fonts", BaseDirectory::Resource)` for macOS and Windows
- Keep the Flatpak-specific `/app/share/fonts` path check as the first lookup on Linux
- Keep `MINI_DIARIUM_FONTS_DIR` env var fallback for dev mode
- Update `list_bundled_fonts()` and `get_font_data()` command signatures to accept `app_handle: tauri::AppHandle`
- Add backend tests for font helper functions and resource resolution logic

## Non-Goals

- Changing the `tauri.conf.json` resources configuration (the `../fonts/*.ttf` glob is correct; the issue is in the code that resolves the path)
- Modifying the Flatpak manifest (it already works)
- Changing the frontend font loading logic (it already works when fonts are found)
- Adding E2E tests (too heavyweight for this fix; covered by manual release verification)

## Assumptions

- `app.path().resolve("../fonts", BaseDirectory::Resource)` produces the exact path where Tauri's bundler placed the fonts (verified from Tauri v2 docs)
- The Tauri `AppHandle` parameter is always available in font commands because they are registered in `invoke_handler` and Tauri v2 auto-injects it
- `std::env::var("MINI_DIARIUM_FONTS_DIR")` fallback will remain the primary dev-mode path

## Open Questions

None.

## Tasks

### Task 1: Replace `installed_font_dir()` and `font_directory()` with `resolve_font_dir()`

- Status: TO BE DONE
- Objective: Replace both `installed_font_dir()` and `font_directory()` with a single `resolve_font_dir(app_handle: &AppHandle)` function that uses `app_handle.path().resolve()` for platform-agnostic resource resolution.
- Steps:
  1. Add imports: `use tauri::{path::BaseDirectory, AppHandle, Manager};`
  2. Remove the `installed_font_dir()` function (lines 67–93) and `font_directory()` function (lines 34–65)
  3. Create a new `resolve_font_dir(app_handle: &AppHandle) -> Result<PathBuf, String>` with this resolution order:
     a. **[Linux only]** Check `/app/share/fonts` — return if it is a directory (Flatpak path)
     b. Call `app_handle.path().resolve("../fonts", BaseDirectory::Resource)` — return if the resolved path is a directory
     c. Check `MINI_DIARIUM_FONTS_DIR` env var — return if it is a directory (dev mode fallback)
     d. Return the resolved path as last resort (so error messages show the expected path)
  4. Add `log::debug!` output for each resolution step attempted
  5. The `resolve()` call uses `"../fonts"` (matching the glob pattern `"../fonts/*.ttf"` in `tauri.conf.json`) so Tauri's path resolution applies the same `..` → `_up_` translation the bundler uses
- Validation:
  - `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo check"`
  - No `#[cfg(target_os)]` blocks except the Linux Flatpak guard
- Notes:
  - File: `src-tauri/src/commands/fonts.rs`
  - `path().resolve()` returns `Result<PathBuf, tauri::Error>` — map with `.map_err(|e| format!("Cannot resolve fonts directory: {e}"))`
  - The Flatpak check uses `#[cfg(target_os = "linux")]` because `/app/share/fonts` only exists in Flatpak Linux runtime
  - Verified API: `use tauri::{path::BaseDirectory, Manager}` per docs.rs/tauri/2.11.0/tauri/path/struct.PathResolver.html

### Task 2: Update command signatures to accept `AppHandle`

- Status: TO BE DONE
- Objective: Both font commands accept `app_handle: tauri::AppHandle`, call `resolve_font_dir(&app_handle)`, and use the returned path.
- Steps:
  1. Change `list_bundled_fonts()` signature from `pub fn list_bundled_fonts()` to `pub fn list_bundled_fonts(app_handle: tauri::AppHandle)`
  2. Change `get_font_data(family: String)` signature from `pub fn get_font_data(family: String)` to `pub fn get_font_data(family: String, app_handle: tauri::AppHandle)`
  3. In both commands, replace `font_directory()` calls with `resolve_font_dir(&app_handle)`
  4. No changes needed in `src-tauri/src/lib.rs` `generate_handler![]` — Tauri v2 auto-injects `AppHandle` by parameter type (verified: `AppHandle` is already used in other commands like `auth_core.rs:6`)
- Validation:
  - `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo check"`
- Notes:
  - File: `src-tauri/src/commands/fonts.rs`
  - `read_font_file()` and `family_from_stem()`/`stem_from_family()` signatures remain unchanged — they receive the resolved `PathBuf` from `resolve_font_dir()`

### Task 3: Add backend unit tests for font helper functions

- Status: TO BE DONE
- Objective: Backend tests cover `family_from_stem()`, `stem_from_family()`, and `mime_from_bytes()` pure functions.
- Steps:
  1. Add `#[cfg(test)] mod tests { ... }` at the bottom of `fonts.rs`
  2. Test `family_from_stem` with known stems:
     - `"FiraMono-Regular"` → `"Fira Mono"`
     - `"FiraMono-Bold"` → `"Fira Mono"`
     - `"SourceSans3-Regular"` → `"Source Sans 3"`
     - `"JetBrainsMono-BoldItalic"` → `"Jet Brains Mono"` (suffix stripped, hyphens → spaces)
  3. Test `family_from_stem` edge cases:
     - Stem with no known suffix → stripped hyphens only (e.g., `"NoStem"` → `"No Stem"`)
     - Stem ending in `-Roman` → suffix stripped, family `"Roman"` → `"Roman"`
  4. Test `stem_from_family` reverse mapping:
     - `"Fira Mono"` → `"FiraMono"`
     - `"Source Sans 3"` → `"SourceSans3"`
     - `"Jet Brains Mono"` → `"JetBrainsMono"`
  5. Test `mime_from_bytes` with magic bytes:
     - TTF: `[0x00, 0x01, 0x00, 0x00]` → `Some("font/ttf")`
     - OTF: `[0x4F, 0x54, 0x54, 0x4F]` → `Some("font/otf")`
     - WOFF: `[0x77, 0x4F, 0x46, 0x46]` → `Some("font/woff")`
     - WOFF2: `[0x77, 0x4F, 0x46, 0x32]` → `Some("font/woff2")`
     - Unknown bytes: `[0xFF, 0xFF, 0xFF, 0xFF]` → `None`
     - Short input: `[0x00, 0x01]` → `None`
- Validation:
  - `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test fonts"`
- Notes:
  - File: `src-tauri/src/commands/fonts.rs`
  - No filesystem needed — pure function tests
  - There are currently **no** tests in `fonts.rs` — this task establishes baseline coverage

### Task 4: Add integration test for font directory listing logic

- Status: TO BE DONE
- Objective: Integration test verifies that font discovery from a directory works correctly (listing, deduplication, error on missing dir).
- Steps:
  1. Extract the directory-listing logic from `list_bundled_fonts()` (lines 8–29) into a new pure function: `fn list_fonts_in_dir(dir: &Path) -> Result<Vec<String>, String>` that takes a `Path` reference and returns sorted, deduplicated font family names from `.ttf`/`.otf` files in that directory
  2. Refactor `list_bundled_fonts()` to call `resolve_font_dir()` then delegate to `list_fonts_in_dir()`
  3. Add tests in the `#[cfg(test)]` module:
     a. Create a `TempDir`, write a few `.ttf` files (`FiraMono-Regular.ttf`, `FiraMono-Bold.ttf`, `NotoSans-Regular.ttf`) — empty files are fine since we only check file names
     b. Call `list_fonts_in_dir(temp_dir.path())` and verify it returns `["Fira Mono", "Noto Sans"]` (sorted, deduplicated — "Fira Mono" appears only once despite two files)
     c. Test with an empty directory → returns `Ok(vec![])`
     d. Test with a nonexistent directory → returns `Err(...)`
     e. Test that `.txt` and other non-font files are ignored
  4. Run `cargo test fonts` to verify all tests pass
- Validation:
  - `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test fonts"`
- Notes:
  - Uses `tempfile::TempDir` (already in dev-dependencies, `Cargo.toml:59`)
  - No Tauri runtime needed — tests exercise pure filesystem logic
  - The extraction of `list_fonts_in_dir()` is a minor refactor that makes both production and test code cleaner

### Task 5: Run full validation suite

- Status: TO BE DONE
- Objective: Confirm no regressions across the full test, lint, and type-check suite.
- Steps:
  1. Run `cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"` — all backend tests pass
  2. Run `cmd.exe /c bun run test:run` — all frontend tests pass
  3. Run `cmd.exe /c bun run type-check` — TypeScript type-check passes
  4. Run `cmd.exe /c bun run lint` — ESLint passes
  5. Run `cmd.exe /c bun run format:check` — Prettier passes
- Validation: All commands exit successfully.
- Notes: This task gates the entire plan.

### Task 6: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove any artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary files, scratch scripts, or debug output
  2. Remove only artifacts that are not part of the intended final repository state
  3. Keep added tests and any test fixtures
- Validation: `git status` shows only intended file changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

## Final Verification

```bash
# Backend tests (includes new font tests)
cmd.exe /c "cd /d D:\Repos\mini-diarium\src-tauri && cargo test"

# Frontend tests
cmd.exe /c bun run test:run

# Type check
cmd.exe /c bun run type-check

# Lint + format
cmd.exe /c bun run lint
cmd.exe /c bun run format:check
```

## Plan Self-Check

- [X] Plan location follows the default location rule (`docs/bundled-fonts-fix-plan.md`)
- [X] Scope, non-goals, assumptions, and open questions are explicit
- [X] Any unresolved open questions have been surfaced to the user (None)
- [X] Every task has concrete steps and validation
- [X] Cleanup and final verification are included
- [X] The plan avoids vague actions without concrete targets
- [X] The plan can be executed by a coding agent without reading the original conversation

## Approval Gate

Implementation must not start until the user approves this plan.

## Execution Notes

- Update task status to IN PROGRESS before starting each task.
- Update task status to COMPLETED immediately after its validation passes.
- Mark tasks BLOCKED with a short reason when progress cannot continue.
