# Technical Review — April 2026

> **Scope:** Architecture, code quality, testing, best practices, simplicity, and performance of the Mini Diarium codebase (backend `src-tauri/` + frontend `src/`), as of branch `feature-v0.4.19` (commit `cc31808`).
>
> **Audience:** The maintainer. Companion document to [`PHILOSOPHY_REVIEW_2026-04.md`](PHILOSOPHY_REVIEW_2026-04.md) — this one is strictly technical; philosophy compliance is cross-referenced when directly relevant but not re-audited.
>
> **Companion plan:** [`TECHNICAL_REVIEW_PLAN_2026-04.md`](TECHNICAL_REVIEW_PLAN_2026-04.md) turns these findings into execution-ready milestones.

## 1. Executive Summary

The codebase is in strong shape. Every objective health check passed on the first run:

| Check | Result |
|---|---|
| `cargo test` (backend) | **276 / 276 passed**, 0 ignored |
| `cargo clippy -- -D warnings` | **0 warnings** |
| `cargo build` (dev) | Clean, 17.67 s |
| `bun run test:run` (frontend) | **229 / 229 passed** across 22 files |
| `bun run type-check` | Clean |
| `bun run lint` | Clean |

There are no correctness bugs, no security regressions, and no philosophy violations of the "non-negotiables" (no network, no custom crypto, no plaintext on disk). The fundamentals the maintainer trusts **do** still hold.

The findings below are organisational/sustainability concerns accumulated over the last ~month of feature work:

- **3 P1 findings** — documentation drift, dead frontend state code, one documentation/memory-vs-reality gap around the passwordless journal decision.
- **6 P2 findings** — two large components (`PreferencesOverlay.tsx`, `EditorPanel.tsx`) that are due for splitting, a large component-test gap on the frontend, a near-duplicated command module, a legacy command shim, and a naive HTML-to-Markdown converter.
- **3 P3 findings** — minor code-hygiene items and opportunistic refactors.

None of these block any release. All of them will pay down interest on long-term sustainability, which the maintainer has explicitly named as the top priority.

## 2. Methodology

Evidence was gathered in four passes:

1. **Objective measurements** — ran the full verification suite (see table above) on the current working tree with no changes. All commands in `CLAUDE.md § Verification Commands` executed successfully.
2. **Structural survey** — file-by-file LOC counts across `src/` and `src-tauri/` (see § Appendix A) to identify hot spots by size.
3. **Deep reads** — every non-trivial hot spot was read in full. In `src-tauri/`: `lib.rs`, `crypto/cipher.rs`, `auth/*`, `commands/auth/*`, `commands/entries.rs`, `commands/stats.rs`, `commands/import.rs`, `db/schema.rs`, `db/queries.rs`, `plugin/rhai_loader.rs`, `menu.rs`, `screen_lock.rs`, `export/markdown.rs`, `config.rs`, `backup.rs`. In `src/`: `App.tsx`, `components/layout/*`, `components/auth/*`, `components/editor/DiaryEditor.tsx`, `components/editor/EditorPanel`-related logic tests, `components/calendar/Calendar.tsx`, `components/overlays/PreferencesOverlay.tsx` (sampled), `state/*`, `lib/*`.
4. **Test coverage map** — enumerated every test file (21 frontend, 32 backend modules with `#[cfg(test)]`) and cross-referenced against source files (§ Appendix B).

Every claim in this report cites a file path (and line range where useful). Version and commit references are pinned to branch `feature-v0.4.19`.

**Priority definitions** (per maintainer):
- **P1** — high priority, must be done, deal-breaker for long-term sustainability.
- **P2** — should have for best practices; not critical.
- **P3** — not important; mostly vanity metrics or personal preference.

## 3. Architecture and Cross-Layer Interaction

### 3.1 Status

The high-level architecture documented in `CLAUDE.md` (presentation → state → backend → data) is accurate and preserved in practice. Key observations:

