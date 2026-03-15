# Open Tasks: Post-v0.1.0 Enhancements

This document tracks features and improvements deferred from the v0.1.0 release.

**Status**: 14 open tasks across 3 categories
- **Infrastructure**: 1 task (release workflow modernization)
- **Features**: 9 tasks (PDF export, i18n framework, i18n translations, menus, auto-update, legacy migration, extension system, text input extension point, theme hardening)
- **Quality**: 4 tasks (accessibility audit, dark-theme form-control contrast, QA pass, backup behavior documentation)

See [docs/TODO.md](TODO.md) for the active working backlog and `CHANGELOG.md` for completed shipped work.

---

## 🔧 Infrastructure & CI/CD

### Task 61: Modernize Release Workflow
**Priority**: Medium | **Complexity**: Low | **File**: `.github/workflows/release.yml`

Improve release pipeline reliability and remove deprecated dependencies.

**Current Issues**:
- Using deprecated `actions/create-release@v1` (deprecated since 2021)
- Two-step release process (create-release job + build-release jobs)
- Silent failures in artifact finding (`find` commands)
- No artifact verification before upload

**Proposed Solution**:
1. **Remove deprecated action**: Eliminate `create-release` job entirely
2. **Simplify workflow**: Let `softprops/action-gh-release@v1` create the release automatically
3. **Add artifact verification**: Check files exist before upload:
   ```bash
   # After preparing artifacts
   ls -lh release-artifacts/
   if [ $(ls release-artifacts/ | wc -l) -eq 0 ]; then
     echo "❌ No artifacts found!"
     exit 1
   fi
   ```
4. **Explicit file paths**: Replace `find` with direct paths or add existence checks

**Benefits**:
- Single-job workflow (simpler to maintain)
- Modern, supported actions only
- Fail fast if artifacts are missing
- Clearer error messages

**Testing**: Test with a patch release (v0.1.1 or similar)

---

### Task 52: Accessibility Audit & Improvements
**Priority**: High | **Complexity**: Medium | **Files**: All components

Ensure the app is usable by everyone.

**Requirements**:
- ARIA labels on all interactive elements
- Focus management (trap in overlays, return on close)
- Keyboard navigation (calendar arrow keys)
- Semantic HTML (headings, landmarks, labels)
- Screen reader testing (NVDA, VoiceOver)
- Color contrast: 4.5:1 minimum
- Visible focus indicators

**Testing**: Automated with axe-core, manual screen reader testing

---

## 🌍 Internationalization (v0.3.0)

### Task 47: i18n Framework Setup
**Priority**: Medium | **Complexity**: High | **Files**: `src-tauri/src/i18n/`, `src/i18n/`, `src/lib/i18n.ts`

Multi-language support starting with English/Spanish.

**Backend** (`src-tauri/src/i18n/mod.rs`):
- Detect OS language via Tauri locale API
- Menu translations (145+ keys)
- Fallback to English for unsupported locales

**Frontend**:
- Translation files: `src/i18n/{en.json,es.json}`
- i18n library: `src/lib/i18n.ts`
- Named substitution: `t('import-from', { format: 'JSON' })`

**Testing**: Manual testing in both languages

---

### Task 48: Translate All UI Text
**Priority**: Medium | **Complexity**: Medium | **Files**: All components

Replace hardcoded strings with translation keys.

**Scope**:
- ~145+ translation keys across all components
- Backend menu translations
- Complete Spanish translations
- Maintain formatting/structure in translations

**Dependencies**: Task 47 (i18n framework) must be complete first

---

## 📦 Export Enhancement

### Task 42: PDF Export
**Priority**: Low | **Complexity**: High | **File**: `src-tauri/src/export/pdf.rs`

Export journal entries as PDF (A4 page size).

**Requirements**:
- Convert: HTML → PDF (entries are stored as HTML via TipTap)
- Library options: chromiumoxide or Tauri webview printing
- Command: `export_pdf()` in `src-tauri/src/commands/export.rs`
- UI: Add to ExportOverlay dropdown
- Menu: Include in Export menu

