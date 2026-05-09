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

**Latest TODO ID: TODO-0020** — next new TODO should be TODO-0021

---

## High Priority

- [x] **TODO-0001: Implement dependency updates from PRs #113, #114, #115** — merge three Dependabot PRs updating Rust crates (tauri 2.10.3→2.11.0, tauri-plugin-opener 2.5.3→2.5.4, tauri-plugin-dialog 2.7.0→2.7.1, tauri-build 2.5.6→2.6.0), JS prod deps (6 packages), and JS dev deps (10 packages); implementation plan: `docs/dependabot-updates-plan.md`
---

## Medium Priority

- [ ] **TODO-0020: Preferences overlay margins and responsive sizing** — the right margin of the Preferences dialog content area is too tight (content panel at `PreferencesOverlay.tsx:230` has `pl-6` but no right padding, causing content to press against the dialog edge); the overlay width is fixed at `max-w-3xl` and height at `max-h-[60vh]` regardless of viewport size, making it feel cramped on smaller screens and underutilized on larger ones; make the dialog width/height responsive to the available viewport and add consistent horizontal padding to the content panel
- [ ] **TODO-0002: Frontend test coverage** — auth screens (`PasswordPrompt.tsx`, `PasswordCreation.tsx`), Calendar, and all overlays (GoToDateOverlay, PreferencesOverlay, StatsOverlay, ImportOverlay, ExportOverlay) have zero test coverage; add Vitest + @solidjs/testing-library tests for each; use existing pattern from `TitleEditor.test.tsx` and `WordCount.test.tsx`
- [ ] **TODO-0003: Full image drag-and-drop support** — dropping images into the editor should work consistently both from file managers and from other applications (for example browsers, chat apps, or image editors), not only when the drag payload exposes file paths; image drops should embed the image the same way as the toolbar picker and paste flow, while unsupported payloads fail safely without breaking the editor
  - [ ] **First compatibility target: Typora** — validate and support dragging images from Typora into Mini Diarium as the first cross-application drag-and-drop case before widening compatibility to other apps
