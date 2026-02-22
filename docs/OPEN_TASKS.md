# Open Tasks: Post-v0.1.0 Enhancements

This document tracks features and improvements deferred from the v0.1.0 release.

**Status**: 17 open tasks across 5 categories
- **Infrastructure**: 1 task (release workflow modernization)
- **Features**: 9 tasks (PDF export, directory selection, i18n, menus, auto-lock, auto-update, legacy migration, extension system, first-launch existing diary picker)
- **Quality**: 4 tasks (accessibility audit, QA pass, keyboard shortcuts audit, backup behavior documentation)
- **Testing**: 3 tasks (E2E setup and tests)

See [Current-implementation-plan.md](Current-implementation-plan.md) for full historical context of the 48 completed tasks.

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

Ensure generated architecture diagrams are actually compared against committed outputs.

**Outcome**:
- Workflow now compares each regenerated `*-check.svg` file against its committed SVG counterpart
- CI fails with actionable output when any diagram is stale or mismatched
- Cleanup of temporary `*-check.svg` files is guaranteed via shell trap

**Requirements**:
- Regenerate all tracked diagrams during CI (`unlock*.svg`, `save-entry*.svg`, `context*.svg`, `architecture*.svg`)
- Diff generated files against committed files and fail on mismatch
- Keep CI output actionable (show which file differs and how to regenerate locally)

**Proposed Solution**:
1. Generate check outputs with deterministic filenames
2. Compare with committed files (`git diff --exit-code` or explicit `diff`)
3. Print a clear remediation message (`bun run diagrams` + commit)

**Testing**:
- Intentionally modify one diagram source and verify CI fails
- Regenerate and verify CI passes

---

## 🎯 High Priority (v0.2.0 Candidates)

### Task 46: Diary Directory Selection
**Priority**: High | **Complexity**: Medium | **File**: `src-tauri/src/commands/auth.rs`

Allow users to change where their diary file is stored.

**Requirements**:
- Command: `change_diary_directory(new_path) -> Result<()>`
- When unlocked: Move file to new directory
- When locked: Update preference only
- Validation: Check no existing file at destination
- UI: Add to PreferencesOverlay (already has display, needs implementation)

**Dependencies**: Backup system (Task 45) ✅ Complete

**Testing**: Integration tests for file move, preference persistence

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

### Task 63: Keyboard Shortcuts Audit & Recovery
**Priority**: High | **Complexity**: Medium | **Files**: `src-tauri/src/menu.rs`, `src/components/layout/MainLayout.tsx`

Audit and restore all expected keyboard shortcuts and menu-triggered navigation actions.

**Requirements**:
- Verify all documented bindings work on Windows/macOS/Linux
- Ensure menu accelerators and frontend handlers stay in sync
- Ensure shortcuts are ignored when typing in inputs/editable regions
- Confirm lock-state behavior (disabled while locked, enabled while unlocked)

**Verification Matrix**:
1. Previous/next day (`CmdOrCtrl+[` / `CmdOrCtrl+]`)
2. Previous/next month (`CmdOrCtrl+Shift+[` / `CmdOrCtrl+Shift+]`)
3. Go to today (`CmdOrCtrl+T`)
4. Go to date (`CmdOrCtrl+G`)
5. Menu-item click emits and frontend handler behavior

**Testing**:
- Add/expand unit tests around shortcut detection and guard conditions
- Manual cross-platform verification in packaged app builds

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

Export diary as PDF (A4 page size).

**Requirements**:
- Convert: Markdown → HTML → PDF
- Library options: chromiumoxide or Tauri webview printing
- Command: `export_pdf()` in `src-tauri/src/commands/export.rs`
- UI: Add to ExportOverlay dropdown
- Menu: Include in Export menu

**Dependencies**: JSON/Markdown export (Tasks 40-41) ✅ Complete

**Testing**: Manual only (PDF generation hard to test automatically)

**Rationale for deferral**: Complex implementation, low user priority for v0.1.0

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
- Disable menu items when diary locked
- Register keyboard accelerators

**Current state**: Generic menu implemented; needs platform-specific customization

---

### Task 50: Auto-Lock on Screen Lock
**Priority**: Medium | **Complexity**: Low | **Files**: Screen lock listener

Automatically lock diary when user locks their screen.

**Current state**:
- Windows implementation is complete (session lock/logoff + suspend)
- Frontend lock-screen sync is implemented via backend lock event emission
- macOS hook is still pending

**Requirements**:
- Listen for OS screen lock event on macOS (Windows already implemented)
- On lock: Call `lock_diary()`, clear DB connection
- Handle: Sleep, screen saver, manual lock

**Testing**: Manual (lock screen, verify diary locked on unlock)

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