**Dependencies**: JSON/Markdown export (Tasks 40-41) ✅ Complete

**Testing**: Manual only (PDF generation hard to test automatically)

**Rationale for deferral**: Complex implementation, low user priority for v0.1.0

---


### Task 67: Text Input Extension Point
**Priority**: Medium | **Complexity**: High | **Files**: TBD (see `docs/text-input-extension-design.md`)

Allow users to augment text entry with pluggable text-generation sources: LLM endpoints (Ollama, OpenAI-compatible APIs), dictation (Web Speech API), and custom Rhai scripts.

**Design**: Fully documented in [`docs/text-input-extension-design.md`](text-input-extension-design.md). Two-tier architecture: Tier 1 (Rhai scripts via existing plugin system, `@type: text-input`), Tier 2 (frontend JS built-ins for LLM endpoint + dictation).

**Deferred because**: Too large for current release; design work preserved for future implementation.

**Privacy constraints**: All network calls are opt-in and user-configured; no implicit telemetry; LLM endpoint URL/key stored only in `localStorage` preferences.

**Key requirements**:
- Rhai tier: `fn generate(prompt)` / `fn generate(prompt, context)` → string; opt-in `@permissions: read-context`
- Built-in LLM tier: OpenAI-compatible HTTP POST to user-specified URL; supports Ollama and cloud APIs
- Built-in dictation tier: Web Speech API (no network)
- UI: Toolbar button in EditorToolbar → TextInputOverlay; Preferences section for LLM config
- 2 new Tauri commands: `list_text_input_plugins`, `run_text_input_plugin`

**Testing**: Rhai unit tests; frontend overlay tests; LLM tier mock tests; dictation manual-only

---

### Task 66: Extension System Architecture
**Priority**: Low | **Complexity**: High | **Files**: Architecture docs + new extension host modules (TBD)

Design an extension/plugin API for third-party integrations (importers, exporters, themes, utilities).

**Requirements**:
- Define extension lifecycle (discover, load, validate, disable, uninstall)
- Define permissions/sandbox model consistent with privacy-first constraints (no implicit network)
- Define stable extension API surface (commands/events/data contracts)
- Decide packaging and versioning strategy
- Define trust and signing model (or explicitly document unsigned-only local extensions)

**Out of scope (initial spike)**:
- Shipping a public extension marketplace
- Remote extension download inside the app

**Deliverables**:
- Technical design doc with threat model
- Minimal proof-of-concept extension host
- At least one sample extension (e.g. additional export target)

---

### Task 69: Advanced Local Theme Overrides ✓ (2026-03-14)
**Priority**: Low | **Complexity**: Medium | **Files**: `src/index.css`, `src/lib/theme.ts`, `src/components/overlays/PreferencesOverlay.tsx`, `docs/DESIGN_SYSTEM.md`

