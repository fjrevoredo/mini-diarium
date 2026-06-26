# Plan: Wire Search UI into the App Shell (TODO-0053)

**Plan Status:** COMPLETED
**Created:** 2026-06-26
**Related:** `docs/todo/TODO.md` TODO-0053; PR #171 (dormant search); ADR `docs/decisions/2026-06-feature-flags.md`.

## Resolved decisions

1. **Placement:** Overlay modal — new `SearchOverlay.tsx` (Kobalte Dialog, clean palette style, `Dialog.Title` sr-only).
2. **Promotion:** Full production promotion in this PR — remove both the Rust `#[cfg(feature="experimental")]` gate and the (no-longer-needed) `VITE_EXPERIMENTAL` wrap together.
3. **Trigger:** Header search button on the **left** (near the date) + a Cmd/Ctrl+F webview-level shortcut. No native "Find…" menu item.
4. **E2E:** Include a new WebdriverIO search spec now.
5. **`experimental` feature:** kept as an empty shell (`experimental = []`) — ADR-consistent; the flag mechanism stays available for the next feature.

## Goal / Scope / Non-goals

**Goal:** Ship dormant search to all users — mount `SearchBar` + `SearchResults` in a new palette-style `SearchOverlay`, trigger it from a left Header button + Cmd/Ctrl+F, fix the result-click view-switch bug, and promote both experimental gates to production in this PR.

**Non-goals:** native "Find…" menu item; FTS5/index/schema migration (the in-memory decrypt is security-clean); runtime beta toggle (Tier 2 deferred).

## Assumptions

- Backend `search_entries` (`commands/search.rs:52`) is correct and tested; only its `experimental` gate must lift.
- `unicode-normalization` is the only `experimental`-activated dependency; it is already transitively present in `Cargo.lock`, so making it non-optional is low-risk.
- Kobalte Dialog auto-focuses the first focusable element (SearchBar input) and gives focus-trap / ESC / backdrop for free.

## Open Questions

None.

## UX-GATE: REQUIRED

Scenarios (confirmed by T10 unit test + T11 E2E + PLATFORM-VERIFY manual):

1. Click the left Header search button → overlay opens, focus in input.
2. Press Cmd/Ctrl+F anywhere (no other overlay open) → overlay opens, focus in input; default suppressed.
3. Type query → debounced 500 ms → results (newest first); loading / empty / no-results states.
4. Click a result → overlay closes, `mainView='editor'`, editor lands on that entry's date + exact entry (deep-link), even with multiple same-day entries.
5. ESC or backdrop → overlay closes, search state cleared.

PLATFORM-VERIFY (manual, dev app): create entries, Ctrl+F, type, click result, confirm navigation + overlay close.

---

## Milestone 1 — Frontend overlay + trigger

### T1 · Add `isSearchOpen` UI signal — TO BE DONE
- **Steps:** In `src/state/ui.ts` add `[isSearchOpen, setIsSearchOpen] = createSignal(false)`; reset in `resetUiState()`; export both.
- **Validation:** `cmd.exe /c bun run type-check`.

### T2 · Add search i18n keys (CI gate) — TO BE DONE
- **Steps:** Add `search.title: 'Search'` and `layout.header.search: 'Search'` to `src/i18n/locales/en.ts`. Mirror both as English fallback into `de.json`, `es.json`, `fr.json`, `it.json`, `hi.json`.
- **Validation:** `cmd.exe /c bun run validate:locales` exits 0.

### T3 · Create `SearchOverlay.tsx` (clean palette) — TO BE DONE
- **Steps:** New `src/components/search/SearchOverlay.tsx` using `@kobalte/core/dialog`. `Dialog.Content` = sr-only `Dialog.Title` → `<SearchBar />` → `<SearchResults />` in `max-h-[60vh] overflow-y-auto`. `open={isSearchOpen()}`; on `onOpenChange(false)` call `resetSearchState()`. Width `max-w-lg`; `data-testid="search-overlay"`.
- **Validation:** `cmd.exe /c bun run type-check`.

### T4 · Mount overlay + ESC guard — TO BE DONE
- **Steps:** Render `<SearchOverlay />` in `MainLayout.tsx` (unguarded). Add `isSearchOpen()` to the early-return list in `handleGlobalEsc` (`MainLayout.tsx:63`).
- **Validation:** `cmd.exe /c bun run test:run -- MainLayout`.

### T5 · Header button (left) + Cmd/Ctrl+F shortcut — TO BE DONE
- **Steps:** In `Header.tsx` add a `Search` icon button (`lucide-solid`) in the left section next to the date; `onClick={() => setIsSearchOpen(true)}`; `data-testid="search-button"`; `aria-label={t('layout.header.search')}`. In `MainLayout.tsx` `onMount`, extend the document keydown handler: if `(metaKey||ctrlKey) && key==='f'` → `preventDefault`; if another overlay open, bail; else open (refocus if already open). Clean up.
- **Validation:** `cmd.exe /c bun run type-check`; PLATFORM-VERIFY.

