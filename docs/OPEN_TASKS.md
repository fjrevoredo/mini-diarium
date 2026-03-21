# Open Tasks: Post-v0.1.0 Enhancements

This document tracks features and improvements deferred from the v0.1.0 release.

**Status**: 14 open tasks across 3 categories
- **Infrastructure**: 1 task (release workflow modernization)
- **Features**: 9 tasks (PDF export, i18n framework, i18n translations, menus, auto-update, legacy migration, extension system, text input extension point, theme hardening)
- **Quality**: 4 tasks (accessibility audit, dark-theme form-control contrast, QA pass, backup behavior documentation)

See [docs/TODO.md](TODO.md) for the active working backlog and `CHANGELOG.md` for completed shipped work.

---

## 🔧 Infrastructure & CI/CD


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

## 🖥️ Platform Features (v0.4.0)

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

### Task 71: Backend Assessment Follow-up ✅ Completed (2026-03-21)
**Priority**: Medium | **Complexity**: Low | **Reference**: `docs/BACKEND_ASSESSMENT_2026-03.md`

Address the actionable findings from the March 2026 backend architectural assessment. The assessment found no security vulnerabilities and no architectural drift — this task covers the two code quality fixes and the nine test/documentation gaps identified.

**Priority 1 — Quick Fixes (≤30 min total)**

- **A1** — `src-tauri/src/commands/entries.rs:124`: change `ok_or("Diary not unlocked")` to `ok_or("Journal must be unlocked to delete entries")`. This is the only unlock guard in the codebase still using the old "Diary" terminology; all others already say "Journal must be unlocked to …".
- **A2** — `src-tauri/src/import/jrnl.rs:10,20,22,24`: move the existing "why" comments from the field line onto the `#[allow(dead_code)]` attribute line (e.g. `#[allow(dead_code)] // jrnl JSON schema field; required for Serde deserialization but Mini Diarium does not import tags`). Brings the file into compliance with the project's lint-suppression comment style (MEMORY.md).

**Priority 2 — Test Coverage (all achievable without Tauri infrastructure)**

- **A3** — Add tests for `delete_entry` command logic in `commands/entries.rs`: (1) delete existing entry → `Ok(())`; (2) delete non-existent ID → `Err("Entry not found")`.
- **A4** — Add `navigate_to_today` test in `commands/navigation.rs`: assert the return value is a valid `YYYY-MM-DD` string that parses as `NaiveDate`.
- **A5** — Add `update_slot_last_used` test in `db/queries.rs`: create a DB, get the password slot id, call `update_slot_last_used`, assert the `last_used` column is no longer null.
- **A6** — Add plugin "not found" error path tests in `commands/plugin.rs`: pass an unknown `plugin_id` to `find_importer`/`find_exporter`, assert the error message format matches `"Import plugin 'x' not found"`.
- **A7** — Add `MAX_IMPORT_FILE_SIZE` boundary tests in `commands/import.rs`: temp file at exactly the limit → success; at limit + 1 byte → `Err` containing "too large".
- **A8** — Add v3→v4 and v4→v5 migration isolation tests in `db/schema.rs`: construct a v3-schema database, run `migrate_v3_to_v4`, assert `entries_fts` is gone and schema version is 4; construct a v4-schema database with entries, run `migrate_v4_to_v5`, assert all rows are preserved in order and schema version is 5.
- **A9** — Add a comment inside `migrate_v3_to_v4` and `migrate_v4_to_v5` in `db/schema.rs` explaining why no pre-migration backup is created (idempotent DDL-only / transactional, low-risk). Mirrors the v2→v3 migration which already has this reasoning documented.

**Deferred items (do not implement in this task, note them in the KNOWN_ISSUES files)**

- **A10** — State lock boilerplate repetition: accepted as-is (`MutexGuard` lifetime constraints make extraction non-trivial; pattern is idiomatic Rust).
- **A11** — `menu.rs` and `screen_lock.rs` unit tests: not unit-testable without live OS handles (`AppHandle<Wry>`, HWND, NSWorkspace). E2E suite covers functionally. Revisit if Tauri adds a test-mode `AppHandle`.
- **A12** — `lib.rs` bootstrap logic tests (`has_legacy_app_state`, `resolve_app_data_dir`): extractable and worth testing, but lower priority than A1–A9. Add as a follow-up to this task.

**Testing**: `cd src-tauri && cargo test` must pass (currently 239 tests; A3–A9 will add approximately 12–18 tests).

---

## 📊 Progress Summary

| Category | Open | Completed |
|----------|------|-----------|
| **Infrastructure** | 1 | 5 |
| **Features** | 9 | 42 |
| **Quality** | 4 | 7 |
| **Testing** | 0 | 4 |
| **Total** | **14** | **58** |

**Next milestone candidates**:
- **v0.1.1**: Task 61 (release workflow modernization)
- **v0.2.0**: Task 52 (accessibility audit)
- **v0.3.0**: Tasks 47–48, 65 (i18n + backup documentation)
- **v0.4.x**: Tasks 49, 51, 53, 66, 68 (menus, auto-update, legacy migration, extension architecture, dark theme form-control contrast)
- **Future**: Tasks 67, 69, 70 (text input extension point, theme overrides, theme hardening)
- **v1.0.0**: Task 58 (comprehensive QA pass)
