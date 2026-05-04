# TODO

Open tasks and planned improvements. For full context and implementation notes on the original tasks, see [OPEN_TASKS.md](OPEN_TASKS.md).

TODO entry format:

- `- [ ] **Task title** — concise requirement-style description with scope and constraints`
- Write items as requirements/acceptance criteria (what must be true), not implementation plans (how to build it)
- Keep implementation details minimal in TODO entries; move deep implementation notes to `OPEN_TASKS.md` when needed
- Put items under the appropriate priority section
- Use indented checkbox items only for true sub-tasks or explicit dependencies

---

## High Priority

- [x] **`bump-version` scripts don't inject metainfo.xml release entry** — `bump-version.sh` and `bump-version.ps1` both claim to prepend a `<release version="X.Y.Z">` entry to `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml` (the comment on line 53 says so), but neither script actually does it; the pre-release checklist catches the omission, but it was manually patched in v0.4.19; fix both scripts so the entry is injected automatically at bump time alongside the other version strings

---

## Medium Priority

- [ ] **Frontend test coverage** — auth screens (`PasswordPrompt.tsx`, `PasswordCreation.tsx`), Calendar, and all overlays (GoToDateOverlay, PreferencesOverlay, StatsOverlay, ImportOverlay, ExportOverlay) have zero test coverage; add Vitest + @solidjs/testing-library tests for each; use existing pattern from `TitleEditor.test.tsx` and `WordCount.test.tsx`
- [ ] **Full image drag-and-drop support** — dropping images into the editor should work consistently both from file managers and from other applications (for example browsers, chat apps, or image editors), not only when the drag payload exposes file paths; image drops should embed the image the same way as the toolbar picker and paste flow, while unsupported payloads fail safely without breaking the editor
  - [ ] **First compatibility target: Typora** — validate and support dragging images from Typora into Mini Diarium as the first cross-application drag-and-drop case before widening compatibility to other apps
- [ ] **`advancedToolbar` per-item configuration** — the advanced formatting toolbar is currently an all-or-nothing toggle (`advancedToolbar: boolean`); replace with a per-item preference so each toolbar action (headings, underline, strikethrough, blockquote, inline code, horizontal rule) can be activated or deactivated individually; add a new "Toolbar items" section in the Writing preferences tab with a checkbox per available action and sensible defaults (all enabled initially); future toolbar additions (e.g. text highlight, alignment, custom insert actions) can be gated by the same mechanism without overcrowding the toolbar by default

---

## Website Priority

- [ ] **Website SEO/GEO follow-up backlog** — remaining implementation items from the 2026 website SEO/GEO pass
  - **Fix:** replace `transition: all 0.2s` with explicit property lists that exclude layout properties — e.g. `transition: color 0.2s, background-color 0.2s, border-color 0.2s, opacity 0.2s, transform 0.2s`; edit `website/css/style.css` (the source file) and regenerate/copy the hashed output.
  - [ ] **Resolve Cloudflare-injected robots.txt Content-Signal directive** — Cloudflare automatically appends `Content-Signal: search=yes,ai-train=no` to the live robots.txt at the CDN layer; Lighthouse's robots.txt parser flags this as invalid (not part of RFC 9309), costing 8 SEO points (score 92 → 100); the repo `website/robots.txt` is clean — this is a Cloudflare dashboard setting (REPORT.md FIX 2.1)
    - **Fix:** in the Cloudflare dashboard → Security → Bots → Crawler Hints, disable "Content Signals" injection or switch to the HTTP-header equivalent (`X-Robots-Tag: ai-train=no`) if available. No code change in the repo is needed — AI bot blocking is already handled by explicit `User-agent` blocks in the live robots.txt.

---

## Low Priority / Future
- [x] **Multi-entry number navigation bar** — when multiple entries exist on a date, replace (or augment) the existing prev/next arrows with a `← 1 2 3 →` indicator row where each number is a clickable link that jumps directly to that entry and the current entry's number is visually highlighted (e.g. bold); the arrows should retain their existing behaviour of stepping to the previous/next entry
- [ ] **Editor font selection** — allow users to select the editor font from a list of curated open-source fonts bundled with the app; fonts are enumerated from the bundle directory at runtime (no OS enumeration, no `font-kit`, no Flatpak sandbox permissions); five families selected for multilingual coverage and category variety (Noto Sans, Source Sans 3, Noto Serif, JetBrains Mono, Fira Mono); the selected font applies to the TipTap editor only and is persisted as the `editorFontFamily` preference; implementation plan: [`docs/editor-font-selection-plan.md`](editor-font-selection-plan.md)
- [ ] **PDF export** — convert journal entries to PDF (A4); likely via Tauri webview printing
- [ ] **Text input extension point** — create a plugin/extension interface for alternative entry methods so official and user plugins can provide text input flows such as dictation, LLM-assisted drafting, and other future capture modes; define capability boundaries, permission model, and how plugins hand content into the editor without weakening the app’s privacy guarantees
- [ ] **Statistics extension point** — add a plugin/extension interface for writing statistics so official and user plugins can calculate custom metrics and surface them in the statistics UI; define the data contract, execution/sandbox constraints, and how custom statistics are registered and rendered without weakening the app’s privacy-first local-only model
- [ ] **Downgrade import path logging** — `commands/import.rs` logs the import file path at `info!` level (line 52 and other locations), leaking the full filesystem path in dev logs; downgrade all path logs to `debug!` level for all import functions
- [ ] **`DiaryEntry` clone efficiency** — `DiaryEntry` in `db/queries.rs` derives `Clone` and can be heap-copied across import/export flows; pass references where possible to reduce allocations when processing thousands of entries; audit current command and export call sites
- [ ] **Document keypair hex in JS heap** — `generate_keypair` returns `KeypairFiles` with `private_key_hex` as plain JSON so the frontend can write it to a file; add a comment on the struct in `auth/mod.rs` or `auth/keypair.rs` noting this is an accepted design tradeoff and that the private key briefly exists in the JS heap before the file is written
- [ ] **Sync tool integration** — allow users to point their journal directory at a folder managed by Dropbox, Google Drive, Syncthing, or similar tools; the app should detect when `diary.db` is modified externally while locked (file-system watcher or mtime check on unlock) and prompt the user to reload; document the supported workflow in the UI and guard against opening a partially-synced (in-progress) file; note that the app never initiates any network calls — sync is entirely delegated to the external tool
- [ ] **Mobile version** — Tauri v2 supports iOS and Android targets; evaluate porting the app to mobile: adapt the SolidJS UI for touch (larger tap targets, bottom navigation, swipe gestures for day navigation), handle mobile file-system sandboxing for the journal location, and assess whether the Argon2id parameters need tuning for mobile CPU/memory constraints