Explore the request from [GitHub issue #53](https://github.com/fjrevoredo/mini-diarium/issues/53): let advanced users customize the built-in light and dark themes beyond the current `auto` / `light` / `dark` selector.

**Philosophy assessment**:
- **Aligned**: this is a local presentation-layer feature only; it does not touch encryption, network behavior, storage format, or diary content
- **Tension with the philosophy**: a raw "paste arbitrary CSS into Preferences" feature expands the supported surface, increases UI breakage risk, and cuts against "small, extensible core" and "simple is good"
- **Conclusion**: the acceptable path is bounded local theme overrides, not a fully supported in-app app-wide CSS injection surface

**Current state**:
- Theme preference is app-level and stored in `localStorage` via `src/lib/theme.ts`
- The supported built-in themes are `auto`, `light`, and `dark`
- App theme colors are already centralized as CSS custom properties in `src/index.css`
- `docs/DESIGN_SYSTEM.md` already treats CSS variables as the theme contract for app UI
- The theme abstraction is incomplete in practice: several app surfaces still use raw Tailwind palette classes and `src/styles/editor.css` still contains direct color literals
- `src/styles/critical-auth.css` is intentionally light-only during cold launch and should not be assumed themeable by any first pass

**Recommended scope**:
- Allow advanced users to override documented theme tokens for light and dark mode locally
- Keep overrides fully offline and local to the machine; no sync, sharing, gallery, or remote fetch behavior
- Treat the supported surface as the token contract (`--bg-*`, `--text-*`, `--border-*`, `--interactive-*`, status colors, and any explicitly added future tokens), not arbitrary selectors across the full DOM
- Keep the website out of scope; this only applies to the desktop app theme system

**Options considered**:
1. **Documented token overrides in a local file** — preferred; smallest support surface, aligns with existing CSS-variable architecture, easy to disable/reset
2. **Structured advanced theme editor for known tokens** — acceptable later if the token list stabilizes; more user-friendly but more UI/validation work
3. **Free-form CSS textarea in Preferences** — not preferred for a first implementation; too easy to break layout, accessibility, overlays, or editor behavior and too broad to support responsibly

**Requirements**:
- Users must be able to customize built-in light and dark palettes without weakening the app's offline-only/privacy-first model
- The default themes must remain the documented and fully supported experience
- Invalid or missing overrides must fail safely and fall back to the built-in theme without blocking app startup
- `auto` theme resolution must continue to work correctly with overrides applied on top of the resolved light/dark theme
- The initial supported override contract must be limited to documented theme tokens; arbitrary selector overrides should be explicitly unsupported unless a later extension architecture formalizes them
- Auth screens and critical pre-hydration CSS may remain on the built-in styling path in an initial version if that materially reduces complexity
- Users must have a clear reset/disable path if a custom override harms readability
- No remote CSS, web fonts, external assets, or any network-backed theme mechanism

**Dependencies**:
- Task 70: Theme System Hardening for Future Overrides

**Out of scope**:
- Theme marketplace or bundled third-party theme distribution
- Syncing theme customizations across devices
- Theme scripts or any executable customization mechanism
- Support guarantees for layout-changing CSS or arbitrary selector overrides
- Re-theming the static marketing website

**Open design questions**:
- Should overrides live in `localStorage`, in an app-level config file, or as a user-owned CSS file next to other local app data?
- Is the first supported format CSS (`:root` / `.dark` token overrides) or a structured JSON/token map that the app serializes into CSS variables?
- Should the feature ship only as an external file contract first, with the Preferences UI limited to "open theme override location" and "reset" actions?
- Does broader theming belong under Task 66's future extension architecture, with this task intentionally staying limited to token overrides only?

**Testing**:
- Frontend unit tests for override loading/parsing/fallback logic if a new theme loader module is added
- Manual verification for `auto`, `light`, and `dark` with and without overrides
- Manual regression pass for overlays, editor toolbar, form controls, and sidebar/calendar surfaces in both themes
- Accessibility contrast spot-checks for user-facing documentation/examples; do not promise automated validation of arbitrary user colors

**Rationale for deferral**:
- Valuable request, but cosmetic rather than core
- Existing theme token architecture makes it feasible later
- Needs clear boundaries to avoid turning Preferences into a general-purpose CSS sandbox

---

### Task 70: Theme System Hardening for Future Overrides
**Priority**: Low | **Complexity**: Medium | **Files**: `src/index.css`, `src/styles/editor.css`, `src/components/**/*`, `docs/DESIGN_SYSTEM.md`

Prepare the theming layer so future user overrides can target a stable semantic contract instead of today's mixed set of CSS variables, UnoCSS utility colors, and hardcoded editor styles.

**Why this exists**:
- The app already has a solid token foundation in `src/index.css`, but the abstraction is not consistently enforced
- Many components still use raw palette utility classes such as `bg-blue-600`, `hover:bg-blue-700`, `focus:ring-blue-500`, `bg-red-600`, and `text-white`
- `src/styles/editor.css` still hardcodes multiple colors instead of consuming semantic tokens
- Shipping theme overrides before this cleanup would either create a weak/incomplete customization feature or freeze current styling details as accidental API

**Requirements**:
- Define the supported app-theme contract explicitly in `docs/DESIGN_SYSTEM.md`
- Replace remaining raw palette classes in app UI where they represent semantic roles that should be themeable
- Add any missing semantic tokens needed for common roles such as primary action, destructive action, selected state, focus state, editor code blocks, and inline editor accents
- Refactor `src/styles/editor.css` to consume theme tokens wherever the styles are part of the app theme rather than intentional content styling
- Audit loading/auth/pre-hydration surfaces and explicitly document which ones are inside or outside the first supported theming boundary
- Ensure future theme work can evolve by treating semantic tokens as stable and component DOM/class structure as internal implementation detail

**Non-goals**:
- Building the end-user override feature itself
- Guaranteeing that every current class name or DOM selector remains stable forever
- Making the static website share the app's theme contract

**Deliverables**:
- Reduced use of raw palette utility classes across app components
- Expanded semantic token set in `src/index.css` where the current set is insufficient
- Updated theming guidance in `docs/DESIGN_SYSTEM.md` that distinguishes stable tokens from internal styling details
- A clear statement of what Task 69 may support safely once this cleanup is done

**Testing**:
- Frontend regression pass for light, dark, and auto theme behavior
- Manual verification of overlays, calendar selection states, auth flows, toolbar actions, destructive buttons, and editor content chrome
- Targeted component test updates where class-level assertions need to move from raw colors to semantic theme behavior

**Rationale**:
- This keeps Task 69 from becoming a compatibility trap
- It preserves freedom to improve the UI later without breaking a user-facing arbitrary-CSS contract

---

## 🖥️ Platform Features (v0.4.0)

### Task 49: Platform-Specific Menus
**Priority**: Medium | **Complexity**: Medium | **File**: `src-tauri/src/menu.rs`

Native menu behavior for each platform.

**macOS**:
- App menu (About, Preferences, Quit)
- Standard macOS menu structure

**Windows/Linux**:
- File menu (Preferences, Exit)
- No App menu

**All Platforms**:
- File, Edit, View, Help menus
- Disable menu items when journal locked
- Register keyboard accelerators

**Current state**: Generic menu implemented; needs platform-specific customization

---

### Task 50: Auto-Lock on Screen Lock ✅ Completed (2026-03-01)
**Priority**: Medium | **Complexity**: Low

**Outcome**: Windows (session lock/logoff/suspend) shipped v0.3.0; macOS (display sleep, system sleep, `Cmd+Ctrl+Q` screen lock via `NSWorkspaceScreensDidSleepNotification` + `com.apple.screenIsLocked`) shipped v0.4.3. Both platforms emit `diary-locked` event so the frontend immediately transitions to the lock screen.

---

### Task 51: Auto-Update System
**Priority**: Medium | **Complexity**: Medium | **Files**: Tauri updater plugin

In-app update notifications and installation.

**Requirements**:
- Plugin: @tauri-apps/plugin-updater
- On launch: Check for updates via `checkUpdate()`
- Download and install with user notification
- Skip: Mac App Store builds (handled by App Store)
- Handle network errors gracefully

**Testing**: Manual with test update server

---

### Task 53: Mini Diary Legacy Migration
**Priority**: Low | **Complexity**: High | **File**: `src-tauri/src/import/minidiary_legacy.rs`

Import from encrypted Mini Diary v1.x files.

**Requirements**:
- Decrypt: PBKDF2-SHA512 + AES-192-CBC (deprecated crypto)
- Apply v2.0.0 Markdown migration if needed
- Command: `import_minidiary_legacy(file_path, password) -> Result<usize>`
- UI: Add to ImportOverlay format dropdown
- Merge entries into database

**Testing**: Rust unit tests with Mini Diary encrypted fixture

**Note**: Current implementation only supports unencrypted Mini Diary JSON exports

---

## 🚪 Onboarding & Documentation

### Task 64: First-Launch "Open Existing Diary" Flow ✅ Completed (2026-02-28)
**Priority**: Medium | **Complexity**: Medium

**Outcome**: Shipped in v0.4.2 via the Journal Picker. The pre-auth picker lets users open an existing `diary.db` from any folder directly (no copy, no workarounds), alongside creating a new journal. Both flows that were previously fragmented are now unified in `src/components/auth/JournalPicker.tsx`.

---

### Task 65: Backup Behavior Documentation for Custom Diary Locations
**Priority**: Medium | **Complexity**: Low | **Files**: `README.md`, `docs/`

Document how automatic backups behave with custom journal locations and current database/auth architecture.

**What to explain**:
- Backup trigger timing (on unlock) and retention policy (rotation)
- Backup storage path with default vs custom journal directories
- Relationship to auth slots/master-key wrapping (schema v3) and encrypted entries
- Expected behavior when moving journal location
- Restore expectations and caveats

**Deliverables**:
- User-facing explanation section in README/docs
- Short troubleshooting checklist (e.g., "where are my backups?")
- Confirm wording matches actual implementation in `src-tauri/src/backup.rs` and `src-tauri/src/commands/auth/`

**Testing**:
- Doc accuracy check by walking through actual code paths and manual verification

---

## 🧪 Testing & Quality Assurance

### Task 58: Final QA Pass
**Priority**: High | **Complexity**: Low | **Platform**: All (macOS, Windows, Linux)

Comprehensive manual testing before each release.

**Test workflows**:
1. First-time setup (create password, create entry)
2. Daily writing (navigate, edit, auto-save)
3. Multiple entries per day (create, navigate with `←`/`→` bar, delete)
4. Import/export (all supported formats via plugin system)
5. Statistics overlay
6. Preferences (all tabs and settings)
7. Password change; key file auth
8. Theme switching (light/dark/auto)
9. Lock/unlock + auto-lock (idle timeout; macOS/Windows screen lock)
10. Journal switching (multiple journals)

**Success criteria**:
- No P0/P1 bugs
- Installer size < 20 MB

**Testing**: Manual QA checklist on 3 platforms

---

### Task 59: E2E Infrastructure (WebdriverIO + tauri-driver) ✅ Completed (2026-02-21)
**Priority**: Medium | **Complexity**: Medium

**Outcome**: Shipped in v0.3.0 using WebdriverIO + tauri-driver (not Playwright as originally planned). Config at `wdio.conf.ts`; specs at `e2e/specs/`. Clean-room (`E2E_MODE=clean`) and stateful (`E2E_MODE=stateful`) lanes; deterministic 800×660 px viewport; isolated diary and WebView profile. CI runs on Ubuntu via `webkit2gtk-driver`.

---

### Task 60: E2E Tests for Critical Workflows ✅ Completed (2026-02-21)
**Priority**: Medium | **Complexity**: High

**Outcome**: Core workflows implemented in `e2e/specs/diary-workflow.spec.ts`: (1) create diary → write entry → lock → unlock → verify persistence; (2) multi-date calendar navigation → write second entry → lock/unlock → verify both entries persist. Test isolation hardened in v0.4.1.

---

## 📊 Progress Summary

| Category | Open | Completed |
|----------|------|-----------|
| **Infrastructure** | 1 | 5 |
| **Features** | 9 | 42 |
| **Quality** | 4 | 6 |
| **Testing** | 0 | 4 |
| **Total** | **14** | **57** |

**Next milestone candidates**:
- **v0.1.1**: Task 61 (release workflow modernization)
- **v0.2.0**: Task 52 (accessibility audit)
- **v0.3.0**: Tasks 47–48, 65 (i18n + backup documentation)
- **v0.4.x**: Tasks 49, 51, 53, 66, 68 (menus, auto-update, legacy migration, extension architecture, dark theme form-control contrast)
- **Future**: Tasks 67, 69, 70 (text input extension point, theme overrides, theme hardening)
- **v1.0.0**: Task 58 (comprehensive QA pass)
