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

**Latest TODO ID: TODO-0033** — next new TODO should be TODO-0034

---

## High Priority

---

## Medium Priority

- [ ] **TODO-0002: Frontend test coverage** — auth screens (`PasswordPrompt.tsx`, `PasswordCreation.tsx`), Calendar, and all overlays (GoToDateOverlay, PreferencesOverlay, StatsOverlay, ImportOverlay, ExportOverlay) have zero test coverage; add Vitest + @solidjs/testing-library tests for each; use existing pattern from `TitleEditor.test.tsx` and `WordCount.test.tsx`
- [ ] **TODO-0003: Full image drag-and-drop support** — dropping images into the editor should work consistently both from file managers and from other applications (for example browsers, chat apps, or image editors), not only when the drag payload exposes file paths; image drops should embed the image the same way as the toolbar picker and paste flow, while unsupported payloads fail safely without breaking the editor
  - [ ] **First compatibility target: Typora** — validate and support dragging images from Typora into Mini Diarium as the first cross-application drag-and-drop case before widening compatibility to other apps
- [ ] **TODO-0004: `advancedToolbar` per-item configuration** — the advanced formatting toolbar is currently an all-or-nothing toggle (`advancedToolbar: boolean`); replace with a per-item preference so each toolbar action (headings, underline, strikethrough, blockquote, inline code, horizontal rule) can be activated or deactivated individually; add a new "Toolbar items" section in the Writing preferences tab with a checkbox per available action and sensible defaults (all enabled initially); future toolbar additions (e.g. text highlight, alignment, custom insert actions) can be gated by the same mechanism without overcrowding the toolbar by default
- [ ] **TODO-0008: Cursor height too tall after Shift+Enter on macOS (#118)** — the text caret (cursor) height becomes extra long starting on the second line, but only when inserting a soft line break with Shift+Enter (Enter alone works fine); macOS-only (v0.4.20); likely a `line-height` or `font-family` mismatch in ProseMirror's `<br>` handling introduced with new editor fonts in v0.4.20; audit soft-break styling in `src/styles/editor.css` and the `--editor-font-family` / `--editor-font-size` CSS custom properties
- [ ] **TODO-0021: RTL/LTR direction toggle buttons** — add optional RTL and LTR direction buttons to the editor toolbar instead of enforcing text direction automatically; allow users to manually choose text direction per paragraph or selection to improve mixed RTL/LTR editing experience
- [ ] **TODO-0022: Font family and size selectors in editor toolbar** — move font family and font size controls from the Preferences settings into the editor toolbar for quicker access; integrate with the per-item toolbar configuration system (TODO-0004) so users can choose whether to show these controls in the toolbar
- [ ] **TODO-0023: Expand bundled font selection** — the current bundled fonts are heavily skewed toward monospace fonts; curate and include 5-10 high-quality open-source fonts covering a broader range of use cases (serif, sans-serif, handwriting, etc.) while keeping bundle size reasonable
- [x] **TODO-0024: Let users pick .db file directly instead of folder for "Open Existing"** — replace the `openDirDialog` folder picker in `handleBrowseOpen` with a file dialog filtered to `.db` files; extract the parent directory from the selected file path and use it as the journal path; namespace backups by DB filename stem (`backups/{stem}/` instead of flat `backups/`) so co-located journals don't share a backup pool; keep plugins shared under `plugins/` (loaded once at startup, not reloaded on journal switch); update `check_diary_path` to accept a file path instead of a folder path; update `DiaryState` to track the DB filename separately or derive it from `db_path`; update i18n keys (`selectFolderTitle`, `noJournalFound`, `chooseFolderTitle`) to file-oriented text; update `JournalPicker.test.tsx`; update `backup.rs` tests; audit E2E specs
- [ ] **TODO-0026: Full-text search across diary entries** — implement a secure, performant full-text search that scans all diary entries for words or phrases without storing plaintext on disk or loading all entries into memory; the old SQLite FTS approach was removed because it exposed plaintext; design a solution that preserves encryption at rest while providing reasonable search performance
- [ ] **TODO-0029: Optimize word-count performance** — benchmarks measure 8.75µs (plain text) and 12.05µs (TipTap HTML), both marked Critical against sub-microsecond targets; the word-count calculation runs after every auto-save; profile and eliminate the regex/allocation bottlenecks in the plain-text fast path and the HTML stripping overhead in the TipTap production path
- [ ] **TODO-0030: Track GitHub pipeline duration in benchmarks** — add a benchmark metric that tracks the total wall-clock duration of the GitHub CI pipeline on master; surface the trend alongside existing benchmarks to detect CI slowdowns from dependency bloat, build step regressions, or runner contention
- [ ] **TODO-0031: Port todo-manager skill to agent-skills repo** — create a repo-agnostic version of the todo-manager skill in `D:\Repos\agent-skills\todo-manager\SKILL.md`; remove Mini Diarium-specific file paths and conventions; match the structure and patterns of the existing `manual-planning` skill in that repo
- [ ] **TODO-0033: First-run onboarding suggestions for new journals** — when the user creates a new journal and it is the only journal in the app (indicating a first-time user), show a minimal, easily dismissible set of tips pop-overs or a suggestion card, for example: enabling the advanced formatting toolbar, importing from other apps, and where to find the documentation; must fire only once per app profile (not per journal) and must be trivial to dismiss without leaving persistent UI clutter; keep the implementation simple — no multi-step wizard, no progress tracking, no backend changes

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
- [ ] **TODO-0027: Tags support for entries** — add the ability to tag individual entries and look up entries by tag; design a lightweight tagging system that stores tag metadata alongside entries without complicating the data model or weakening privacy guarantees
- [ ] **TODO-0028: Evaluate Markdown editor migration** — evaluate replacing the current TipTap HTML-based editor with a Markdown-based editor to simplify formatting support and reduce bundle size; research available Markdown editor libraries or consider building a custom one; this is a large architectural change and should only be pursued if the current editor limitations become a significant blocker
- [ ] **TODO-0032: Move plugins directory to app-data central location** — plugins currently live under the active journal directory (`{journal_path}/plugins/`) but are loaded once at startup and never reloaded on journal switch, making the per-journal location arbitrary; this task has two phases: first, challenge and validate the decision — audit whether moving to `{app_data_dir}/plugins/` creates any discoverability or migration gaps (users may have dropped `.rhai` scripts into the old location), whether per-journal plugin isolation is desirable in the future, and how to handle the existing `plugins/README.md` generation; second, if the decision is confirmed, implement the move — update `lib.rs` plugin loading to read from `app_data_dir`, add a one-time migration step for any `.rhai` files found in the old journal-relative location, update the `plugins/README.md` generation path, and update the user plugin guide docs