### T6 · Fix result-click view switch — TO BE DONE
- **Steps:** In `SearchResults.tsx:10` after the deep-link, add `setMainView('editor')` and `setIsSearchOpen(false)`. Fix the stale `// FTS5 backend` comment (`SearchResults.tsx:54`) → in-memory scan.
- **Validation:** covered by T10.

**M1 exit:** Overlay opens from the left Header button and Cmd/Ctrl+F, searches, and a result click navigates to the editor (deep-link) with the overlay closed. `type-check` + `test:run` green.

## Milestone 2 — Promote experimental gates to production (backend)

### T7 · Ungate `commands/search.rs` + default-run impl tests — TO BE DONE
- **Steps:** Remove all `#[cfg(feature = "experimental")]` in `src-tauri/src/commands/search.rs`. Change impl-test gate (`search.rs:242`) → `#[cfg(test)]`. Update stale comments (`search.rs:46-49`, `239-241`).
- **Validation:** `cargo test --manifest-path src-tauri/Cargo.toml search` (default features).

### T8 · Ungate `generate_handler!` entry — TO BE DONE
- **Steps:** In `src-tauri/src/lib.rs:331-333` remove the `#[cfg(feature="experimental")]` line above `commands::search::search_entries,`; update comment.
- **Validation:** `cargo build --manifest-path src-tauri/Cargo.toml` (default features).

### T9 · Make `unicode-normalization` non-optional — TO BE DONE
- **Steps:** `src-tauri/Cargo.toml:48` → `unicode-normalization = "0.1"`; `experimental = ["dep:unicode-normalization"]` → `experimental = []` (keep shell, update comment). Cargo.lock regenerates on build. No npm/Nix change.
- **Validation:** `cargo build --manifest-path src-tauri/Cargo.toml && cargo test --manifest-path src-tauri/Cargo.toml`.

**M2 exit:** Backend compiles + all search tests pass under the default feature set; `experimental` defined but empty.

## Milestone 3 — Tests

### T10 · `SearchOverlay` unit test — TO BE DONE
- **Steps:** New `src/components/search/SearchOverlay.test.tsx`: (a) closed → no input; open → input present; (b) mocked result click → `selectedEntryId`/`selectedDate` set, `mainView==='editor'`, overlay closed.
- **Validation:** `cmd.exe /c bun run test:run -- SearchOverlay`.

### T11 · E2E search spec — TO BE DONE
- **Steps:** New `e2e/specs/search.spec.ts`: create entry with known text, open via `search-button`, type, assert result, click, assert editor shows that date. 800×660 viewport; testids added to canonical table first (T12).
- **Validation:** `cmd.exe /c bun run test:e2e:local`.

**M3 exit:** Unit + E2E search flows green locally.

## Milestone 4 — Docs, cleanup, verification

### T12 · Documentation — TO BE DONE
- **Steps:**
  - **Rewrite** `website/docs-src/03-search.md` (currently says "not available"); run `cmd.exe /c bun run website:build-static` (PowerShell tool).
  - **Reframe** flag docs using search as worked example: ADR `2026-06-feature-flags.md`, `CONTRIBUTING.md:62-65`, `src/CLAUDE.md:84-101`, `src-tauri/CLAUDE.md` "Implementing Search" + experimental checklist.
  - Root `CLAUDE.md` GOTCHA #1 + **data-testid table** (`src/CLAUDE.md`): add `search-button`, `search-overlay`.
  - Fix `TODO-0060` trailing "remains gated" clause.
- **Validation:** `cmd.exe /c bun run diagrams:check`; docs build succeeds.

### T13 · Changelog + TODO checkbox — TO BE DONE
- **Steps:** Append `CHANGELOG.md` `[Unreleased] → Added`: full-text search available (in-memory, AES-256-GCM-safe) + shortcut. Mark `docs/todo/TODO.md:39` `[x]`.
- **Validation:** inspect TODO line shows `[x]`.

### T14 · Final verification — TO BE DONE
- **Steps:** `cmd.exe /c bun run type-check && cmd.exe /c bun run lint && cmd.exe /c bun run format`; `cmd.exe /c bun run test:run`; `cargo test --manifest-path src-tauri/Cargo.toml`; `cmd.exe /c bun run coverage:diff`; `cmd.exe /c bun run validate:locales`.
- **Validation:** all green.

## Self-check

Location `docs/` ✓ · status IN PROGRESS ✓ · scope/non-goals/assumptions explicit ✓ · all questions asked & answered, none open ✓ · UX-GATE tagged w/ scenarios + PLATFORM-VERIFY ✓ · 14 tasks in 4 milestones w/ exit criteria ✓ · cleanup (T13) checks off TODO-0053 + changelog ✓ · final verification (T14) ✓ · no vague actions ✓ · executable without the conversation ✓ · no decision-log companion requested → omitted ✓.
