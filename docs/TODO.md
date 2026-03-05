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

- [ ] **Add safe "Debug Dump" export in Preferences → Advanced** — add a user-triggered "Generate Debug Dump" button in a new `Advanced` subsection of settings that writes a support-friendly diagnostic file for troubleshooting while preserving privacy
  - **Scope:** add an `Advanced` section in `PreferencesOverlay.tsx` and place a clearly labeled action button (e.g. "Generate Debug Dump"); allow user-selected save path via dialog; show success/error feedback after generation
  - **Must include (safe diagnostics):** app version, OS/platform info, runtime/build metadata, enabled feature flags, non-sensitive preference values, active journal id (or anonymized identifier), and recent app logs relevant to failures
  - **Must NOT include (privacy boundary):** entry content/title HTML, search queries, password values, key files/private keys/public keys/master-key material, auth slot wrapped blobs, full filesystem paths, or any raw user text fields; redact/sanitize before write
  - **Implementation notes:** create a backend command for dump generation so sanitization is enforced in Rust, and keep frontend as a simple trigger + save flow
  - **Files:** `src/components/overlays/PreferencesOverlay.tsx`, `src/lib/tauri.ts`, `src-tauri/src/commands/` (new command module and registration in `commands/mod.rs` + `lib.rs`)
- [x] **Add "-" button to delete current extra entry (same day)** — add a delete-entry button next to the existing `+` button in the entry navigator for multi-entry days (2026-03-05)
  - **Visibility requirement:** show the `-` button only when the selected day has more than 1 entry
  - **Tooltip requirement:** the `-` button must have a clear tooltip that explains the action before click
  - **Confirmation requirement:** clicking `-` opens a `Yes` / `No` confirmation dialog
  - **Delete requirement:** selecting `Yes` deletes the currently selected entry for that day
  - **Navigation requirement:** after delete, navigate to the next available entry for that same day
  - **Cancel requirement:** selecting `No` closes the dialog and changes nothing
- [x] **Unify terminology to "Journal" across app and codebase** (2026-03-05) — remove mixed `diary`/`journal` wording and standardize user-facing language and internal naming conventions
  - **UI text requirement:** all user-visible labels/messages/tooltips/dialogs must use `Journal` consistently
  - **Codebase requirement:** naming in frontend/backend command wrappers and state modules should be aligned to the same term where feasible, with compatibility preserved where renames would break public interfaces
  - **Documentation requirement:** repository docs (README, guides, and related docs) must be updated to use `Journal` terminology consistently
  - **Website requirement:** marketing website content under `website/` must also use `Journal` terminology consistently
  - **Compatibility requirement:** existing persisted data, command contracts, and migrations must keep working after terminology cleanup
