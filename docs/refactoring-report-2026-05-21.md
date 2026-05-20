# Mini Diarium — Sustainability & Simplification Report

_Generated: 2026-05-21 · Branch: feature-v0.5.0 · Reviewer: claude-opus-4-7_
_Revised: 2026-05-21 after independent review (`refactoring-report-2026-05-21-review.md`) — see [Revision Log](#revision-log) at end._

This is a deep, codebase-wide review of Mini Diarium with one goal: **keep the code simple to read, simple to maintain, simple to change**. Every proposal is grounded in PHILOSOPHY.md (small core, boring security, focused scope, simple is good) and SECURITY.md (no network, no custom crypto, no recovery, honest threat model, no lock-in).

The aim is *not* cosmetic. Each item targets a real maintainability or correctness risk.

---

## Part I — Status Quo

### 1.1 The Good (preserve these)

These pieces are well-designed and should be **protected from regression** as the project grows.

- **Cryptographic core is tight.** `crypto/cipher.rs` (311 LoC) and `crypto/password.rs` (232 LoC) are small, single-purpose, well-tested, and use only audited libraries. They expose a minimal surface (`Key`, `encrypt`, `decrypt`, `hash_password`, `verify_password`, `derive_key_from_phc_hash`, `tag_name_fingerprint`). No churn needed.
- **Auth method abstraction is symmetrical.** `auth/password.rs`, `auth/keypair.rs`, `auth/auto_key.rs` all implement the same `wrap_master_key` / `unwrap_master_key` contract. The blob formats are documented inline. `SecretBytes` + `ZeroizeOnDrop` give defense-in-depth that is easy to reason about.
- **Domain split is genuine.** `crypto/`, `auth/`, `db/`, `import/`, `export/`, `plugin/`, `commands/` are real seams, not folders pretending to be modules. Plugin traits (`ImportPlugin` / `ExportPlugin`) are minimal — 2 methods each — and built-ins implement the same trait as Rhai user scripts (Principle 1: no privileged "built-in" path).
- **Migrations are safe — with a deliberate two-tier policy.** The expensive migrations (`v1→v2`, `v2→v3` — the latter re-encrypts every entry) explicitly create a pre-migration backup, run inside `BEGIN IMMEDIATE TRANSACTION`, and on failure roll back with a recovery message that names the backup path. The DDL-only migrations (`v3→v4`, `v4→v5`, `v5→v6`, `v6→v7`) deliberately skip the backup step — they use `execute_batch("BEGIN IMMEDIATE; ...; COMMIT;")` and rely on SQLite's atomic-rollback guarantee on transaction failure. The distinction is intentional and documented inline. Tests cover the v2→v3 rollback path explicitly.
- **The IPC error sanitization contract exists and is widely used.** Most user-facing error paths flow through `mapTauriError()` in `errors.ts` (e.g. `PreferencesSecurityTab`, `PasswordPrompt`, `EditorPanel`). The helper itself is a clean choke point. **Caveat:** not every `invoke()` callsite uses it — `ImportOverlay.tsx:82,108`, `StatsOverlay.tsx:34`, and `PasswordCreation.tsx:32,58` still surface raw `err.message` / `String(err)` to UI state. See P19 for the audit item.
- **Tests are real.** Backend tests hit real SQLite, real encryption, real Argon2 — no DB mocking. The schema-migration tests build legacy v1 databases by hand and run the upgrade path end-to-end. Frontend tests use `@solidjs/testing-library` with realistic interactions.
- **Network isolation is layered properly.** CSP + init-script + `on_navigation` + `on_new_window(Deny)` + platform-specific (Win32 COM handler, WK ContentRuleList) + Flatpak no-network. Each layer is independent and documented.
- **Plugin sandbox is appropriately constrained.** Rhai has explicit op/call/string limits in `create_sandboxed_engine`. Host functions are a tight whitelist.

### 1.2 The Bad (real friction; fixable)

#### B1. Repetition in command boilerplate (the unlocked-DB preamble specifically)

Most backend commands that need a decrypted DB begin with the same 6-line preamble:

```rust
let db_state = state.db.lock().map_err(|_| "State lock poisoned".to_string())?;
let db = db_state.as_ref().ok_or("Journal must be unlocked")?;
```

**Accurate counts (production code only):**

- `state.db.lock()` appears ~**35 times** in production (counting line-wrapped builder form), targeting the unlocked `DatabaseConnection`.
- `"Journal must be unlocked..."` (small wording variations) appears **27 times** — these are the actual `as_ref().ok_or(...)` follow-ups.
- The literal `"State lock poisoned"` appears **57 times** total, but this includes locks on **other** mutexes — `state.db_path`, `state.backups_dir`, and `State<Mutex<PluginRegistry>>`. Those are **not** candidates for a `with_unlocked_db` helper.

**So the realistic target set for P1 is the ~27 commands that combine `state.db.lock()` + the unlocked check** — concentrated in `commands/entries.rs`, `commands/tags.rs`, `commands/stats.rs`, `commands/export.rs`, `commands/plugin.rs`, `commands/debug.rs`, `commands/files.rs`, and the auth-method commands. The other ~30 lock sites need other helpers (P1 alternatives) or stay as-is.

Refactoring the locking strategy (e.g. switching to `parking_lot::Mutex`) would still touch every site, but the helper would consolidate the `db`-mutex subset.

#### B2. Markdown export triplication

`export/markdown.rs` defines three top-level functions:
- `export_entries_to_markdown` (lines 31–79)
- `export_entries_to_markdown_with_assets` (lines 361–414)
- `export_entries_to_markdown_inline` (lines 422–469)

All three repeat the same date-grouping logic (lines 36–45, 368–377, 426–435) and the same per-entry header rendering (lines 47–75, 379–411, 437–467). The only difference is how `<img>` tags are processed. ~50 lines of duplicated control flow per variant; ~140 LoC of pure duplication.

#### B3. `migrate_require_all_auth_to_db` duplicated across unlock paths

In `commands/auth/auth_core.rs`, the same one-time migration call appears at lines 124, 177, and 478 — inside `unlock_diary`, `unlock_diary_with_keypair`, and `unlock_diary_all_methods`. The migration body is at lines 35–67. If the migration logic changes (e.g. add another legacy key), three call sites must stay in sync.

#### B4. The three unlock commands share ~80% of their structure

`unlock_diary` (51 LoC), `unlock_diary_with_keypair` (51 LoC), and `unlock_diary_all_methods` (~115 LoC) all do the same scaffolding: read `db_path`/`backups_dir` from state, check existence, open DB, run `migrate_require_all_auth_to_db`, check `require_all_auth` guard, install into state, log, run `backup_and_rotate`, update menu. The credential-verification logic differs but the wrapper is identical.

#### B5. SQL row decoding repeated for `DiaryEntry`

`db/queries.rs` has the same row tuple unpacking `(i64, String, Vec<u8>, Vec<u8>, i32, String, String)` followed by manual `cipher::decrypt` + `String::from_utf8` mapping at 4+ call sites: `get_entries_by_date`, `get_entry_by_id`, `get_all_entries`, `get_entries_in_range`. Each version subtly differs in error handling (some use `?`, some use `filter_map(.ok).unwrap_or_default()`), which is worse — same data, inconsistent guarantees.

#### B6. `PreferencesSecurityTab.tsx` mixes 5 features in one 580-line component

It owns: auth-method list + removal, add-password form, add-keypair form, change-password form, require-all-auth toggle, auto-lock settings. Each section has its own buffered signals and async handler. ~6 signals per feature × 5 features = ~30 signals + 5 handlers, all in one file.

#### B7. `DiaryEditor.tsx` (518 LoC) is doing too much

The component owns: TipTap editor mount + content sync, font-face injection via `<style>` element, drop-target state, drop-hint timer, BiDi extension definition, AlignableImage extension definition, image-resize-and-embed for File/path/dataURL, manual MIME-from-extension mapping, paste handler, drag-over visual feedback. The two TipTap extensions (`BidiExtension`, `AlignableImage`, `TimestampMark`) are large enough to deserve their own files — they have no coupling to the component beyond being passed to `Editor({ extensions })`.

#### B8. Dead/orphaned code

- `_isLoadingEntry` signal in `EditorPanel.tsx:36` is set by `useEntryLifecycle` but never read.
- `JournalConfig.require_all_auth` field is marked `TODO: deprecated` (config.rs:15) but is still populated, serialized (conditionally), and read in `migrate_require_all_auth_to_db`. The migration was added to phase it out — but the field stays, the deprecation never finishes.
- Empty directories `src-tauri/src/backup/` and `src-tauri/src/i18n/` exist as ghost folders (real content lives in `backup.rs` and... no actual i18n module — `src-tauri/CLAUDE.md` doesn't reference `src-tauri/src/i18n/` at all). They confuse readers about the structure.

### 1.3 The Ugly (these are *not* working; high risk)

#### U1. `db/schema.rs` (1658 LoC) is a god module

It owns: the `DatabaseConnection` struct, schema version constant, 3 entrypoints (`create_database`, `open_database`, `open_database_with_keypair`), 2 auto-key variants (`create_database_auto`, `open_database_auto`), 6 migration functions (`migrate_v1_to_v2` ... `migrate_v6_to_v7`), `create_schema` SQL DDL, legacy hash derivation helper, all tests. 

Adding a new migration today means scrolling past 800 LoC to find a parallel example. Adding a new auth type means touching at least 3 functions. The schema DDL and the migration DDL drift over time (the create-schema CREATE TABLE for `entries` and the v4→v5 migration's CREATE TABLE differ subtly — both correct, but you have to read both to verify).

#### U2. `db/queries.rs` (1594 LoC) owns 5 different domains

Sections, in order: entries (insert/get/update/delete/range), `count_words`, tags CRUD + association, db_settings + MAC verification, auth_slots CRUD. A reader looking for "how do we list auth slots?" must scroll through tagging code. A reader looking for tag fingerprint logic finds it split between `crypto/cipher.rs` (`tag_name_fingerprint`) and `db/queries.rs` (`create_tag` uses it). The MAC computation lives next to entry CRUD even though it's authentication infrastructure.

#### U3. `commands/auth/auth_methods.rs` (887 LoC) is doing identity, slot management, multi-auth slot peeking, and the require-all-auth setting

Eight Tauri commands plus a peek struct hierarchy plus 500 LoC of tests. The verify/register/remove/list functions overlap with `auth_core.rs` (which has change_password using `get_password_slot`). The `set_require_all_auth` command lives here for historical reasons but logically belongs with the journal/policy settings.

#### U4. `lib.rs` (547 LoC) mixes setup with two giant platform-specific COM handlers

Lines 1–280: legitimate Tauri setup (state, plugins, menu, navigation guard, dev-mode hooks, command registry). Lines 281–547: two `#[cfg(target_os = "...")]` functions that are ~80 LoC each of platform-specific COM/WebKit unsafe code. They are correctly written, but they have no business living in the entry-point file. Reading lib.rs to understand the app means scrolling past a `WebResourceRequested` event handler.

#### U5. Tests that pretend to test guarded functions

`auth_directory.rs:259–296` (`test_change_diary_directory_blocked_when_unlocked`) is misleading. The test sets `let is_unlocked = true;` and tests that this local boolean returns the right error. The actual command `change_diary_directory` does not contain such a guard — it calls `auto_lock_diary_if_unlocked` and proceeds. The test gives false confidence that "we check the diary is locked first." If a future change accidentally removes the auto-lock call, this test would still pass.

`auth_methods.rs:459–478` (`test_remove_auth_method_last_slot_guard`) similarly reimplements the guard inline and tests it against itself rather than calling `remove_auth_method`.

#### U6. Stale schema documentation drift

In-repo docs:

- `PHILOSOPHY.md` line 231: "Current coverage (as of v0.4.19): 276 tests across 32 modules" (out of date — newer code added, never updated).
- `PHILOSOPHY.md` line 264: "Current version: v6" — but `SCHEMA_VERSION = 7` since the tags migration shipped.
- `SECURITY.md` lines 9–10: "0.3.x — Supported / 0.2.x — No" — the project is now at v0.5.0; the supported-versions table was never updated.
- `AGENTS.md` line 116: "There are **54 registered Tauri commands**" — the current `generate_handler![]` in `lib.rs` has 62 entries. (Surfaced by the review of this report — missed in the original pass.)

External / out-of-repo context (not in the repo):

- The session's auto-memory file `MEMORY.md` (stored in the agent runtime under `~/.claude/projects/.../memory/`, **not** in this repository) carries a "DB Schema v5" line that is also stale at v7. This is an agent-memory hygiene issue, not a repo issue — it does not need a code change, but the agent should refresh its memory when it next touches schema work.

This is not a code problem per se, but it's a **trust** problem: the security policy, philosophy doc, and AGENTS.md all name versions that no longer exist. A reader who fact-checks one and finds it wrong will doubt the rest.

#### U7. Frontend test coverage is asymmetric on the auth/security surface

**15 of 32 component `.tsx` files have no same-name test** (counting `*.tsx` excluding `*.test.tsx`; 17 test files exist alongside 15 untested components and tests for some hooks). The **most security-relevant uncovered component (`PreferencesSecurityTab.tsx`, 580 LoC, 4 forms touching credentials)** is in that set. The 4 forms are: change password, add password, add keypair (3 backend calls), remove auth method. These exercise password verification, keypair generation, file dialogs, file writes — every code path that touches user secrets. A regression here could silently let users register a keypair that won't unlock, or skip the password-verification step before removal.

The specific untested files are: `SearchResults.tsx`, `SearchBar.tsx`, `TagManager.tsx`, `AboutOverlay.tsx`, `PreferencesSecurityTab.tsx`, `PreferencesGeneralTab.tsx`, `PreferencesDataTab.tsx`, `PreferencesAdvancedTab.tsx`, `OnboardingOverlay.tsx`, `Sidebar.tsx`, `Header.tsx`, `PasswordStrengthIndicator.tsx`, `DiaryEditor.tsx`, `TimestampOverlay.tsx`, `EntryTags.tsx`.

#### U8. No Tauri command integration tests

Every backend test calls the underlying `db/queries::*` or `auth::*::method` functions directly. None call the Tauri commands through the `State<DiaryState>` injection. This is acceptable for individual logic but it means the IPC layer itself — argument deserialization (camelCase ↔ snake_case mapping), `State` extraction, error string formatting — is never tested. If a serde-field rename breaks IPC, only manual smoke testing or E2E catches it.

---

## Part II — Prioritized Proposal

Items are scored by **Impact** (how much it simplifies day-to-day work) and **Effort** (LoC touched, test risk, review surface). PHILOSOPHY/SECURITY alignment is called out per item.

### Tier 1 — High impact, low effort (do these first)

---

#### P1. Introduce `with_unlocked_db` helper for the ~27 unlocked-DB command sites

**Problem:** B1. ~27 commands (`entries.rs`, `tags.rs`, `stats.rs`, `export.rs`, `plugin.rs`, `debug.rs`, `files.rs`, plus several auth-method commands) begin with the same 6-line `state.db.lock()` + `as_ref().ok_or(...)` preamble. The lock-poisoned and journal-unlocked error strings are scattered.

**Important scope note:** This helper only targets commands that need `&DatabaseConnection`. The other ~30 production `.lock()` sites (`state.db_path`, `state.backups_dir`, `State<Mutex<PluginRegistry>>`) are **not** in scope and will not benefit from this helper. The original report's "50+ sites / 250 LoC reduction" estimate conflated unrelated mutexes; the realistic reduction is closer to **~150 LoC across ~27 commands**.

**Proposal:** Add to `commands/auth/mod.rs`:

```rust
pub(crate) fn with_unlocked_db<T>(
    state: &DiaryState,
    f: impl FnOnce(&DatabaseConnection) -> Result<T, String>,
) -> Result<T, String> {
    let db_state = state.db.lock().map_err(|_| "Journal state lock failed".to_string())?;
    let db = db_state.as_ref().ok_or("Journal must be unlocked")?;
    f(db)
}
```

Then `save_entry`, `get_entries_for_date`, etc. become:

```rust
#[tauri::command]
pub fn save_entry(id: i64, title: String, text: String, state: State<DiaryState>) -> Result<(), String> {
    with_unlocked_db(&state, |db| {
        let mut entry = queries::get_entry_by_id(db, id)?.ok_or_else(|| format!("No entry: {id}"))?;
        // ...
        queries::update_entry(db, &entry)
    })
}
```

Net change per command: -5 lines. **Realistic total: ~150 LoC across ~27 commands** (down from the original report's overstated 250). One canonical error string. Refactoring the lock primitive later changes one function.

**Alternative considered:** Make `DiaryState::with_unlocked` a method on the state struct. Rejected because it's a free function — making it a method requires `&self`, and we'd want `with_unlocked(&state, ...)` to remain ergonomic. A free function with the state as the first param is simpler. Either reads fine; the free function is one less indirection.

**Security impact:** Neutral — same logic, single location. Easier to audit. **However**, this is not purely mechanical: it changes the error string returned to the frontend (currently "State lock poisoned" / "Journal must be unlocked..." varies; the helper unifies them). If `mapTauriError()` or any test matches on the old strings, those callsites must be updated in the same PR.

**Test impact (corrected from prior pass):** The original report claimed "no new tests needed." That is too aggressive for this repo — most affected commands have no direct command-level tests today (only underlying-function tests), so a regression in the helper's error string or lock acquisition would not be caught.

**Required test work before broad rollout:**
1. Write two focused tests against the helper directly: one for the unlocked path (returns inner result), one for the locked path (returns "Journal must be unlocked" error).
2. Pick 2–3 representative commands (e.g. `save_entry`, `get_statistics`, `list_auth_methods`) and add a locked-vs-unlocked smoke test for each before the broad mechanical conversion. This can either use a small Tauri command harness (P14) or call the command function directly with a manually-constructed `DiaryState` and `State` wrapper.

---

#### P2. Extract a single `group_entries_by_date_with_header` walker to deduplicate the three Markdown export variants

**Problem:** B2. ~140 LoC of duplicated date-grouping in `export/markdown.rs`.

**Proposal:** Replace the three top-level functions with one that takes a `process_text` closure:

```rust
fn export_markdown_with<F>(entries: Vec<DiaryEntry>, mut process_text: F) -> String
where F: FnMut(&str, &mut Vec<(String, Vec<u8>)>) -> String
{
    // single implementation: header, group by date, per-entry header, call process_text(entry.text, &mut assets), trim
}
```

Then:
- `export_entries_to_markdown` = call with `process_text = |t, _| html_to_markdown(t)`
- `export_entries_to_markdown_with_assets` = call with the asset-extracting closure; assets accumulate in the returned Vec
- `export_entries_to_markdown_inline` = call with `process_text = |t, _| html_to_markdown(&inline_replace_images(t, ...))`

Net change: ~140 LoC removed, one source of truth for the date-group ordering and the "Entry N" fallback heading rule.

**Alternative considered:** Pull the date-grouping into a public `iter_grouped_by_date(entries: &[DiaryEntry]) -> impl Iterator<...>` and write the three functions on top of it. This is cleaner conceptually but produces less reduction because each variant still has its own outer loop. The closure approach is denser and easier to follow when the only difference between variants is "what do you do with the text body?"

**Security impact:** None.

**Test impact:** The existing 38 markdown tests already cover all three entry points. The unified implementation passes the same suite without changes.

---

#### P3. Split `db/queries.rs` (1594 LoC) into 5 files by domain

**Problem:** U2. Five unrelated query domains in one file. This is the most-edited file in the backend; future contributors waste time scrolling.

**Proposal:** New layout:

```
src-tauri/src/db/
├── mod.rs                  # re-exports
├── schema.rs               # unchanged for now (P4 splits it)
├── queries/
│   ├── mod.rs              # DiaryEntry struct + re-exports
│   ├── entries.rs          # insert/get/update/delete/range, count_words
│   ├── tags.rs             # Tag struct + create/get/rename/delete/associate/get_dates_by_tag
│   ├── auth_slots.rs       # get_password_slot, get_keypair_slot_by_pubkey, insert/update/delete/list/count
│   └── db_settings.rs      # get/set/delete + verify_require_all_auth + MAC
```

Move all tests with their functions. No logic changes. Pure file-split.

**Alternative considered:** Keep one file but use `// ─── tag queries ───────` section comments (the current approach). Rejected because the file already does that *and* it's still 1594 lines — the section comments don't help when you `Ctrl+P` to "the queries file" and have to grep within it. File-level separation gives every reader's editor a useful sidebar.

**Security impact:** None (mechanical move).

**Test impact:** All tests move with their functions. No behavior changes.

---

#### P4. Split `db/schema.rs` (1658 LoC) — separate `migrations.rs` and per-auth-type open paths

**Problem:** U1. One file owns schema creation, 3 open entrypoints (password/keypair/auto), 6 migrations, helpers, all tests.

**Proposal:**

```
src-tauri/src/db/
├── mod.rs                  # DatabaseConnection + SCHEMA_VERSION constant
├── schema/
│   ├── mod.rs              # re-exports, DatabaseConnection
│   ├── create.rs           # create_database (password), create_database_auto, create_schema DDL
│   ├── open.rs             # open_database, open_database_with_keypair, open_database_auto, open_v3_with_password helper
│   ├── legacy.rs           # get_metadata, derive_key_from_hash (only used by v1/v2 → v3 migration)
│   └── migrations/
│       ├── mod.rs          # apply_pending(&db) — calls each migration in order
│       ├── v1_to_v2.rs
│       ├── v2_to_v3.rs     # the only re-encryption one
│       ├── v3_to_v4.rs
│       ├── v4_to_v5.rs
│       ├── v5_to_v6.rs
│       └── v6_to_v7.rs
└── queries/                # from P3
```

Crucially: introduce `migrations::apply_pending(db)` that calls v3→v4 → v4→v5 → ... → v6→v7 in order. Every `open_*` function calls this once, removing the 4 hardcoded migration calls in each of `open_database`, `open_database_with_keypair`, `open_database_auto`. When v7→v8 ships, you add one file and one line in `migrations/mod.rs`, not 4 lines in 4 places.

**Alternative considered:** Keep `schema.rs` as one file but add the `apply_pending` helper only. Rejected because the file size is half the problem — `migrations/v2_to_v3.rs` (the re-encryption one, ~140 LoC) needs to be findable as the canonical "expensive migration with backup" example. Hiding it inside a 1658-line file undersells it.

**Security impact:** Positive — `apply_pending` becomes the chokepoint for migration ordering, easier to review. No logic change otherwise.

**Test impact:** Move each migration's test next to its function. The cross-version "v1→v7" integration test stays in `schema/mod.rs` or moves to `migrations/mod.rs`. Same coverage.

---

#### P5. Extract `RowMapper for DiaryEntry` to eliminate row-decoding duplication

**Problem:** B5. Four query functions repeat the same `row.get::<_, T>(...)` tuple + decrypt + utf8 dance.

**Proposal:** Add to `db/queries/entries.rs` (the snippet below is **pseudocode — must be compiled and adjusted before merging**; the exact `rusqlite::Error` constructor signature and the error trait bounds for `.into()` may differ in the current rusqlite version):

```rust
// PSEUDOCODE — confirm the rusqlite::Error variant and error trait bounds at implementation time.
fn row_to_entry(db: &DatabaseConnection, row: &rusqlite::Row) -> rusqlite::Result<DiaryEntry> {
    let title_enc: Vec<u8> = row.get(2)?;
    let text_enc: Vec<u8> = row.get(3)?;
    // Decryption failure must NOT be silently swallowed (a 0-LoC fallback masks corruption).
    // Map decrypt errors into rusqlite::Error so the outer query can surface them uniformly.
    let title = decrypt_utf8(db.key(), &title_enc)
        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(2, rusqlite::types::Type::Blob, Box::new(e)))?;
    let text = decrypt_utf8(db.key(), &text_enc)
        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(3, rusqlite::types::Type::Blob, Box::new(e)))?;
    Ok(DiaryEntry { id: row.get(0)?, date: row.get(1)?, title, text,
                    word_count: row.get(4)?, date_created: row.get(5)?, date_updated: row.get(6)? })
}
```

The current `CipherError` type derives `Debug` and implements `Display + Error`, so `Box<dyn Error + Send + Sync>` should work — but the cleanest path is to introduce a local error enum (`EntryDecodeError`) that wraps both `CipherError` and `FromUtf8Error`, implements `std::error::Error`, and is `Send + Sync + 'static`. Either approach is fine; the snippet above is the conceptual shape, not a copy-paste-ready implementation.

Then `get_entries_by_date`, `get_entry_by_id`, `get_all_entries`, `get_entries_in_range` all just prepare a statement and `query_map(|row| row_to_entry(db, row))`. The standard `SELECT id, date, title_encrypted, text_encrypted, word_count, date_created, date_updated FROM entries` literal becomes a `const ENTRY_SELECT: &str = ...`.

Critical side benefit: **`get_all_entries` currently uses `.unwrap_or_default()` on decryption failures, silently returning empty strings for corrupt entries.** The unified helper makes decryption failures explicit — a future "why is my export missing entry titles?" bug becomes a real error, not silent corruption.

**Alternative considered:** A blanket `impl FromRow<'_, ...> for DiaryEntry`. Rejected because the cipher key is part of the conversion — `FromRow` would have to be parameterized by the key, which is uglier than just passing `db` to a function.

**Security impact:** Positive — corruption no longer silently passes.

**Test impact:** Existing tests still pass. Add one new test: corrupt the title_encrypted blob, call `get_all_entries`, assert error (verifies the silent-fallback fix).

---

#### P6. Remove dead code: `_isLoadingEntry`, the empty directories — and *plan* (don't yet execute) the `require_all_auth` legacy-field removal

**Problem:** B8. Orphaned signals, ghost folders, and a deprecated config field.

**Proposal (split into safe-now vs. plan-only):**

**Safe to do now:**

1. **Delete `_isLoadingEntry`** in `EditorPanel.tsx:36`. It is set by the lifecycle hook but never read. The lifecycle hook should stop setting it; the prop should be removed from `useEntryLifecycle`'s contract (the signal *setter* is wired through, but the getter is dead — see `EditorPanel.tsx:36`, `useEntryLifecycle.ts:30,130,176`).
2. **Delete `src-tauri/src/backup/` and `src-tauri/src/i18n/`** empty directories. They confuse readers and IDE breadcrumbs.

**Plan only — do NOT execute yet:**

3. **Phase out `JournalConfig.require_all_auth`** (config.rs:17) across two releases. The original report proposed removing the field while still keeping `migrate_require_all_auth_to_db` (auth_core.rs:35) reading it — these cannot both happen with the current typed `serde` config model. Worse, premature removal risks **silently dropping a security flag** for users who have not yet opened a journal on a version that migrated it.

   Correct phased plan:

   Per P16's Option B decision (no sentinel), the phasing is simpler than originally drafted:

   - **Release N (now / current branch):** Keep both the field and the migration. Do nothing destructive. The existing idempotent derived-state check in `migrate_require_all_auth_to_db` already provides the safety net.
   - **Release N+k (a chosen future boundary, announced in CHANGELOG):** Single PR removing all the legacy machinery together:
     - `JournalConfig.require_all_auth` (config.rs:17)
     - `JournalInfo.require_all_auth` (config.rs:27)
     - `set_journal_require_all_auth` and its callsites in `commands/auth/auth_methods.rs` (the cleanup branch) and `commands/auth/auth_core.rs` (legacy reset)
     - `migrate_require_all_auth_to_db` itself
     - The frontend type field at `src/lib/tauri.ts:139` (`require_all_auth: boolean` inside `JournalConfig` type)
     - The matching test references in `src/components/auth/JournalPicker.test.tsx`

   The decision on *which* release boundary is the maintainer's call (CHANGELOG announcement + a reasonable support window).

**Alternatives considered:**

- *Leave `_isLoadingEntry` as a future hook for loading spinners.* Rejected — Principle 6 says don't add for hypothetical futures.
- *Drop the legacy `require_all_auth` field immediately and rely on every user having unlocked on a recent build.* Rejected — this is a security flag, not a UX flag. A stale install could silently lose multi-auth enforcement.
- *Sentinel row in `db_settings` to skip re-reading the legacy field (originally Option A under P16).* Rejected per P16's Option B decision — adds tampering surface without benefit.

**Security impact:** Items 1+2 in the next PR are neutral. Item 3 done correctly at a future release boundary removes a duplicated source of truth (currently mitigated only by the MAC check in `db_settings`). Item 3 done wrong (premature removal) silently disables multi-auth enforcement for some users.

**Test impact:**

- For 1+2: existing tests still pass; no new tests needed.
- For 3 (release N+k): the two `config.rs` tests for `set_journal_require_all_auth` get removed alongside the field. `JournalPicker.test.tsx` needs updating to drop the `require_all_auth` field reference. **Before merging the removal PR**, add a regression test: build a `config.json` with `require_all_auth: true` set on the legacy field, unlock, confirm the `db_settings` row is written. (This test stays in the codebase for one release after the migration, then can be removed with the migration code itself.)

---

#### P7. Fix the misleading "guard" tests

**Problem:** U5. `test_change_diary_directory_blocked_when_unlocked` and `test_remove_auth_method_last_slot_guard` test inline reimplementations of the guard, not the actual function. Future regressions would not catch.

**Proposal:**

- For `change_diary_directory`: there *is no* explicit "must be locked" guard in production. The function calls `auto_lock_diary_if_unlocked` and proceeds. The misleading test should be **deleted** (it doesn't test what its name claims) and replaced with a test that verifies the actual behavior: starting with an unlocked DB, calling the directory change auto-locks before moving the file. (This requires either lifting the `change_diary_directory_inner` boundary or accepting that integration testing is needed — see P14.)
- For `remove_auth_method_last_slot_guard`: same — delete the inline guard reimplementation and write a test that calls `count_auth_slots(&db)` and asserts the actual guard branch in `remove_auth_method` is reached. The trickiest part is that `remove_auth_method` requires `State<DiaryState>`; this folds into P14 (Tauri integration test harness).

**Alternative considered:** Keep both tests as "documentation of intent" with a comment. Rejected — a passing test that doesn't test what its name says is worse than no test. It actively misleads.

**Security impact:** Positive (closing a hole where a guard regression would pass tests).

**Test impact:** Net +1 or +2 tests once P14 lands. Until then, the deleted tests reduce false-positive coverage.

---

#### P8. Update stale documentation (PHILOSOPHY, SECURITY, AGENTS)

**Problem:** U6. Multiple in-repo docs name versions/schema versions/command counts that no longer exist.

**Proposal:**

- `PHILOSOPHY.md`:
  - Line 231: "v0.4.19" → current version; **remove the exact test totals entirely** — replace "276 tests across 32 modules" / "229 tests across 22 files" with "comprehensive test coverage across backend modules / frontend components. Run `cargo test` and `bun run test:run` for current totals." Exact counts rot too fast to be useful in a philosophy doc.
  - Line 264: "Current version: v6" → "v7" (and reference the `tags` / `entry_tags` tables added in the v6→v7 migration).
- `SECURITY.md` lines 9–10: supported versions table → **rewrite per the maintainer's chosen support policy**. Don't promise a specific version range without first confirming the policy. A safe baseline: "Latest released minor — Yes; older minors — No (use latest)."
- `AGENTS.md` line 116: "There are **54 registered Tauri commands**" → drop the exact count. Suggested replacement: "All Tauri commands are registered in `src-tauri/src/lib.rs` inside `generate_handler![]` — grep that block for the authoritative list." This sidesteps the count drifting after every feature.

**Alternative considered:** Build a docs-sync test (CI fails if `SCHEMA_VERSION` in code disagrees with the number in CLAUDE.md or PHILOSOPHY.md, or if `lib.rs` command count disagrees with AGENTS.md). Reasonable but more infra than needed for now — a single docs sweep + commit-time discipline (helped by the `docs-sync-guardian` agent) covers it. Revisit if the docs drift again within a few releases.

**Security impact:** Trust. A user reading SECURITY.md that names a version 2 releases out of date will doubt the rest of the document.

**Test impact:** None (docs only).

**Note on agent auto-memory:** The session's `MEMORY.md` (in the agent runtime, outside the repo) also has a stale "DB Schema v5" reference. That is an agent-memory hygiene issue, not a repo concern — flag it for the next agent session, but it's not part of this proposal's scope.

---

### Tier 2 — Medium impact, medium effort

---

#### P9. Unify the unlock commands behind a single `perform_unlock(mode, ...)` — auto-key excluded by policy (decision A confirmed 2026-05-21)

**Problem:** B4. `unlock_diary`, `unlock_diary_with_keypair`, and `unlock_diary_all_methods` share ~80% of their structure. `unlock_diary_auto` shares the path/state plumbing but **diverges on policy** — local-only journals are an explicit exceptional case (see P20).

**Current behavior (verified from `auth_core.rs`):**

| Command | Runs `migrate_require_all_auth_to_db`? | Calls `verify_require_all_auth`? |
|---|---|---|
| `unlock_diary` (password) | Yes (line 124) | Yes — blocks single-method unlock (line 127) |
| `unlock_diary_with_keypair` | Yes (line 177) | Yes — blocks single-method unlock (line 180) |
| `unlock_diary_all_methods` | Yes (line 478) | Yes — enforces credential count (line 485) |
| `unlock_diary_auto` | **No (by design)** | **No (by design)** |

**Policy decision (recorded 2026-05-21): Position A.** Local-only (auto-key) journals are an exceptional case. They are device-bound, have only an `auto` slot, and are excluded from `peek_auth_slot_types`, so the multi-auth UI never offers `require_all_auth` for them. **`unlock_diary_auto` stays out of the shared helper.** This is documented further in P20.

**Scope of P9 (post-decision):** Three commands in scope — `unlock_diary`, `unlock_diary_with_keypair`, `unlock_diary_all_methods`. `unlock_diary_auto` is intentionally left as a separate, smaller function.

**Proposal (revised):** Use a typed mode enum instead of the original `allow_single_method: bool` (booleans on security-relevant flags invite misuse):

```rust
enum UnlockMode {
    SingleMethod,       // enforce !verify_require_all_auth before committing
    MultiMethod {       // verify credential count >= non-auto slot count
        credential_count: usize,
    },
    // No AutoKey variant: local-only journals are handled by a separate,
    // smaller unlock_diary_auto function. See P20 for the policy rationale.
}

fn perform_unlock(
    state: &DiaryState,
    app: &AppHandle<Wry>,
    mode: UnlockMode,
    open: impl FnOnce(&Path, &Path) -> Result<DatabaseConnection, String>,
) -> Result<(), String> {
    // 1. read paths from state, check db_path.exists()
    // 2. call open(&db_path, &backups_dir)
    // 3. run migrate_require_all_auth_to_db (always — both modes need it)
    // 4. match mode {
    //      SingleMethod    => reject if verify_require_all_auth
    //      MultiMethod{n}  => reject if n < non_auto_slot_count
    //    }
    // 5. install in state, backup_and_rotate, menu update
}
```

`unlock_diary` and `unlock_diary_with_keypair` call `perform_unlock(..., UnlockMode::SingleMethod, ...)`. `unlock_diary_all_methods` calls with `UnlockMode::MultiMethod { credential_count: credentials.len() }`. `unlock_diary_auto` keeps its own implementation and is intentionally not touched by this refactor.

**Alternatives considered:**

- *`enum Credentials { Password, Keypair, Auto, Multi }` dispatching inside.* Rejected because the multi-auth flow verifies credentials *after* opening with the first one — a fundamentally different shape that doesn't fit a single-credential enum.
- *Boolean `allow_single_method` (original proposal).* Rejected: a future maintainer could trivially flip the wrong way and bypass `verify_require_all_auth`. A named enum variant prevents this.

**Security impact:** Positive. `verify_require_all_auth` and the credential-count check become impossible to forget for the modes that need them. `unlock_diary_auto` retains its current behavior — no risk of accidentally applying a guard to local-only journals.

**Test impact:** Existing per-command unit tests still cover behavior. Add:
1. One test per `UnlockMode` variant against `perform_unlock` directly (guard ordering).
2. A regression test that creating a local-only journal and unlocking it via `unlock_diary_auto` is unaffected by this refactor (locks down the exclusion).

---

#### P10. Move TipTap extensions out of `DiaryEditor.tsx`

**Problem:** B7. `DiaryEditor.tsx` is 518 LoC including 3 inline TipTap extension definitions.

**Proposal:** New layout:

```
src/components/editor/
├── DiaryEditor.tsx                 # ~250 LoC: mount + drop-target + content sync
├── extensions/
│   ├── AlignableImage.ts           # figure-wrapped image + text-align integration
│   ├── BidiExtension.ts            # auto-detect direction + Ctrl+Shift+D toggle
│   ├── TimestampMark.ts            # span.timestamp
│   └── image-embed.ts              # resizeAndEmbedDataUrl / resizeAndEmbedImage / resizeAndEmbedPath
```

`DiaryEditor.tsx` keeps the JSX, drop-target visual state, and editor lifecycle. The TipTap extensions are now small, focused files (each ≤100 LoC) that other editor surfaces (if we ever add a comment editor, etc.) can reuse.

The MIME-from-extension map in `resizeAndEmbedPath` lines 78–88 should move to a small `mimeFromExtension(path)` util in `lib/image-drag.ts` (next to existing image-drag helpers) — same module, related logic.

**Alternative considered:** Leave it inline; the extensions are TipTap-specific and only used in this file. Rejected because their *size* is the problem, not their reusability. Three nested 30–60 LoC extension definitions inside a component hurt readability of the actual JSX/lifecycle.

**Security impact:** None.

**Test impact:** The extensions are currently untested (DiaryEditor has no test file). Splitting them into separate files makes adding focused unit tests trivial (`BidiExtension.test.ts` for `getFirstStrongDir`, etc.). Add at least `getFirstStrongDir` tests (it has a non-obvious Unicode range list that should be locked down).

---

#### P11. Split `PreferencesSecurityTab.tsx` into per-feature subsections

**Problem:** B6. 580 LoC, ~30 signals, 5 disjoint forms.

**Proposal:** Use the same pattern as the rest of `preferences/`. The tab file becomes a layout shell that imports each section:

```
src/components/overlays/preferences/security/
├── PreferencesSecurityTab.tsx      # shell + section layout
├── AuthMethodsList.tsx             # registered methods list + removal
├── AddPasswordForm.tsx             # shown when no password slot exists
├── AddKeypairForm.tsx              # generate + register flow
├── ChangePasswordForm.tsx          # change password
├── RequireAllAuthToggle.tsx        # multi-auth requirement
└── AutoLockSettings.tsx            # buffered auto-lock prefs
```

Each section owns its own signals (the forms don't share state today anyway — they each have their own error/success signals). The shell file shrinks to ~80 LoC of just layout + tab plumbing.

**Pragmatic first cut:** Don't extract all six sub-files in one PR. Start with the four highest-value sections, in this order:

1. `AddKeypairForm.tsx` (most security-relevant — 5-step flow with private-key file write)
2. `AuthMethodsList.tsx` (last-slot guard, removal-password check)
3. `ChangePasswordForm.tsx`
4. `RequireAllAuthToggle.tsx`

Defer `AutoLockSettings` and `AddPasswordForm` to a follow-up PR. This lowers review risk and lets P15 land tests for the four critical forms before the lower-risk sections move.

**Alternative considered:** Reduce signals by moving them to a single reducer-like store. Rejected because SolidJS idioms prefer many small signals; centralizing them re-creates the Redux complexity Principle 6 explicitly avoids.

**Security impact:** Positive — `AddKeypairForm` is the only place that touches `generateKeypair` + `writeKeyFile` + `registerKeypair`. Isolating it makes auditing the 5-step keypair flow much easier.

**Test impact:** Each subsection becomes individually testable. Closes the U7 coverage gap one component at a time. The most security-critical one — `AddKeypairForm` (5 backend calls in sequence) — gets its own test file.

---

#### P12. Split `commands/auth/auth_methods.rs` (887 LoC) by responsibility

**Problem:** U3. Identity ops, slot management, peek operations, and policy settings all in one file.

**Proposal:** Within `commands/auth/`:

```
commands/auth/
├── mod.rs              # DiaryState, shared helpers
├── auth_core.rs        # create/unlock/lock/reset/change_password
├── auth_directory.rs   # unchanged
├── auth_journals.rs    # unchanged
├── auth_identity.rs    # verify_password, list_auth_methods, peek_auth_slot_types (+ JournalPeek/AuthSlotPeek structs)
├── auth_slots.rs       # generate_keypair, write_key_file, register_password, register_keypair, remove_auth_method
└── auth_policy.rs      # set_require_all_auth
```

Each new file ~150–300 LoC. The commands themselves don't change; this is a pure move.

**Alternative considered:** Merge auth_methods.rs into auth_core.rs (current state but unified) — adds insult to injury. Or leave it alone — postpones the cost.

**Security impact:** Neutral, slight readability gain for the auth audit surface.

**Test impact:** Move tests with functions. No coverage change.

---

#### P13. Move platform-specific WebView handlers out of `lib.rs`

**Problem:** U4. `lib.rs` has 280 lines of legitimate setup and 270 lines of platform-specific COM/WebKit handlers.

**Proposal:**

```
src-tauri/src/
├── lib.rs              # ~280 LoC: setup, state, navigation guard, command registry
├── webview_security/
│   ├── mod.rs          # install_platform_handlers(&win) — calls into the platform module
│   ├── windows.rs      # #[cfg(target_os = "windows")] install_webresource_requested_handler
│   └── macos.rs        # #[cfg(target_os = "macos")] install_content_rule_list
```

In `lib.rs`, replace the two `#[cfg]` calls with one cross-platform `webview_security::install_platform_handlers(&win);`. Each platform module owns its own `unsafe` block and SAFETY comment.

**Alternative considered:** Leave as-is; `#[cfg(target_os = ...)]` means only one block compiles on a given build. Rejected because *humans* see both blocks when reading or grepping, and they're large enough to be a real cognitive cost. Splitting also makes it easier to add Linux variants later (e.g. WebKitGTK content blocking) without growing `lib.rs` further.

**Security impact:** Neutral. The unsafe COM/Objective-C code is just as auditable in its own file — arguably more so because the file is dedicated to it.

**Test impact:** None directly testable (these are integration-level WebView handlers); the existing E2E `network-isolation.spec.ts` covers behavior.

---

### Tier 3 — Lower urgency, higher leverage (longer-term)

---

#### P14. Build a minimal Tauri command integration harness — **spike first**

**Problem:** U8. The IPC layer itself has no test coverage. Every backend test bypasses `tauri::command` dispatch and calls underlying functions.

**This proposal is a spike, not a plan.** This repo has no `src-tauri/tests/` directory and no existing `tauri::test` usage. The Tauri v2 test API surface is not yet exercised here. Before committing to a design or LoC estimate, the work must start with a feasibility spike (target: 1–2 days):

1. **Verify Tauri v2 in-process command invocation is supported** for this app's setup — specifically that `tauri::test::mock_app()` (or current equivalent) can build with the project's plugin set (`tauri_plugin_dialog`, `tauri_plugin_opener`, optional `tauri_plugin_window_state`).
2. **Confirm `State<DiaryState>` and `AppHandle<Wry>` extraction works** when invoking a command via the test harness — these are passed by `manage()` in `lib.rs`, but the test harness path may differ.
3. **Check `generate_context!()` behavior in tests** — the macro reads `tauri.conf.json` at build time; the test build must not need a real frontend bundle.
4. **Confirm menu / screen_lock initialization can be skipped** in tests (these have OS dependencies).

Only after the spike answers these can we estimate harness size and design. The original report's "~100 LoC of helper" was speculative.

**Once feasible, the proposal direction is:** a test helper that constructs a mock app, `app.manage(DiaryState::new(...))`, and offers a convenience to invoke commands by name. Use it to write integration tests for:

- The 3 unlock paths (post-P9 simplification) — fewer callsites to test.
- `change_diary_directory` (auto-lock + move + state update + config sync).
- `remove_auth_method` last-slot guard (P7 follow-through).
- Multi-auth `unlock_diary_all_methods` rejecting fewer credentials than slots.

Aim for ~15 high-value integration tests covering the IPC boundary specifically, not every command.

**Alternative considered:** Lean entirely on E2E (`wdio.conf.ts` + tauri-driver). Rejected because E2E runs in minutes per spec; an in-process command-level test runs in milliseconds and can be more thorough per-flow. The two complement each other: integration tests catch IPC contract bugs, E2E catches UI-flow bugs.

**If the spike fails** (Tauri v2's test API doesn't fit this app's setup), fall back to a thinner alternative: extract the command bodies into pure functions taking `&DiaryState` (not `State<DiaryState>`), and unit-test those. This loses IPC-deserialization coverage but is feasible immediately.

**Security impact:** Material. The 4 commands above are precisely the security-critical paths (multi-auth, lock state, last-slot guard, directory move). Each one currently has only unit-test coverage of its building blocks.

**Test impact:** Spike output dictates the rest. After spike, ~15 new tests targeting IPC boundaries.

---

#### P15. Add tests for `PreferencesSecurityTab.tsx` sub-sections (after P11 split)

**Problem:** U7. The security UI is untested. Per-section split (P11) makes per-section tests feasible.

**Proposal:** Add tests for the highest-leverage sub-sections in this order:

1. **`AddKeypairForm.test.tsx`** — 5-step flow (verifyPassword → generateKeypair → save dialog → registerKeypair → writeKeyFile). Mock each Tauri call; assert ordering and that `writeKeyFile` is only called *after* `registerKeypair` succeeds (the current code's "DB write first" guarantee — a regression would silently leak private keys).
2. **`ChangePasswordForm.test.tsx`** — empty-field guard, mismatch guard, success path clears fields.
3. **`AuthMethodsList.test.tsx`** — "Cannot remove the last method" guard, removal requires correct password when password slot exists.
4. **`RequireAllAuthToggle.test.tsx`** — disabled when <2 non-auto methods, error path keeps the UI state consistent.

Skip `AddPasswordForm` and `AutoLockSettings` for now (lower risk).

**Alternative considered:** Wait for E2E coverage. Rejected because E2E can't easily simulate Tauri dialog flows (file dialogs are interactive); component tests can mock them precisely.

**Security impact:** Material. These are the regressions we'd most regret missing.

**Test impact:** +4 test files. Closes a known critical gap.

---

#### P16. Replace `JournalConfig.require_all_auth` legacy migration with a derived-state check — **Decision: Option B (2026-05-21)**

**Problem:** B8 (deeper). `migrate_require_all_auth_to_db` is called on every unlock. It's idempotent so it's cheap, but the call sites (3 of them, see B3) are technical debt. The legacy field is read each unlock to decide whether to migrate.

**Decision recorded 2026-05-21 (maintainer): Option B — derived state, no sentinel.**

The migration stays as it is today: a question of "does `db_settings` already have a `require_all_auth` row?" If yes, nothing to do. If no, check the legacy config; if set, copy across; if not, nothing to do. This is what the current code already does (`migrate_require_all_auth_to_db` checks `get_db_setting(... "require_all_auth").is_none()` before doing anything).

**Why Option B over Option A (sentinel row):** Option A would have added `_migrated_require_all_auth = "true"` to `db_settings` after each migration, but that sentinel itself becomes a security-relevant config bit — an attacker with file-system write access could set it to `true` and skip the migration, silently dropping legacy security flags. To make Option A safe, the sentinel would have to be MAC-protected (extending the existing `require_all_auth_mac` pattern). That's a non-trivial extension of the integrity-protection design for no real benefit, because the existing derived-state check is already fast and idempotent.

**Proposal under Option B (concrete tasks):**

1. **Do not add any sentinel.** Leave `migrate_require_all_auth_to_db` as is — its idempotency is already the right design.
2. **Plan the eventual cleanup**, coordinated with P6 phase 3 (release N+2 or later): when the maintainer decides the support window is past, delete the function, the field, the `set_journal_require_all_auth` callsites, and the frontend type/test references. This is a single PR at a chosen release boundary, not a multi-phase migration.
3. **No threat-model expansion required** — the integrity surface stays exactly as it is today (only `require_all_auth` and `require_all_auth_mac` rows in `db_settings`).

**Alternatives considered:**

- *Option A (sentinel row).* Rejected per the security analysis above — adds tampering surface without performance benefit.
- *Drop the legacy field and migration immediately.* Rejected — users with stale installs would silently lose their multi-auth requirement, a security regression. Stays under P6 phase 3.

**Security impact:** None (no new state introduced). The cleanup is purely a deletion at a future release boundary.

**Test impact:** No new test required for the migration logic itself (no behavior change). The regression test in P6 step 3 — "legacy config flag is honored on first unlock; not re-migrated on second unlock" — already covers this code path and lands when the cleanup PR ships.

---

#### P17. Consolidate frontend test coverage for the editor surface

**Problem:** U7. `EditorPanel.tsx`, `DiaryEditor.tsx`, `Sidebar.tsx`, `Header.tsx`, `MainLayout.tsx` are all untested. The lifecycle hooks (`useEntryLifecycle.ts`, `useMultiEntryNav.ts`, `useEditorEmptyCheck.ts`) are tested but the integration shell isn't.

**Proposal:** Don't try to test all five. Pick **`EditorPanel.tsx`** as the priority — it has an integration test file already (`EditorPanel.integration.test.tsx`, 297 LoC, 4 flows). Extend it with:

- Word-count display updates on content change.
- Save-status footer visibility correlates with `isSaving()`.
- Import-markdown error banner appears on failed read.

Defer `Sidebar`, `Header`, `MainLayout` to a later sweep. They are mostly layout and shortcut wiring (shortcut listeners are already tested in `MainLayout-event-listeners.test.tsx`).

**Alternative considered:** Test everything proportionally. Rejected — Principle 3 (testing pyramid) says many unit, some integration, few E2E. We're already top-heavy on E2E for visual flows. Add focused integration tests where they have leverage; don't pursue 100% component coverage.

**Security impact:** None directly.

**Test impact:** ~3 additional integration test cases. Modest but compounding.

---

#### P19. Audit and close remaining raw-error UI paths

**Problem:** H3 / MF2 / MF3. The "every invoke site flows through `mapTauriError()`" claim is too broad. Several user-facing components surface raw `err.message` or `String(err)` to the UI, which can leak filesystem paths, SQLite internals, or Argon2 diagnostics into error banners.

**Confirmed non-sanitized sites:**

- `src/components/overlays/ImportOverlay.tsx:82,108` — surfaces raw import/plugin errors in the import flow's error banner.
- `src/components/overlays/StatsOverlay.tsx:34` — surfaces raw stats-load errors.
- `src/components/auth/PasswordCreation.tsx:32,58` — surfaces raw creation-flow errors during initial setup (notably before `mapTauriError` would normally fire).
- `src/components/search/SearchBar.tsx` — search errors are logged raw and results silently cleared. Low-urgency today because search is a stub, but anyone reviving search must follow the sanitization policy.

**Proposal:** One focused pass:

1. Convert each of the above to `mapTauriError(err, t)` with a sensible fallback key (e.g. `t('import.importFailed')`, which `ImportOverlay` already uses as the non-`Error` branch — extend it to cover the `Error` branch too).
2. Add a lightweight ESLint rule or grep-based CI check: any `catch (err)` block that ends in `setError(err...)` or `setError(String(err))` without going through `mapTauriError` should be flagged. (A regex CI check is enough; a full ESLint rule is over-engineering for this codebase.)
3. Update the IPC contract comment in `src/lib/errors.ts` to enumerate the sanitization rule clearly: *every error string that reaches `setError` (or equivalent UI state) goes through `mapTauriError(err, t)` — no exceptions for "this is just setup" or "this is just import".*

**Alternative considered:** Make `mapTauriError` the only path by hiding `invoke()` behind a wrapper that auto-sanitizes errors. Rejected — `mapTauriError` needs `t` (the i18n function), which is component-scoped. Hiding it inside `invoke()` would force a global `t` reference or break i18n. The grep-rule approach is simpler.

**Security impact:** Closes the disclosure surface flagged in H3. The leaked content today is mostly low-severity (file paths in the journal directory; argon2 parameter strings) but the principle is what the IPC contract is supposed to enforce.

**Test impact:** Add at least one component test per converted site asserting that a sample raw error gets the sanitized fallback, not the leaky string. Cheap to write — a one-line `mock.rejects(new Error('/Users/secret/path/diary.db is locked'))` in the existing test setup.

---

#### P20. Document the `unlock_diary_auto` security policy decision — **Decision: Position A (2026-05-21)**

**Problem:** MF4. The auto-unlock path (`unlock_diary_auto` in `commands/auth/auth_core.rs:375`) currently bypasses both `migrate_require_all_auth_to_db` and `verify_require_all_auth`. The divergence was undocumented.

**Policy decision (recorded 2026-05-21 by maintainer): Position A — local-only journals are an exceptional case and stay outside the multi-auth policy.**

Rationale (now the canonical statement):
- Local-only journals have only an `auto` slot by design.
- `peek_auth_slot_types` already excludes `auto` slots when reporting non-auto slot counts.
- The `require_all_auth` UI toggle is intentionally hidden for auto-protected journals (`PreferencesSecurityTab.tsx` uses `isAutoProtected()` to gate the toggle).
- Therefore `unlock_diary_auto` correctly skips both the migration and the guard.

**Proposal (concrete writing tasks now that the decision is recorded):**

1. **Add a comment at the top of `unlock_diary_auto`** in `src-tauri/src/commands/auth/auth_core.rs` (above the `#[tauri::command]` attribute) with this exact policy text — adapted from the rationale above:

   > Local-only journals are an exceptional case. They only have an `auto` slot, and `peek_auth_slot_types` excludes `auto` slots from the multi-auth slot count. The `require_all_auth` UI toggle is hidden for auto-protected journals (`isAutoProtected()` in `PreferencesSecurityTab.tsx`), so this code path correctly skips both `migrate_require_all_auth_to_db` and `verify_require_all_auth`. **If a local-only journal can ever gain a non-auto slot, this assumption must be revisited.** See `docs/refactoring-report-2026-05-21.md` §P20 (decision 2026-05-21).

2. **Add a short paragraph in `src-tauri/CLAUDE.md`** under the auth-rules / Security Rules section. Suggested text:

   > **Auto-key (local-only) journals are excluded from `require_all_auth` by policy.** Their only auth slot is the device-bound `auto` slot, which is filtered out of the multi-auth UI and slot counts. `unlock_diary_auto` does not call `migrate_require_all_auth_to_db` or `verify_require_all_auth`. If a future feature allows mixing `auto` slots with other slot types, this policy must be revisited.

**Alternative considered (and rejected by the decision):** Apply the `require_all_auth` guard inside `unlock_diary_auto`. Rejected because (a) the UI never sets the flag for auto journals, so the guard would only fire for tampered DBs — and the existing MAC on `require_all_auth_mac` already covers that case; (b) it would add complexity (the guard would need to ignore the slot count from the auto journal context) for a scenario the UI deliberately doesn't expose.

**Security impact:** Policy clarity, not a code change. The decision narrows the assumption to a single documented invariant: "auto slots are excluded from multi-auth, by design, in every layer." Any future change that breaks this invariant will be flagged by the comment.

**Test impact:** None directly from the policy doc itself. The P9 regression test (locks down `unlock_diary_auto` behavior under the refactor) covers the enforcement side.

---

#### P18. Centralize the encrypted-row format (`title_encrypted`, `text_encrypted`)

**Problem:** Subtle. The format of an encrypted entry row is implicit. The cipher.encrypt output (`[nonce(12)][ciphertext][tag(16)]`) is opaque to readers. There's no `EntryRow::serialize` helper; instead every query duplicates the encrypt step and every read does the decrypt step.

**Proposal:** Add to `db/queries/entries.rs`:

```rust
fn encrypt_for_storage(key: &cipher::Key, plaintext: &str) -> Result<Vec<u8>, String> {
    cipher::encrypt(key, plaintext.as_bytes())
        .map_err(|e| format!("Failed to encrypt: {e}"))
}

fn decrypt_utf8(key: &cipher::Key, ciphertext: &[u8]) -> Result<String, CipherError> {
    let bytes = cipher::decrypt(key, ciphertext)?;
    String::from_utf8(bytes).map_err(|e| CipherError::DecryptionFailed(format!("invalid UTF-8: {e}")))
}
```

`insert_entry`, `update_entry`, `create_tag`, `rename_tag`, and the row mapper from P5 all use these. About 8 call sites collapse to 1 helper per direction.

**Alternative considered:** Skip this — `cipher::encrypt(db.key(), bytes)` is already 1 line. True, but it's repeated identically 8 times and the error mapping differs subtly each time. The helper enforces a uniform error string.

**Security impact:** None.

**Test impact:** Tests stay the same; helpers covered transitively.

---

### Things I considered and explicitly **rejected**

- **A trait-based command framework (e.g., `impl Command for SaveEntry { ... }`).** Rejected. Tauri's `#[tauri::command]` macro is already the abstraction. Adding our own layer violates Principle 6 ("avoid magic configuration with dozens of options"). The `with_unlocked_db` helper (P1) is enough.
- **Switching from `String` errors to `thiserror` enum errors.** Rejected. The IPC contract is `Result<T, String>` and the frontend sanitization (`mapTauriError`) depends on string matching. Changing the error type means changing both layers — high effort, modest payoff. Maybe reconsider in a future major version, but not now.
- **Generalizing the plugin trait to allow tag/entry/search plugins.** Rejected. Principle 5 (focused scope) — extending the plugin surface invites scope creep. The current import/export traits are sufficient for the documented use cases.
- **Adopting an ORM (e.g. `diesel`) to remove SQL boilerplate.** Rejected. Conflicts with `src-tauri/CLAUDE.md` which explicitly calls out "direct `rusqlite` queries... no ORM, no query builder" as a deliberate Principle 6 choice. P3+P5+P18 reduce the boilerplate within that constraint.
- **Writing a custom encrypted FTS to revive search.** Rejected for this report — it's a feature, not a refactor. It's tracked as TODO-0026 separately and has its own design constraints in `src-tauri/CLAUDE.md`.
- **A workspace split (separate crates for `crypto`, `db`, etc.).** Rejected. The current `mod` boundaries are sufficient; cross-crate refactoring is a much larger undertaking and the project is one binary anyway. Compile-time gains would be modest.

---

## Part III — Suggested Sequencing (revised)

Reordered after the external review to put **unambiguously-safe** items first, behavior-changing refactors **after** test infrastructure exists, and policy-gated items **after** an explicit maintainer decision.

1. **Week 1 — unambiguously safe documentation + cleanup:**
   - P8 (PHILOSOPHY/SECURITY/AGENTS staleness — including the 54→62 command-count drift).
   - P6 items 1 & 2 only (`_isLoadingEntry` removal + empty directory cleanup). **Do not touch the `require_all_auth` legacy field in this PR.**
   - P7 (delete/replace the misleading guard tests).
2. **Week 1–2 — single-file, contained refactors:**
   - P2 (markdown export deduplication).
   - P5 (row decoding consolidation — compile the pseudocode snippet, add the corruption regression test).
3. **Week 2 — policy doc + raw-error sanitization:**
   - **P20: policy decision already recorded (Position A, 2026-05-21).** Just land the two writing tasks — comment block on `unlock_diary_auto` and the `src-tauri/CLAUDE.md` paragraph. This unblocks P9 and locks the invariant in the codebase.
   - P19 (raw-error sanitization audit on `ImportOverlay`, `StatsOverlay`, `PasswordCreation`).
4. **Week 2–3 — `db/queries.rs` split:**
   - P3 (file split), then P18 (encrypted-row helpers) on top.
5. **Week 3 — `db/schema.rs` split:**
   - P4 with `apply_pending` consolidating the per-version migration calls.
6. **Week 3–4 — minimum viable command-level testing:**
   - P14 **spike** (1–2 days): confirm Tauri v2 test harness viability. Either the spike succeeds → small harness; or the spike fails → extract command bodies as pure functions for unit testing.
7. **Week 4 — behavior-changing refactors gated by test coverage:**
   - P1 (`with_unlocked_db`) **only after step 6 produces at least the 2 helper tests + 3 representative command tests required by P1's revised test impact**.
   - P9 (`perform_unlock` with `UnlockMode` enum) — auto-key policy is now resolved (Position A; P20 writing tasks land in Week 2). Sweep `unlock_diary`, `unlock_diary_with_keypair`, `unlock_diary_all_methods` only; `unlock_diary_auto` stays as a separate, smaller function.
8. **Week 5+ — frontend/backend cosmetic splits (independent, pick by appetite):**
   - P10 (TipTap extensions out of `DiaryEditor.tsx`).
   - P11 (PreferencesSecurityTab pragmatic 4-of-6 split + the matching tests from P15).
   - P12 (`commands/auth/auth_methods.rs` split).
   - P13 (`webview_security/` module).
6. **Week 6+ — long-tail and release-coordinated:**
   - P15 (broader security-tab subsection tests once P11 has landed).
   - P17 (EditorPanel integration test extensions).
   - **P6 item 3 + P16 (combined, single release-boundary PR):** delete the legacy `JournalConfig.require_all_auth` field, `JournalInfo.require_all_auth`, `set_journal_require_all_auth`, `migrate_require_all_auth_to_db` and all its call sites, plus the frontend type/test references. Per P16's Option B decision, this is a single PR at a chosen release boundary — no sentinel, no multi-phase migration.

After Weeks 1–3, the codebase should be measurably easier to navigate: the largest file drops from ~1660 LoC to ~400 LoC, ~150 LoC of boilerplate disappears from command files (revised down from the original 250), 5 stale docs are accurate, and 4 user-facing components stop leaking raw error strings.

---

## Part IV — Self-Check

This section is the report's own quality check, performed after writing.

### Verification of factual claims (post-revision)

Cross-referenced every code reference, line number, and LoC count back to the source files. The table below reflects corrections from the external review:

| Claim | Source | Verified |
|-------|--------|----------|
| `db/schema.rs` 1658 LoC | `wc -l` output, file fully read | ✅ (drifts over time — see L1) |
| `db/queries.rs` 1594 LoC | `wc -l` output, file fully read | ✅ |
| `export/markdown.rs` 1064 LoC, 3 export variants | File partially read incl. signatures of all 3 | ✅ |
| `commands/auth/auth_methods.rs` 887 LoC | `wc -l` + first 487 lines read | ✅ |
| `commands/auth/auth_core.rs` 771 LoC | Full file read | ✅ |
| `PreferencesSecurityTab.tsx` 580 LoC | `wc -l` + 380 lines read | ✅ |
| `DiaryEditor.tsx` 518 LoC | Full file read | ✅ |
| `lib.rs` 547 LoC | Full file read | ✅ |
| ~~50×~~ **~27** `state.db.lock()` unlocked-DB preambles | `grep -rB1 "\.lock()$"` → 35 multi-line `state.db.lock()` sites in production + 14 inline (mostly tests); B1 corrected; "State lock poisoned" 57× includes db_path/backups_dir/registry, not all are `db.lock()` | ⚠️ **Corrected** |
| `migrate_require_all_auth_to_db` called 3×: lines 124, 177, 478 | All 3 sites visible in `auth_core.rs`; `unlock_diary_auto` (line 375) does **not** call it | ✅ |
| `_isLoadingEntry` set but never read in EditorPanel | EditorPanel.tsx:36; `setIsLoadingEntry` is wired to `useEntryLifecycle.ts:30,130,176` but the *getter* (`_isLoadingEntry`) is unread | ✅ |
| `JournalConfig.require_all_auth` has `TODO: deprecated` | config.rs:15 confirmed; also still present in `JournalInfo` (config.rs:27) and `tauri.ts:139` | ✅ |
| Empty directories `src-tauri/src/backup/` and `src-tauri/src/i18n/` | `ls` output | ✅ |
| ~~17~~ **15** untested frontend components | Recounted: 32 component `.tsx` files; 17 test files exist; 15 components without same-name test (the original "17" was off by 2) | ⚠️ **Corrected** |
| `test_change_diary_directory_blocked_when_unlocked` tests inline boolean | `auth_directory.rs:259–296` read, confirmed | ✅ |
| SCHEMA_VERSION = 7 | schema.rs:29 confirmed (`SCHEMA_VERSION: i32 = 7`) | ✅ |
| `PHILOSOPHY.md` says v0.4.19 and 276 tests | PHILOSOPHY.md lines 231–235 confirmed | ✅ |
| `AGENTS.md` says 54 commands; actual = 62 | AGENTS.md line 116, `lib.rs` `generate_handler![]` block | ⚠️ **Newly added** |
| ~~`MEMORY.md`~~ — *external auto-memory, not in repo* | The file lives in the agent runtime, not the repository. The U6 finding now distinguishes in-repo docs from external memory. | ⚠️ **Corrected** |
| `SECURITY.md` versions table only lists 0.2/0.3 | Read in full at session start | ✅ |
| `mapTauriError` is NOT used by every invoke site | ImportOverlay:82,108; StatsOverlay:34; PasswordCreation:32,58 all use raw `err.message` / `String(err)` | ⚠️ **Newly added** (H3) |
| `unlock_diary_auto` bypasses both migration and `verify_require_all_auth` | `auth_core.rs:375–432` reads paths and opens DB without calling either | ⚠️ **Newly added** (MF4) |
| Migration backup behavior is two-tier | v1→v2 and v2→v3 create backups; v3→v4..v6→v7 do not (DDL-only, single-tx atomic rollback) | ⚠️ **Corrected** (M4) |

### Verification of proposal coherence (post-revision)

For each proposal, checked:
- **Does the alternative actually exist?** Yes, each proposal includes at least one genuinely-considered alternative with a stated rejection reason.
- **Is the security impact honest?** P5 and P9 are flagged as positive *with conditions* (silent corruption fix; unlock invariant centralization once auto-key policy is documented). P12 and P13 are neutral. P6 is split between safe-now and plan-only because the original proposal would have created a security regression.
- **Is the proposal mechanical or behavioral?** P3, P4, P10–P13 are pure file moves (mechanical). P2, P18 change call sites but not semantics. P1, P5, P9 change semantics in ways that require new tests; the test impact sections call this out.
- **Are policy decisions surfaced?** P20 was added to make the `unlock_diary_auto` policy a deliberate decision, not an accidental refactor consequence.

### Alignment check against PHILOSOPHY.md principles

| Principle | Proposals supporting it |
|-----------|------------------------|
| 1. Small and Extensible Core | P10 (extensions become reusable), P12 (auth surface separated) |
| 2. Boring Security | P5 surfaces silent decrypt failures; P11 splits security UI for auditability; P19 closes raw-error UI leak paths; P20 makes auto-key policy explicit |
| 3. Testing Pyramid | P14 (spike-first) adds integration-tier tests; P15/P17/P19 add component tests; P7 removes false-coverage |
| 4. Easy In, Easy Out | P2 (markdown export consolidation) |
| 5. Focused Scope | All proposals were checked: no new features, no extension of scope |
| 6. Simple is Good | P1, P2, P3, P4, P5, P9, P10, P11, P12, P13, P18 all reduce duplication/files-too-big |

Alignment check against SECURITY.md non-negotiables:
- **No network access:** No proposal introduces any network call.
- **No custom cryptography:** No proposal touches crypto algorithms.
- **No password recovery:** No proposal introduces recovery.
- **No vendor lock-in:** No proposal changes the export schema.
- **Honest threat documentation:** P8 fixes the SECURITY.md staleness; P19 closes UI-side disclosure paths; P20 documents the auto-key policy.

### Items still uncertain (post-revision)

- **P1's exact helper signature.** `FnOnce` may be too restrictive if callers need to take multiple `&db` reads with intervening logic. If so, return the guard and let the caller hold it. The example is illustrative.
- **P5's `rusqlite::Error` conversion.** The snippet is pseudocode — the real implementation may need a local error enum that wraps `CipherError + FromUtf8Error + Send + Sync + 'static`. Confirm at compile time, not by reading the snippet.
- **P6 / P16 release-boundary timing.** The release at which the legacy field is removed (release N+k) is the maintainer's call, announced via CHANGELOG. The mechanics are now fully resolved (single PR per P16 Option B); only the *when* is open.
- ~~**P9's policy gating.**~~ **Resolved 2026-05-21:** maintainer confirmed Position A. `unlock_diary_auto` stays outside the shared helper. P20's two writing tasks land in Week 2; P9 is no longer policy-gated.
- **P14's harness viability.** Marked as a spike, not a plan. Outcome of the spike dictates whether ~15 IPC tests are achievable or whether we fall back to pure-function extraction.
- **P17's scope.** Frontend test coverage for `EditorPanel.tsx` could grow indefinitely. The proposal caps it at "extend the existing integration test file" precisely to avoid that.

### What this report does **not** cover

Out of scope for a refactoring report:
- Performance optimization beyond what's already benchmarked (`cargo bench` is in place).
- New features (search, mobile, PDF export — see TODO.md).
- Dependency upgrades (deferred per agent auto-memory notes on the crypto crate ecosystem; that note lives outside the repo).
- CI/CD pipeline (separate concern, governed by `docs/CI_BEST_PRACTICES.md`).
- Build/packaging changes (Flathub, Homebrew, Winget — handled by skills).

If any of these become blockers, they warrant their own focused reports.

---

## Revision Log

This report was independently reviewed at `docs/refactoring-report-2026-05-21-review.md` (also 2026-05-21). The following corrections were applied.

**Policy decisions recorded after the revision:**

- **2026-05-21 (maintainer): P20 → Position A.** Local-only (auto-key) journals are an exceptional case and stay outside `require_all_auth`. `unlock_diary_auto` keeps its current behavior (skips both `migrate_require_all_auth_to_db` and `verify_require_all_auth`) and is **not** swept into P9's shared helper. P9 is now unblocked. P20 has been narrowed to the two concrete writing tasks (code comment + CLAUDE.md paragraph) that lock the invariant in place.
- **2026-05-21 (maintainer): P16 → Option B.** No sentinel row. The existing derived-state check in `migrate_require_all_auth_to_db` stays as the migration's only "have we done this yet?" mechanism. Cleanup is a single PR at a future release boundary (coordinated with P6 phase 3), not a multi-phase migration. No new integrity-protected state added.

**High-severity corrections:**

- **H1 → P6 rewritten.** The original proposal would have removed `JournalConfig.require_all_auth` while still relying on it for legacy migration — a security regression risk. P6 is now split into safe-now items (1–2) and a plan-only phased deprecation (item 3) that spans two release boundaries.
- **H2 → P9 rewritten.** The original proposal would have unified `unlock_diary_auto` into the shared helper without acknowledging that it currently bypasses both `migrate_require_all_auth_to_db` and `verify_require_all_auth`. P9 is now gated on the policy decision in new proposal **P20**, uses a typed `UnlockMode` enum instead of a boolean, and explicitly excludes auto until the policy is documented.
- **H3 → "every invoke site sanitized" claim corrected.** The Good section now acknowledges that some sites (`ImportOverlay.tsx:82,108`, `StatsOverlay.tsx:34`, `PasswordCreation.tsx:32,58`) still surface raw `err.message`. A new proposal **P19** closes these.
- **H4 → B1 recalculated.** The "50× preamble" / "250 LoC reduction" claim mixed different mutexes. Recounted: ~27 `state.db.lock()` callsites that need an unlocked `DatabaseConnection`. P1's reduction estimate revised down to ~150 LoC. P1's scope explicitly excludes `db_path`/`backups_dir`/`registry` locks.
- **H5 → P1 now requires tests.** The "no new tests needed" claim was too aggressive. P1 now requires two helper tests + 3 representative command tests before broad mechanical conversion. This also pulls P1 later in the sequencing (after P14 spike).

**Medium-severity corrections:**

- **M1 → 17 → 15 untested components.** Recounted (32 components, 17 test files, 15 untested). Specific files now listed in U7.
- **M2 → `MEMORY.md` clarified.** It is auto-memory in the agent runtime, not a repo file. The Good/Bad references now distinguish in-repo vs. external context.
- **M3 / MF1 → `AGENTS.md` staleness added.** "54 registered commands" vs. actual 62. Now in U6 and P8.
- **M4 → Migration safety nuanced.** The Good section now distinguishes the two-tier policy: re-encryption migrations make explicit backups; DDL-only migrations rely on SQLite's atomic rollback.
- **M5 → P14 marked as spike-first.** Original "~100 LoC harper" was speculative. P14 now requires a 1–2 day spike to confirm Tauri v2 test API viability, with a fallback plan if the spike fails.
- **M6 → P5 snippet marked as pseudocode.** Calls out that `Box::new(e)` and the error trait bounds need verifying at compile time.
- **M7 → P6 frontend cleanup listed.** Item 3 now enumerates frontend type/test sites (`tauri.ts:139`, `JournalPicker.test.tsx`) that must be updated when the legacy field is finally removed.
- **M8 → P8 softer.** No more "0.4.x: Yes" suggestion. The SECURITY.md change is now "rewrite per the maintainer's chosen support policy."
- **M9 → P16 revised to Option B.** Adding a sentinel row would introduce a new tampering surface. The simpler answer is the code's existing derived-state check (already idempotent); the cleanup is just eventually deleting the legacy code path per P6's phased plan.

**Missed findings now incorporated:**

- **MF1 → AGENTS.md command count** — folded into P8 and U6.
- **MF2 → `SearchBar` raw error logging** — folded into P19.
- **MF3 → `ImportOverlay` / `StatsOverlay` raw error display** — folded into P19.
- **MF4 → `unlock_diary_auto` security policy** — new proposal **P20**, gates P9.
- **MF5 → Remove exact test counts, not refresh them** — P8 now removes counts entirely rather than updating them.

**Low-severity acknowledgments:**

- L1 (LoC counts drift): noted in Self-Check with a "drifts over time" qualifier on the LoC row.
- L2 / L3 / L4 / L5 / L6 / L7: validations only; original findings stand.
- L8 (over-splitting P11): P11 now recommends a pragmatic first cut of four sub-files (the security-critical ones), deferring the other two.

**Sequencing reordered:** Behavior-changing refactors (P1, P9) now sit *after* the test infrastructure they need (P14 spike) and *after* policy decisions (P20). Unambiguously-safe items (P8 docs, P6 items 1–2, P7) lead.

---

_End of report._