- **Layering is clean.** No SolidJS component calls SQLite directly; every access goes through `src/lib/tauri.ts` → Tauri `#[command]` → `db::queries`. The 53 commands in `lib.rs:generate_handler![]` match the 53 typed wrappers in `src/lib/tauri.ts`.
- **State layer is cohesive.** 8 state modules (`auth`, `entries`, `journals`, `notifications`, `preferences`, `search`, `session`, `ui`), each with a narrow, single-topic responsibility. No module mutates another's signals. `session.ts:resetSessionState()` is the only cross-module coordinator and is well-bounded.
- **Menu event pattern works.** `menu.rs` (Rust) emits 10 `menu-*` events, all listened to in `components/layout/MainLayout.tsx` (`onMount`, lines 69–171). `App.tsx` handles `menu-about` separately. The boundary is clean and there is a regression test (`MainLayout-event-listeners.test.tsx`).
- **Auto-lock has two paths and both work.** Frontend idle timer in `App.tsx:33-54` and OS-level listener in `src-tauri/src/screen_lock.rs` (Windows `WTSRegisterSessionNotification` + `SetWindowSubclass`; macOS `NSWorkspace` + `NSDistributedNotificationCenter`). Both converge on `auto_lock_diary_if_unlocked()` in `commands/auth/mod.rs`, which emits `journal-locked` exactly once.
- **Multi-journal cutover is correct.** `commands/auth/auth_journals.rs:switch_journal` calls `auto_lock_diary_if_unlocked` before rebinding `db_path`/`backups_dir`, and the frontend's `state/journals.ts:switchJournal` calls `executeCleanupCallbacks()` before the backend invoke — both ends agree on the lock-before-swap ordering.

### 3.2 Finding A1 — **P1**: Documented state layer is out of date

**Evidence.** `src/CLAUDE.md § State Management` has four distinct drifts:

1. Says "**Six** signal-based state modules in `src/state/`" but the table lists **seven** (`auth`, `entries`, `journals`, `search`, `ui`, `notifications`, `preferences`).
2. `session.ts` appears in the File Structure block above but is **missing from the State Management table entirely**.
3. The `entries.ts` row lists `currentEntry, entryDates, isLoading, isSaving`. But `src/state/entries.ts` actually exports `currentEntry`, `dayEntries`, `entryDates`, `isLoading`, `isSaving` plus setters. Only `entryDates`, `setEntryDates`, and `isSaving/setIsSaving` are imported externally — `EditorPanel.tsx` imports `isSaving, setIsSaving, setEntryDates, registerCleanupCallback` only (see line 22) and keeps its own local `dayEntries`, `loadRequestId`-based loading state. `currentEntry`, `dayEntries`, `isLoading` are declared in `state/entries.ts` but never imported outside the module.
4. `auth.ts` exports `authMethods` / `setAuthMethods`. `PreferencesOverlay.tsx` imports `authState` from that module but maintains its own **local** `authMethods` signal at line 114 — the global is effectively dead.

`src-tauri/CLAUDE.md § File Structure` documents `auth/mod.rs`, `auth/password.rs`, `auth/keypair.rs` but **omits** `src-tauri/src/auth/auto_key.rs` (88 LOC, introduced with the local-only-journal feature).

**Why this is P1.** Documentation drift on the state layer is the first place a new reader looks. When the docs list signals that don't exist as documented, a new contributor (or the maintainer on a 3-month context gap) will spend time debugging phantom references. It also masks **actual dead code** (see A2). The fix is small and should be done alongside A2.

**Suggested action.** Update `src/CLAUDE.md`'s State Management table to match current exports; add `auth/auto_key.rs` to the `src-tauri/CLAUDE.md` File Structure block. Delete or re-wire the dead exports identified in A2 so the documentation matches code.

### 3.3 Finding A2 — **P1**: Dead frontend state code

**Evidence.** In `src/state/entries.ts`:

- `currentEntry` / `setCurrentEntry` — no external consumer. `EditorPanel.tsx` reads `pendingEntryId` + `dayEntries()[currentIndex()]` instead.
- `dayEntries` / `setDayEntries` — no external consumer. `EditorPanel.tsx` has its own local `dayEntries` signal at line 51.
- `isLoading` / `setIsLoading` — no external consumer. `EditorPanel.tsx` uses `_isLoadingEntry` (prefixed underscore, declared-but-unused-as-a-read local).

In `src/state/auth.ts`:
- `authMethods` / `setAuthMethods` — declared; no external read. `PreferencesOverlay.tsx:114` keeps its own local copy.

**Why this is P1.** These are misleading public interfaces. A future contributor looking at `state/entries.ts` will assume `currentEntry` is the current entry, and will write code that subscribes to a never-updated signal. This is the kind of latent bug that shows up weeks later when a feature mysteriously doesn't react. It is also inconsistent with the philosophy of "Small Extensible Core" — an export is a commitment.

