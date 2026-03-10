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


---

## Medium Priority

- [ ] **Restore CI diagram content-diff check** — the byte-comparison check in `scripts/verify-diagrams.mjs` was reverted to existence-only because mmdc/d2 produce slightly different SVG bytes depending on version (local vs CI runners differ). The proper fix is to pin identical tool versions in both CI and local dev (e.g. lock `@mermaid-js/mermaid-cli` in `devDependencies` and `d2` via a specific release download in CI), then re-add the byte comparison. Until then, `diagrams:check` only verifies that all 8 `.svg` files are present.
- [ ] **i18n framework** — detect OS locale, set up translation files (`en.json`, `es.json`), add `t()` helper
  - [ ] **Translate all UI text** — replace hardcoded strings with translation keys (~145 keys); depends on i18n framework above
- [ ] **Frontend test coverage** — auth screens (`PasswordPrompt.tsx`, `PasswordCreation.tsx`), Calendar, and all overlays (GoToDateOverlay, PreferencesOverlay, StatsOverlay, ImportOverlay, ExportOverlay) have zero test coverage; add Vitest + @solidjs/testing-library tests for each; use existing pattern from `TitleEditor.test.tsx` and `WordCount.test.tsx`
- [ ] **`screen_lock.rs` unit tests** — the Windows session-lock hook is untested because it calls Win32 APIs directly; extract `trigger_auto_lock` and test it with a mock `DiaryState`; requires Win32 API mocking strategy.

---

## Website Priority

- [ ] **Website SEO/GEO follow-up backlog** — remaining implementation items from the 2026 website SEO/GEO pass
  - **Fix:** replace `transition: all 0.2s` with explicit property lists that exclude layout properties — e.g. `transition: color 0.2s, background-color 0.2s, border-color 0.2s, opacity 0.2s, transform 0.2s`; edit `website/css/style.css` (the source file) and regenerate/copy the hashed output.
  - [ ] **Resolve Cloudflare-injected robots.txt Content-Signal directive** — Cloudflare automatically appends `Content-Signal: search=yes,ai-train=no` to the live robots.txt at the CDN layer; Lighthouse's robots.txt parser flags this as invalid (not part of RFC 9309), costing 8 SEO points (score 92 → 100); the repo `website/robots.txt` is clean — this is a Cloudflare dashboard setting (REPORT.md FIX 2.1)
    - **Fix:** in the Cloudflare dashboard → Security → Bots → Crawler Hints, disable "Content Signals" injection or switch to the HTTP-header equivalent (`X-Robots-Tag: ai-train=no`) if available. No code change in the repo is needed — AI bot blocking is already handled by explicit `User-agent` blocks in the live robots.txt.

---

## Low Priority / Future
- [ ] **PDF export** — convert journal entries to PDF (A4); likely via Tauri webview printing
- [ ] **Text input extension point** — create a plugin/extension interface for alternative entry methods so official and user plugins can provide text input flows such as dictation, LLM-assisted drafting, and other future capture modes; define capability boundaries, permission model, and how plugins hand content into the editor without weakening the app’s privacy guarantees
- [ ] **Statistics extension point** — add a plugin/extension interface for writing statistics so official and user plugins can calculate custom metrics and surface them in the statistics UI; define the data contract, execution/sandbox constraints, and how custom statistics are registered and rendered without weakening the app’s privacy-first local-only model
- [ ] **Downgrade import path logging** — `commands/import.rs` logs the import file path at `info!` level (line 52 and other locations), leaking the full filesystem path in dev logs; downgrade all path logs to `debug!` level for all import functions
- [ ] **`DiaryEntry` clone efficiency** — `DiaryEntry` in `db/queries.rs` derives `Clone` and can be heap-copied across import/export flows; pass references where possible to reduce allocations when processing thousands of entries; audit current command and export call sites
- [ ] **Document keypair hex in JS heap** — `generate_keypair` returns `KeypairFiles` with `private_key_hex` as plain JSON so the frontend can write it to a file; add a comment on the struct in `auth/mod.rs` or `auth/keypair.rs` noting this is an accepted design tradeoff and that the private key briefly exists in the JS heap before the file is written
- [ ] **Accessibility audit** — only 5 ARIA labels exist (Calendar nav buttons, EditorToolbar buttons); missing ARIA on overlays, form inputs, dialogs, focus trapping, and keyboard calendar navigation; add color contrast testing and screen reader testing (NVDA / VoiceOver)
- [ ] **Mobile version** — Tauri v2 supports iOS and Android targets; evaluate porting the app to mobile: adapt the SolidJS UI for touch (larger tap targets, bottom navigation, swipe gestures for day navigation), handle mobile file-system sandboxing for the journal location, and assess whether the Argon2id parameters need tuning for mobile CPU/memory constraints
