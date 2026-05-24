# TODO Extra Detail

Implementation detail and structured notes for specific TODO items in [`TODO.md`](TODO.md). Each section uses a `TODO-XXXX-YY` ID linking back to its parent TODO entry (e.g. `TODO-0011-01` belongs to `TODO-0011`). Items without a parent TODO are not retained in this file.

---

## TODO-0038-01: Legacy `require_all_auth` Config Removal

Parent: [`TODO-0038: Remove legacy require_all_auth config migration`](TODO.md)

**Approval gate**: requires maintainer sign-off on the release boundary before any code is deleted. Do not execute this task speculatively.

**Background**: the `require_all_auth` setting was migrated from `config.json` (`JournalConfig.require_all_auth`) to `db_settings` in schema v6 (2026-05-settings-storage-taxonomy decision). The live DB-settings-backed path already works. The legacy config field and its migration function (`migrate_require_all_auth_to_db`) are kept until the release boundary is confirmed so users upgrading from older versions are not stranded.

**Steps**:

1. Get maintainer approval for the exact release boundary (which version this ships in) and the CHANGELOG wording.
2. **Red**: add a regression test that loads a legacy `config.json` containing `require_all_auth: true`, performs an unlock, and asserts the value was migrated to `db_settings` — confirm this test passes *before* any deletion.
3. Remove `JournalConfig.require_all_auth` and `JournalInfo.require_all_auth` from the Rust structs.
4. Remove `set_journal_require_all_auth` and its call sites.
5. Remove `migrate_require_all_auth_to_db` and its call sites (check all open paths in `schema/open.rs`).
6. Remove the corresponding frontend type field from `src/lib/tauri.ts` and any reference in `JournalPicker.test.tsx`.
7. Remove the temporary regression test from step 2 only if it is no longer meaningful after deletion; keep any replacement test that validates the DB-backed policy.
8. Update CHANGELOG with the cleanup note.

**Validation**:
```
cargo test auth
bun run test:run
bun run type-check
```

---

## TODO-0011-01: Deferred — Per-post OG Images (P4-F)

Parent: [`TODO-0011: Website SEO/GEO follow-up backlog`](TODO.md)

**Reference**: [`docs/seo-geo-implementation-plan.md`](../seo-geo-implementation-plan.md) — Task 4.4

Unique per-post OG images would require a design step and an image generation pipeline not present in the current static site. Out of scope for the current static website architecture.

---

## TODO-0012-01: PDF Export

Parent: [`TODO-0012: PDF export`](TODO.md)

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

## TODO-0013-01: Text Input Extension Point

Parent: [`TODO-0013: Text input extension point`](TODO.md)

**Priority**: Medium | **Complexity**: High | **Files**: TBD (see `docs/text-input-extension-design.md`)

Allow users to augment text entry with pluggable text-generation sources: LLM endpoints (Ollama, OpenAI-compatible APIs), dictation (Web Speech API), and custom Rhai scripts.

**Design**: Fully documented in [`docs/text-input-extension-design.md`](../text-input-extension-design.md). Two-tier architecture: Tier 1 (Rhai scripts via existing plugin system, `@type: text-input`), Tier 2 (frontend JS built-ins for LLM endpoint + dictation).

**Deferred because**: Too large for current release; design work preserved for future implementation.

**Privacy constraints**: All network calls are opt-in and user-configured; no implicit telemetry; LLM endpoint URL/key stored only in `localStorage` preferences.

**Key requirements**:
- Rhai tier: `fn generate(prompt)` / `fn generate(prompt, context)` → string; opt-in `@permissions: read-context`
- Built-in LLM tier: OpenAI-compatible HTTP POST to user-specified URL; supports Ollama and cloud APIs
- Built-in dictation tier: Web Speech API (no network)
- UI: Toolbar button in EditorToolbar → TextInputOverlay; Preferences section for LLM config
- 2 new Tauri commands: `list_text_input_plugins`, `run_text_input_plugin`

**Testing**: Rhai unit tests; frontend overlay tests; LLM tier mock tests; dictation manual-only