**Suggested action.** Remove `currentEntry`, `dayEntries`, `isLoading` from `state/entries.ts` and their re-exports. Decide on `authMethods`: either promote it to the canonical source (and delete `PreferencesOverlay.tsx`'s local) or remove it from `state/auth.ts`. I recommend **promoting** it — auth methods are conceptually global state, and `PreferencesOverlay` re-fetching on every `handleOpenChange` (line 191) duplicates the invalidation pattern already expressed by `loadAuthMethods()` in `state/auth.ts:initializeAuth`.

### 3.4 Finding A3 — **P1**: Passwordless-journal memory-vs-reality divergence

**Evidence.** Auto-memory `project_passwordless_decision.md` records:

> "Options A/B rejected; OS keychain (Option C) deferred; use key-file auth as interim"

The implementation in `src-tauri/src/auth/auto_key.rs` + `commands/auth/auth_core.rs:create_diary_auto` (line 260) + `config.rs:JournalConfig.auto_key` does something else: a random 32-byte key is generated and stored **plaintext-hex inside `config.json`**. The key wraps the master key via the normal `AutoKeyMethod` auth slot. This is closer to "Option B-prime" than "key-file auth as interim".

The UX mitigation in `PasswordCreation.tsx` (ack checkbox with warning bullets) describes this correctly to the user. The implementation works. The **decision record** is simply stale.

**Why this is P1.** The maintainer has explicitly named adherence to documented principles as top priority. A drift between the recorded decision and what shipped means future decisions are being made against a mental model that no longer matches the code. This is exactly the kind of slow erosion the maintainer is worried about.

**Suggested action.** Three options — pick one:
- (a) **Ratify the current implementation**: update the memory entry and `PHILOSOPHY.md` (or add a decision record in `docs/`) to explicitly name the chosen option as "B-prime: device-bound random key stored in config". Document the threat model (OS account compromise = journal compromise; not a crypto concern but an access-control one).
- (b) **Replace with Option C** (OS keychain) and remove `auto_key` from `config.json`.
- (c) **Remove the feature** and default back to password-only + key-file.

This is a P1 decision document to write, not necessarily a P1 code change. (a) is the smallest honest fix.

### 3.5 Cross-layer strength — no P2/P3 findings

Architecture-level debt is otherwise minimal. Command registration is already ergonomic (just two places: `commands/mod.rs` + `lib.rs`, both grep-discoverable). The plugin boundary (`plugin/mod.rs` traits, `plugin/builtins.rs` wrappers, `plugin/rhai_loader.rs` sandbox) is a genuinely good small-extensible-core example.

## 4. Backend (Rust/Tauri)

### 4.1 Status — Code Quality

Clippy is clean with `-D warnings`. All 276 tests pass. No `unwrap()` on fallible paths in production code (the two `Mutex::lock().unwrap()` patterns have been replaced with `.map_err(|_| "State lock poisoned".to_string())` — see `commands/entries.rs` and `commands/stats.rs` for the idiom).

Hot spots read in full:
- `crypto/cipher.rs` (296 LOC, 11 tests) — exemplary. Random 12-byte nonces, `Key` newtype with `ZeroizeOnDrop`, tamper tests cover ciphertext/tag/nonce. No issues.
- `auth/keypair.rs`, `auth/password.rs`, `auth/auto_key.rs` — all use `Zeroizing<[u8; 32]>` on master keys; explicit `.zeroize()` on unwrap errors; HKDF + SHA2 for key derivation. No issues.
- `db/schema.rs` (1402 LOC, 15 tests) — half is tests. Migration ladder v1→v5 is linear, each step creates a backup before altering data, and the backup step is covered by `test_migration_creates_backup`. Good.
- `plugin/rhai_loader.rs` (549 LOC) — sandbox limits (`max_operations=1_000_000`, `max_call_levels=32`, `max_string_size=100MB`) are sensible. The `unsafe impl Send + Sync for RhaiImportPlugin / RhaiExportPlugin` is justified in a comment (AST immutable; Engine per-call). No issues.
- `menu.rs` (273 LOC) — canonical shortcut reference in doc comments; `TranslatableMenuItems` + `LockableMenuItems` structs cleanly separate concerns.

### 4.2 Finding B1 — **P2**: `commands/import.rs` has four near-identical functions

**Evidence.** `src-tauri/src/commands/import.rs` is 380 LOC. Lines 46–245 contain four commands (`import_minidiary_json`, `import_dayone_json`, `import_jrnl_json`, `import_dayone_txt`) that differ only in which parser they call:

```rust
let entries = minidiary::parse_minidiary_json(&json_content)?;
// vs
let entries = dayone::parse_dayone_json(&json_content)?;
// vs
let entries = jrnl::parse_jrnl_json(&json_content)?;
// vs
let entries = dayone_txt::parse_dayone_txt(&txt_content)?;
```

Every other line — the lock guard, the file-size cap, the `import_entries` call, the log statements, the `// Search index hook:` comment — is copy-pasted across all four.

**Why this is P2.** This is textbook shotgun surgery risk. When search is re-implemented and needs the `bulk_reindex()` call injected, the maintainer has to touch four places instead of one. When the `MAX_IMPORT_FILE_SIZE` limit changes or logging format is adjusted, same. The four commands are also already **obsoleted** by `run_import_plugin` + the built-in plugin wrappers in `plugin/builtins.rs` — the Import Overlay frontend actually uses the plugin path (per backend CLAUDE.md gotcha #8). See B2.

**Suggested action.** Extract a single helper `import_from_parser<P: Fn(&str) -> Result<Vec<DiaryEntry>, String>>(file_path, parser, label, state)` and make each command a one-liner that selects the parser. Or, better, see B2.

### 4.3 Finding B2 — **P2**: Four legacy import commands duplicate the plugin path

**Evidence.** `src-tauri/src/plugin/builtins.rs` defines `MiniDiaryImporter`, `DayOneJsonImporter`, `JrnlImporter`, `DayOneTxtImporter` — wrappers around the same parsers. `plugin/registry.rs` registers them at startup. `commands/plugin.rs:run_import_plugin` dispatches by plugin id. Per `src-tauri/CLAUDE.md` gotcha #8:

> "Old import/export commands are preserved: The original `import_minidiary_json`, `import_dayone_json`, etc. commands remain registered for backward compatibility. The Import/Export overlays now use the plugin system (`runImportPlugin`/`runExportPlugin`) but the legacy commands still work."

A grep of `src/` shows the frontend wrappers in `tauri.ts` (`importMiniDiaryJson`, etc.) are exported but **not called anywhere** — `ImportOverlay.tsx` uses `runImportPlugin`. The test file `src/lib/import.test.ts` tests `tauri.ts` wrappers but not their UI wiring.

**Why this is P2.** "Preserved for backward compatibility" inside a single local-first desktop app with no API consumers means **preserved for no one**. Every line of the four commands is carrying paging weight in the mental model. Deleting them would also collapse B1 naturally.

**Suggested action.** Delete `import_minidiary_json`, `import_dayone_json`, `import_jrnl_json`, `import_dayone_txt` and their frontend wrappers. Update `lib.rs:generate_handler![]` and the `CLAUDE.md` command registry. The built-in plugin wrappers in `plugin/builtins.rs` remain. Four commands → zero, one module (`commands/import.rs`) shrinks to just the shared `import_entries` + `read_import_file` helpers.

### 4.4 Finding B3 — **P2**: `export/markdown.rs` is a 1025-LOC hand-rolled HTML-to-Markdown converter

**Evidence.** `src-tauri/src/export/markdown.rs` contains 1025 lines, of which `html_to_markdown` (lines 98–187) performs a sequence of 17 string replacements plus hand-rolled `process_code_blocks`, `process_blockquotes`, `number_ordered_lists`, `strip_remaining_tags`. Example lines 119–137:

```rust
result = result.replace("<strong>", "**");
result = result.replace("</strong>", "**");
result = result.replace("<b>", "**");
result = result.replace("</b>", "**");
// ... etc for <em>, <i>, <s>, <del>, <strike>
```

This is correct for the specific HTML subset TipTap emits, and it's covered by tests. But the `strip_remaining_tags` comment at line 289–292 acknowledges its fragility: it preserves blockquote `>` markers only because of a one-off special case.

**Why this is P2 (not P1, not P3).** It works today. But it's 1025 LOC of tag-matching that won't survive any TipTap schema addition (e.g. a future "quote attribution" mark, or inline images with captions) without the test suite quietly going green while the user sees garbled exports. This is **exactly** the "if my future self reads this, will it be obvious what it does" failure mode the maintainer has said matters most.

**Suggested action.** Evaluate `html2md` (crate, MIT, ~600 stars), `html2text`, or `pulldown-cmark` as a foundation. If a drop-in replacement passes the existing test cases, the 1025 LOC collapses to ~100. If none do, at minimum: add a fuzz test (`cargo fuzz`) that feeds random TipTap HTML snippets through `html_to_markdown` and asserts it terminates and produces valid UTF-8. The image-asset-extraction path (`export_entries_to_markdown_with_assets`) stays; it's orthogonal.

### 4.5 Finding B4 — **P3**: `DiaryState` uses `Mutex<Option<DatabaseConnection>>`

**Evidence.** `commands/auth/mod.rs` defines:
```rust
pub struct DiaryState { pub db: Mutex<Option<DatabaseConnection>>, ... }
```

Every command does `state.db.lock().map_err(...)?` then `db_state.as_ref().ok_or("Journal must be unlocked")?`. That's two guard steps in every one of the 30+ commands that touch the DB.

**Why this is P3.** It works, clippy is happy, and the pattern is uniform. An alternative (e.g. `RwLock`, `parking_lot`, or `tokio::sync::Mutex` with `spawn_blocking`) would buy either better error types or marginally better concurrency, but SQLite writes serialize anyway. The real cost is boilerplate — every command starts with 5 lines of unlock guard. Not worth changing.

**Suggested action.** Optional: extract a `fn with_unlocked_db<T>(state: &DiaryState, f: impl FnOnce(&DatabaseConnection) -> Result<T, String>) -> Result<T, String>` helper and refactor the 30+ commands to call it. This would collapse the 5-line preamble to 1 line. Low value, low risk, pure vanity — P3.

### 4.6 Status — Backend Testing

**Excellent.** 32 Rust source files contain `#[cfg(test)]` modules. Coverage is near-complete:

- All 4 import parsers individually tested (`dayone`, `dayone_txt`, `jrnl`, `minidiary`).
- Both export paths tested (`json`, `markdown` including the image-extraction variant).
- All auth primitives: `crypto/cipher.rs`, `crypto/password.rs`, `auth/keypair.rs`, `auth/password.rs`, `auth/auto_key.rs`.
- All four auth command modules: `auth_core`, `auth_methods`, `auth_journals`, `auth_directory`.
- DB schema migrations v1→v2→v3 with backup creation, plus `open_*` path variants for each auth method.
- Plugin system: `builtins`, `registry`, `rhai_loader` (including sandbox limit tests).
- Statistics and navigation with edge-case dates.
- File-size limit at boundary (`test_import_file_at_size_limit`, `test_import_file_over_size_limit`) — both off-by-one directions tested.

**Untested (intentional):** `lib.rs`, `main.rs` (bootstrap-only), `screen_lock.rs` (OS-event callbacks, hard to unit-test without host OS). `menu.rs` (Tauri scaffolding without Tauri test infra). These are all appropriate.

**No finding on backend testing.** It is already at the level the maintainer would normally call for.

### 4.7 Status — Backend Performance

No performance problems identified. Benchmarks (`benchmarks/`) cover `cipher_bench.rs`, `argon2_bench.rs`, and a handful of import parsers; they're tracked in CI per memory `benchmarking.md`. Argon2id m_cost/t_cost are tuned (not checked in this review but are untouched in recent commits).

The only theoretical hot path worth naming:
- `commands/stats.rs:calculate_statistics` issues one SQL `SELECT date, word_count FROM entries` then does Rust-side dedup + streak computation. This is `O(N)` on total entries. With a 10-year daily journaller at ~3650 entries + images, stats runs in microseconds. No action.

## 5. Frontend (SolidJS)

### 5.1 Status — Code Quality

ESLint clean. TypeScript strict clean. 229 tests green. No `as any` casts on app paths (one intentional `any` in `lib/debounce.ts` for generic `this` binding with a `// eslint-disable-next-line` comment — correct use of the escape hatch).

State modules are small and pure. `lib/` helpers (`dates`, `debounce`, `logger`, `markdown`, `errors`, `theme`, `theme-overrides`, `wordcount`) are tiny single-purpose files. `mapTauriError` is thoughtful — it accepts an optional `t` fn so state modules that can't call `useI18n()` still get i18n support.

Hot spots read in full:
- `App.tsx` (115 LOC) — clean auth-state router, idle-timer effect, menu-about listener. Good.
- `MainLayout.tsx` (214 LOC) — ten `listen("menu-*", ...)` handlers in `onMount`, one shared `handleGlobalEsc`. Verbose but uniform; covered by `MainLayout-event-listeners.test.tsx`. Acceptable.
- `Sidebar.tsx` (135 LOC) — focus-trap tab navigation + mobile-overlay close. Correct.
- `Calendar.tsx` (479 LOC) — calendar + month picker + keyboard grid navigation (Arrow/Home/End/PageUp/PageDown/Enter). Large but coherent; every piece is on a single concern.
- `DiaryEditor.tsx` (285 LOC) — TipTap integration, `AlignableImage` wrapper (implements the container-model alignment per root CLAUDE.md gotcha #4), drag-drop/paste/file-picker image embedding with resize-to-1200px cap. Dense but justified.
- `Header.tsx` (106 LOC) — good.

### 5.2 Finding F1 — **P2**: `PreferencesOverlay.tsx` is 1400 LOC and five tabs in one component

**Evidence.** `src/components/overlays/PreferencesOverlay.tsx` is 1400 lines. Responsibilities inside:

- 5 tabs (General, Writing, Security, Data, Advanced), each rendering substantial form UI.
- 20+ local signals for tab-local form state.
- Auth-method CRUD: password, keypair registration, keypair file write, remove slot with confirm dialog.
- Journal directory change (destructive action with reload).
- Journal reset (destructive, double-confirm, reload).
- Debug dump generation.
- Theme override JSON editor with parse validation.
- Password change with strength indicator.
- A 70-line `handleOpenChange` resetting all 20+ local signals on open.

**Why this is P2.** It's working correctly, has no known bug, and the tabs are disjoint — so the blast radius of a change is contained. But: a new contributor landing on this file has to scroll 1400 lines to find any single form. The `handleOpenChange` reset block is the classic "add a signal, forget to reset" bug magnet. And the file has **no component test** (the overlay has the largest user-facing surface area of any overlay).

**Suggested action.** Split into five files: `PreferencesOverlay.tsx` (shell: dialog, tab list, active-tab switch, save/cancel footer) + `PreferencesGeneralTab.tsx` + `PreferencesWritingTab.tsx` + `PreferencesSecurityTab.tsx` + `PreferencesDataTab.tsx` + `PreferencesAdvancedTab.tsx`. Each tab owns its own local signals and its own reset on open (prop: `isOpen`). The shell becomes ~200 LOC; each tab 150–300 LOC. This matches the granularity at which the maintainer actually reasons about preferences.

### 5.3 Finding F2 — **P2**: `EditorPanel.tsx` is 675 LOC of complex race management

**Evidence.** `src/components/layout/EditorPanel.tsx` is 675 lines. It holds 11 local signals (`title`, `content`, `wordCount`, `_isLoadingEntry`, `editorInstance`, `dayEntries`, `currentIndex`, `pendingEntryId`, `importError`, `isCreatingEntry`, `editorIsEmpty`), three imperative race latches (`pendingCreationPromise`, `justCreatedEntryId`, `isDisposed`), two monotonic request IDs (`loadRequestId`, `saveRequestId`), one debounced save with explicit `.cancel()` at four call sites, and the `editorHasImages()` helper called locally.

The comments are the strongest evidence of complexity: lines 61–73 describe the `justCreatedEntryId` race in detail; lines 180–188 explain why `untrack()` must wrap all reads in `loadEntriesForDate`; lines 192–199 explain why `editor.getHTML()` is read directly instead of the `content()` signal.

**Why this is P2.** The component works — three logic-test files (`EditorPanel-save-logic`, `EditorPanel-multientry-nav`, `EditorPanel-delete-logic`) cover the race cases. But the component **itself** has no integration test that exercises the TipTap instance, and splitting logic into three test files while keeping one 675-LOC component means the tests verify isolated mock behavior, not the real effect interactions. This is the single riskiest piece of frontend code in the project.

**Suggested action.** Two steps, separable:
1. **Refactor, no behavior change:** extract three custom hooks/state modules: `useEntryLifecycle` (load/save/delete, race IDs, debounced save), `useMultiEntryNav` (`dayEntries`, `currentIndex`, navigation), `useEditorEmptyCheck` (`editorHasImages`, `isContentEmpty`, `editorIsEmpty`). Leave the component as the UI shell + effect wiring. Target ≤300 LOC in the component.
2. **Add one high-value integration test** using `@solidjs/testing-library` + a minimal real TipTap editor in jsdom (TipTap does run under jsdom if you set `element` carefully; if not, mock TipTap with a small shim that honors `isEmpty`/`getText`/`getHTML`). Cover: load-entry-then-type, switch-day-while-unsaved, delete-empty-entry-on-nav, create-entry-on-first-keystroke. These four flows together cover every race the comments describe.

### 5.4 Finding F3 — **P2**: Frontend component-test coverage has visible gaps

**Evidence** (see § Appendix B for the full matrix). Components with tests: 8 of ~25. Components with **no** tests that actually need them:

| Component | Size (LOC) | Risk level |
|---|---:|---|
| `PreferencesOverlay.tsx` | 1400 | High — largest UI surface, auth CRUD, destructive reset |
| `EditorPanel.tsx` | 675 | High — race management, only logic-mock tests exist |
| `Calendar.tsx` | 479 | Medium — keyboard grid nav, month picker, hasEntry dots |
| `DiaryEditor.tsx` | 285 | Medium — image embed, alignment, drag-drop |
| `MainLayout.tsx` | 214 | Low — only menu-listener test exists, rest untested |
| `Sidebar.tsx` | 135 | Low — focus trap |
| `JournalPicker.tsx` | 428 | Medium — add/remove/rename journals |
| `ImportOverlay.tsx` / `ExportOverlay.tsx` / `StatsOverlay.tsx` / `GoToDateOverlay.tsx` / `AboutOverlay.tsx` | — | Low-Medium |

State: `auth.ts`, `journals.ts`, `ui.ts`, `preferences.ts`, `search.ts`, `entries.ts`, `session.ts` — only `auth-session-boundary.test.ts` + `notifications.test.ts` exist.

**Why this is P2.** Backend testing is excellent; frontend is not at parity. This is acknowledged in the root CLAUDE.md § Known Issues. It's P2 (not P1) because the components that are **most** dangerous (auth, password input, JournalPicker) **are** tested; the gap is in overlays and higher-level layouts where a regression would typically be caught by E2E (which we have for the golden path — `diary-workflow.spec.ts`, `multi-entry.spec.ts`).

**Suggested action.** Target a minimum-viable test per high-risk component. Rank-ordered by value:
1. `PreferencesOverlay` (after F1 split: one test per tab, ~20 tests total).
2. `Calendar` (keyboard grid nav, hasEntry dot, month picker toggle — ~8 tests).
3. `EditorPanel` integration test (after F2 refactor — ~4 tests).
4. `JournalPicker` (add/remove/rename flows; empty state; error display — ~6 tests).
5. `state/auth.ts` (the journal state-machine transitions, not just session boundary — ~8 tests).

This is ~50 new tests and moves the needle from ~8 / 25 to ~13 / 25 components tested. Not comprehensive, but covers every high-risk surface.

### 5.5 Finding F4 — **P3**: i18n locale list is inconsistent (`en.ts` vs JSON locales)

**Evidence.** `src/i18n/locales/en.ts` is a typed TypeScript canonical source. Other locales (`de.json`, `es.json`, `it.json` per memory `i18n.md`) are JSON. The validator (`bun run validate:locales`) reconciles them.

**Why this is P3.** It works and the validator catches drift. A purist would say the canonical source should be JSON too (so tooling like Crowdin/Lokalise could operate uniformly) or TypeScript too (for type-checked placeholders). Picking one is preference, not correctness.

**Suggested action.** Skip unless community translator onboarding becomes a friction point. If it does, migrate `en.ts` → `en.json` and generate the TypeScript type from JSON at build time.

### 5.6 Finding F5 — **P3**: `debounce.ts` has `any` leaks

**Evidence.** `src/lib/debounce.ts` uses `// eslint-disable-next-line @typescript-eslint/no-explicit-any` twice — once on the generic constraint, once on `this: any`. This is standard for a generic debounce and is explicitly approved by the eslint exception.

**Why this is P3.** No behavior issue; the `any` is contained. Could use `unknown[]` + stricter constraint but would complicate ergonomics for callers.

**Suggested action.** Leave it. Noted only for completeness.

### 5.7 Status — Frontend Simplicity

Mostly good. Two hot spots named above (F1, F2). Lib helpers are tiny and focused. Reactive patterns are correct — every `createMemo` wrapping an i18n-touching array comply with the "module-level arrays using translations" rule documented in `src/CLAUDE.md`. Event-handler-in-Effect cleanups are present in `App.tsx`, `MainLayout.tsx`, `Sidebar.tsx` (no listener leak found).

### 5.8 Status — Frontend Performance

No performance concerns. The only potentially expensive path is base64 image embedding in TipTap — `DiaryEditor.tsx:26-57` caps every image at 1200×1200 px and re-encodes to JPEG@0.85 before insertion. This is the memoized right thing. Large-entry encryption cost scales linearly with text+image size and is acceptable for the journaling workload.

Notifications overlay (`state/notifications.ts`) reads `/notifications.json` once on mount and caches; `autoMarkStale` prunes anything >90 days. Fine.

## 6. Cross-Cutting Findings

### 6.1 Finding X1 — **P3**: `lib.rs` legacy app-dir resolution

**Evidence.** `src-tauri/src/lib.rs` carries legacy app-dir resolution for `MINI_DIARIUM_APP_DIR` / `MINI_DIARIUM_DATA_DIR` overrides. This is E2E-only. The E2E comment block in `e2e/CLAUDE.md` documents the env-var contract.

**Why this is P3.** It works, it's documented, and it's platform-isolated via `#[cfg]`-style dispatch to env checks. Not worth touching.

## 7. Summary Table of Findings

| ID | Priority | Area | Title | Est. effort |
|---|---|---|---|---|
| A1 | **P1** | Docs | Documented state layer out of date | 30 min |
| A2 | **P1** | Frontend | Dead state code in `entries.ts` / `auth.ts` | 1 h |
| A3 | **P1** | Decisions | Passwordless-journal memory-vs-reality drift | 1 h (write a decision doc) |
| B1 | P2 | Backend | Four import commands near-duplicated | 1 h (subsumed by B2) |
| B2 | P2 | Backend | Legacy import commands duplicate plugin path | 1.5 h |
| B3 | P2 | Backend | `export/markdown.rs` hand-rolled converter (1025 LOC) | 4–8 h |
| F1 | P2 | Frontend | `PreferencesOverlay.tsx` is 1400 LOC | 4–6 h |
| F2 | P2 | Frontend | `EditorPanel.tsx` is 675 LOC of race management | 6–10 h (refactor + test) |
| F3 | P2 | Testing | Frontend component-test gaps on high-risk UIs | 8–12 h (incremental) |
| B4 | P3 | Backend | `DiaryState` lock-guard boilerplate | 2 h (optional) |
| F4 | P3 | i18n | `en.ts` vs JSON locale inconsistency | Skip unless friction |
| F5 | P3 | Code | `debounce.ts` `any` leaks | Skip |
| X1 | P3 | Docs | `lib.rs` legacy app-dir resolution comment | Skip |

**Total P1 work: ~2.5 hours.**
**Total P2 work (without test expansion): ~17–30 hours.**
**Total P3 work: skip by default.**

## 8. Self-check

Every finding was cross-checked against the code at the referenced line ranges at review time. Commands used: `cargo test` (276 passed), `cargo clippy -- -D warnings` (0 warnings), `cargo build` (clean), `bun run test:run` (229 passed), `bun run type-check` (clean), `bun run lint` (clean). File LOC counts verified via `wc -l`. Memory vs reality check for A3 performed against `src-tauri/src/auth/auto_key.rs` + `config.rs:JournalConfig` + `commands/auth/auth_core.rs:create_diary_auto` (line 260).

Known limits of this review:
- Did not benchmark or profile; performance analysis is read-and-reason only.
- Did not run E2E locally (`bun run test:e2e:local`); relied on the existing two spec files and CI history.
- Did not audit `website/` (per user scope: core app only).
- Did not audit `benchmarks/` internals, only confirmed they exist and track in CI.

## Appendix A — Source File Size Census (LOC)

**Backend (`src-tauri/src/`, ≥200 LOC shown):**

| File | LOC |
|---|---:|
| `db/schema.rs` | 1402 |
| `export/markdown.rs` | 1025 |
| `db/queries.rs` | 837 |
| `plugin/rhai_loader.rs` | 549 |
| `commands/auth/auth_methods.rs` | 509 |
| `commands/auth/auth_core.rs` | 490 |
| `config.rs` | 422 |
| `backup.rs` | 415 |
| `commands/import.rs` | 380 |
| `commands/auth/auth_journals.rs` | 363 |
| `commands/stats.rs` | 316 |
| `commands/debug.rs` | 301 |
| `crypto/cipher.rs` | 296 |
| `commands/auth/auth_directory.rs` | 281 |
| `menu.rs` | 273 |
| `lib.rs` | 245 |
| `crypto/password.rs` | 232 |
| `auth/keypair.rs` | 221 |

**Frontend (`src/`, ≥200 LOC shown):**

| File | LOC |
|---|---:|
| `components/overlays/PreferencesOverlay.tsx` | 1400 |
| `components/layout/EditorPanel.tsx` | 675 |
| `components/calendar/Calendar.tsx` | 479 |
| `components/auth/JournalPicker.tsx` | 428 |
| `lib/tauri.ts` | 305 |
| `components/editor/DiaryEditor.tsx` | 285 |
| `state/auth.ts` | 234 |
| `components/layout/MainLayout.tsx` | 214 |
| `components/auth/PasswordCreation.tsx` | 205 |

## Appendix B — Test Coverage Matrix

**Backend** — 32 modules with `#[cfg(test)]`; 276 tests passing. Gaps are intentional: `lib.rs`, `main.rs`, `screen_lock.rs`, `menu.rs` (tauri scaffolding without Tauri test infra).

**Frontend** — 22 test files; 229 tests passing:

| Category | Tested | Untested (non-trivial) |
|---|---|---|
| Auth components | JournalPicker, PasswordCreation, PasswordPrompt | — |
| Editor | TitleEditor, WordCount, EntryNavBar, EditorToolbar | **DiaryEditor** |
| Layout | MainLayout event listeners, EditorPanel (three logic-mock files) | **EditorPanel (integration), MainLayout (rest), Sidebar, Header** |
| Overlays | NotificationsOverlay | **PreferencesOverlay, ExportOverlay, ImportOverlay, StatsOverlay, GoToDateOverlay, AboutOverlay** |
| Search | — | SearchBar, SearchResults (interface contract only; not rendered) |
| Calendar | — | **Calendar** |
| State | auth-session-boundary, notifications | **auth (full state machine), journals, ui, preferences, search, entries, session** |
| Lib | dates, import, tauri-params, theme-overrides, wordcount, markdown, i18n | debounce, logger, errors, theme |

**E2E** (`e2e/specs/`, 2 specs, 356 LOC total):
- `diary-workflow.spec.ts` (111 LOC) — single-entry golden path.
- `multi-entry.spec.ts` (245 LOC) — multi-entry navigation.

Gaps: no E2E spec for preferences, no spec for journal switching, no spec for import/export. E2E is thin; frontend unit coverage is the cheaper lever to pull first (per F3).
