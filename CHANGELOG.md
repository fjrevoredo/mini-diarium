# Changelog

All notable changes to Mini Diarium are documented here. This project uses [Semantic Versioning](https://semver.org/).

Template:

```markdown
## [X.Y.Z] - dd-mm-YYYY/Unreleased

### Added
- **Change X**: Change X description
    - **Change X sub-item**: Change X subitem description

### Fixed
- **Fix X**: Fix X description

### Changed
- **Change X**: Change X description

### Removed
- **Removal X**: Removal X description

### Internal
- **Internal X**: Internal change X description

### Security
- **Security X**: Security change X description


## [X.Y.Z-1] - dd-mm-YYYY

...
```

# Versions

## [0.6.3] - Unreleased

### Added
- **In-app day navigation in the header** (TODO-0063): the header date now sits between a `◀` previous-day button and a `▶` next-day button, and the date itself is clickable to open the Go to Date picker. Previously these actions lived only in the native OS menu bar, which is off-screen on most platforms and unreachable by the E2E harness — they are now core, always-visible affordances (not gated behind the in-app-menu experimental flag). The `▶` button respects the "allow future entries" preference, stopping at today when future entries are disabled. The prev/next-day logic is now a single shared source of truth (`src/lib/day-navigation.ts`) used by both the header buttons and the existing menu shortcuts, so both behave identically.

### Internal
- **Onboarding tour's Import step retargeted to the in-app `⋮` menu** (TODO-0062, completing the in-app-menu migration piece begun in 0.6.2): the first-run tour's "Import" step now spotlights the header overflow (`⋮`) trigger via a new `data-tour-target="import"` attribute on it, instead of pointing an arrow off-screen at the native OS menu bar. This is flag-aware and correct in both states: when the `inAppMenu` runtime feature flag is on the trigger exists and the tour highlights it; when the flag is off (the default) the whole overflow menu isn't rendered, so the element is absent and the tour transparently falls back to the existing native-menu-bar edge hint (where Import genuinely still lives). No onboarding change for users on a default build. This was the last remaining piece before the flag can graduate to on-by-default (TODO-0065, still approval-gated). No user-visible change in a default build.
- **Consolidated the post-task completion checklist into a single best-practices doc**: the six-check workflow every task must pass before being reported done (scope assessment, originating TODO closed, CHANGELOG entry, tests + type-check green, formatting clean, summary template) now lives in `docs/best-practices/POST_TASK_BEST_PRACTICES.md` as the single source of truth. Step 1 maps each task scope (frontend-only, backend-only, full-stack, dependency-update, CI/build, docs-only, refactor) to which checks are mandatory, recommended, or skippable, and codifies the E2E rule: run `test:e2e:local` only for cross-layer user-flow changes or dependency updates; CI covers the rest. Root `CLAUDE.md` (Rule 1 + the Verification Commands section), `CONTRIBUTING.md`, `scripts/README.md`, and the four domain `CLAUDE.md` files now point at it instead of duplicating the verification command list. Also reconciled the CHANGELOG format spec in `.claude/agents/docs-sync-guardian.md`, `latest-changelog.template.md`, and the template block at the top of `CHANGELOG.md` with current practice (the `dd-mm-YYYY` date format, the project-specific `### Internal` section, and `### Security`). Added a clarifying note to `CONTEXT_FILES_BEST_PRACTICES.md` anti-pattern #8 explaining why a cross-cutting review rule lives in `best-practices/` rather than as a skill. No production behavior change.


## [0.6.2] - 12-07-2026

### Added
- **Lock journal when the window loses focus** (TODO-0068, addressing [#194](https://github.com/fjrevoredo/mini-diarium/issues/194)): a new "Lock when the window loses focus" toggle in Preferences → Security (off by default, independent of the existing idle-timer auto-lock) locks the journal a few seconds after the app window loses OS-level focus — minimizing, Alt+Tab/Cmd+Tab away, clicking another window, or Cmd+H on macOS. A short debounce means a quick misclick outside the window doesn't lock the journal if focus returns in time, and opening one of the app's own native dialogs (export, import, key-file save) never triggers it. Detection lives in Rust (`WindowEvent::Focused`) rather than the DOM `visibilitychange` API, which does not reliably fire on window minimize in the bundled WebView2. Verified end-to-end on Windows; macOS/Linux rely on the same cross-platform windowing API and have not been separately live-tested.
- **Per-entry lock against accidental edits** (TODO-0071, addressing [#205](https://github.com/fjrevoredo/mini-diarium/issues/205)): a lock/unlock button in the editor's entry nav bar makes an entry read-only so you can reread older days from the calendar or timeline without risking a stray edit. A locked entry cannot be edited, deleted, or re-tagged — the editor, title field, formatting toolbar, delete button, and the add/remove-tag controls all disable, and the backend rejects `save_entry`, `delete_entry`, `add_tag_to_entry`, and `remove_tag_from_entry` for a locked entry as a safety net. Locked days show a small passive lock indicator on their calendar cell and timeline row (the toggle itself lives only in the editor). This is a convenience affordance, not a security feature: the lock state is stored as a plaintext column and is independent of the journal's auth-lock. Requires a database migration (schema v12 → v13) that runs automatically on first unlock.

### Fixed
- **Auto-lock timeout floor** (TODO-0069): the auto-lock timeout preference can no longer be set below 5 seconds. Any pre-existing stored value outside the 5–999 range is corrected automatically on next load. Addresses [#194](https://github.com/fjrevoredo/mini-diarium/issues/194).

### Changed

### Removed

### Internal
- **In-app header `⋮` menu placed behind an off-by-default runtime feature flag** (TODO-0062, building on TODO-0061): the header overflow menu — which surfaces Preferences and now also Statistics, Import, and Export inside the WebView instead of the native OS menu bar — is gated behind a new `inAppMenu` runtime feature flag that defaults **off**, so there is no user-visible change in this release; the migration graduates to visible-by-default once the redundant native menu items are removed (TODO-0065). The flag wraps the entire menu at the `Header.tsx` render site (trigger and all items), so nothing appears until it is enabled, and Preferences stays reachable via the native menu meanwhile — the toggle can never be trapped behind the menu it controls. Introduced a small **migration-free** feature-flag store (`src/state/feature-flags.ts`: its own `localStorage['feature-flags']` key holding an open `Record<string, boolean>`, no per-flag migration logic — the Tier 2 the feature-flag ADR had deferred, now adopted) plus a toggle under Preferences → Advanced → Experimental Features. The three new items reuse the existing Statistics/Import/Export overlays (no new backend command). While building TODO-0061 this also closed a menu/shortcut interaction gap — the global Escape-to-quit and Ctrl/Cmd+F search shortcuts ignore keypresses while the overflow menu is open, matching every other overlay. Also fixed a pre-existing stacking bug where the `⋮` dropdown rendered behind the editor (the portaled menu content had no z-index; it now uses the app-wide `z-50` overlay level). `e2e/specs/header-actions.spec.ts` enables the flag before driving the menu via a new `setFeatureFlag` localStorage-seed-and-reload helper in `e2e/specs/helpers.ts`.
- **E2E coverage for the header `⋮` → Preferences path** (TODO-0064): added a WebdriverIO spec (`e2e/specs/header-actions.spec.ts`) that opens the overflow menu and asserts the Preferences overlay opens, driven against the real Tauri binary — the first end-to-end coverage of an action that was previously reachable only through the untestable native OS menu bar. Extracted the auth/onboarding boilerplate duplicated across `diary-workflow`, `search`, and `multi-entry` into a shared `e2e/specs/helpers.ts` (`connectToApp`/`authenticate`/`dismissOnboardingTour`) and refactored those three specs to use it; `multi-entry` now also dismisses the onboarding tour, removing a latent spec-order dependency. Added a stable `preferences-overlay` test id to `PreferencesOverlay`. Also repaired `e2e/tsconfig.json`, which no longer type-checked under WebdriverIO v9: replaced the removed v7 `webdriverio/async` types entry with `@wdio/globals/types` + `mocha`, added the `DOM` lib for `browser.execute()` callbacks, and silenced the `node10` module-resolution deprecation; retyped `wdio.conf.ts`'s config as `WebdriverIO.Config` (the v9 type that carries `capabilities`). Reframed TODO-0064 to decouple future Statistics/Import/Export/day-nav coverage from this task and cap it at shallow "overlay opens" smoke checks. No production behavior change.
- **Fixed `hover:bg-hover` and sibling theme tokens never compiling** (TODO-0066): `bg-hover`, `bg-active`, `bg-primary/secondary/tertiary`, `text-primary/secondary/tertiary/muted`, `border-primary/secondary`, and the status colors were hand-authored plain CSS classes never registered with UnoCSS, so any `hover:`/`focus:`/`disabled:`/`data-[...]:`-prefixed combination against them silently compiled to nothing. Native `<button>`s appeared to hover correctly only by accident, via an unrelated generic `button:hover` fallback rule in `index.html`; non-button elements (e.g. Kobalte dropdown items) got no hover feedback at all. Registered all affected tokens as static UnoCSS rules in `uno.config.ts` so variants compile correctly against them, removed the now-redundant plain classes from `src/index.css`, and removed the `as="button"` workaround this had forced in `HeaderMoreMenu.tsx`. Buttons across the app now show the intended subtle gray/dark-gray hover tint instead of the accidental blue. Added a regression test (`uno.config.test.ts`) asserting the compiled CSS contains the expected variant selectors. Filed TODO-0067 to separately decide whether to scope or remove the now-redundant `index.html` fallback rule.
- **Raised frontend test quality and coverage toward the 85% target** (TODO-0070): behavior-first test pass lifting frontend coverage from ~74.9%/62.8%/75.7%/75.2% to 80.4%/66.0%/84.1%/81.5% (statements/branches/functions/lines) and bumping the `vitest.config.ts` backstop thresholds to 76/62/80/77. Added shared test infrastructure (`src/test/mock-tauri.ts` `mockTauriBarrel` helper and `src/test/fixtures.ts` factories), IPC-contract tests for all 14 `src/lib/tauri/*` command wrappers (exact command string + camelCase arg mapping + return pass-through), and new behavior tests for `state/journals`, `state/onboarding`, `lib/theme`, `TimestampOverlay`, `EntryTags`, and the branchy `state/auth` (transition coverage, backend-before-state ordering, `mapTauriError` sanitization, fake-timer lock animation). Cleaned up weak tests: deleted a `MainLayout` "test" that asserted only on local variables and re-covered the real menu-navigation behavior; rewrote the network-isolation test to actually execute the isolation script in a sandbox and assert globals are neutralized — and to run the same behavioral checks over both the frontend copy and the Rust runtime copy extracted from `src-tauri/src/lib.rs`, so the two can no longer silently drift; and upgraded several `toBeTruthy`/`not.toThrow`-only assertions to check real outcomes. `DiaryEditor.tsx` and the `pdf.ts` canvas path were left for E2E as they cannot be covered honestly in jsdom. No production behavior change.


## [0.6.1] - 01-07-2026

### Added
- **Brazilian Portuguese (pt-BR) translation**: full Brazilian Portuguese localisation covering all 536 UI strings and the native OS menu, with Brazilian conventions throughout (3-letter month/day abbreviations `Jan`–`Dez` / `Dom`–`Sáb`, gerund in `-ando`/`-endo`, "você" form). Selectable from Preferences → General → Language.

### Fixed
- **AppImage GLIBC compatibility with Debian 12 (bookworm)** (TODO-0051): the Linux release build ran on `ubuntu-latest` (resolves to Ubuntu 24.04, glibc 2.39), so the AppImage refused to launch on any distro with an older glibc, including Debian 12 bookworm (glibc 2.36). The Linux leg of `.github/workflows/release.yml` now builds on `ubuntu-22.04` (glibc 2.35), so the AppImage now runs on Debian 12 and other distros with glibc ≥2.35, previously ≥2.38/2.39.

### Internal
- **Replaced deprecated `navigator.platform`** (TODO-0049): `getLinkOpenShortcutLabel()` (link tooltip's "Cmd+Click"/"Ctrl+Click" text) now prefers `navigator.userAgentData.platform`, falling back to `navigator.platform` for WebViews that don't support the newer API. Added a minimal ambient `Navigator.userAgentData` type in `src/vite-env.d.ts` (not present in the project's TypeScript DOM lib) and unit test coverage for both APIs and their precedence. No behavioral change.
- **Refactored `apply-dependency-prs` runbook** into a triage router + per-ecosystem procedures. `ENTRY.md` is now a short triage document that dispatches to `procedures/npm.md`, `procedures/cargo.md`, and `procedures/actions.md` based on PR labels → `headRefName` prefix → file paths. The previously-pending TODO-0050-01 Part 2 (Nix `npmDepsHash` refresh step) is included in the new `procedures/npm.md`.
- **Text styling export coverage audit** (TODO-0044): added backend tests confirming every inline text style (bold, italic, underline, strikethrough, code, highlight, text color, timestamp mark) round-trips through JSON, Markdown, and Print/PDF export. JSON/PDF were already lossless; Markdown's "strip tag, keep text" fallback for styles with no Markdown equivalent is unchanged, now with adjacent-delimiter regression tests verified against `marked`. Tightened `website/docs-src/05-export.md` to list exactly what converts vs. is dropped.
- **Fixed a time-dependent test in `notifications.test.ts`**: two tests used fixed dates against the module's 90-day staleness cutoff, which compares to the real wall-clock date, so they broke as time passed. Now pins system time via `vi.useFakeTimers()`/`vi.setSystemTime()`.


## [0.6.0] - 27-06-2026

### Added
- **Timeline view** ([#161](https://github.com/fjrevoredo/mini-diarium/issues/161)): a chronological list of every entry, newest-first, that complements the calendar with a flat `date | title + 200-char preview` overview. Open it from the new header toggle (List ⇄ PenLine, `timeline-toggle-button` testid); clicking a row jumps straight to that entry in the editor. The list re-fetches automatically when entries are added or removed, so it stays in sync without a manual refresh. Previews are generated server-side by `preview_from_html` (strips HTML tags, decodes common entities, collapses whitespace, truncates to 200 chars). Only `{ id, date, title, preview }` crosses the IPC boundary; the full decrypted entry body never leaves the backend, consistent with the project's field-level encryption model. The component ships with localized strings, empty/untitled fallbacks, a `<Suspense>` loading state, and Vitest coverage for row-click navigation. Contributed by [@kenlacroix](https://github.com/kenlacroix) via [#173](https://github.com/fjrevoredo/mini-diarium/pull/173).
- **Full-text search** (TODO-0053): search across every entry in the current journal via a palette-style overlay, opened from the header search button or Ctrl/Cmd+F. Search is case- and accent-insensitive with AND semantics, returns newest-first results with highlighted snippets, and clicking a result opens that exact entry in the editor (deep-linking works even on days with multiple entries). The overlay displays a result count ("12 results found"); when results exceed 200, a truncation notice prompts refinement ("Showing first 200..."). Keyboard navigation is supported: ArrowDown/ArrowUp navigate results, and ArrowDown from the search input focuses the first result. Privacy: each query decrypts entries in memory and discards them, so nothing searchable is ever written to disk, and no plaintext index exists. Promoted both the Rust `#[cfg(feature="experimental")]` gate and the frontend `VITE_EXPERIMENTAL` guard to production in the same PR. Backend `search_entries` command contributed by [@kenlacroix](https://github.com/kenlacroix) via [#171](https://github.com/fjrevoredo/mini-diarium/pull/171) (addressing [#160](https://github.com/fjrevoredo/mini-diarium/issues/160)); this change wires it into the app shell and ships it to all users.
- **Nix flake packaging**: Mini Diarium can now be built and installed directly from this repository on NixOS and any Linux system with Nix Flakes enabled (`x86_64-linux`, `aarch64-linux`). Supports three integration styles: bare package, NixOS module (`programs.mini-diarium.enable = true`), and Home Manager module. An overlay (`overlays.default`) is also exported for custom configurations. Try it without installing with `nix run github:fjrevoredo/mini-diarium`. Contributed by [@tyler274](https://github.com/tyler274) via [#159](https://github.com/fjrevoredo/mini-diarium/pull/159) (integrated manually).

### Internal
- **Local Codecov patch-coverage mirror**: added `scripts/check-diff-coverage.mjs`, a dependency-free Node gate that consumes the same lcov files CI uploads (`coverage/lcov.info` + `src-tauri/lcov.info`), diffs them against `origin/master`, and fails when patch coverage on new/changed lines drops below 80% (matching `codecov.yml`). This closes the gap where Vitest's global thresholds pass locally but Codecov's patch check fails on CI, so uncovered new lines are now listed as `file:line` before pushing. Wired into `bun run pre-commit` as step 9 (via `--working-tree`, so it checks not-yet-committed changes); the frontend step now runs `test:coverage` and the backend step runs `cargo llvm-cov nextest` when `cargo-llvm-cov` is installed (falls back to plain `cargo test` otherwise). Standalone commands: `bun run coverage:diff` (gate), `coverage:check` (generate + gate), `coverage:self-test` (parser regression guard).
- **Accent-insensitive search** (TODO-0060): the experimental `search_entries` command now folds Unicode accents in addition to case, so a query for "cafe" matches "Café". A shared `fold_char` helper (lowercase → NFD decompose → drop combining marks) is applied to both query terms and searched text, and the snippet byte-offset map still points each folded byte at its source char so highlighted snippets slice the original accented text. Added behind the `experimental` feature via an optional `unicode-normalization` dependency that compiles out of production builds.
- **Search frontend test coverage** (TODO-0059): added Vitest coverage for the search plumbing that shipped untested in [#171](https://github.com/fjrevoredo/mini-diarium/pull/171) while the UI is still unmounted: the monotonic `searchSeq` latest-wins guard in `SearchBar` (stale resolve and stale rejection must not clobber a newer query), and the `selectedEntryId` deep-link branches in `EditorPanel` (open the requested entry, fall back to the day's newest when absent, navigate within the already-open date, and no-op a cross-date target).
- **Split `src/lib/tauri.ts` into a `src/lib/tauri/` directory** (TODO-0057): the 510-line frontend Tauri-command wrapper file (10 lines over the 500-line hard limit for Tauri boundary files) is now one sub-file per command category (`auth`, `journals`, `entries`, `search`, `navigation`, `statistics`, `export`, `plugins`, `files`, `debug`, `menu`, `fonts`, `tags`, `images`), re-exported from a barrel `index.ts`. With `moduleResolution: "bundler"`, all 41 importers resolve unchanged, and no import-site edits are needed. Each sub-file is well under the 350-line soft limit.
- **Schema v12: encrypted timeline previews**: added `preview_enc BLOB` (nullable, AES-256-GCM) to the `entries` table; `insert_entry` and `update_entry` now store an encrypted 200-character plaintext preview (HTML-stripped, entity-decoded) using a dedicated `"entry_preview"` key context. `get_entries_for_timeline` reads only `title_encrypted` and `preview_enc` per row; a `CASE WHEN preview_enc IS NOT NULL THEN NULL ELSE text_encrypted END` expression avoids transferring full entry bodies from SQLite on every timeline open. Legacy entries (`preview_enc IS NULL`) fall back to full-text decryption until the next save.
- **Timeline test coverage**: added `scripts/**` to vitest `test.exclude` and `coverage.exclude` (fixes `bun run test:coverage` failing due to `node:test` in `sync-skills.js`); added `Timeline` component tests for the entry-click navigation handler and the untitled-title fallback branch.
- **Testid doc**: recorded `timeline-toggle-button` in the canonical `data-testid` attribute table in `src/CLAUDE.md`.
- **Auto-formatting pre-commit hook** (TODO-0058): a Git pre-commit hook (`.githooks/pre-commit`) now runs Prettier on staged `src/**/*.{ts,tsx,css}` files and `cargo fmt` on staged `src-tauri/**/*.rs` files before every commit, so style violations never reach the repository. The hook auto-installs on `bun install` via the `postinstall` lifecycle (sets `core.hooksPath .githooks`); it is scoped to staged files only (typical <2s), skips silently when no relevant files are staged, and can be bypassed with `git commit --no-verify`. CI continues to use the existing read-only `format:check` / `cargo fmt --check` gates.

### Fixed
- **Locale-aware font family sort**: font family names are now sorted with `localeCompare` instead of the default Unicode code-point order, which produced incorrect results for non-ASCII family names.
- **Keyboard accessibility for link tooltip**: the link tooltip in the editor now appears and disappears on keyboard focus and blur in addition to mouse hover, making hyperlink previews reachable without a pointer device.
- **Flatpak manifest script validates commit SHA**: `flatpak/rewrite-manifest.py` now rejects any `COMMIT` argument that is not a 40-character lowercase hex SHA before writing it to the manifest file.
- **Duplicate editor extension warning**: the rich-text editor no longer registers `@tiptap/extension-underline` separately. TipTap StarterKit v3 already bundles the Underline extension, so the standalone registration produced a `Duplicate extension names found: ['underline']` console warning on every editor mount. Underline functionality is unchanged.
- **Editor focus crash on lock/unlock**: fixed an unhandled `TypeError: null is not an object (evaluating 'this.commandManager.commands')` that could fire when locking and unlocking the journal in quick succession. The auto-focus effect schedules a `requestAnimationFrame`, but a lock could destroy the editor before that frame ran; the callback now re-checks that the editor is still alive (and still the current instance) before calling `focus()`. The title-bar Enter handler got the same `isDestroyed` guard. Contributed by [@bronty13](https://github.com/bronty13) via [#148](https://github.com/fjrevoredo/mini-diarium/pull/148) (integrated manually).

## [0.5.4] - 17-06-2026

### Added
- **Print / PDF export**: journal entries can now be exported as a PDF file directly from the app. In the Export dialog, select **Print / PDF** from the format dropdown and optionally filter by date range or month; clicking **Print** opens a native save dialog and writes a formatted PDF to the chosen path. Output is A4 portrait with 2 cm margins, entries grouped by date with titles, tags, and full formatted content including images.
    - **Page breaks**: each page break is placed at natural blank rows so text lines are never cut in half, and images stay intact without splitting across page boundaries.
    - **Default filename**: the save dialog suggests `mini-diarium-export-YYYY-MM-DD_HH-MM.pdf` instead of a plain `mini-diarium-export.pdf`.

### Fixed
- **Bullet and numbered lists now display markers in the editor**: the Tailwind CSS reset (`list-style: none`) was stripping bullet dots and ordinal numbers from all list elements. The editor stylesheet now explicitly restores `list-style-type: disc` for unordered lists and `list-style-type: decimal` for ordered lists inside the ProseMirror container. Most noticeable on Linux where the WebKit renderer enforces the reset strictly (issue #163).
- **Export dialog state clears when reopened**: error and success messages now reset whenever the dialog becomes visible, so reopening after a failed or successful export always shows a clean state.

### Internal
- **PDF export uses jsPDF + html2canvas in-browser**; two new Tauri commands (`print_entries` generates HTML, `write_pdf_file` writes bytes to disk); print styles are applied programmatically so html2canvas captures the correct layout; page-boundary detection scans html2canvas's raster output for blank rows (TODO-0012).
- **PDF export: print layer no longer flashes during generation**: the temporary render div (`#mini-diarium-print-layer`) is now created with `visibility: hidden`, hiding it from users while keeping it in the render tree so html2canvas can capture it. The html2canvas clone restores `visibility: visible` via `prepareClone`.

## [0.5.3] - 05-06-2026

### Added
- **Image deduplication**: images are now stored once in a content-addressed encrypted store inside `diary.db` and referenced by ID. Inserting the same image into multiple entries shares one encrypted copy. All export paths (JSON, Markdown, Rhai plugins) resolve image references back to data URLs before exporting, preserving full compatibility. Legacy entries that still embed data URLs continue to display and export correctly; existing saved entries migrate on their next save, and Mini Diarium JSON imports now normalize embedded `data:image/...` content into the encrypted image store during import.
- **"Insert existing image" media picker**: browse and reuse any image previously saved in the journal through a visual thumbnail picker with sort, month filter, preview metadata, load-more pagination, explicit Insert action, and double-click insertion. The picker loads encrypted thumbnail summaries first and decrypts full image data only for the image being inserted. Inserted images are reused verbatim (no canvas re-encode), ensuring the stored copy is deduplicated correctly.

### Changed
- `save_entry` now extracts embedded data-URL images atomically into the image store on each save, reducing stored entry size for entries with images. All writes (image extraction, link update, entry text rewrite) are committed in a single database transaction.

### Internal
- Schema v10: added `images` and `entry_images` tables for content-addressed encrypted image storage.
- Enabled `PRAGMA foreign_keys = ON` on all database connections (fixes silently-inert `ON DELETE CASCADE` on `entry_tags` and `entry_images`).
- **Website docs**: Improved meta descriptions on all 11 docs pages to 150–160 characters to resolve Bing Webmaster Tools flags (TODO-0045)
- **Website docs**: Widened docs content column from ~500px to ~800px on desktop viewports by increasing the docs-page container max-width to 1400px (TODO-0047)
- **Website**: Documented local Docker dev workflow in `website/CLAUDE.md` with build, serve, troubleshooting steps, and Host header note (TODO-0048)
- **Website**: Added visual content audit decision table to `website/CLAUDE.md` recording which docs pages need screenshots (TODO-0047)

- **Three-level font system**: control entry fonts at three levels simultaneously: app-wide defaults (Preferences → Writing → Editor font), per-entry defaults (new "Set as entry default" / "Clear entry default" toolbar buttons next to the font dropdown), and inline formatting applied to selected text via the toolbar font dropdowns. Entries with font metadata export to JSON with a `"metadata": {"fontFamily": "...", "fontSize": 18.0}` object. The JSON importer handles both old (Mini Diary date-keyed) and new (array format with optional metadata) export formats for backward compatibility. Schema v9: new nullable `entry_metadata_encrypted BLOB` column stores encrypted entry metadata (font family/size) per entry.
- **Named links in the editor**: insert a hyperlink with custom display text via the toolbar Insert Link button (or `Ctrl/Cmd+K`). The visible label and the URL are independent: with no selection, the URL becomes the label; with a selection, the selected text becomes the label. `Ctrl/Cmd`-click opens a link in the system browser. Links round-trip through Markdown export as `[label](url)`, through JSON export as raw HTML, and are preserved by user Rhai export plugins via the `html_to_markdown` host function.

### Changed
- **Link dialog now has a Display text field**: you can override the visible label of a link directly in the dialog (instead of the URL always being the label). Bare domains like `example.com` are auto-prefixed with `https://`, email addresses become `mailto:` links, and phone numbers become `tel:` links. The dialog also includes an "Open link" button so you can verify a URL before applying it.
- **Editor toolbar font controls apply inline formatting**: the font family and font size dropdowns in the toolbar now apply inline marks to the selected text, instead of changing the global preference. Preferences still controls the app-wide defaults that appear when an entry has no entry default and no inline formatting on the selection.

### Fixed
- **External link opening now enforces safe protocols consistently**: editor link opening paths now normalize and allow only `http`, `https`, `mailto`, and `tel` targets. Unsafe stored or imported protocols are ignored instead of being passed to the opener plugin.

## [0.5.2] - 29-05-2026

### Added
- **Custom font upload**: users can now upload their own `.ttf`, `.otf`, `.woff`, or `.woff2` font files from **Preferences → Advanced → Custom fonts** and use them as the editor font. Regular and Bold weights are uploaded separately; if only a Regular is provided, the browser synthesizes bold text and a warning is shown in the preferences list. Custom fonts are stored as blobs inside the journal (`diary.db`) so they travel to other devices automatically. Deleting the currently selected custom font reverts the editor to System Default immediately. Schema bumped to v8 (`custom_fonts` table).
- **Hindi (हिन्दी) translation**: the app UI is now fully translated into Hindi, covering all 456 strings across every screen — auth, editor, preferences, import/export, stats, tags, onboarding, and error messages. The native OS menu bar (Navigation, Diary, File, Help) is also translated when Hindi is selected in Preferences → General → Language.

### Changed
- **Preferences lifecycle**: the Preferences dialog is now close-only (no Save/Cancel footer). Reversible settings apply immediately across General, Writing, and Security auto-lock controls. Theme Overrides moved to **Preferences → Advanced** and now auto-apply as soon as JSON is valid; invalid JSON stays local with an inline error while the last valid saved overrides remain active. Explicit actions (password/auth operations, journal reset/move, debug dump export, and custom-font upload/delete) remain button-driven.
- **About dialog link styling**: the GitHub and Documentation links are now pill-style buttons (icon + label, rounded border) and the "Show Welcome Tour" shortcut is a ghost button with a Compass icon, replacing the bare underlined text links.

### Fixed
- **Editor placeholder updates on locale switch**: the body placeholder ("What's on your mind today?") now updates immediately and reliably when changing the language in Preferences, including when switching back to a previously used locale.

## [0.5.1] - 27-05-2026

### Removed
- **Windows installer outbound firewall rule**: removed the NSIS post-install hook that added a Windows Firewall block rule for `mini-diarium.exe`. The rule covered only the main Rust process, not WebView2 subprocess traffic, so it provided no meaningful additional isolation on top of the existing WebView-layer defenses (CSP, `WebResourceRequested` COM handler, init script, `on_navigation`). The hook was triggering a false-positive `Validation-Defender-Error` in winget's validation pipeline.

## [0.5.0] - 24-05-2026

### Added
- **IndexNow integration for the marketing website**: all public URLs are now automatically submitted to Bing, Yandex, Seznam, and other participating search engines via the IndexNow protocol. A new `scripts/submit-indexnow.mjs` script reads the sitemap and submits URLs in bulk. A GitHub Actions workflow (`.github/workflows/indexnow.yml`) enables manual submission after deployment, with an automatic push trigger ready to be enabled once Coolify auto-deployment is configured. Run `bun run website:submit-indexnow` to submit, or `bun run website:submit-indexnow:dry-run` to preview the payload.

### Security
- **Multi-auth duplicate-credential fix**: `unlock_diary_all_methods` previously accepted the same credential twice, allowing a single factor to satisfy both slots in a require-all-auth setup. The backend now rejects duplicate slot IDs so each registered factor must be provided independently.
- **Error message sanitization**: several dialogs (import, statistics, journal picker, security preferences, password creation) were displaying raw internal error strings that could leak filesystem paths or library internals. All user-facing error messages are now sanitized before display.
- **Network isolation hardening**: added defense-in-depth layers to prevent outbound network use from within the WebView. Layers added: explicit `connect-src 'self' ipc: http://ipc.localhost` CSP directive; `worker-src 'none'`, `child-src 'none'`, `frame-src 'none'`, `object-src 'none'`, `form-action 'none'`, `manifest-src 'none'` CSP directives; document-start init script nulling `RTCPeerConnection`, `WebTransport`, `Worker`, `SharedWorker`, `navigator.serviceWorker`, `navigator.sendBeacon`, `navigator.connection`, and `window.open` in all frames; `on_new_window(Deny)` handler blocking popup creation on all platforms; Windows WebView2 `WebResourceRequested` COM handler; macOS `WKContentRuleList` content-blocking rule; Windows installer outbound firewall rule (NSIS, `perMachine`); removed `devtools` Cargo feature from release builds; added CI static check for network-capable crates and APIs. (`fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource` remain available for IPC/local runtime communication and are constrained by CSP + platform handlers.)

### Added
- **Tags for diary entries**: entries can now be tagged with user-defined labels. A row of tag chips appears below the title in the editor. Click `+ Add tag` to type a new tag or pick an existing one from the dropdown; click `×` on a chip to remove it. Tags are managed globally via **Manage tags** → rename or delete any tag across all entries. Tag names are encrypted with AES-256-GCM (the same key as entry content) so they are never stored as readable text in the database. A keyed HKDF-SHA256 fingerprint enforces deduplication at the database level. Existing journals are automatically migrated to schema v7 on next unlock.
    - **Tag filter**: click a tag chip's name to activate a tag filter — the calendar in the sidebar narrows its dot indicators to only show dates that have entries with that tag. A banner above the calendar names the active filter and provides a `×` to clear it. Clicking the same chip again also clears it. The filter persists across month navigation and is automatically cleared on journal lock or when the filtered tag is deleted.
- **First-run onboarding tour**: creating a new journal now triggers a 3-step transparent overlay tour that highlights key features — enabling the advanced toolbar (Preferences → Writing), importing entries from other apps, and finding the online documentation. The tour can be minimized to a floating help icon (`?`) in the bottom-right corner; clicking the icon shows a popover with **Resume Tour** and **Dismiss** options. Pressing Escape while the tour is active minimizes it instead of quitting the app. The tour fires only once per app profile and is permanently dismissed via the popover or by completing all three steps; subsequent launches render nothing.
    - **Spotlight anchoring**: each tour step now highlights its real target element — the editor toolbar strip and the About button in the header are spotlit via a `box-shadow` cutout with the card dynamically positioned adjacent and an arrow pointing at the target; for native OS elements outside the webview (such as Import in the menu bar) a soft pulsing glow appears at the webview edge nearest the item.
- **Cross-application image drag-and-drop**: dragging images from desktop apps that embed them as HTML payloads now works, extending the existing file-manager and clipboard-paste paths. Two payload types are handled: apps that inline images as `data:image/...` base64 sources (some Electron apps), and apps that reference images as local `file://` paths (e.g. Typora with file-linked images). All dropped images pass through the same canvas resize pipeline (max 1200 px, re-encoded as JPEG or PNG). The editor container shows a blue border highlight when a file-manager drag hovers over it. When an image is dragged from a web browser or web app (where the drag payload only contains an HTTPS URL), a dismissible banner explains that embedding is not possible because it would require a network request — which the app never makes — and directs the user to use **right-click → Copy Image** and paste instead.

### Changed
- **Unlock/lock transition animations**: unlocking the journal now reveals the main view through a blur-dissolve effect (encrypted fog lifting over ~1.4 s); locking plays the reverse — a blur fades in over the content for ~700 ms while the backend closes the database, then the lock screen appears. Both animations respect `prefers-reduced-motion`. The lock animation blocks pointer interaction during the transition; all security operations (save flush, database close) run on the same schedule as before — the timing change is cosmetic only.
- **Internal refactoring**: a large structured pass across the Rust backend and SolidJS frontend. No user-facing behavior changes; all encryption and auth guarantees are preserved.
    - **Backend**: the database query, schema/migration, and auth-command layers were each split into focused modules. Encrypted row decoding and the locked-state guard are now centralized, so failures surface as errors instead of being silently swallowed. The password, key-file, and multi-auth unlock paths share a single auditable implementation; the local-only auto-unlock path remains intentionally separate.
    - **Frontend**: the security preferences panel and the rich-text editor were each broken into smaller, independently testable components.
    - **Test coverage**: command-level, security-preference, and editor-integration tests were added across both layers; a CI check now enforces the error-sanitization rule going forward.
- **Sticky editor toolbar**: the formatting toolbar now stays pinned at the top of the scroll area while scrolling through a long entry, so formatting controls remain accessible at all times without scrolling back to the top. When multiple entries are stacked (multiple entries per day), each toolbar independently sticks as its entry scrolls through the viewport.
- **Central plugins directory**: user `.rhai` plugins now live in `{app_data_dir}/plugins/` (e.g. `%APPDATA%\com.minidiarium\plugins\` on Windows) instead of the per-journal `{journal_path}/plugins/` folder. Plugins are shared across all journals and loaded once at startup. On first launch after upgrading, any `.rhai` scripts found in the old per-journal locations are automatically copied to the new central directory (originals are left in place).
- **Font family and font size in editor toolbar**: the editor font family and font size can now be changed directly from the editor toolbar without opening Preferences. Both controls appear as compact dropdown selectors and are opt-in — enable them in Preferences → Writing → Toolbar items (**Font family** and **Font size** are added at the bottom of every user's item list, disabled by default). Existing users with a saved toolbar configuration automatically get the new items appended. The dropdowns write directly to the saved preference, so the value is always in sync with the Preferences → Writing sliders and selects.
- **Per-item toolbar configuration**: the all-or-nothing **Show advanced formatting toolbar** toggle in Preferences → Writing has been replaced with a fully configurable **Toolbar items** list. Each of the 15 formatting controls (Headings, Underline, Strikethrough, Text color, Highlight color, Blockquote, Inline code, Bullet list, Numbered list, Horizontal rule, Insert image, Import Markdown, Insert timestamp, Text direction, Alignment controls) can be individually enabled or disabled, and reordered with ↑/↓ arrows. **Select all** and **Select none** buttons enable quick bulk actions. Bold and Italic remain fixed at the start of the toolbar and are not configurable. Existing users are migrated automatically: `advancedToolbar: false` keeps Underline, Bullet list, and Numbered list enabled (matching the previous basic toolbar); `advancedToolbar: true` enables all 15 items.

## [0.4.22] - 13-05-2026

### Added
- **Amiri and Tajawal bundled fonts**: two new open-source font families with Arabic script support are now bundled — Amiri (classic Arabic serif) and Tajawal (modern Arabic sans-serif), each with Regular and Bold weights. Both are SIL Open Font License 1.1. The editor font family dropdown now includes these alongside the existing 5 font families.

### Changed
- **Journal picker scroll limit**: the journal list in the picker is now capped at ~5 visible items with a vertical scrollbar appearing for additional journals, preventing the picker card from growing beyond the viewport. The "Your Journals" heading stays fixed above the scrollable list.
- **Open Existing Journal uses a file picker**: instead of picking a folder and requiring a `diary.db` file inside it, the "Open Existing" flow now opens a file dialog filtered to `.db` files so the user selects the database file directly. The DB filename (no longer hardcoded to `diary.db`) is stored in `JournalConfig.db_filename`, and backups are namespaced under `backups/{stem}/` so co-located journals don't share a backup pool. Updated `selectFolderTitle`, `noJournalFound`, and `chooseFolderTitle` to file-oriented text in all five locales.
- **Word-count performance optimization**: replaced the two-pass Rust `strip_html_tags` + `split_whitespace()` with a zero-allocation single-pass state machine; optimized TypeScript `countWordsFromText` and `countWordsInHtml` to use `match(/\S+/g)` instead of `split().filter()`, eliminating intermediate array allocations. Word-count now runs in sub-microsecond time for both plain text and TipTap HTML paths.

## [0.4.21] - 09-05-2026

### Added
- **Text color and highlight color formatting**: the advanced formatting toolbar now includes two color picker buttons — one for text color and one for highlight (background) color. Both use a native color picker that lets you choose any color. The text color button shows the active color as a small bar beneath the `Type` icon; the highlight button shows the active highlight color beneath the `Highlighter` icon. Old default `<mark>` highlights (pre-existing entries without an explicit color) continue to render as colored text for backward compatibility. New `textColor` and `highlightColor` i18n keys added to all five locales (en, es, fr, de, it).
- **Export date/month filter**: you can now export entries from a specific date range or a single month instead of always exporting everything. A new filter dropdown in the export dialog offers "All entries", "Date range", and "Single month" options.
- **Auto-focus editor on unlock**: the TipTap editor now receives focus automatically after the journal is unlocked so the user can start typing immediately. Focus fires once per unlock session — it does not re-fire on date navigation, entry switching, or save cycles. Re-locking and re-unlocking resets the behavior.
- **French (`fr`) locale**: full 387-key French translation with proper month/day abbreviations and plural forms.

### Fixed
- **Bundled fonts not working in macOS/Windows release builds**: the editor font family selector was stuck on "System Default" because `installed_font_dir()` hardcoded platform paths without accounting for Tauri v2's `..` → `_up_` path translation during bundling. Replaced `installed_font_dir()` and `font_directory()` with a single `resolve_font_dir()` that uses `app.path().resolve("../fonts", BaseDirectory::Resource)` for platform-agnostic resource resolution. Added 20 backend tests covering font discovery, MIME detection, and family/stem name mapping.

### Changed
- **Underline is now always visible**: the Underline button has moved from the advanced formatting toolbar (gated behind **Preferences → Writing → Show advanced formatting toolbar**) to the basic toolbar, where it appears alongside Bold and Italic for all users regardless of the advanced-toolbar preference.
- **Preferences overlay responsive sizing**: the Preferences dialog now scales its width and height with the viewport instead of using fixed dimensions. Width grows from `max-w-2xl` on small screens to `max-w-3xl` on medium screens and `max-w-4xl` on large screens; the scrollable content panel height increases from `55vh` to `75vh` across the same breakpoints. The content panel also gains symmetric horizontal padding (`px-6`) so form inputs no longer press against the right dialog edge.


## [0.4.20] - 06-05-2026

### Added
- **RTL/LTR toggle button in the editor toolbar**: a new paragraph-direction toggle button (pilcrow icon with directional arrow) is now available in the advanced formatting toolbar, placed before the alignment controls. The icon dynamically shows `PilcrowRight` when the current block is LTR (click to switch to RTL) and `PilcrowLeft` when RTL (click to switch to LTR), matching the convention used by Google Docs and LibreOffice. The button reuses the same `setTextDirection` command as the existing `Ctrl+Shift+D` / `Cmd+Shift+D` keyboard shortcut. New `textDirection` / `textDirectionTitle` i18n keys are added to all four locales.
- **Multi-entry number navigation bar**: the entry counter (`1 / 3`) has been replaced with clickable number buttons (`← 1 2 3 →`) that jump directly to the chosen entry. The current entry is highlighted in bold with an `aria-current="true"` attribute for screen readers. The prev/next arrows retain their existing step-by-step behaviour. A `goToEntry` aria-label key is added to all four locales.
- **Insert timestamp in the editor**: a new clock button in the advanced formatting toolbar opens a popup that lets you choose between 12-hour and 24-hour format, pick hours:minutes or hours:minutes:seconds precision, and insert the current time at the cursor position. Both selections are remembered across sessions.
- **Editor font selection**: a new "Editor font" dropdown in Preferences → Writing lets you choose from five bundled open-source font families (Noto Sans, Source Sans 3, Noto Serif, JetBrains Mono, Fira Mono). Fonts are loaded on-demand as base64 data URLs and applied to the TipTap editor only. The selection is persisted as the `editorFontFamily` preference and works fully offline — no network requests, no OS-level font enumeration.

### Fixed
- **`unicode-bidi: plaintext` CSS overrides `dir` attribute on paragraphs and headings**: the `plaintext` value in the editor CSS forced the browser to always auto-detect text direction from content, silently overriding any explicit `dir` attribute set by the RTL toggle button or `Ctrl+Shift+D` shortcut. The `unicode-bidi` override has been removed from both paragraph and heading rules, allowing the `dir` HTML attribute to control direction natively while the existing `BidiExtension` auto-detection plugin still sets `dir` on new blocks.
- **`bump-version` scripts now inject metainfo.xml release entry**: `bump-version.sh` and `bump-version.ps1` both prepend a `<release version="X.Y.Z">` element to the AppStream metainfo file during version bumps. The `.sh` script was also made portable to BSD/macOS sed. The pre-release checklist now validates the metainfo version as a fifth consistency check.

### Security
- **Multi-auth requirement can no longer be bypassed by re-adding a journal**: the "Require All Authentication Methods" setting was previously stored in `config.json`. Removing a journal from the list and re-adding the same database file produced a fresh config entry with the flag absent, allowing a single-credential unlock even when multi-auth was required. The flag is now stored inside `diary.db` itself (new `db_settings` table, schema v6), so it stays with the database file regardless of what happens to the config. Existing journals are migrated automatically on the first unlock after updating.
- **Multi-auth requirement MAC integrity**: the `require_all_auth` flag stored in `db_settings` inside `diary.db` was vulnerable to plaintext SQLite tampering — deleting or modifying the row would bypass the guard and allow single-credential unlock. The flag is now bound to the master key via HKDF-SHA256 MAC (computed as `HKDF-SHA256(IKM=master_key, salt=None, info="mini-diarium:require_all_auth:v1")` and stored as a 64-char hex string under the `require_all_auth_mac` key). A fail-safe ensures any tampering (absent, malformed, or mismatched MAC) enforces the guard. Existing journals are self-healed on the first successful all-methods unlock — no user action required. No schema migration; no new dependencies.


## [0.4.19] - 27-04-2026

### Added
- **Mandatory multi-auth unlock setting**: journals can now require all configured authentication methods simultaneously at unlock time. A "Require All Authentication Methods" toggle in Preferences → Security (hidden for auto-protected journals and when fewer than two non-auto methods are registered) writes a `require_all_auth` flag to `config.json`. When active, `unlock_diary` and `unlock_diary_with_keypair` are blocked with a clear error; a new `unlock_diary_all_methods` backend command opens the DB with the first credential and verifies every remaining credential against the already-open connection before committing the session — no crypto changes, no schema migration. The lock screen switches to a combined password + key-file form for affected journals. Removing a non-auto auth method while the flag is active is blocked until the flag is disabled first.
- **RTL text direction persistence**: the TipTap editor now writes an explicit `dir` attribute (`dir="ltr"` or `dir="rtl"`) into the stored HTML of each paragraph and heading block so text direction is preserved through save, export, and re-open cycles. Direction is auto-detected from the first strongly-directional Unicode character in each block (Arabic, Hebrew, Syriac → RTL; Basic Latin / Latin Extended → LTR); once set, the `dir` attribute is never overwritten automatically, preserving manual overrides. A new `Ctrl+Shift+D` / `Cmd+Shift+D` keyboard shortcut toggles the current block between RTL and LTR explicitly. Existing entries without a `dir` attribute are handled by the `dir="auto"` container fallback and gain an explicit attribute on the next edit. Implementation uses a custom `BidiExtension` built on `@tiptap/pm/state` (`Plugin`/`PluginKey` already installed) and TipTap's built-in `setTextDirection` command — no new npm dependency.

### Fixed
- **German locale regression**: German (`de`) was accidentally dropped from both the frontend locale map and the native menu translation table when Italian was added, causing all UI strings and native menus to silently fall back to English for users with German selected. Both wiring points are restored.
- **Stale password requirement after password slot removal**: after removing the password auth slot (while retaining one or more keypair slots), `register_keypair` and `remove_auth_method` would fail with "No password auth method found". Both commands now gate the password requirement on whether a password slot actually exists — if none is present, being unlocked is sufficient (the same model used by `register_password`). Master key wrapping in `register_keypair` now always uses the session key (`db.key().as_bytes()`) rather than re-deriving it via the password slot. The "Change Password" section and the current-password field in "Add Key File" are now hidden in the Security preferences when no password slot exists.
- **RTL paragraph alignment toolbar active state**: the alignment toolbar previously always showed Left as the active button when no explicit `text-align` style was set on the current block, even for RTL paragraphs that the browser renders right-aligned. Clicking Left would silently write `style="text-align: left"`, overriding `dir="rtl"` and corrupting layout. The active-state logic now reads the `dir` attribute of the current paragraph or heading: when `dir="rtl"` is set and no explicit `text-align` override is present, Right is shown as the active alignment, matching the browser's actual rendering. Explicit `text-align: left` on an RTL block continues to show Left as active.
- **Test discovery picking up reference repos**: cloning `tiptap` and `tiptap-docs` into `.reference/` caused Vitest to discover and attempt to run the upstream test suites. Added `.reference/**` to the `exclude` list in `vitest.config.ts`.
- **Language list sync script**: `bun run sync-languages` (`scripts/sync-languages.ts`) reads `AVAILABLE_LOCALES` from `src/i18n/locales/index.ts` as the single source of truth and rewrites HTML-comment-delimited regions in `README.md` (markdown bullet list) and `website/index.html` (plain-text `<p>` sentence) so the supported-language list stays in sync without manual edits. The script is idempotent, exits 1 if any marker is missing (CI-safe), and is wired into both `docs/TRANSLATIONS.md` (new step 5 between validate and open-PR) and the pre-release checklist in `docs/RELEASING.md`. The stale "English only" sentence in `README.md` is replaced with the current four-language list.

### Changed
- **PHILOSOPHY.md test counts updated to v0.4.19**: The implementation guide (Part II) had stale numbers from v0.4.14. Updated to reflect the current test suite: backend 276 tests across 32 modules (was 265/30), frontend 229 tests across 22 files (was ~161/17+), Markdown export 38 tests (was 12), state modules 8 (was 6). Known-gap statement narrowed — auth screens and NotificationsOverlay now have partial coverage.
- **`EditorPanel.tsx` refactored into three custom hooks**: the 675-LOC component became a 308-LOC shell plus three focused hooks under `src/components/layout/editor-panel/`. `useEditorEmptyCheck` owns the `editorIsEmpty` signal and the `editorHasImages` / `computeIsEmpty` helpers. `useEntryLifecycle` owns the `loadRequestId` / `saveRequestId` / `pendingCreationPromise` / `justCreatedEntryId` refs, the 500 ms debounced save, and the journal-lock cleanup callback. `useMultiEntryNav` owns the per-day navigation (prev/next/add/delete) and exports `fetchEntriesOrdered`. The three pre-existing logic-mock tests were renamed to match, and a new `EditorPanel.integration.test.tsx` adds four flow-level tests (load-then-type, switch-day-while-unsaved, delete-empty-on-nav, create-on-first-keystroke) driving the component through a minimal TipTap shim. Behaviour is unchanged — same races guarded, same debounce, same edge cases. See `docs/wip/TECHNICAL_REVIEW_PLAN_2026-04.md` M6.


## [0.4.18] - 19-04-2026

### Fixed
- **Flathub CI: missing metainfo release entries**: `bump-version.sh` silently failed to prepend `<release>` entries to `data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml` on Windows because the file had CRLF line endings and the `sed` pattern didn't match. v0.4.16 and v0.4.17 entries are backfilled; `bump-version.sh` now strips `\r` before substituting; `.gitattributes` enforces `eol=lf` for `data/linux/*.xml` and `*.desktop` going forward.
- **WinGet CI: fork sync failure**: `wingetcreate submit` failed with "forked repository could not be synced" when the `fjrevoredo/winget-pkgs` fork had drifted behind upstream. The publish workflow now calls the GitHub API to sync the fork before submitting, preventing this recurring failure.


## [0.4.17] - 19-04-2026

### Added
- **In-app notification center**: Bell icon in the header surfaces bundled release notes and announcements without any network access. Notifications ship as `public/notifications.json` with each release. Unread entries show a badge counter; users can mark individual notifications read or dismiss all at once. Read state persists to `localStorage`. Entries older than 90 days are auto-dismissed. Links open in the system browser via `@tauri-apps/plugin-opener`.
- **Italian translation**: Full Italian (`it`) localisation contributed by the community (#96). Covers all UI strings and the native OS menu.
- **Custom benchmark report page**: Replaces the auto-generated `github-action-benchmark` index with a hand-crafted `benchmarks/index.html` served from gh-pages. The new page groups all 18 benchmarks into four labelled sections (Auth Security, Cryptography, Database, Word Count), gives each benchmark a human title, a what/why description, and an interpretation callout explaining what "good" and "bad" results look like. Each card shows the latest timing value and a Chart.js line trend chart over the last 30 CI runs. Supports automatic dark/light mode via `prefers-color-scheme`. The CI workflow now copies the file to gh-pages after every benchmark run.
- **`db_delete_entry` benchmark**: New criterion benchmark in `db_bench.rs` covering the hard-delete-by-id path (`DELETE FROM entries WHERE id = ?`). Uses `iter_batched` so each iteration gets a fresh database with a pre-inserted entry. This was the only common DB operation without a benchmark.

### Changed
- **Docs layout and navigation redesign**: The documentation site (`mini-diarium.com/docs/`) moves from a flat two-column layout to a modern three-column experience. The left sidebar now groups pages under labelled sections (Basics, Discovery, Your Data, Settings & More, Help) and is always visible without a `<details>` disclosure wrapper. A right-hand "On this page" TOC is generated from each page's h2/h3 headings and highlights the active heading as you scroll (Intersection Observer). On screens narrower than 900 px the sidebar collapses to a slide-in drawer toggled by a hamburger button; the TOC hides below 1 100 px. The docs hub index page is reorganised to match the same groupings, with emoji category icons and a "Jump in: Getting Started →" CTA. All SEO metadata, canonical URLs, and structured data are unchanged.


## [0.4.16] - 17-04-2026

### Added
- **Website documentation section**: User guide is now published as a structured, per-section documentation area at `mini-diarium.com/docs/`. Each of the 11 feature sections has its own page with sidebar navigation, breadcrumbs, prev/next links, and section-level SEO. Built from Markdown sources in `website/docs-src/` via a new `generate-website-docs.mjs` script integrated into the `website:build-static` pipeline.
- **In-app docs link**: About dialog now includes a "Documentation" button linking to `mini-diarium.com/docs/`.

### Changed
- **CI diagram staleness check restored**: `scripts/verify-diagrams.mjs` was previously reverted to an existence-only check because `mmdc` (Puppeteer/Chrome) produces slightly different SVG bytes on different OSes even with the same tool version, making byte comparison impossible across platforms. The script now uses a source-hash approach: `bun run diagrams` writes `docs/diagrams/.source-hashes.json` with SHA-256 hashes of every `.mmd` and `.d2` source file after rendering; `diagrams:check` recomputes those hashes at CI time and fails if any source has changed since the last render — no SVG byte comparison needed, no re-rendering in CI. Supporting changes: `@mermaid-js/mermaid-cli` pinned to an exact version in `devDependencies` (caret removed); `.gitattributes` added to force LF on `docs/diagrams/*.svg`.


## [0.4.15] - 04-04-2026

### Added
- **Local-only (device-protected) journals**: A new optional protection mode when creating a journal. Instead of a user-chosen password, the app generates a random 32-byte key at creation time, stores it in `config.json` (the OS-managed app data directory), and uses it to auto-unlock on every open — no password prompt. Entries remain AES-256-GCM encrypted; the key is simply app-managed rather than user-managed. **Security guarantee:** protects against copying only the `diary.db` file (e.g. from a cloud folder or external drive) to another machine, but does not protect against someone with access to the user's OS account. The risk is explained and must be explicitly acknowledged (checkbox) before creation. Existing password/keypair journals are entirely unchanged.
    - New `create_diary_auto` / `unlock_diary_auto` Tauri commands backed by a new `AutoKeyMethod` auth slot type (`auth_slots.type = 'auto'`); no KDF is applied (the key is already 32 bytes of random entropy).
    - The `list_journals` and `add_journal` commands now return a `JournalInfo` DTO with `auto_protected: bool` instead of the raw `JournalConfig` — the auto key never crosses the IPC boundary.
    - On app startup, journals with `auto_protected = true` are unlocked silently without showing the lock screen. If locked by idle timeout or OS screen lock, `PasswordPrompt` auto-retries on mount.
    - Upgrading to password protection uses the existing `register_password` + `remove_auth_method` flow; removing the auto slot also clears its key from `config.json`.
    - UI: mode toggle (Password / Local-only) in `PasswordCreation`; warning block with three risk bullet-points and a required acknowledgment checkbox; new i18n keys in English, German, and Spanish.

### Fixed
- **Paste/drop image-only entries silently lost on journal close (issue #84)**: pasting or drag-dropping an image onto a blank day never persisted the entry, and an entry whose only content was one or more images was auto-deleted by the debounced save. Root cause: three `isEmpty` guards in `EditorPanel.tsx` used `editor.getText().trim() === ''` — TipTap's `getText()` ignores image leaf nodes and always returns `''` for image-only content, making all three guards treat the entry as empty. Fixed by adding an `editorHasImages()` helper that walks the ProseMirror document tree; an entry is now only considered empty when `editor.isEmpty` is true *and* no image nodes are present. The fix covers all three affected paths: (1) the blank-day entry-creation gate (image pastes on a fresh date now correctly trigger entry creation), (2) the `editorIsEmpty` reactive signal (the "+" button state is correct for image-only entries), and (3) the `saveCurrentById` auto-delete check (image-only entries are no longer deleted by the 500 ms debounce).


## [0.4.14] - 29-03-2026

### Added
- **Benchmarking infrastructure**: Rust criterion benchmarks for AES-256-GCM cipher operations, encrypted SQLite queries, and word-count; frontend Vitest bench for Markdown parsing; CI benchmark workflow tracks trends on each merge to master; `benchmarks/CLAUDE.md` domain guide.
- **Markdown file import into current entry**: A new "Import Markdown file" button in the advanced formatting toolbar (next to Insert Image) allows importing a `.md` file from disk into the active editor. When the current entry is empty the imported content replaces it; when the entry already has content the Markdown is appended after a horizontal-rule separator. `marked` (GFM mode) handles Markdown-to-HTML conversion on the frontend; `DOMPurify` sanitizes the output via the `postprocess` hook before it reaches TipTap. File size is capped at 1 MB; import errors surface as a dismissible banner in the editor footer.
- **i18n / Translation support**: All ~220 hardcoded English UI strings are extracted into a typed locale file (`src/i18n/locales/en.ts`) using `@solid-primitives/i18n`. The system is designed for community-contributed translations — add a JSON file to `src/i18n/locales/` and run `bun run validate:locales` to check completeness. See `docs/TRANSLATIONS.md` for the full translator guide covering interpolation syntax, plural key pairs, and PR instructions.
    - **Language selector in Preferences**: A Language dropdown is now available in Preferences → General. The locale is stored in user preferences and applied reactively at runtime (no restart needed).
    - **Spanish (Español) translation**: full translation of all UI strings into Spanish (`src/i18n/locales/es.json`). Select "Español" in Preferences → General → Language.
    - **Native OS menu i18n**: The native app menu (Navigation, Diary, and all items within) now updates to the selected language in real time without an app restart. A new `update_menu_locale` Tauri command stores all translatable `MenuItem` and `Submenu` handles in a `TranslatableMenuItems` managed-state struct and calls `set_text()` on each. Adding a new community locale requires adding its ~15 menu strings to the match block in `src-tauri/src/commands/menu.rs` alongside the JSON locale file.
- **Flatpak / Flathub distribution**: The release process is extended to automatically publish Mini Diarium to Flathub on each release. A new `flathub-publish.yml` workflow generates offline-vendored Cargo and Node source lists, patches the Flatpak manifest with the release tag and commit SHA, and opens a PR against the Flathub repository. The Flatpak manifest (`flatpak/com.minidiarium.yml`) builds via `npm ci --offline` → `npm run build` → `cargo build --release`, bypassing the Tauri CLI so Bun is not required in the sandbox. Desktop entry, AppStream metainfo, and icon installs are all included. One-time manual setup (screenshots, local manifest test, initial Flathub submission PR) is documented in `docs/RELEASING.md`.

### Fixed
- **Word count live updates and HTML-awareness**: two bugs corrected. (1) The word counter now updates on every keystroke — `handleContentUpdate` calls `setWordCount(countWordsFromText(editor.getText()))` on each TipTap transaction so the counter reflects the current document without requiring a save. (2) Load-time word count calculations previously split raw HTML with a whitespace regex, inflating the count to thousands of "words" for entries containing embedded base64 images. All four calculation sites in `EditorPanel.tsx` now use a new `countWordsInHtml` helper (`src/lib/wordcount.ts`) that strips all HTML tags (including `<img src="data:…">` in full) before splitting — consistent with the backend `count_words` / `strip_html_tags` implementation. `editor.getText()` (TipTap's own plain-text extractor) is used for the live path; `countWordsInHtml` is used as a fallback and for all load-time sites.
- **Entry-not-saved race on fresh date**: typing on a date with no prior entries and locking the journal before the `createEntry` IPC call returned would leave the entry blank after unlock. Two windows existed: (1) `pendingEntryId` was still `null` when the cleanup callback fired so the normal save path was skipped entirely; (2) `createEntry` returned and `setPendingEntryId` was set but the 500 ms debounce hadn't fired before `debouncedSave.cancel()` was called. Fixed by extracting a shared `startEntryCreation` helper that stores the in-flight Promise in a `pendingCreationPromise` ref, and updating the `registerCleanupCallback` to await that Promise and call `saveEntry` directly — with the DB still open — before returning. Ghost entries created during the race with no real content are cleaned up via `deleteEntryIfEmpty`.
- **Auto-delete race on newly created blank entry**: clicking "+" and typing within 500 ms could delete the just-created entry before the first keystroke was saved. The race: `addEntry()` cancels the old debounce synchronously, but DiaryEditor's `createEffect` (which calls `onSetContent(isEmpty=true)`) runs as a SolidJS microtask at the following `await getAllEntryDates()` — after `cancel()` has already returned. `onSetContent` then re-queued a fresh 500 ms debounce that was never cancelled, racing against the user's first input. Fixed with a `justCreatedEntryId` mutable ref set in `addEntry()` after the new entry's ID is known; the `onSetContent` callback skips queuing the auto-delete debounce when the active entry ID matches. The ref is cleared on first real user input (`handleContentUpdate` or `handleTitleInput`). Blank entries loaded from the DB (e.g. on navigation or date switch-back) are unaffected — `justCreatedEntryId` is null for those paths and the auto-delete debounce fires normally.

### Changed
- **Benchmarks revised to cover actual hot paths**: added `db_update_entry` (the real auto-save path replacing `db_insert_entry` as primary write bench), `db_get_all_entry_dates` at 100 and 500 entries, `auth_argon2` group for Argon2id wrap/unwrap (the unlock path, `sample_size(10)`); scaled `db_get_all` corpus to 500 entries alongside 100; replaced synthetic word-count input with realistic TipTap HTML; added context comments to `cipher_bench`.


## [0.4.13] - 25-03-2026

### Added

- **Markdown export image handling**: embedded base64 images are no longer silently stripped on export. Two new export options appear in the Export dialog:
    - **Markdown** (`builtin:markdown`) extracts images to a sibling `assets/` folder and replaces `<img>` tags with relative `![Image N](assets/image-N.ext)` references — compatible with Obsidian, Typora, and VS Code
    - **Markdown (inline images)** (`builtin:markdown-inline`) embeds images as `![Image N](data:image/TYPE;base64,…)` data URIs for single-file portability in editors that support them
    - Backend test count: 249 → 265


## [0.4.11] - 24-03-2026

### Fixed

- **Text alignment lost after calendar navigation — final fix (issue #63)**: two independent bugs were responsible. *(1) Visual rendering (root cause)*: Tauri automatically injects a random `'nonce-...'` into all CSP directives at runtime; per the CSP spec a nonce in `style-src` causes `'unsafe-inline'` to be ignored, so TipTap's `style="text-align: center"` attributes were silently blocked by the browser every time alignment was applied or loaded — the data was saved correctly, only the rendering was stripped. Fixed by `"dangerousDisableAssetCspModification": ["style-src"]` in `tauri.conf.json`, preventing nonce injection into `style-src` while leaving `script-src` nonce-protected for Tauri's internal use. *(2) Save loss*: navigating from Day A to Day B with a pre-existing blank entry caused `onSetContent(isEmpty=true)` to call `debouncedSave()` with Day B's blank args, resetting the 500 ms timer and discarding any pending save for Day A. Fixed by flushing the current entry (cancel + immediate `saveCurrentById`) at the start of `loadEntriesForDate` before loading the new date; all signal reads use `untrack()` to prevent reactive loop. Additionally hardened all five save paths to read from `editor.getHTML()` directly rather than the SolidJS `content()` signal.


## [0.4.9] - 23-03-2026

### Fixed

- **Text alignment lost after calendar navigation (issue #63)**: alignment (justify, center, right) applied to an entry was permanently overwritten after navigating away and returning. Root cause: TipTap v3 changed `setContent`'s `emitUpdate` default from `false` (v2) to `true`, causing the programmatic content load in DiaryEditor's `createEffect` to fire `onUpdate`, which queued a debounced save with un-aligned HTML from the production bundle's intermediate `getHTML()` state. Fixed by passing `{ emitUpdate: false }` to suppress `onUpdate` for programmatic loads; a new `onSetContent` callback from DiaryEditor to EditorPanel (1) updates the `editorIsEmpty` reactive signal so the "add entry" button state stays correct, and (2) re-triggers `debouncedSave` for blank entries (preserving the auto-deletion-on-navigation behaviour that previously ran through the now-suppressed `onUpdate` path). Signal reads in the callback use `untrack()` to avoid adding spurious reactive dependencies to DiaryEditor's effect.
- **E2E layout white gap above auth screens**: three-part fix. (1) In E2E mode the Tauri window now sets its size to `800×660` *before* `win.show()` (in `lib.rs` setup) — previously the window opened at the production default (`800×780`). (2) All screen-filling containers (`JournalPicker`, `PasswordCreation`, `PasswordPrompt`, `App` loading state, `MainLayout`) now use `h-full` (height: 100% via the `html → body → #root` chain) instead of `h-screen`/`min-h-screen` (`100vh`), which may include the native app menu bar height in WebView2 on Windows. (3) Removed `browser.setWindowSize(800, 660)` from the `wdio.conf.ts` `before` hook — WebDriver `setWindowRect` is a post-render resize that uses a different window-size measurement than Tauri's `LogicalSize`, causing a second resize after CSS `100vh`/`height:100%` were already computed and re-introducing the layout mismatch.
- **"+" button stuck disabled after multi-entry navigation (two variants)**: fixed two related bugs where the "Add entry for this day" button became permanently disabled on a day with real content.
  - *Variant 1 (navigation arrow)*: clicking "+", getting a blank second entry, then navigating back via "←" left the "+" permanently disabled. Root cause: SolidJS re-evaluated `addDisabled` when `setPendingEntryId()` changed, but TipTap had not yet processed the loaded entry's content, so `editor.isEmpty` was stale. Fixed by adding an `editorIsEmpty` reactive signal updated in `handleContentUpdate` (called by TipTap's `onUpdate`), forcing re-evaluation after TipTap reflects the correct state.
  - *Variant 2 (day switch)*: same setup, but switching to a different day instead of using the arrow, then switching back, also blocked the "+". Root cause: the blank entry's debounced auto-delete (500 ms) called `setPendingEntryId(null)` and left the editor showing stale blank content even though the original real entry still existed. Fixed by having `saveCurrentById` auto-navigate to the nearest remaining entry after deleting a blank entry, so `pendingEntryId` is never left as `null` while real entries still exist on the day.

### Added

- **Multi-entry E2E tests**: new `e2e/specs/multi-entry.spec.ts` covering (A) multi-entry persistence after lock/unlock, (B) "+" recovery after backward navigation (v0.4.9 Variant 1 regression), and (C) "+" recovery after day switch with blank entry (v0.4.9 Variant 2 regression). `data-testid` attributes added to `EntryNavBar` (`entry-nav-bar`, `entry-prev-button`, `entry-counter`, `entry-next-button`, `entry-delete-button`, `entry-add-button`) to support reliable E2E selectors.
- **Backend assessment follow-up** (Task 71): addressed all actionable findings from the March 2026 assessment. Two code quality fixes: `delete_entry` unlock guard now uses the consistent "Journal must be unlocked to …" error message (A1); `#[allow(dead_code)]` suppressions in `jrnl.rs` now carry "why" comments on the attribute line per project convention (A2). Ten new backend tests added: `delete_entry` command logic (A3), `navigate_to_today` valid-date assertion (A4), `update_slot_last_used` NULL→non-null column check (A5), import/export plugin "not found" error message format (A6), `MAX_IMPORT_FILE_SIZE` boundary (A7), and isolated v3→v4 and v4→v5 migration tests (A8). Comments added to `migrate_v3_to_v4` and `migrate_v4_to_v5` explaining why no pre-migration backup is taken (A9). Backend test count: 239 → 249.
- **Backend architectural assessment** ( temporarely stored at `docs/BACKEND_ASSESSMENT_2026-03.md`): full health-check of all 42 Rust source files covering architecture alignment, code quality, security posture, and test coverage.
- **Known issues document** (`docs/KNOWN_ISSUES.md`): comprehensive reference for all known limitations, deliberate tradeoffs, and technical debt — organized for both users (KI-1 to KI-9) and developers (AT-1 to AT-12, TD-1 to TD-5). Replaces the single-bullet entry in README.md.
- **Journal name on unlock screen**: the unlock screen now shows the name of the selected journal ("Unlock *My Journal*") instead of the generic "Unlock your journal" subtitle. Falls back to the generic text when no journal name is available.
- **Accessibility improvements**: comprehensive ARIA audit and fixes across the app. Editor toolbar now has `role="toolbar"` and `aria-pressed` on all toggle buttons (bold, italic, lists, alignment, etc.). Error and success message regions across all overlays and auth screens now carry `role="alert"` / `role="status"` for automatic screen-reader announcement. Loading spinners use `aria-busy` and `aria-hidden`. Calendar grid now exposes full WCAG `role="grid"` / `role="row"` / `role="gridcell"` / `role="columnheader"` semantics with `aria-selected`, `aria-current="date"`, and descriptive `aria-label` on each day button; arrow-key navigation (←→ day, ↑↓ week, Home/End month, PageUp/PageDown month) added so the calendar is fully keyboard-operable. Preferences dialog tabs now implement the ARIA tab pattern (`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby`) with Left/Right arrow key switching. Hamburger button gains `aria-expanded` and `aria-controls`. Mobile sidebar overlay gains focus trapping and focus restoration. Journal picker list uses `<ul>`/`<li>` semantics. Password strength indicator announces changes via `aria-live="polite"`.


## [0.4.8] - 18-03-2026

### Changed

- **Vite 8 upgrade**: bumped `vite` from 7.3.1 → 8.0.0 and `jsdom` from 28.1.0 → 29.0.0. Converted `manualChunks` in `vite.config.ts` from object to function form, as required by Vite 8's rolldown bundler. Vendor chunk output (`vendor-solid`, `vendor-tiptap`, `vendor-ui`) is unchanged.
- **Image alignment**: alignment controls now apply to images as well as text blocks, using a container model that makes future block types (tables, etc.) trivially alignable without per-node workarounds. Each image is wrapped in a `<figure class="image-container">` element; `TextAlign` sets `text-align` on the container and the inner `<img>` responds as `display: inline-block`. Existing bare `<img>` entries load correctly via a parse fallback (no migration needed).


## [0.4.7] — 15-03-2026

### Added

- **Editor alignment controls**: paragraphs and headings can now be aligned **left**, **center**, **right**, or **justified** using four new toolbar buttons. The controls live in the advanced toolbar (requires **Preferences → Writing → Show advanced formatting toolbar**). Alignment is stored as an inline `style="text-align: …"` attribute on the block element so it round-trips cleanly through save/load. Existing entries with no alignment metadata continue to render exactly as before. JSON export preserves the stored HTML unchanged; Markdown export degrades alignment gracefully without dropping content. Closes [#54](https://github.com/fjrevoredo/mini-diarium/issues/54).
- **Entry timestamps**: the editor can now show the `date_created` and `date_updated` timestamps for the current entry below the title, formatted using the OS locale. Opt-in via **Preferences → Writing → Show entry timestamps** (disabled by default). The updated timestamp is only shown when it differs from the created timestamp. Both timestamps are hidden when "Hide Titles" is enabled.
- **Theme overrides (advanced)**: advanced users can now override individual theme color tokens. Open **Preferences → General → Theme Overrides**, enter a JSON object with `light` and/or `dark` keys mapping CSS variable names (`--bg-primary`, `--text-primary`, etc.) to values, then click **Apply Overrides**. Overrides persist in `localStorage` and are layered on top of the active built-in theme automatically at startup. The documented token contract (`--bg-*`, `--text-*`, `--border-*`, `--interactive-*`, `--btn-*`, `--editor-*`, `--status-*`, `--spinner-color`, `--overlay-bg`, `--shadow-*`) is supported; unknown tokens are silently ignored. **Reset to Default** removes all overrides immediately. `auto` theme resolution continues to work correctly with overrides applied on top of the resolved light/dark theme.

### Fixed

- **Dark mode editor body text too dark**: two layered issues caused editor body text to appear dark-on-dark in dark mode. (1) `--editor-body-text` in the `.dark` token set was hardcoded to `#e5e7eb` (gray-200) instead of `var(--text-primary)` (`#f9fafb`); the token now follows `--text-primary` consistently in both themes. (2) The `color` rule was declared on `.ProseMirror` (single-class specificity), which lost to `@tailwindcss/typography`'s `.prose` rule injected later in the stylesheet. The `color` declaration has been moved to `.ProseMirror.journal-editor-content` (double-class specificity), exactly as was already done for `font-size` for the same reason.
- **Heading-style dropdown focus ring in editor toolbar**: the text-style `<select>` was using the raw palette class `focus:ring-blue-500` instead of the semantic `focus:ring-[var(--border-focus)]` token introduced during theme hardening.

### Changed

- **Theme system hardening**: all raw palette classes (`bg-blue-600`, `bg-red-600`, `border-blue-600`, `text-blue-500`, `text-red-500`, etc.) have been replaced with semantic CSS variable tokens and utility classes across 13 component files and `src/styles/editor.css`. New tokens added to `src/index.css`: `--btn-primary-*`, `--btn-destructive-*`, `--btn-active-*`, `--spinner-color` (button/spinner family), and `--editor-*` (editor content family). New utility classes: `.interactive-primary`, `.interactive-destructive`, `.text-destructive`, `.btn-active`, `.spinner-border`, `.text-interactive`, `.bg-interactive`. `editor.css` now uses only CSS variables with no `.dark`-specific override blocks. This task establishes the stable token contract for future user theme overrides (Task 69).


## [0.4.6] — 08-03-2026

### Added

- **Automatic WinGet publishing**: every published release now automatically submits a WinGet manifest update to the community repository (`microsoft/winget-pkgs`), opening a pull request for the new version. The workflow triggers on `release.published` events (not drafts), handles the `vX.Y.Z` tag format by stripping the `v` prefix, verifies the Windows asset `Mini-Diarium-{VERSION}-windows.exe` exists, and uses `wingetcreate.exe --submit` to auto-submit the PR. Users can install/upgrade via `winget install fjrevoredo.MiniDiarium` and `winget upgrade fjrevoredo.MiniDiarium`. Requires the `WINGET_TOKEN` repository secret to be configured.

### Fixed

- **Dark theme form-control contrast on Linux**: text inside password fields, plain text inputs, and native `<select>` dropdowns is now always readable in dark mode regardless of the active GTK theme. Added `color-scheme: light` / `color-scheme: dark` to `:root` / `.dark` so WebKit/GTK respects the app's color scheme for native form-control rendering. Added a zero-specificity `:where()` baseline that sets `background-color: var(--bg-primary)` and `color: var(--text-primary)` on all non-checkbox/radio/range/file inputs, selects, and textareas — any UnoCSS utility class (`bg-primary`, `bg-tertiary`, `disabled:bg-tertiary`, etc.) overrides it. Auth-screen password inputs in `PasswordPrompt` and `PasswordCreation` now carry explicit `bg-primary` classes. Fixes [#48](https://github.com/fjrevoredo/mini-diarium/issues/48).
- **About dialog now accessible from the native menu at any auth state**: the `AboutOverlay` and its `menu-about` listener have been lifted from `MainLayout` (unlocked-only) up to `App` (always mounted). Help → About Mini Diarium now opens correctly from the journal picker, password prompt, and creation screens — not just when the journal is unlocked.
- **E2E: title persistence assertion now waits for async DB load**: replaced `waitForDisplayed` + immediate `getValue` with a `waitUntil` poll, preventing a race between the WebDriver assertion and the async `loadEntriesForDate` round-trip to the backend.
- **Backup rotation limit reduced from 50 to 30**: the `MAX_BACKUPS` constant has been lowered and a new test `test_backup_and_rotate_repeated_unlocks()` verifies that repeated unlock operations never allow the backup count to exceed the configured cap. All test assertions now use the constant instead of hardcoded values.


## [0.4.5] — 06-03-2026

### Added

- **Advanced tab in Preferences** with a "Generate Debug Dump" button — exports a privacy-safe JSON diagnostic file (app version, OS/platform, schema version, entry counts, auth method types, backup count, plugin count, preferences); no entry content, passwords, or key material is ever included
- **Month/year picker in calendar header**: clicking the month/year label in the sidebar calendar now toggles an inline month picker. The calendar body switches to a 3×4 month grid with year-step arrows; selecting a month jumps directly to that month and closes the picker. The currently displayed month is highlighted in the grid. No new dependencies. (#43)
- **Delete entry button for multi-entry days**: a "−" button now appears next to the "+" button in the entry navigator when a day has more than one entry. Clicking "−" opens a confirmation dialog ("Delete Entry" — "Are you sure you want to delete this entry?") and, if confirmed, deletes the currently selected entry and navigates to the next available entry for the same day (staying at the same index, clamping to bounds if the last entry was deleted). The button is only visible when the day has multiple entries and is disabled while an entry is being created. (#43)

### Changed

- **Unified user-facing terminology to "Journal"**: all UI text, error messages, and documentation now consistently use "Journal" instead of the mixed "diary"/"journal" wording; internal Tauri command names and filesystem identifiers (`diary.db`) are preserved for compatibility (issue #46)
- **Auto-select last-used journal on startup**: the app now skips the Journal Picker when a previously used journal is known (`active_journal_id` set in config). `initializeAuth()` calls `refreshAuthState()` directly and transitions to the password prompt (or unlocked state if already unlocked). The Journal Picker is shown only on a fresh install or when no active journal is configured. (#43)
- **Reduced password minimum length to 1 character:** the 8-character minimum has been removed. Passwords must be non-empty; a visual strength indicator now guides users with feedback on weak/medium/strong passwords. Very weak passwords show an additional warning banner with recommendations. This aligns with the cryptographic reality that Argon2id protects any password length, while giving users control over their security tradeoffs. (#43)
- **Website SEO/GEO follow-up pass (2026-03-06)**: replaced the 4.5 MB hero GIF with compressed MP4/WebM demo media plus a poster image, switched the stylesheet to inline-critical + non-blocking loading, updated title/description metadata for search intent, replaced the social preview SVG with a PNG, changed the hero download CTAs to distinct Windows/macOS/Linux direct installer links with ARIA labels, added apex-canonical redirect/cache parity to the nginx reference config, and documented post-release Search Console/IndexNow/Cloudflare ops in the release guide.

### Fixed

- **Window position flash on startup**: the main window no longer flashes at the default position before jumping to the saved position. The window is now created hidden (`"visible": false` in `tauri.conf.json`) and shown explicitly after `tauri-plugin-window-state` has restored the saved bounds. (#43)
- **"+" add-entry button**: the button to create an additional entry for the same day now correctly guards against concurrent calls using a reactive signal. The button is disabled while creation is in flight, preventing duplicate entries from rapid clicks. Errors are no longer silently swallowed. (#43)
- **"Go to today" calendar button**: clicking the calendar icon in the sidebar now correctly navigates the calendar month view. A `createEffect` in `Calendar.tsx` watches `selectedDate` and syncs `currentMonth` whenever the selected date falls outside the currently displayed month — fixing all month-navigation cases including "go to today", go-to-date overlay, and day/month menu navigation. (#43)
- **Clicking adjacent-month days in calendar**: days from the previous or next month shown in the calendar grid are now clickable. The `isCurrentMonth` guard has been removed from `handleDayClick` and the `disabled` attribute; only future dates (when the preference is off) remain disabled. (#43)
- **Sidebar header border alignment**: the sidebar title bar and the main header bar now share the same rendered height (64 px). Previously the sidebar's text-only header was 12 px shorter than the main header whose icon buttons set the height, causing the bottom borders to visually misalign. (#43)
- **"Go to today" button alignment**: the button in the sidebar was right-aligned (`justify-end`) while the calendar below it is left-aligned. Changed to `justify-start` so the button aligns with the calendar's left edge. (#43)
- **Settings tab active state on light theme**: the active tab in Preferences used hardcoded Tailwind classes (`bg-blue-100 text-blue-700`) that could render with low contrast. Replaced with CSS-variable classes (`bg-active text-primary`) that correctly follow the current theme in both light and dark mode. (#43)
- **Editor placeholder showing "Loading…"**: TipTap's placeholder extension showed "Loading…" whenever the editor was empty during an async entry load, which could flicker on fast navigations. Placeholders are now always static ("Title (optional)" / "What's on your mind today?"). (#43)
- **Calendar month navigation broken by reactive loop**: clicking the previous/next month buttons had no effect because the `createEffect` that syncs `currentMonth` to `selectedDate` was also reading `currentMonth()` as a reactive dependency — causing it to immediately reset the month back. Fixed by using `untrack(currentMonth)` so the effect only re-runs when `selectedDate` changes.
- **"+" button creates spurious entry on empty day**: pressing "+" when no content existed would create and immediately delete an empty entry (visible briefly as a dot in the calendar). The button is now disabled unless the current entry has body content. Contextual tooltip text explains why the button is disabled ("Write something first to add another entry for this day") or what it does when enabled ("Add another entry for this day").
- **New entry auto-deleted 500 ms after creation**: after creating a new entry via "+", `setContent('')` caused TipTap to fire `onUpdate` synchronously with empty content, scheduling a debounced save that would delete the blank entry. An explicit `debouncedSave.cancel()` now runs immediately after state is reset to prevent this.
- **Multi-entry day counter order**: entries for a day are now displayed in chronological order (oldest = 1/N, newest = N/N). Previously the backend's newest-first ordering made the counter confusingly start at 1 for the most-recent entry. New entries created via "+" always land at position N/N. Opening a multi-entry day now navigates to the newest entry (N/N) instead of the oldest.
- **Empty entries persist on lock/switch**: empty entries created with the "+" button now correctly delete themselves when the diary is locked or when switching journals without adding content. Previously, the empty entry would remain in the database until the user navigated to a different entry. The fix implements a pre-lock event pattern that ensures `saveCurrentById()` (which deletes empty entries) is called before the database is locked, covering all lock paths (manual button, OS session lock, and journal switching).

## [0.4.4] — 03-03-2026

### Added

- **Text highlight formatting** in the advanced editor toolbar (`Ctrl/Cmd+Shift+H`). Highlighted text is rendered with a yellow background (theme-safe in light and dark mode). HTML `<mark>` tags are preserved in storage and JSON export; Markdown export strips the tags and keeps the text. (#41)
- **Embedded images in the editor**: images can now be inserted into diary entries via drag-and-drop, clipboard paste (Ctrl/Cmd+V), or the new "Insert image" button in the advanced toolbar. Images are resized client-side (max 1200 × 1200 px, JPEG 85% quality) before embedding as base64 data URIs in the encrypted entry HTML. Plaintext never touches disk. Note: JSON/Markdown exports will include the full base64 strings and may be large for entries with many images. (#40)
- **Configurable editor font size** (12–24 px) in Preferences → Writing (#30)

## [0.4.3] — 01-03-2026

### Added

- **Expanded rich text toolbar**: heading selector (Normal / H1 / H2 / H3), Underline, Strikethrough, Blockquote, Inline Code, and Horizontal Rule buttons added to the editor toolbar. Markdown export now correctly converts strikethrough (`~~`), blockquotes (`>`), inline code (`` ` ``), and fenced code blocks (` ``` `).
- **Minimal toolbar by default**: a new **Show advanced formatting toolbar** preference (Preferences → Writing) controls whether the extended toolbar controls are visible. The default is off — the toolbar shows only Bold, Italic, Bullet List, and Ordered List. Toggling the setting on reveals the full toolbar (headings, Underline, Strikethrough, Blockquote, Inline Code, Horizontal Rule) immediately without restarting. Rendering of existing content and import/export behavior are unaffected by this setting.
- **Configurable auto-lock timeout**: a new **Auto-Lock** section in Preferences → Security lets you enable automatic locking after a period of inactivity. When enabled, any mouse movement, key press, click, touch, or scroll resets the idle timer; the diary locks automatically once the timeout (1–999 seconds, default 300) expires with no activity. The setting is stored in `localStorage` and takes effect immediately without restarting.
- **Auto-lock on macOS screen lock**: the diary now auto-locks when the display sleeps, the system enters sleep, or the user explicitly locks the screen (Cmd+Ctrl+Q / Apple menu → Lock Screen) on macOS. Uses `NSWorkspaceScreensDidSleepNotification`, `NSWorkspaceWillSleepNotification`, and `com.apple.screenIsLocked` via `NSDistributedNotificationCenter`.
- **Multiple entries per day**: each diary day can now hold any number of independent entries. A `←` / `→` navigation bar appears above the editor when a day has more than one entry, showing the current position (e.g. `2 / 3`). A `+` button on the right side of the bar creates a new blank entry for the same date. Single-entry days look and behave exactly as before — the navigation bar is hidden.
- **Entry identity**: each entry now carries a stable `INTEGER PRIMARY KEY AUTOINCREMENT` id. Saves, deletes, and exports all reference entries by id rather than by date.

### Changed

- **Database schema bumped to v5**: the `entries` table gains an `id INTEGER PRIMARY KEY AUTOINCREMENT` column; the old `date TEXT PRIMARY KEY` unique constraint is replaced by a non-unique `idx_entries_date` index. Existing databases are migrated automatically on first launch (entries are preserved in date-creation order).
- **Import no longer merges same-date entries**: previously, importing a file with entries that matched an existing date would merge the content. Imports now always create a new entry, consistent with the multiple-entries-per-day model. The `entries_merged` field has been removed from the import result.
- **JSON export format changed to an array**: the exported JSON file now contains an `"entries"` array (each object includes an `"id"` field) instead of a date-keyed object. This format can represent multiple entries per day correctly. The `"metadata"` wrapper (`application`, `version`, `exportedAt`) is unchanged.
- **Markdown export groups multiple entries per day**: when a day has more than one entry, each entry appears as a `### Entry N` sub-heading (or `### {title}` if the entry has a title) under the day's `## YYYY-MM-DD` heading.

### Fixed

- **Streak calculation now counts distinct days**: with multiple entries per date, the statistics streak algorithm now deduplicates dates before computing streaks, ensuring one active day is counted once regardless of how many entries it contains.

## [0.4.2] — 28-02-2026

### Added

- **Journal Picker as the outermost app layer**: the app now opens to a **Journal Picker** screen before any diary authentication. The picker lists all configured journals and lets you open, rename, or remove any of them without authenticating first. You can also create a new diary (picks a folder, names it, then goes to password creation) or open an existing `diary.db` from any folder — both flows that were previously fragmented across the first-launch screen and Preferences > Journals. On a shared device, each person can select their own diary without having to step through someone else's lock screen.
- **"← Back to Journals" link** on both `PasswordCreation` and `PasswordPrompt` screens, letting users navigate back to the journal picker without locking or restarting the app.
- **Removing the last journal is now allowed**: the backend no longer blocks removal of the sole remaining journal; the picker simply shows the empty state with the two Add buttons so the user can configure a new one.

### Changed

- **Journal management moved to the Journal Picker**: the **Journals** tab has been removed from Preferences. All journal operations (add, rename, remove, open) are available on the pre-auth picker screen. Auth methods, password changes, and data settings remain in their respective Preferences tabs unchanged.
- **Auth flow**: `initializeAuth()` now always routes to `'journal-select'` on startup (instead of probing the diary path immediately); `refreshAuthState()` is called only after the user selects a journal. This eliminates the single-user assumption baked into the previous startup sequence.
- **Release build profile**: added `[profile.release]` with `opt-level = 3` and `lto = true` to `Cargo.toml` for smaller, faster distribution binaries.
- **Website SEO/GEO refresh (2026)**: upgraded metadata and machine-readable signals for search and AI retrieval. Added robots snippet controls, richer Open Graph/Twitter tags (`og:site_name`, `og:locale`, image dimensions, account attribution), expanded JSON-LD graph (`SoftwareApplication` + `Organization` + `WebSite` + `FAQPage` with `softwareVersion`/`dateModified`), added extraction-friendly **Quick facts** + **FAQ** sections, introduced a dedicated **Release status** block with explicit last-updated date, replaced placeholder `href="#"` links, updated sitemap to use `<lastmod>`, and added a lightweight social preview asset (`website/assets/og-cover.svg`).
- **Website compatibility and cache hardening (2026-02-26)**: added a broader favicon set (`favicon.ico`, 16/32/128 PNG, `apple-touch-icon`), published `ai-crawlers.txt` and `llms.txt` with footer/README discoverability, and introduced content-hash fingerprinting for website CSS/JS (`website:fingerprint`) so nginx can safely keep `immutable` only for hashed assets while unfingerprinted files use short TTL caching.

## [0.4.1] — 25-02-2026

### Added

- **ESC key can now quit the app** (#25): a new "ESC key action" preference (General tab) lets you choose between _Do nothing_ (default, unchanged behaviour) and _Quit the app_. When set to Quit, pressing Escape anywhere on the main screen closes the application — identical to clicking the title-bar X button, so the autosave `beforeunload` handler fires normally. The shortcut is suppressed whenever any dialog is open, so Escape still dismisses overlays as before.
- **Preferences panel reorganised into tabs**: the single long-scroll preferences dialog is now a sidebar-tab layout with five tabs — **General** (theme, ESC action), **Writing** (calendar and editor options), **Journals** (journal management), **Security** (auth methods, change password), and **Data** (diary path, move location, reset). Writing and Security tabs are grayed out and non-clickable while the diary is locked.
- **Sidebar starts collapsed on launch and unlock** (#24): the app now opens directly to today's entry without the calendar panel obscuring the editor. The sidebar can still be toggled via the menu button. After locking and unlocking, the view resets to today's entry with the sidebar closed.
- **Window size and position are remembered between sessions** (#26): the app restores the window dimensions and position from the previous session. First launch still uses the default 800×660 px. Powered by `tauri-plugin-window-state`.
- **Official user-plugin example and guides**: added `docs/user-plugins/plain-text-timeline.rhai` as a reference Rhai export plugin, plus dedicated built-in/user plugin guides for requirements, testing, and best practices.

### Changed

- **Plugin documentation structure simplified**: user plugin documentation and canonical example now live together in `docs/user-plugins/` for discoverability; README now links to this area from a dedicated **Extending Mini Diarium** section.
- **E2E test isolation hardened**: `bun run test:e2e` now runs in deterministic clean-room mode (isolated diary data, isolated WebView profile on Windows, fixed 800×660 viewport, and backend window-state persistence disabled via `MINI_DIARIUM_E2E=1`), with `bun run test:e2e:stateful` available for persistence-focused checks in a repo-local state directory.

## [0.4.0] - 25-02-2026

### Added

- **Extension system for import/export formats**: built-in formats (Mini Diary JSON, Day One JSON, Day One TXT, jrnl JSON, JSON export, Markdown export) are now served through a unified plugin registry. Users can add custom import/export formats by dropping `.rhai` scripts into a `plugins/` folder inside their diary directory. Rhai scripts run in a secure sandbox (no file system, no network, operation limits enforced). A `README.md` with templates and API docs is auto-generated in the `plugins/` folder on first launch.
- **Multiple journals**: configure and switch between multiple journals (e.g. personal, work, travel) from the login screen. A dropdown selector appears on the password/key-file unlock screen when more than one journal is configured. Journals are managed in Preferences (add, rename, remove, switch). Each journal is an independent encrypted `diary.db` in its own directory. Existing single-diary setups are automatically migrated — no action required. The "Change Location" feature in Preferences stays in sync with the active journal's config.

### Fixed

- **Navigating to an empty date no longer creates a spurious calendar dot**: clicking into the editor on a date with no entry (without typing anything, or typing only whitespace) previously wrote an empty entry to the database because TipTap normalises an empty document to `<p></p>`, which bypassed the `!content.trim()` check. The save logic now uses TipTap's `editor.isEmpty || editor.getText().trim() === ''` to correctly identify empty and whitespace-only content, and passes `''` to the backend deletion guard so it also passes. Fixes #22.
- **Keyboard shortcuts overhauled**: bracket-key accelerators (`CmdOrCtrl+[`/`]` for previous/next day, `CmdOrCtrl+Shift+[`/`]` for previous/next month) replace the old arrow-key combos that conflicted with OS and TipTap text-navigation bindings. Removed the duplicate frontend `keydown` listener (`shortcuts.ts`) that caused every shortcut to fire twice. Removed accelerators from Statistics, Import, and Export that conflicted with TipTap italic (`Ctrl+I`) and Chromium DevTools (`Ctrl+Shift+I`). All shortcut definitions now live exclusively in `menu.rs` as OS-level menu accelerators.
- **CI diagram verification now detects stale outputs**: the "Verify diagrams are up-to-date" workflow step now compares each regenerated `*-check.svg` file with its committed SVG counterpart and fails with a clear remediation message when any diagram differs.
- **Flaky diagram CI diffs resolved**: diagram rendering/checking is now centralized in `scripts/render-diagrams.mjs` and `scripts/verify-diagrams.mjs`; Mermaid always renders with a consistent Puppeteer config in both local and CI runs; CI uses `bun run diagrams:check` (project-locked Mermaid CLI instead of `bun x mmdc`), workflow Bun installs now use `--frozen-lockfile`, Bun is pinned to `1.2`, and D2 is pinned/validated at `v0.7.1` to prevent toolchain drift.
- **Editor now scales better on large/fullscreen windows**: the main writing column keeps the existing compact behavior on smaller screens, but expands its max width on larger displays and increases the editor's default writing area height on tall viewports to reduce unused space below the editor.
- **Session state is now fully reset on lock/logout boundaries**: locking the diary (manual lock button or backend-emitted `diary-locked` event from OS/session auto-lock flows) now clears transient frontend state so selected date, in-memory entry/search state, and open overlays do not leak across sessions or journal switches. Unlock now starts from a fresh `today` baseline; E2E coverage was updated accordingly.
- **Journal selection on auth screens no longer reverts to the previous journal**: switching journals from the locked/no-diary screen now updates auth status without reloading journal metadata in the same step, preventing the dropdown from briefly changing and then snapping back to the old journal.
- **Auth screens no longer clip content when multiple journals are configured**: the journal selector dropdown added in 0.4.0 pushed the unlock/create-diary cards past the 600 px window height, causing the top of the card to be clipped with no way to scroll. The layout now uses a column-flex + `my-auto` pattern so the card centres when space is available and the page scrolls naturally when it is not. Outer vertical padding was reduced (`py-12` → `py-6`), card internal padding tightened (`py-10` → `py-8`), logo and subtitle margins trimmed, and the default window height increased from 600 px to 660 px so both screens fit without scrolling in the multi-journal case.

### Changed

- **PHILOSOPHY.md restructured and expanded**: split into Part I (what and why for each principle) and Part II (how each principle is implemented in the codebase). Added concrete extension/plugin system description, E2E test stack guidance, rationale for the no-password-recovery rule, OS integration and Rhai scripting as justified complexity examples, a typo fix ("rich-text support"), a clarification distinguishing local Rhai plugins from plugin marketplaces, a version/date header, and a new "Honest threat documentation" non-negotiable. README now links to PHILOSOPHY.md under a dedicated Philosophy section.

## [0.3.0] — 2026-02-21

### Added

- **macOS menu bar**: proper App menu (About, Preferences, Services, Hide, Quit), Edit menu (Undo/Redo, Cut/Copy/Paste/Select All for standard keyboard shortcuts), and Window menu (Minimize, Zoom, Close). The custom menu is now installed app-wide via Tauri `AppHandle::set_menu` (instead of `window.set_menu`, which is unsupported on macOS), so menu actions and shortcuts work correctly on macOS.
- **Lock-state menu enforcement**: Navigation and Diary menu items are disabled while the diary is locked and automatically re-enable on unlock, preventing spurious menu actions on the lock screen. File/Help items (Preferences, About, Quit) remain available at all times.
- **About from menu**: Help › About (Windows/Linux) and Mini Diarium › About (macOS) now open the About overlay.
- **Auto-lock on Windows session lock/suspend**: the app now listens for native Windows session/power events and auto-locks the diary when the session is locked/logged off or the system is suspending.
- **E2E test suite**: end-to-end tests using WebdriverIO + tauri-driver that exercise the full app stack (real binary, real SQLite). The core workflow test covers diary creation, writing an entry, locking, and verifying persistence after unlock. Run locally with `bun run test:e2e`; runs automatically in CI on Ubuntu after the build step.

### Security

- **Key material zeroized on all exit paths**: wrapping keys derived during `wrap_master_key` and `unwrap_master_key` are now explicitly zeroed before returning on both the success path and every error path (wrong password, wrong key file, decryption failure). Previously the wrapping key bytes could remain in memory whenever an incorrect credential was entered.
- **Auth structs zeroize on drop**: `PasswordMethod` and `PrivateKeyMethod` now implement `ZeroizeOnDrop`; memory is reliably overwritten when the struct is dropped, regardless of call site.
- **Keypair unlock buffer zeroized**: the intermediate `Vec<u8>` holding private key bytes decoded from the key file during `unlock_diary_with_keypair` is now explicitly zeroized immediately after copying into the stack array.
- **`SecretBytes` newtype for decrypted master key**: `unwrap_master_key` now returns `SecretBytes` (a `ZeroizeOnDrop` wrapper) instead of a bare `Vec<u8>`, enforcing automatic cleanup of master key material regardless of whether the caller remembers to call `.zeroize()`.
- **Mutex poisoning handled gracefully**: all Tauri command handlers now propagate a `"State lock poisoned"` error instead of panicking via `.unwrap()` if a thread panics while holding the diary state lock. Previously a single panicking thread could permanently crash the app for the user.
- **Diary directory config rejects relative paths**: `config.json` entries with relative paths (e.g. `../../etc/passwd`) are now silently rejected; only absolute paths are accepted.
- **`migrate_v3_to_v4` is now atomic**: the two-statement migration that drops the plaintext FTS table and bumps the schema version is now wrapped in a single `BEGIN IMMEDIATE`/`COMMIT` transaction, consistent with other migrations.

### Fixed

- **Ordered lists in Markdown export**: entries containing numbered lists (`<ol>`) now export as `1. First`, `2. Second`, etc. instead of being silently converted to unordered bullet lists.
- **Word counts inflated by HTML markup**: word counts for entries written in the rich-text editor were inflated because HTML tags (`<p>`, `<strong>`, `<em>`, etc.) were counted as word tokens. `count_words` now strips tags before counting. Existing stored word counts are not retroactively corrected, but new writes and updates are accurate.
- **Export JSON version always showed `0.1.0`**: the `metadata.version` field in JSON exports now reflects the actual app version instead of the hardcoded string `"0.1.0"`.
- **Startup directory errors are now logged**: failure to determine the system app-data directory or to create the app directory now emits a warning to the log instead of silently falling back or ignoring the error.
- **Export no longer does N+1 queries**: JSON and Markdown export previously fetched entry dates and then queried each entry individually. All entries are now fetched and decrypted in a single SQL query.
- E2E CI failure on Linux: `browserName: 'edge'` is now set only on Windows (required by msedgedriver/WebView2) and omitted entirely on Linux. WebKitWebDriver (webkit2gtk-driver) rejects both `'edge'` and an empty string `''`; omitting the key means no browser-name constraint is imposed, which satisfies WebKitWebDriver's W3C capability matching.
- E2E spec (`e2e/specs/diary-workflow.spec.ts`) is now excluded from the Vitest unit test run, preventing a `ReferenceError: browser is not defined` failure when running `bun run test:run`.
- macOS CI build failure with Tauri `2.10.x`: updated predefined menu item calls to the current API (`services/hide/hide_others/show_all` now pass `None` label argument, and Window menu `zoom` was replaced with `maximize`).
- Bundle identifier warning on macOS: changed app identifier from `com.minidiarium.app` to `com.minidiarium`, and added startup compatibility fallback so existing installs using the legacy `com.minidiarium.app` app-data directory continue to load their existing diary/config.
- **Auto-lock UI desync after OS lock**: backend lock operations now emit a `diary-locked` event so the frontend immediately transitions to the lock screen instead of remaining in an unusable unlocked layout.

- **Custom diary location**: choose where your diary file is stored (Preferences → Diary File → Change Location). The file is moved to the selected folder and the choice persists across restarts, enabling cloud sync via Dropbox, OneDrive, or any folder-based sync tool. The diary is automatically locked during the move; the app reloads so you can re-authenticate from the new location.
- **Website contact obfuscation**: footer email link now renders via `data-*` attributes plus inline script so the address is reconstructed in the browser and not present in the raw HTML.

### Changed

- **Documentation diagrams synced with codebase**: refreshed architecture/context diagrams to match the current SolidJS signal state model, command/backend layout, and security posture (no plaintext search index); updated stale `AGENTS.md`/`CLAUDE.md` diagram references and regeneration instructions; added light-theme `architecture.svg` generation and CI existence checks alongside `architecture-dark.svg`.

## [0.2.1] — 2026-02-19

### Added

- Public website at [mini-diarium.com](https://mini-diarium.com) (`website/` subfolder, served via nginx on Docker)
- Website SEO: canonical URL, author meta, JSON-LD `SoftwareApplication` structured data, `og:image` switched to GIF, `twitter:card` upgraded to `summary_large_image`, `<main>` landmark, `id="demo"` anchor, `robots.txt`, `sitemap.xml`

### Fixed

- Website: Proofreading, fixed corrupted Linux platform icon SVG path, added `width`/`height` to demo GIF to prevent layout shift
- macOS "damaged and can't be opened" error: added ad-hoc code signing (`signingIdentity: "-"`) and updated installation instructions to use `xattr -cr` workaround
- macOS release builds now correctly produce a universal binary (arm64 + x86_64) by passing `--target universal-apple-darwin` to the build step
- The entries_skipped field was declared but never used, it was added a condition in the for loop to skip and count entries that have no meaningful content rather than inserting empty records. by @Yujonpradhananga

## [0.2.0] — 2026-02-18

### Added

- **Key file authentication**: unlock your diary with an X25519 private key file instead of (or in addition to) your password
- **Multiple unlock methods**: register more than one key file alongside your password; all are listed and manageable in Preferences → Authentication Methods
- **Key file generation**: generate a new X25519 keypair and save the private key to a `.key` file directly from Preferences
- **Auth Methods section in Preferences**: view all registered unlock methods, add a new key file, or remove existing ones (the last remaining method is always protected)
- `verify_password` command for side-effect-free password validation, used internally before multi-step operations
- **Lock button**: lock the diary instantly from the header toolbar without closing the app
- **About dialog**: view app version, description, license, and a link to the GitHub repository via the Info button in the header

### Security

- Remove plaintext FTS search index (`entries_fts` table); existing databases are migrated to schema v4 which drops the table on first unlock. Search is disabled until a secure implementation is available.
- Key file now written with mode 0o600 (owner read/write only) on Unix; Windows relies on NTFS ACLs (H1)
- Import commands now reject files larger than 100 MB to prevent out-of-memory conditions (H2)
- Content Security Policy enabled in webview (M2)

### Fixed

- Password change now enforces 8-character minimum, consistent with diary creation (M1)
- Backup files now use `.db` extension instead of `.txt` (L1)
- Confirmation dialogs for removing an auth method and resetting the diary now use native Tauri dialogs instead of `window.confirm()`, which was silently returning `true` in WebView2 on Windows regardless of user input
- Add Password form now appears in Preferences → Authentication Methods when the password slot has been removed, allowing users to re-register a password via the `register_password` command (uses the master key already held in the unlocked session)

### Changed

- Clicking a day in the calendar sidebar now automatically collapses the sidebar so the selected entry is immediately visible
- Backend error messages mapped to user-friendly strings before display in the UI (M3)
- Export overlay now warns that exported files are unencrypted plaintext (L4)
- Database schema upgraded to v3: entries are now encrypted with a random master key, with each authentication method storing its own wrapped copy in a new `auth_slots` table (replaces the `password_hash` table)
- `change_password` now re-wraps the master key in O(1) — no entry re-encryption required regardless of diary size
- Existing v1 and v2 databases are automatically migrated to v3 then v4 on the first unlock
- App icon and logo updated across all platforms (Windows ICO, macOS ICNS, Linux PNG, Windows AppX, iOS, Android); logo also shown on the unlock and diary creation screens

## [0.1.0] — 2026-02-16

### Added

- Password-based diary creation and unlock with Argon2id hashing
- AES-256-GCM encryption for all diary entries at rest
- Rich text editor powered by TipTap (bold, italic, lists, headings, blockquotes, code blocks, links)
- Entry titles with optional hide-titles preference
- Auto-save with debounced writes and automatic deletion of empty entries
- Calendar sidebar with entry indicators and month navigation
- Full-text search via SQLite FTS5 with snippet highlighting
- Keyboard shortcuts and application menu for navigation (previous/next day, previous/next month, go to today, go to date)
- Import from Mini Diary JSON and Day One JSON formats with merge conflict resolution
- Export to JSON and Markdown formats
- Statistics overlay (total entries, total words, average words, longest/current streaks, entries per weekday)
- Preferences (theme selection, first day of week, allow future entries, hide titles, spellcheck toggle, password change, diary reset)
- Go to Date overlay with date picker
- Light and dark theme support
- Automatic database backups with rotation
- Live word count display
- Cross-platform support (Windows, macOS, Linux)
- CI/CD pipeline with lint, test, and build jobs across all three platforms
