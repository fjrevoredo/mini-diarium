# Open Tasks: Post-v0.1.0 Enhancements

This document tracks features and improvements deferred from the v0.1.0 release.

**Status**: 13 open tasks across 5 categories
- **Infrastructure**: 1 task (release workflow modernization)
- **Features**: 7 tasks (PDF export, directory selection, i18n, menus, auto-lock, auto-update, legacy migration)
- **Quality**: 2 tasks (accessibility audit, QA pass)
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

**Requirements**:
- Listen for OS screen lock event (macOS, Windows)
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
| **Infrastructure** | 1 | 4 |
| **Features** | 7 | 38 |
| **Quality** | 2 | 5 |
| **Testing** | 3 | 2 |
| **Total** | **13** | **49** |

**Next milestone candidates**:
- **v0.1.1**: Task 61 (modernize release workflow)
- **v0.2.0**: Tasks 46, 52 (accessibility + directory selection)
- **v0.3.0**: Tasks 47-48 (internationalization)
- **v0.4.0**: Tasks 49-51, 53 (platform features + legacy migration)
- **v1.0.0**: Tasks 58-60 (comprehensive QA + E2E tests)