### Task 64: First-Launch "Open Existing Diary" Flow
**Priority**: Medium | **Complexity**: Medium | **Files**: `src/components/auth/PasswordCreation.tsx`, `src/state/auth.ts`, `src/lib/tauri.ts`, `src-tauri/src/commands/auth.rs`

When no diary is found, let users choose an existing `diary.db` from another directory instead of only showing "create new diary".

**Use case**:
- Users who sync `diary.db` via Dropbox/OneDrive/iCloud/Network folder
- Fresh install on a second machine where the diary already exists elsewhere

**Requirements**:
- Add a clear "Open Existing Diary..." action to the no-diary screen
- Allow selecting an existing `diary.db` file (or directory containing it)
- Validate selection and set app diary location accordingly (without copying)
- Transition to locked state and show the unlock prompt for that diary
- Keep "Create New Diary" as the default primary path

**Testing**:
- Manual: clean install -> choose external existing DB -> unlock -> entries load
- Reject invalid selections (wrong file name, unreadable path, missing file)

---

### Task 65: Backup Behavior Documentation for Custom Diary Locations
**Priority**: Medium | **Complexity**: Low | **Files**: `README.md`, `docs/`, `CHANGELOG.md` (if behavior changes)

Document how automatic backups behave with custom diary locations and current database/auth architecture.

**What to explain**:
- Backup trigger timing (on unlock) and retention policy (rotation)
- Backup storage path with default vs custom diary directories
- Relationship to auth slots/master-key wrapping (schema v3) and encrypted entries
- Expected behavior when moving diary location
- Restore expectations and caveats

**Deliverables**:
- User-facing explanation section in README/docs
- Short troubleshooting checklist (e.g., "where are my backups?")
- Confirm wording matches actual implementation in `src-tauri/src/backup.rs` and `src-tauri/src/commands/auth.rs`

**Testing**:
- Doc accuracy check by walking through actual code paths and manual verification

---

## 🧪 Testing & Quality Assurance

### Task 58: Final QA Pass
**Priority**: High | **Complexity**: Low | **Platform**: All (macOS, Windows, Linux)

Comprehensive manual testing before each release.

**Test workflows**:
1. First-time setup (create password, create entry)
2. Daily journaling (navigate, edit, auto-save)
3. Search entries (FTS5 search)
4. Import/export (all supported formats)
5. Statistics overlay
6. Preferences (all settings)
7. Password change
8. Theme switching (light/dark/auto)

**Success criteria**:
- No P0/P1 bugs
- Performance targets met (see IMPLEMENTATION_PLAN.md section 5.2)
- Installer size < 20 MB

**Testing**: Manual QA checklist on 3 platforms

---

### Task 59: Set up Playwright for E2E Testing
**Priority**: Medium | **Complexity**: Medium | **Files**: `playwright.config.ts`, `tests/e2e/`

E2E testing infrastructure with Playwright.

**Setup**:
- Install: `bun add -d @playwright/test`
- Config: `playwright.config.ts` for Tauri app
- Fixtures: `tests/e2e/fixtures/` (test data)
- Helpers: `tests/e2e/helpers/` (common operations)

**Verify**: `bun playwright test` runs successfully

---

### Task 60: Write E2E Tests for Critical Workflows
**Priority**: Medium | **Complexity**: High | **Files**: `tests/e2e/*.spec.ts`

Automated end-to-end tests for critical user journeys.

**Test scenarios** (8 total):
1. First-time setup (create password, create entry)
2. Unlock diary, navigate dates, edit entry
3. Search entries across multiple days
4. Import Mini Diary JSON
5. Export to JSON and Markdown
6. Change preferences (theme, calendar, etc.)
7. Lock/unlock diary workflow
8. Theme switching (light/dark/auto)

**Dependencies**: Task 59 (Playwright setup) must be complete first

**Verify**: All tests pass on all platforms (macOS, Windows, Linux)

---

## 📊 Progress Summary

| Category | Open | Completed |
|----------|------|-----------|
| **Infrastructure** | 1 | 5 |
| **Features** | 9 | 38 |
| **Quality** | 4 | 5 |
| **Testing** | 3 | 2 |
| **Total** | **17** | **50** |

**Next milestone candidates**:
- **v0.1.1**: Task 61 (release workflow modernization)
- **v0.2.0**: Tasks 52, 63 (accessibility + keyboard shortcuts)
- **v0.3.0**: Tasks 47-48, 64-65 (i18n + onboarding/docs improvements)
- **v0.4.0**: Tasks 50-51, 53, 66 (platform features + legacy migration + extension architecture)
- **v1.0.0**: Tasks 58-60 (comprehensive QA + E2E tests)