- [ ] **Remove minimum password length requirement** — the current UI enforces a minimum length; the owner needs to verify whether the encryption algorithm truly requires it (Argon2id does not); if not required, remove the hard block and replace with a strength hint/suggestion (issue #43)
  - **Investigation:** the 8-char minimum is enforced frontend-only in three places: `src/components/auth/PasswordCreation.tsx:28-31`, `src/components/overlays/PreferencesOverlay.tsx:218-221` (change password), and `PreferencesOverlay.tsx:300-303` (add password auth method). The backend (`src-tauri/src/crypto/password.rs`) and Argon2id have **no minimum length** — any string including empty is accepted.
  - **Fix:** remove the hard `return` block in each location; replace with a visual strength hint (e.g. yellow warning if < 8 chars, green if ≥ 12). The "Create"/"Save" button should remain enabled. Optionally add backend validation only for empty-string passwords.
  - **Files:** `src/components/auth/PasswordCreation.tsx:28-31`, `src/components/overlays/PreferencesOverlay.tsx:218-221, 300-303`.
- [x] **Add month/year picker to left calendar** (2026-03-05) — clicking on the month/year header in the sidebar calendar should open a date-picker so users can jump to any month/year directly (issue #43)
  - **Investigation:** Calendar header (`Calendar.tsx:161`) is a static `<h3>` with no click handler. No date-picker library is installed (only `@kobalte/core` for UI primitives). A native `<input type="month">` approach is viable without new dependencies.
  - **Fix option A (simple):** replace the `<h3>` with a button that shows a `<Show>`-gated `<input type="month">` popover on click — no extra dependency.
  - **Fix option B (polished):** render a 12-month grid + year steppers in a small dropdown (~50 extra lines, no new dependency).
  - Clicking a month/year in either picker calls `setCurrentMonth(new Date(year, month))`. If the "go to today" fix (item above) moves `currentMonth` to `ui.ts`, this picker updates the same shared signal.
  - **File:** `src/components/calendar/Calendar.tsx`.
- [ ] **Restore CI diagram content-diff check** — the byte-comparison check in `scripts/verify-diagrams.mjs` was reverted to existence-only because mmdc/d2 produce slightly different SVG bytes depending on version (local vs CI runners differ). The proper fix is to pin identical tool versions in both CI and local dev (e.g. lock `@mermaid-js/mermaid-cli` in `devDependencies` and `d2` via a specific release download in CI), then re-add the byte comparison. Until then, `diagrams:check` only verifies that all 8 `.svg` files are present.
- [ ] **i18n framework** — detect OS locale, set up translation files (`en.json`, `es.json`), add `t()` helper
  - [ ] **Translate all UI text** — replace hardcoded strings with translation keys (~145 keys); depends on i18n framework above
- [ ] **Frontend test coverage** — auth screens (`PasswordPrompt.tsx`, `PasswordCreation.tsx`), Calendar, and all overlays (GoToDateOverlay, PreferencesOverlay, StatsOverlay, ImportOverlay, ExportOverlay) have zero test coverage; add Vitest + @solidjs/testing-library tests for each; use existing pattern from `TitleEditor.test.tsx` and `WordCount.test.tsx`
- [ ] **`screen_lock.rs` unit tests** — the Windows session-lock hook is untested because it calls Win32 APIs directly; extract `trigger_auto_lock` and test it with a mock `DiaryState`; requires Win32 API mocking strategy.

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
- [ ] **Add basic manual blog to website** — add a simple static blog section under `website/` with hand-written entries (no CMS, no database, no dynamic rendering). New posts are created by manually adding/updating static files and then fully republishing the website; this manual release flow is intentional to keep implementation simple.
- [ ] **Website SEO/GEO follow-up backlog** — remaining implementation items from the 2026 website SEO/GEO pass
  - [ ] **Optimize demo media — fix mobile LCP (11.6 s)** — `website/assets/demo.gif` is 4.7 MB and is the LCP element on mobile, causing an 11.6 s Largest Contentful Paint (Google ranks pages with LCP > 4 s as "Poor"); it also has `loading="lazy"` and `fetchpriority="low"` which actively delays it further (`website/index.html:237`)
    - **Fix:** convert to MP4/WebM (target < 1 MB) with a `<video autoplay loop muted playsinline>` element and a static poster image as fallback; remove `loading="lazy"`; set `fetchpriority="high"` on the replacement element; add a `<link rel="preload" as="video" href="/assets/demo.mp4" fetchpriority="high">` hint as the first resource hint in `<head>`. Estimated mobile LCP drop from ~11.6 s to under 2.5 s.
  - [ ] **Canonical host redirect** — enforce one canonical host (`mini-diarium.com` vs `www`) with explicit 301 behavior in deployment/edge config and keep `<link rel="canonical">` aligned
  - [ ] **Email no-JS fallback** — make the contact email actionable without JavaScript (server-rendered `mailto:`), keeping optional obfuscation/enhancement on top
  - [ ] **Release freshness ops** — document and automate post-release discovery flow (Search Console URL inspection/request indexing and optional IndexNow ping) for high-cadence releases
  - [ ] **Update title tag and meta description with search keywords** — current title `"Mini Diarium: Your journal. Your device. Your keys."` is brand-only (51 chars, zero search-intent keywords); meta description starts with brand name instead of keyword; both affect SERP CTR and ranking (REPORT.md FIX 3.1, 3.2)
    - **Title fix:** `"Mini Diarium — Encrypted Offline Journal for Windows, macOS & Linux"` (64 chars, within 65-char limit); file: `website/index.html` `<title>` tag and `og:title` / `twitter:title` meta tags.
    - **Description fix:** front-load the keyword — e.g. `"Encrypted offline journal app for Windows, macOS & Linux. AES-256-GCM encryption, no cloud, no tracking, no subscriptions."` (~124 chars); file: `website/index.html` `name="description"` and `og:description` / `twitter:description`.
  - [ ] **Replace SVG OG/Twitter cover image with PNG** — `website/assets/og-cover.svg` (1.7 KB) is referenced by `og:image` and `twitter:image`; SVG is not supported by most social platforms (Twitter/X, Slack, iMessage, WhatsApp — all silently omit the image when the type is `image/svg+xml`) (REPORT.md Section 3)
    - **Fix:** export `og-cover.svg` to a 1200×630 PNG (target < 80 KiB); update `og:image`, `og:image:type`, and `twitter:image` in `website/index.html`; serve the PNG from `website/assets/og-cover.png`.
  - [ ] **Add ARIA labels to platform-specific download buttons** — "Download for Windows" and "macOS & Linux" hero buttons (`website/index.html:197-205`) point to the same URL with no `aria-label`; screen readers read them as duplicate links (Lighthouse accessibility flag, REPORT.md FIX 2.2)
    - **Fix option A (minimal):** add `aria-label="Download Mini Diarium for Windows"` and `aria-label="Download Mini Diarium for macOS and Linux"` to the two `<a>` elements.
    - **Fix option B (better UX):** deep-link to platform-specific release assets (e.g. `…/releases/latest/download/mini-diarium_x.y.z_x64-setup.exe`) so users land directly on the right installer — eliminates the duplicate-URL issue entirely and improves the download funnel.
  - [ ] **Inline critical CSS to eliminate render-blocking stylesheet** — `website/index.html` loads `css/style.d6319c6e.css` as a standard blocking `<link>`; on slow mobile connections this delays first paint by ~140 ms (Lighthouse FIX 1.3, REPORT.md Section 1)
    - **Fix:** extract ~2–4 KB of above-the-fold styles (nav, hero headline, hero subtext, CTA button styles, background colour) into an inline `<style>` block in `<head>`; load the full stylesheet non-blocking via `rel="preload" as="style" onload="this.rel='stylesheet'"` with a `<noscript>` fallback. The filename is already content-hashed so the non-blocking pattern is safe.
  - [ ] **Set long-lived cache headers on static website assets** — Lighthouse flagged 2,769 KiB of assets with short/no cache lifetimes; CSS is already content-hashed (`style.d6319c6e.css`) so it is safe to cache indefinitely (REPORT.md FIX 1.4)
    - **Fix (Cloudflare):** create a Cache Rule — URI path matches `\.(css|js|webp|png|jpg|svg|ico|woff2)$` → Cache-Control `max-age=31536000, immutable`.
    - **Fix (nginx fallback):** add to `website/nginx.conf`: `location ~* \.(css|js|webp|png|jpg|svg|ico|woff2)$ { expires 1y; add_header Cache-Control "public, max-age=31536000, immutable"; }`.
  - [ ] **Fix non-composited CSS transitions on website** — Lighthouse flagged 1 animated element using a non-composited animation (animates layout properties instead of `transform`/`opacity`, forcing repaint on every frame); `transition: all 0.2s` at `website/css/style.d6319c6e.css` lines 225, 715, 811 is the likely cause (REPORT.md FIX 1.5)
    - **Fix:** replace `transition: all 0.2s` with explicit property lists that exclude layout properties — e.g. `transition: color 0.2s, background-color 0.2s, border-color 0.2s, opacity 0.2s, transform 0.2s`; edit `website/css/style.css` (the source file) and regenerate/copy the hashed output.
  - [ ] **Resolve Cloudflare-injected robots.txt Content-Signal directive** — Cloudflare automatically appends `Content-Signal: search=yes,ai-train=no` to the live robots.txt at the CDN layer; Lighthouse's robots.txt parser flags this as invalid (not part of RFC 9309), costing 8 SEO points (score 92 → 100); the repo `website/robots.txt` is clean — this is a Cloudflare dashboard setting (REPORT.md FIX 2.1)
    - **Fix:** in the Cloudflare dashboard → Security → Bots → Crawler Hints, disable "Content Signals" injection or switch to the HTTP-header equivalent (`X-Robots-Tag: ai-train=no`) if available. No code change in the repo is needed — AI bot blocking is already handled by explicit `User-agent` blocks in the live robots.txt.