- [ ] **TODO-0004: `advancedToolbar` per-item configuration** — the advanced formatting toolbar is currently an all-or-nothing toggle (`advancedToolbar: boolean`); replace with a per-item preference so each toolbar action (headings, underline, strikethrough, blockquote, inline code, horizontal rule) can be activated or deactivated individually; add a new "Toolbar items" section in the Writing preferences tab with a checkbox per available action and sensible defaults (all enabled initially); future toolbar additions (e.g. text highlight, alignment, custom insert actions) can be gated by the same mechanism without overcrowding the toolbar by default
- [x] **TODO-0005: French translation** — add French (`fr`) as a supported locale; create `src/i18n/fr.json` with all existing translation keys; wire French into the i18n framework same as Spanish; update language preference dropdown to include French; ensure French dates format correctly (locale-aware)
- [x] **TODO-0006: Markdown export date/month filter** — add a filter option to the Markdown export flow so users can select a specific date range or export an entire month at once instead of exporting all entries; expose the filter in the ExportOverlay UI with date inputs or a month picker, and pass the selected range to the export command to emit only the matching entries
- [x] **TODO-0007: Bundled fonts not working in macOS/Windows release builds** — the editor font family selector is stuck on "System default" and non-functional in release builds on macOS and Windows; works correctly only in the Flatpak (Linux) release; works in dev environment because fonts are loaded directly from the local `fonts/` folder (via `MINI_DIARIUM_FONTS_DIR` env var or the dev-mode fallback); the bug is release-only: the `resources: ["../fonts/*.ttf"]` glob in `tauri.conf.json` may not be placing font files into the expected directory structure on macOS (`Contents/Resources/fonts/`) and Windows (`{exe_dir}/fonts/`); audit `installed_font_dir()` paths in `src-tauri/src/commands/fonts.rs` against actual bundled resource layout for each platform, verify the `fonts/` subdirectory is preserved (not flattened) in the bundle, and add integration tests with Tauri resource resolution
- [x] **TODO-0008: Cursor height too tall after Shift+Enter on macOS (#118)** — the text caret (cursor) height becomes extra long starting on the second line, but only when inserting a soft line break with Shift+Enter (Enter alone works fine); macOS-only (v0.4.20); likely a `line-height` or `font-family` mismatch in ProseMirror's `<br>` handling introduced with new editor fonts in v0.4.20; audit soft-break styling in `src/styles/editor.css` and the `--editor-font-family` / `--editor-font-size` CSS custom properties
- [x] **TODO-0009: Auto-focus editor on startup (#119)** — when the app first opens and the journal is unlocked, the TipTap editor should receive focus automatically so the user can start typing without clicking; trigger `editor.commands.focus('end')` in `EditorPanel.tsx` or `DiaryEditor.tsx` after the editor is mounted and content is loaded; ensure this only fires on initial unlock/startup, not on every date navigation or save cycle
- [x] **TODO-0010: TODO system IDs and E2E skill** — add unique identifiers to TODO items in `docs/todo/TODO.md` and create a `.agents/skills/` skill that systematizes end-to-end handling of TODO items (creation, tracking, archival, validation)

---

## Website Priority

- [ ] **TODO-0011: Website SEO/GEO follow-up backlog** — remaining implementation items from the 2026 website SEO/GEO pass
  - **Fix:** replace `transition: all 0.2s` with explicit property lists that exclude layout properties — e.g. `transition: color 0.2s, background-color 0.2s, border-color 0.2s, opacity 0.2s, transform 0.2s`; edit `website/css/style.css` (the source file) and regenerate/copy the hashed output.
  - [ ] **Resolve Cloudflare-injected robots.txt Content-Signal directive** — Cloudflare automatically appends `Content-Signal: search=yes,ai-train=no` to the live robots.txt at the CDN layer; Lighthouse's robots.txt parser flags this as invalid (not part of RFC 9309), costing 8 SEO points (score 92 → 100); the repo `website/robots.txt` is clean — this is a Cloudflare dashboard setting (REPORT.md FIX 2.1)
    - **Fix:** in the Cloudflare dashboard → Security → Bots → Crawler Hints, disable "Content Signals" injection or switch to the HTTP-header equivalent (`X-Robots-Tag: ai-train=no`) if available. No code change in the repo is needed — AI bot blocking is already handled by explicit `User-agent` blocks in the live robots.txt.

---

## Low Priority / Future
- [ ] **TODO-0012: PDF export** — convert journal entries to PDF (A4); likely via Tauri webview printing
- [ ] **TODO-0013: Text input extension point** — create a plugin/extension interface for alternative entry methods so official and user plugins can provide text input flows such as dictation, LLM-assisted drafting, and other future capture modes; define capability boundaries, permission model, and how plugins hand content into the editor without weakening the app’s privacy guarantees
- [ ] **TODO-0014: Statistics extension point** — add a plugin/extension interface for writing statistics so official and user plugins can calculate custom metrics and surface them in the statistics UI; define the data contract, execution/sandbox constraints, and how custom statistics are registered and rendered without weakening the app’s privacy-first local-only model
- [ ] **TODO-0015: Downgrade import path logging** — `commands/import.rs` logs the import file path at `info!` level (line 52 and other locations), leaking the full filesystem path in dev logs; downgrade all path logs to `debug!` level for all import functions
- [ ] **TODO-0016: `DiaryEntry` clone efficiency** — `DiaryEntry` in `db/queries.rs` derives `Clone` and can be heap-copied across import/export flows; pass references where possible to reduce allocations when processing thousands of entries; audit current command and export call sites
- [ ] **TODO-0017: Document keypair hex in JS heap** — `generate_keypair` returns `KeypairFiles` with `private_key_hex` as plain JSON so the frontend can write it to a file; add a comment on the struct in `auth/mod.rs` or `auth/keypair.rs` noting this is an accepted design tradeoff and that the private key briefly exists in the JS heap before the file is written
- [ ] **TODO-0018: Sync tool integration** — allow users to point their journal directory at a folder managed by Dropbox, Google Drive, Syncthing, or similar tools; the app should detect when `diary.db` is modified externally while locked (file-system watcher or mtime check on unlock) and prompt the user to reload; document the supported workflow in the UI and guard against opening a partially-synced (in-progress) file; note that the app never initiates any network calls — sync is entirely delegated to the external tool
- [ ] **TODO-0019: Mobile version** — Tauri v2 supports iOS and Android targets; evaluate porting the app to mobile: adapt the SolidJS UI for touch (larger tap targets, bottom navigation, swipe gestures for day navigation), handle mobile file-system sandboxing for the journal location, and assess whether the Argon2id parameters need tuning for mobile CPU/memory constraints
