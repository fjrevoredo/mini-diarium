# TODO

Open tasks and planned improvements. For full context and implementation notes on the original tasks, see [OPEN_TASKS.md](OPEN_TASKS.md).

---

## High Priority



---

## Medium Priority

- [ ] **Restore CI diagram content-diff check** — the byte-comparison check in `scripts/verify-diagrams.mjs` was reverted to existence-only because mmdc/d2 produce slightly different SVG bytes depending on version (local vs CI runners differ). The proper fix is to pin identical tool versions in both CI and local dev (e.g. lock `@mermaid-js/mermaid-cli` in `devDependencies` and `d2` via a specific release download in CI), then re-add the byte comparison. Until then, `diagrams:check` only verifies that all 8 `.svg` files are present.
- [ ] **Auto-lock on screen lock (macOS parity)** — Windows implementation is done; add macOS native screen-lock hook so behavior matches across desktop platforms
- [ ] **i18n framework** — detect OS locale, set up translation files (`en.json`, `es.json`), add `t()` helper
  - [ ] **Translate all UI text** — replace hardcoded strings with translation keys (~145 keys); depends on i18n framework above
- [ ] **Frontend test coverage** — auth screens (`PasswordPrompt.tsx`, `PasswordCreation.tsx`), Calendar, and all overlays (GoToDateOverlay, PreferencesOverlay, StatsOverlay, ImportOverlay, ExportOverlay) have zero test coverage; add Vitest + @solidjs/testing-library tests for each; use existing pattern from `TitleEditor.test.tsx` and `WordCount.test.tsx`
- [ ] **`screen_lock.rs` unit tests** — the Windows session-lock hook is untested because it calls Win32 APIs directly; extract `trigger_auto_lock` and test it with a mock `DiaryState`; requires Win32 API mocking strategy.

---

## Low Priority / Future

- [ ] **PDF export** — convert diary entries to PDF (A4); likely via Tauri webview printing
- [ ] **Downgrade import path logging** — `commands/import.rs` logs the import file path at `info!` level (line 52 and other locations), leaking the full filesystem path in dev logs; downgrade all path logs to `debug!` level for all import functions
- [ ] **`DiaryEntry` clone efficiency** — `DiaryEntry` in `db/queries.rs` derives `Clone` and is heap-copied for each entry during import (see `import/merge.rs` usage); pass references where possible to reduce allocations when importing thousands of entries; audit call sites in merge logic
- [ ] **Document keypair hex in JS heap** — `generate_keypair` returns `KeypairFiles` with `private_key_hex` as plain JSON so the frontend can write it to a file; add a comment on the struct in `auth/mod.rs` or `auth/keypair.rs` noting this is an accepted design tradeoff and that the private key briefly exists in the JS heap before the file is written
- [ ] **Accessibility audit** — Only 5 ARIA labels exist (Calendar nav buttons, EditorToolbar buttons); missing ARIA on: overlays, form inputs, dialogs, focus trapping, keyboard calendar navigation; add color contrast testing, screen reader testing (NVDA / VoiceOver)
- [ ] **Mobile version** — Tauri v2 supports iOS and Android targets; evaluate porting the app to mobile: adapt the SolidJS UI for touch (larger tap targets, bottom navigation, swipe gestures for day navigation), handle mobile file-system sandboxing for the diary DB location, and assess whether the Argon2id parameters need tuning for mobile CPU/memory constraints
- [ ] **Website SEO/GEO follow-up backlog** — remaining implementation items from the 2026 website SEO/GEO pass
  - [ ] **Optimize demo media** — replace the 4.7 MB `website/assets/demo.gif` with a lightweight preview strategy (e.g. poster image + optional MP4/WebM playback) to reduce transfer size and improve performance signals
  - [ ] **Canonical host redirect** — enforce one canonical host (`mini-diarium.com` vs `www`) with explicit 301 behavior in deployment/edge config and keep `<link rel="canonical">` aligned
  - [ ] **Email no-JS fallback** — make the contact email actionable without JavaScript (server-rendered `mailto:`), keeping optional obfuscation/enhancement on top
  - [ ] **Release freshness ops** — document and automate post-release discovery flow (Search Console URL inspection/request indexing and optional IndexNow ping) for high-cadence releases