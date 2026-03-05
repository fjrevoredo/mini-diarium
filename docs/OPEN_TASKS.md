# Open Tasks: Post-v0.1.0 Enhancements

This document tracks features and improvements deferred from the v0.1.0 release.

**Status**: 12 open tasks across 3 categories
- **Infrastructure**: 1 task (release workflow modernization)
- **Features**: 8 tasks (PDF export, i18n framework, i18n translations, menus, auto-update, legacy migration, extension system, text input extension point)
- **Quality**: 3 tasks (accessibility audit, QA pass, backup behavior documentation)

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

### Task 62: CI Diagram Diff Verification ✅ Completed (2026-02-21)
**Priority**: Medium | **Complexity**: Low | **Files**: `.github/workflows/ci.yml`, `docs/diagrams/*`

**Outcome**: CI now regenerates all diagram SVGs, diffs each against the committed file, and fails with a clear remediation message (`bun run diagrams`) when any output is stale. Temporary check files are cleaned up via shell trap.

---

## 🎯 High Priority (v0.2.0 Candidates)

### Task 46: Diary Directory Selection ✅ Completed (2026-02-21)
**Priority**: High | **Complexity**: Medium

**Outcome**: Shipped in v0.3.0. Users can change the journal location from Preferences → Data → Change Location. The file is moved atomically; the journal is auto-locked during the move. Implementation in `src-tauri/src/commands/auth/auth_directory.rs` (5 tests). Syncs to `config.json`.

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

### Task 63: Keyboard Shortcuts Audit & Recovery ✅ Completed (2026-02-25)
**Priority**: High | **Complexity**: Medium

**Outcome**: Shipped in v0.4.0. Bracket-key accelerators (`CmdOrCtrl+[`/`]`, `CmdOrCtrl+Shift+[`/`]`) replaced conflicting arrow-key combos. Duplicate frontend listener removed. All shortcut definitions consolidated in `menu.rs` as OS-level accelerators. Lock-state enforcement (Navigation/Diary items disable while locked) shipped in v0.3.0.

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
| **Features** | 8 | 41 |
| **Quality** | 3 | 6 |
| **Testing** | 0 | 4 |
| **Total** | **12** | **56** |

**Next milestone candidates**:
- **v0.1.1**: Task 61 (release workflow modernization)
- **v0.2.0**: Task 52 (accessibility audit)
- **v0.3.0**: Tasks 47–48, 65 (i18n + backup documentation)
- **v0.4.x**: Tasks 49, 51, 53, 66 (menus, auto-update, legacy migration, extension architecture)
- **Future**: Task 67 (text input extension point)
- **v1.0.0**: Task 58 (comprehensive QA pass)
