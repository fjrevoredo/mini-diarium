# TODO

Open tasks and planned improvements. For full context and implementation notes on the original tasks, see [TODO_EXTRA.md](TODO_EXTRA.md).

TODO entry format:

- `- [ ] **TODO-XXXX: Task title** — concise requirement-style description with scope and constraints`
- Every top-level checkbox item must carry a unique `TODO-XXXX` ID (4-digit zero-padded, e.g. `TODO-0001`)
- Indented sub-items are free-form and do **not** carry IDs
- Write items as requirements/acceptance criteria (what must be true), not implementation plans (how to build it)
- Keep implementation details minimal in TODO entries; move deep implementation notes to [TODO_EXTRA.md](TODO_EXTRA.md) when needed
- New IDs are assigned by reading the `Latest TODO ID` marker near the top of this file and incrementing — never reuse IDs
- After creating a new TODO, update the `Latest TODO ID` marker to reflect the new highest ID
- Use the `todo-manager` skill (`.agents/skills/todo-manager/`) for creation, tracking, archival, and validation

**Latest TODO ID: TODO-0046** — next new TODO should be TODO-0047

---

## High Priority

---

- [ ] **TODO-0008: Cursor height too tall after Shift+Enter on macOS (#118)** — the text caret (cursor) height becomes extra long starting on the second line, but only when inserting a soft line break with Shift+Enter (Enter alone works fine); macOS-only (v0.4.20); likely a `line-height` or `font-family` mismatch in ProseMirror's `<br>` handling introduced with new editor fonts in v0.4.20; audit soft-break styling in `src/styles/editor.css` and the `--editor-font-family` / `--editor-font-size` CSS custom properties
- [ ] **TODO-0026: Full-text search across diary entries** — implement a secure, performant full-text search that scans all diary entries for words or phrases without storing plaintext on disk or loading all entries into memory; the old SQLite FTS approach was removed because it exposed plaintext; design a solution that preserves encryption at rest while providing reasonable search performance
- [ ] **TODO-0031: Port todo-manager skill to agent-skills repo** — create a repo-agnostic version of the todo-manager skill in `D:\Repos\agent-skills\todo-manager\SKILL.md`; remove Mini Diarium-specific file paths and conventions; match the structure and patterns of the existing `manual-planning` skill in that repo
---

## Website Priority

- [ ] **TODO-0045: Improve meta descriptions on docs pages** — 11 docs pages flagged by Bing Webmaster Tools (2026-05-31) have meta descriptions that are too short or missing; each page needs a well-crafted meta description of 150–160 characters; edit source files under `website/docs-src/` (never the generated HTML under `website/docs/`) and regenerate with `bun run website:build-static`; affected pages: `/docs/export/`, `/docs/getting-started/`, `/docs/search/`, `/docs/plugins/`, `/docs/writing-entries/`, `/docs/import/`, `/docs/faq/`, `/docs/statistics/`, `/docs/preferences/`, `/docs/backups/`, `/docs/navigating/`

- [ ] **TODO-0011: Website SEO/GEO follow-up backlog** — remaining implementation items from the 2026 website SEO/GEO pass
  - **Fix:** replace `transition: all 0.2s` with explicit property lists that exclude layout properties — e.g. `transition: color 0.2s, background-color 0.2s, border-color 0.2s, opacity 0.2s, transform 0.2s`; edit `website/css/style.css` (the source file) and regenerate/copy the hashed output.
  - [ ] **Resolve Cloudflare-injected robots.txt Content-Signal directive** — Cloudflare automatically appends `Content-Signal: search=yes,ai-train=no` to the live robots.txt at the CDN layer; Lighthouse's robots.txt parser flags this as invalid (not part of RFC 9309), costing 8 SEO points (score 92 → 100); the repo `website/robots.txt` is clean — this is a Cloudflare dashboard setting (REPORT.md FIX 2.1)
    - **Fix:** in the Cloudflare dashboard → Security → Bots → Crawler Hints, disable "Content Signals" injection or switch to the HTTP-header equivalent (`X-Robots-Tag: ai-train=no`) if available. No code change in the repo is needed — AI bot blocking is already handled by explicit `User-agent` blocks in the live robots.txt.

---

## Medium Priority

- [ ] **TODO-0046: Sustainable image storage — deduplicate and reuse images across entries** — currently every image embedded in an entry is stored as an independent blob, so inserting the same image into multiple entries duplicates it; the image model must be reworked to a content-addressed or reference-counted store (e.g. an `images` table keyed by hash, with entries referencing images by ID) so one physical copy is shared across entries; the editor UI must allow picking an already-stored image instead of re-importing it; migration must be non-breaking: images embedded before this feature ships remain intact and readable; all export formats (Markdown, JSON, plugin exporters) must correctly resolve image references at export time; tracked in GitHub issue #150

- [ ] **TODO-0042: Rework font system with app default, per-entry, and inline overrides** — font configuration must follow standard text-editor UX: (1) an app-level default font family and size (already partially exists via `localStorage` preferences); (2) a per-entry override stored with the entry (e.g. in entry metadata or TipTap document attributes); (3) inline font family and size overrides on arbitrary text selections within the editor, matching how MS Word, LibreOffice, Notion, and similar editors behave; research what TipTap extensions (`FontFamily`, `TextStyle`, `FontSize`) already provide before designing anything custom; the solution must not invent novel UX — map directly to patterns users already expect from rich-text editors; note that custom font files (BLOBs) are already per-journal in `custom_fonts` DB table but the *selection* preference is currently global in `localStorage`

- [x] **TODO-0043: Named links (hyperlinks with custom display text)** — the editor must allow inserting a hyperlink where the visible label differs from the URL (e.g. `[Visit site](https://example.com)`); the feature must be correctly exported in all formats: Markdown (standard `[label](url)` syntax), JSON (TipTap mark with `href` and text), and any plugin-based exporters; the UI must allow creating, editing, and removing named links on a text selection

- [ ] **TODO-0044: Audit text styling export coverage** — verify that every inline text style the editor supports (bold, italic, underline, strikethrough, inline code, and any others) is correctly round-tripped through all export paths (Markdown, JSON, plugin exporters); identify and fix any style that is visually rendered but silently dropped, collapsed, or malformed on export

- [ ] **TODO-0041: Migrate native menu elements to main app layout** — move most menu actions from native OS menus into the app's main UI for consistent cross-platform behavior and improved E2E testability; audit current native menu items in menu.rs and identify which commands should have in-app equivalents (toolbar buttons, dropdown menus, or keyboard shortcuts); preserve critical platform-native items (app-level quit, window management) where expected by users; update E2E tests to interact with in-app controls instead of native menu automation

---

## Low Priority / Future
- [ ] **TODO-0012: PDF export** — convert journal entries to PDF (A4); likely via Tauri webview printing
- [ ] **TODO-0013: Text input extension point** — create a plugin/extension interface for alternative entry methods so official and user plugins can provide text input flows such as dictation, LLM-assisted drafting, and other future capture modes; define capability boundaries, permission model, and how plugins hand content into the editor without weakening the app's privacy guarantees
- [ ] **TODO-0014: Statistics extension point** — add a plugin/extension interface for writing statistics so official and user plugins can calculate custom metrics and surface them in the statistics UI; define the data contract, execution/sandbox constraints, and how custom statistics are registered and rendered without weakening the app's privacy-first local-only model
- [ ] **TODO-0015: Downgrade import path logging** — `commands/import.rs` logs the import file path at `info!` level (line 52 and other locations), leaking the full filesystem path in dev logs; downgrade all path logs to `debug!` level for all import functions
- [ ] **TODO-0016: `DiaryEntry` clone efficiency** — `DiaryEntry` in `db/queries.rs` derives `Clone` and can be heap-copied across import/export flows; pass references where possible to reduce allocations when processing thousands of entries; audit current command and export call sites
- [ ] **TODO-0017: Document keypair hex in JS heap** — `generate_keypair` returns `KeypairFiles` with `private_key_hex` as plain JSON so the frontend can write it to a file; add a comment on the struct in `auth/mod.rs` or `auth/keypair.rs` noting this is an accepted design tradeoff and that the private key briefly exists in the JS heap before the file is written
- [ ] **TODO-0018: Sync tool integration** — allow users to point their journal directory at a folder managed by Dropbox, Google Drive, Syncthing, or similar tools; the app should detect when `diary.db` is modified externally while locked (file-system watcher or mtime check on unlock) and prompt the user to reload; document the supported workflow in the UI and guard against opening a partially-synced (in-progress) file; note that the app never initiates any network calls — sync is entirely delegated to the external tool
- [ ] **TODO-0019: Mobile version** — Tauri v2 supports iOS and Android targets; evaluate porting the app to mobile: adapt the SolidJS UI for touch (larger tap targets, bottom navigation, swipe gestures for day navigation), handle mobile file-system sandboxing for the journal location, and assess whether the Argon2id parameters need tuning for mobile CPU/memory constraints
- [ ] **TODO-0028: Evaluate Markdown editor migration** — evaluate replacing the current TipTap HTML-based editor with a Markdown-based editor to simplify formatting support and reduce bundle size; research available Markdown editor libraries or consider building a custom one; this is a large architectural change and should only be pursued if the current editor limitations become a significant blocker
- [ ] **TODO-0038: Remove legacy `require_all_auth` config migration** — once the release boundary is agreed, remove the legacy `JournalConfig.require_all_auth` field, its migration function `migrate_require_all_auth_to_db`, and all call sites from backend and frontend; the DB-settings-backed implementation that replaced it stays untouched; requires maintainer approval before execution; see TODO-0038-01 for full steps
- [ ] **TODO-0039: Re-evaluate `glib` Dependabot alert when Tauri upgrades webkit2gtk bindings** — Dependabot alert #6 (`glib 0.18.5`, medium) was dismissed as a tolerated risk: the vulnerability is in `glib::VariantStrIter` (Linux-only, UB via unsound iterator impl), the app has zero direct `glib` usage, and upgrading requires `gtk 0.20` + `webkit2gtk 2.1.x` Rust bindings that do not yet exist in a Tauri-compatible release; re-evaluate when Tauri ships a `wry` version that pulls in `gtk-rs 0.20`-based webkit2gtk bindings
