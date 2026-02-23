# TODO.md Audit - 2026-02-23

## Summary
Audited `docs/TODO.md` against codebase. Found 3 items incorrectly marked `[ ]` that are actually complete, plus several items that needed description updates for accuracy.

## Items Corrected ([ ] → [x])

1. **Extension system** — DONE
   - Plugin system: `src-tauri/src/plugin/mod.rs`, `plugin/registry.rs`, `plugin/rhai_loader.rs`, `plugin/builtins.rs`
   - Commands: `src-tauri/src/commands/plugin.rs`
   - Frontend wired: `ImportOverlay.tsx`, `ExportOverlay.tsx` use `listImportPlugins()`, `runImportPlugin()`
   - Traits: `ImportPlugin`, `ExportPlugin` with `.info()` and `.parse()` / `.export()` methods

2. **Modernize release workflow** — DONE
   - Already uses `softprops/action-gh-release@v2` in `.github/workflows/release.yml`
   - Was incorrectly marked as still using deprecated `actions/create-release@v1`

3. **Split commands/auth.rs into sub-modules** — DONE
   - Directory: `src-tauri/src/commands/auth/` contains:
     - `auth_core.rs` (11KB)
     - `auth_methods.rs` (18KB)
     - `auth_directory.rs` (10KB)
     - `mod.rs` (2.8KB)
   - Completed as of v0.4.0

## Items with Updated Descriptions (accuracy/specificity)

1. **E2E tests for critical workflows** — Clarified that only 1 test currently exists; needs 7 more scenarios
2. **Downgrade import path logging** — Specified line 52 and that ALL import functions log paths at `info!` level
3. **DiaryEntry clone efficiency** — Added context: affects `import/merge.rs` usage
4. **Document keypair hex in JS heap** — Specified files where comment should be added
5. **Accessibility audit** — Quantified existing ARIA (only 5 labels); listed missing areas

## Items Verified as Correctly Pending

- **Multiple journals with login-time switching** — NOT FOUND anywhere in codebase; correctly marked [ ]
- **Auto-lock on screen lock (macOS parity)** — Only Windows in `screen_lock.rs` (#[cfg(target_os = "windows")]); correctly [ ]
- **Auto-update system** — Not in Cargo.toml (no tauri-plugin-updater); correctly [ ]
- **i18n framework** — Not found; correctly [ ]
- **Translate all UI text** — Depends on i18n; correctly [ ]
- **Frontend test coverage** — 6 test files exist but auth screens, Calendar, overlays untested; correctly [ ]
- **First-launch existing diary picker** — Not found; correctly [ ]
- **screen_lock.rs unit tests** — No #[cfg(test)] blocks; correctly [ ]
- **PDF export** — Not in export commands; correctly [ ]
- **Release build profile** — [profile.release] NOT in Cargo.toml; correctly [ ]
- **DiaryEntry clone efficiency** — Still derives Clone without ref optimization; correctly [ ]
- **Document keypair hex in JS heap** — No comments present; correctly [ ]
- **Accessibility audit** — Only 5 ARIA labels found; correctly [ ]
- **Mobile version** — No iOS/Android in tauri.conf.json; correctly [ ]

## Key Findings

- Plugin system is fully functional and wired — ready for production use
- Release workflow modernization complete
- Codebase is accurately reflected by the TODO file (post-corrections)
- Most pending items are genuinely unstarted or incomplete
- Next audit should focus on confirming newly-completed items are marked [x] after implementation
