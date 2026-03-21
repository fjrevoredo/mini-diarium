# Backend Architectural Assessment — March 2026

**Date:** 2026-03-21
**Assessed version:** v0.4.9 (branch `feature-v0.4.9`)
**Scope:** `src-tauri/src/` — all 42 Rust source files
**Schema version at assessment:** 5
**Registered commands at assessment:** 49
**Backend test count at assessment:** 239 tests across 30 modules

---

## 1. Executive Summary

This is a full-depth read of every Rust source file in the Mini Diarium backend, covering: architecture alignment against CLAUDE.md, command registration completeness, code quality and style conventions, cryptographic implementation correctness, SQL parameterization, sensitive data handling and zeroization, unsafe code justification, and unit test coverage by module.

### Overall Verdict: Good Health — No Critical Issues

The backend is in good structural health with a sound security posture:

- **No architectural drift.** The code matches its documentation exactly — module layout, state model, command registration, and data flow all match CLAUDE.md.
- **Cryptography is correct.** AES-256-GCM, Argon2id, and X25519 ECIES are all implemented without misuse. Nonces are generated freshly per encryption. Zeroization is consistent and complete.
- **No SQL injection surface.** Every query uses `rusqlite::params![]` parameterized bindings.
- **No plaintext on disk.** All entry content is encrypted before any `INSERT` or `UPDATE`.
- **No panics in production code.** All commands return `Result<T, String>`.
- **No hardcoded secrets or sensitive data in logs.**

Two low-severity code quality issues require quick fixes (≤30 minutes total). The primary area warranting sustained attention is test coverage: three files have zero tests, and five public commands callable by the frontend have no direct coverage. These are documented with concrete action items below.

---

## 2. Architecture Assessment

### 2.1 Layer Alignment

The four-layer architecture (Presentation / State / Backend / Data) documented in CLAUDE.md matches the code exactly. No drift detected.

The `DiaryState` struct in `commands/auth/mod.rs:8–26` holds:

```rust
pub struct DiaryState {
    pub db: Mutex<Option<DatabaseConnection>>,  // None = locked, Some = unlocked
    pub db_path: Mutex<PathBuf>,
    pub backups_dir: Mutex<PathBuf>,
    pub app_data_dir: PathBuf,  // immutable after setup, no Mutex needed
}
```

Setting `*db_state = None` in `lock_diary_inner()` drops the `DatabaseConnection`, triggering `Key`'s `ZeroizeOnDrop`. The zeroization chain from unlock → lock is complete and correct.

Every command that accesses entries guards on `db_state.as_ref().ok_or(...)`. All guard sites were verified.

### 2.2 Command Registration

All 49 commands are registered in both `commands/mod.rs` re-exports and the `generate_handler![]` macro in `lib.rs:150–211`. Cross-checked against the Command Registry table in CLAUDE.md. No mismatches.

### 2.3 Module Boundary Pattern

All modules follow a consistent inner-function / command-wrapper pattern. Inner functions (e.g., `add_journal_inner`, `remove_journal_inner`, `switch_journal_inner` in `auth_journals.rs`) accept plain references and are independently testable without Tauri infrastructure. Public command functions are thin wrappers that add `State` injection and logging. This pattern is applied uniformly across the codebase.

### 2.4 State Lock Boilerplate

The following pattern appears verbatim across 10+ command files:

```rust
let db_state = state.db.lock().map_err(|_| "State lock poisoned".to_string())?;
```

This is a DRY observation, not a correctness issue. Extracting it into a shared helper is complicated by `MutexGuard` lifetime rules. The pattern is idiomatic Rust for this scenario. **Accepted as-is.** (See Action Item A10.)

### 2.5 Plugin Registry

The plugin registry is initialized once in `lib.rs`'s `.setup()` closure and stored as `State<Mutex<PluginRegistry>>`. It reads `{diary_dir}/plugins/*.rhai` at startup. Per CLAUDE.md Gotcha #9, plugins are not reloaded if the diary directory changes — this is documented, intentional behavior.

---

## 3. Code Quality

### 3.1 Issues Requiring Action

**CQ-1 [Low] — Stale error message in `delete_entry` (`entries.rs:124`)**

```rust
// entries.rs:124
let db = db_state.as_ref().ok_or("Diary not unlocked")?;
```

Every other unlock guard in the codebase uses "Journal" terminology, for example:

- `entries.rs:15` — `"Journal must be unlocked to create entries"`
- `entries.rs:53` — `"Journal must be unlocked to save entries"`
- `entries.rs:85` — `"Journal must be unlocked to read entries"`
- `entries.rs:106` — `"Journal must be unlocked to delete entries"`
- `entries.rs:147` — `"Journal must be unlocked to read entry dates"`
- `auth_core.rs`, `auth_methods.rs`, `debug.rs`, `stats.rs` — all use "Journal" phrasing

`delete_entry` at line 124 is the sole exception, using the old pre-v0.4.2 "Diary" terminology. These strings surface in `mapTauriError()` on the frontend.

**Recommended fix:** Change line 124 to `ok_or("Journal must be unlocked to delete entries")`.

---

**CQ-2 [Low] — `#[allow(dead_code)]` attributes in `jrnl.rs` lack inline "why" comments**

The MEMORY.md code style rule states: *"Every lint/eslint suppression MUST include a 'why' comment. Apply this rule to any suppression: `#[allow(...)]`, `// @ts-ignore`, etc."*

`src-tauri/src/import/jrnl.rs` has four `#[allow(dead_code)]` attributes (lines 10, 20, 22, 24). Currently, the "why" explanation appears on the field's line-end comment, not on the attribute line itself:

```rust
// Current (non-compliant):
#[allow(dead_code)]
tags: serde_json::Value, // We don't use the tags summary
```

The comments explain the intent correctly, but the convention requires the rationale on the same line as the suppression:

```rust
// Compliant:
#[allow(dead_code)] // jrnl JSON schema field; required for Serde to deserialize the format, but Mini Diarium does not import tags
tags: serde_json::Value,
```

**Recommended fix:** Move the existing inline comments up onto the `#[allow(dead_code)]` lines for all four attributes (lines 10, 20, 22, 24).

### 3.2 Positive Findings

- **No `TODO`, `FIXME`, or `HACK` comments** anywhere in the backend. The only marked-for-future comment is the intentional `// Search index hook:` pattern at `db/queries.rs:46`, `db/queries.rs:206`, `db/queries.rs:225`, four import commands in `commands/import.rs`, and `commands/plugin.rs:79`. These are specifications for future implementation, not deferred debt.
- **Logging is consistent.** `info!` for lifecycle events (unlock, lock, backup, import/export), `debug!` for operational detail, `warn!` for non-fatal recoverable errors. No password, key, or plaintext content is ever passed to a log macro.
- **`rand 0.8` pin is intentional.** `aes-gcm` and `x25519-dalek` depend on `rand_core 0.6`. Upgrading would require pre-release crypto crate versions, inappropriate for a privacy-first app. Documented in MEMORY.md under "Deferred Dependency Upgrades."
- **No dead code beyond the suppressed jrnl parser fields.** Those fields are required by Serde to deserialize the format even though their values are not imported.

---

## 4. Security Deep Dive

### 4.1 AES-256-GCM (`crypto/cipher.rs`)

| Aspect | Finding | Location |
|--------|---------|----------|
| Nonce generation | `OsRng.fill_bytes()` called for each encryption — fresh 12-byte nonce per call | `cipher.rs:70–74` |
| Ciphertext format | `[nonce(12) \|\| ciphertext \|\| GCM tag(16)]` assembled via two `extend_from_slice` calls | `cipher.rs:99–101` |
| Decryption | Splits on 12-byte prefix, passes remainder to AEAD `decrypt()` | `cipher.rs:116–134` |
| Key zeroization | `Key` derives `Zeroize` and `ZeroizeOnDrop` | `cipher.rs:15` |
| Debug output | `Key`'s `Debug` impl outputs `[REDACTED]` | `cipher.rs:18–22` |
| Key size validation | `from_slice()` checks exact 32-byte length | `cipher.rs:32–39` |
| Tamper detection | Tests confirm authentication failure on any modification | `cipher.rs:213–229` |

**Assessment: No issues.** Fresh nonce per encryption prevents the catastrophic GCM nonce-reuse vulnerability. Authentication tag verification is implicit in AEAD `decrypt()`.

### 4.2 Argon2id (`crypto/password.rs`)

| Aspect | Finding | Location |
|--------|---------|----------|
| Algorithm | Argon2id (memory-hard, resistant to GPU/ASIC attacks) | `password.rs:52` |
| Memory cost | 65,536 KiB (64 MB) — exceeds OWASP minimum (19 MB for interactive) | `password.rs:8` |
| Time cost | 3 iterations — exceeds OWASP minimum (2) | `password.rs:9` |
| Salt generation | `SaltString::generate(&mut OsRng)` — fresh random salt per hash | `password.rs:36` |
| Password zeroization | Explicit `.zeroize()` after use | `password.rs:60, 103` |
| Verification | `Argon2::verify_password()` for constant-time comparison | `password.rs:98–100` |

**Assessment: No issues.** Parameters are conservative for a desktop app context.

### 4.3 X25519 ECIES (`auth/keypair.rs`)

| Aspect | Finding | Location |
|--------|---------|----------|
| Ephemeral key | `EphemeralSecret::random_from_rng(OsRng)` called per wrap — no key reuse | `keypair.rs:31` |
| ECDH | `diffie_hellman()` computed for sender and recipient correctly | `keypair.rs:36, 76` |
| Key derivation | HKDF-SHA256 with ephemeral public key as salt, app info string `"mini-diarium-v1"` | `keypair.rs:40, 79` |
| Blob format | `[eph_pub(32) \|\| nonce(12) \|\| ciphertext \|\| tag(16)]` | `keypair.rs:13` |
| Minimum blob size | Checked before decryption (`>= 60 bytes`) | `keypair.rs:65` |
| Private key zeroization | `#[derive(Zeroize, ZeroizeOnDrop)]` on `PrivateKeyMethod` | `keypair.rs:20` |

**Assessment: No issues.** Sound ECIES construction. The HKDF `info` string binds keys to this application, preventing cross-protocol attacks.

### 4.4 Master Key Lifecycle

1. `create_database` (`schema.rs:41`): generates 32 random bytes via `OsRng.fill_bytes()`
2. Wraps the master key with the initial password via `PasswordMethod::wrap_master_key()`
3. Stores the wrapped blob in `auth_slots` — never the raw key
4. Zeroizes the raw byte array at `schema.rs:66`
5. Returns `DatabaseConnection` holding the master key as `cipher::Key` (`ZeroizeOnDrop`)
6. On lock: `*db_state = None` drops `DatabaseConnection` → `Key::drop()` → zeroed

The chain from key generation through lock is unbroken. Wrong password returns the same error (`"Incorrect password"`) regardless of whether the PHC verification or the AES-GCM decryption failed — preventing information disclosure about which step failed.

### 4.5 SQL Injection

All SQL statements across `db/queries.rs`, `db/schema.rs`, `commands/auth/auth_methods.rs`, and `commands/auth/auth_journals.rs` use `rusqlite::params![]` parameterized bindings. No string formatting is used to construct SQL. **Zero SQL injection surface.**

The `list_auth_slots()` query at `queries.rs:380–407` explicitly omits `wrapped_key` from the SELECT, preventing wrapped key material from ever appearing in the data returned to the frontend.

### 4.6 Sensitive Data Handling

- No plaintext diary content is written to disk. All `title` and `text` fields pass through `cipher::encrypt()` before any `INSERT` or `UPDATE`.
- No password, key, or plaintext content appears in log statements.
- Temporary sensitive values (wrapping keys, master key byte arrays during migrations) are explicitly `.zeroize()`d before their containing functions return.
- Key materials use `#[derive(Zeroize, ZeroizeOnDrop)]`: `cipher::Key`, `auth::keypair::PrivateKeyMethod`, `auth::password::PasswordMethod`.

### 4.7 `unsafe` Code

Two sites in the codebase use `unsafe`:

**`screen_lock.rs` (Windows path, ≈ lines 49–126)**

Uses `unsafe` for `WTSRegisterSessionNotification`, `SetWindowSubclass`, and the `SUBCLASSPROC` callback. Each block has a multi-line `// SAFETY:` comment explaining the invariants. `WM_NCDESTROY` handling calls both `WTSUnRegisterSessionNotification` and `RemoveWindowSubclass` before the window is destroyed, satisfying cleanup contracts. The `OnceLock<AppHandle<Wry>>` pattern ensures single-init and safe cross-thread access. **Assessment: justified and sound.**

**`plugin/rhai_loader.rs` (`RhaiImportPlugin`, `RhaiExportPlugin`)**

`unsafe impl Send` and `unsafe impl Sync` are required because `rhai::AST` does not implement `Send + Sync` in the current Rhai version. The invariants hold: the AST is compiled once and never mutated afterward; each invocation of `parse()` or `format_entries()` constructs a fresh `Engine` (lines 158, 182) — no shared mutable state exists across threads. This matches CLAUDE.md Gotcha #11. **Assessment: justified and sound.**

### 4.8 Minor Finding: v3→v4 and v4→v5 Migrations Lack Pre-Migration Backups

The v1→v2 and v2→v3 migrations call `crate::backup::create_backup()` before modifying the database (`schema.rs:338`, `schema.rs:418–420`). The v3→v4 (`schema.rs:560–577`) and v4→v5 (`schema.rs:590–622`) migrations do not.

**Risk assessment: Low.** v3→v4 is `DROP TABLE IF EXISTS entries_fts` — idempotent, the dropped table stored plaintext so dropping it is an unambiguous security improvement. v4→v5 is a table schema migration inside a single `BEGIN IMMEDIATE / COMMIT` transaction — SQLite atomicity guarantees the database is either fully migrated or left at v4. A failure in either migration leaves the database at the prior schema version, which the prior app release handled correctly.

**Recommended action:** Add a comment inside `migrate_v3_to_v4` and `migrate_v4_to_v5` documenting why a pre-migration backup was deliberately omitted, making the absence auditable rather than an apparent oversight (Action Item A9).

---

## 5. Test Coverage Analysis

### 5.1 Coverage by Module

| Module / File | Test Count | Quality | Gaps |
|---|---|---|---|
| `crypto/cipher.rs` | 11 | Excellent | None |
| `crypto/password.rs` | 10 | Excellent | None |
| `auth/keypair.rs` | 6 | Excellent | No test for malformed public key blob |
| `auth/password.rs` | 5 | Very good | None significant |
| `db/queries.rs` | 24 | Excellent | `update_slot_last_used` untested |
| `db/schema.rs` | 10 | Very good | v3→v4 and v4→v5 not tested in isolation |
| `commands/auth/auth_core.rs` | ~8 | Good | `unlock_diary_with_keypair` path covered via schema tests |
| `commands/auth/auth_directory.rs` | 4 | Good | Permission denied, invalid path not tested |
| `commands/auth/auth_journals.rs` | 6 | Good | Non-existent ID removal/rename not tested |
| `commands/auth/auth_methods.rs` | 6 | Very good | Removing non-existent slot ID not tested |
| `commands/entries.rs` | 6 | Good | `delete_entry` command wrapper untested; `get_all_entry_dates` command wrapper untested |
| `commands/navigation.rs` | 4 | Good | `navigate_to_today` untested |
| `commands/stats.rs` | 11+ | Excellent | None |
| `commands/search.rs` | 1 | Appropriate | Stub — single serialization test is sufficient |
| `commands/import.rs` | ~4 | Minimal | File size limit boundary untested; file I/O error paths untested |
| `commands/export.rs` | 2 | Minimal | `export_markdown` command not tested; file I/O errors not tested |
| `commands/plugin.rs` | 4 | Good | "Not found" plugin ID error path untested |
| `commands/debug.rs` | 3 | Good | Permission denied on output file not tested |
| `commands/files.rs` | 3 | Good | Symlink, very large file not tested |
| `import/minidiary.rs` | ~8 | Excellent | None |
| `import/dayone.rs` | ~8 | Excellent | None |
| `import/dayone_txt.rs` | 12 | Excellent | None |
| `import/jrnl.rs` | 11 | Excellent | None |
| `export/json.rs` | 5 | Excellent | None |
| `export/markdown.rs` | 24 | Excellent | None |
| `config.rs` | 11 | Excellent | File I/O error paths not tested |
| `backup.rs` | 5+ | Good | Disk full, permission errors not tested |
| `plugin/registry.rs` | 5 | Good | Non-existent plugin find not tested |
| `plugin/builtins.rs` | 3 | Good | End-to-end plugin execution not tested |
| `plugin/rhai_loader.rs` | ~8 | Very good | Rhai runtime errors; missing `@type` header not tested |
| `menu.rs` | **0** | **None** | See TC-CRITICAL-1 |
| `screen_lock.rs` | **0** | **None** | See TC-CRITICAL-2 |
| `lib.rs` | **0** | **None** | See TC-CRITICAL-3 |
| Re-export modules (`*/mod.rs` with no logic) | N/A | N/A | Not applicable |

### 5.2 Critical Gaps

**TC-CRITICAL-1: `menu.rs` — Zero Tests**

`menu.rs` covers 226 lines: `build_menu()` (all menu items, accelerators, platform-conditional layout), `on_menu_event` handler (11 event ID branches), and `update_menu_lock_state()` (enables/disables 9 items on lock/unlock). None is tested.

`build_menu()` requires an `AppHandle<Wry>`, which requires a running Tauri context. This makes unit testing impractical without Tauri's test infrastructure, which the project intentionally avoids at the command layer. The functional coverage from `e2e/specs/diary-workflow.spec.ts` exercises the lock/unlock path and menu state indirectly.

**Current mitigation:** E2E functional coverage.
**Future option:** If Tauri adds a test-mode `AppHandle`, revisit. Track in OPEN_TASKS.md.

---

**TC-CRITICAL-2: `screen_lock.rs` — Zero Tests**

The Windows `unsafe extern "system"` subclass procedure and the macOS `NSWorkspace` notification subscriptions cannot be unit-tested without OS-level handles and a running event loop. The `trigger_auto_lock` helper function is pure application logic and could be extracted and tested with a mock `DiaryState`, but this requires additional refactoring.

**Current mitigation:** The auto-lock path is indirectly validated by E2E tests (lock/unlock flow).
**Future option:** Extract `trigger_auto_lock` to a testable inner function. Track in OPEN_TASKS.md.

---

**TC-CRITICAL-3: `lib.rs` — Zero Tests**

`lib.rs` contains the application bootstrap: app data directory resolution, legacy migration path detection, E2E env var overrides, and plugin registry initialization. The pure functions `resolve_app_data_dir()` and `has_legacy_app_state()` could be unit-tested without Tauri infrastructure.

**Recommended action (A12):** Extract these as testable helpers and add isolated tests.

### 5.3 High-Priority Gaps: Untested Public Commands

These commands are callable directly from the frontend with no direct test at the command level:

| Command | File:Line | Gap |
|---|---|---|
| `delete_entry` | `commands/entries.rs:119–134` | Hard delete. `queries::delete_entry_by_id` is tested in queries.rs, but the command wrapper — including the "Entry not found" error path at line 130 — is not. |
| `get_all_entry_dates` | `commands/entries.rs:140–150` | The test `test_get_all_dates_workflow` at line 277 calls `queries::get_all_entry_dates` directly, not the command wrapper. |
| `navigate_to_today` | `commands/navigation.rs:25–28` | Returns `chrono::Local::now().date_naive()`. Not tested; exact value can't be asserted but format and parseability can. |
| `update_slot_last_used` | `db/queries.rs` | Called on every successful keypair unlock (`schema.rs:192`, `schema.rs:239`). If it silently fails, the `last_used` column stays null. Non-critical, but unverified. |

### 5.4 Medium-Priority Gaps

**TC-MED-1: v3→v4 and v4→v5 migration isolation**

The schema tests in `db/schema.rs` test the full pipeline (v1→v5), but there are no tests that start with a v3 database and verify v4 migration, or start with a v4 database and verify v5 migration preserves entry order and data.

**TC-MED-2: Import file size boundary (`commands/import.rs`)**

`MAX_IMPORT_FILE_SIZE` (100 MB) is enforced in `read_import_file` at lines 16–23. The boundary condition (file at exactly the limit, and at limit + 1 byte) and the error message format are unverified.

**TC-MED-3: Plugin "not found" error path**

`commands/plugin.rs:52` returns `Err(format!("Import plugin '{}' not found", plugin_id))` for unknown plugin IDs. This error message format reaching the frontend is unverified.

**TC-MED-4: Rhai plugin execution errors**

`plugin/rhai_loader.rs` does not test: a script that fails to compile, a script with a missing `fn parse(content)` function, or a script that throws during execution.

**TC-MED-5: Auth journal edge cases**

`auth_journals.rs` does not test `remove_journal_inner` / `rename_journal_inner` / `switch_journal_inner` with a non-existent journal ID.

**TC-MED-6: Auth method edge cases**

`auth_methods.rs` does not test `remove_auth_method` with a non-existent `slot_id`. The underlying `delete_auth_slot` query would succeed silently (rusqlite `execute` does not error on zero rows affected for DELETE). This is arguably correct behavior but is unverified.

### 5.5 Tests That Are Correct As-Is

- **`commands/search.rs`** has one test (`test_search_result_serialization`). This is appropriate for a stub command returning `[]`. No additional tests are warranted until a real implementation is added.
- **`commands/navigation.rs`** covers all four `navigate_*` functions except `navigate_to_today`. The other four have meaningful tests including year-boundary and invalid-date cases.
- **Import parsers** (`minidiary.rs`, `dayone.rs`, `dayone_txt.rs`, `jrnl.rs`) and **export modules** (`json.rs`, `markdown.rs`) have thorough test suites. No gaps warranting action.

---

## 6. Action Plan

### Priority 1 — Quick Fixes (≤30 min each)

**A1 — Fix stale error message in `delete_entry`**
- **File:** `src-tauri/src/commands/entries.rs:124`
- **Change:** `ok_or("Diary not unlocked")` → `ok_or("Journal must be unlocked to delete entries")`
- **Why:** Terminological consistency across all unlock guard sites. "Diary" is the old pre-v0.4.2 terminology.

**A2 — Add inline "why" to `#[allow(dead_code)]` attributes in `jrnl.rs`**
- **File:** `src-tauri/src/import/jrnl.rs:10, 20, 22, 24`
- **Change:** Move the existing field-line comments up onto the attribute lines.
- **Example:** `#[allow(dead_code)] // jrnl JSON schema field; required for Serde deserialization but Mini Diarium does not import tags`
- **Why:** Brings the file into compliance with the project's lint-suppression comment style.

### Priority 2 — Test Coverage Improvements

These can all be implemented without Tauri infrastructure, following the same test pattern used in the rest of the codebase (tempfile DB, inner-function calls).

**A3 — Test `delete_entry` command logic**
- **File:** `commands/entries.rs` — add to existing `#[cfg(test)]`
- **Cases:** (1) delete existing entry → `Ok(())`; (2) delete non-existent ID → `Err("Entry not found")`.
- **Pattern:** Call `queries::delete_entry_by_id` directly (same as other tests in the file).

**A4 — Test `navigate_to_today`**
- **File:** `commands/navigation.rs` — add to existing `#[cfg(test)]`
- **Cases:** (1) return value matches `%Y-%m-%d` pattern; (2) parses successfully as `NaiveDate`.

**A5 — Test `update_slot_last_used` in `db/queries.rs`**
- **File:** `db/queries.rs` — add to existing `#[cfg(test)]`
- **Cases:** (1) create DB with `create_database`; (2) query password slot id; (3) call `update_slot_last_used`; (4) assert `last_used` column is not null.

**A6 — Test plugin "not found" error path**
- **File:** `commands/plugin.rs` — add to existing `#[cfg(test)]`
- **Cases:** (1) `find_importer("nonexistent")` returns `None`; (2) verify error message format matches `"Import plugin 'x' not found"`.

**A7 — Test `MAX_IMPORT_FILE_SIZE` boundary**
- **File:** `commands/import.rs` — add to existing `#[cfg(test)]`
- **Cases:** (1) temp file at exactly `MAX_IMPORT_FILE_SIZE` bytes → success; (2) temp file at `MAX_IMPORT_FILE_SIZE + 1` → `Err` containing "too large".

**A8 — Add v3→v4 and v4→v5 migration isolation tests**
- **File:** `db/schema.rs` — add to existing `#[cfg(test)]`
- **Cases:** (1) construct a v3-schema database, call `migrate_v3_to_v4`, assert `entries_fts` table no longer exists and schema version is 4; (2) construct a v4-schema database with entries, call `migrate_v4_to_v5`, assert all rows are preserved in correct order and schema version is 5.

**A9 — Document migration backup absence with comments**
- **File:** `db/schema.rs`, inside `migrate_v3_to_v4` and `migrate_v4_to_v5`
- **Change:** Add a comment explaining why no pre-migration backup is created (idempotent DDL-only, transactional, low-risk).
- **Example:** `// No pre-migration backup: this migration is DDL-only (DROP TABLE IF EXISTS) and idempotent. Failure leaves the database at schema v3, which the prior release handled correctly.`

### Priority 3 — Defer or Accept

**A10 — State lock boilerplate**
State lock acquisition is repeated verbatim across 10+ files. Extracting it is complicated by `MutexGuard` lifetime constraints. The pattern is idiomatic Rust; extraction would require either a macro or significant restructuring with minimal safety gain. **Accept as-is.**

**A11 — `menu.rs` and `screen_lock.rs` unit tests**
Both files require live OS-level handles unavailable in unit tests. E2E coverage via `diary-workflow.spec.ts` provides functional validation of the lock/unlock flow. **Defer; track in OPEN_TASKS.md.**

**A12 — `lib.rs` bootstrap logic tests**
`has_legacy_app_state()` and `resolve_app_data_dir()` are pure enough to unit-test without Tauri infrastructure. Medium priority. **Track in OPEN_TASKS.md.**

---

## 7. Decisions Log

The following findings were evaluated and explicitly decided not to fix. Each entry documents the rationale so future reviewers understand the decision was intentional.

| Decision | Finding | Rationale |
|---|---|---|
| Do not upgrade `rand` to 0.10 | `rand = "0.8"` in `Cargo.toml` | `aes-gcm 0.10` and `x25519-dalek 2` depend on `rand_core 0.6`. Upgrading requires pre-release crypto crates (`aes-gcm 0.11.0-rc.3`, `x25519-dalek 3.0.0-pre.6`), which is inappropriate for a privacy-first app. Retry when stable releases land. Tracked in MEMORY.md. |
| No pre-migration backup for v3→v4 | `migrate_v3_to_v4` in `schema.rs` | Idempotent `DROP TABLE IF EXISTS`. The dropped table stored plaintext; dropping it is a security improvement. Failure leaves DB at v3, which the prior release handled. |
| No pre-migration backup for v4→v5 | `migrate_v4_to_v5` in `schema.rs` | Table rename + row copy inside `BEGIN IMMEDIATE / COMMIT`. SQLite atomicity guarantees the database is either fully migrated or left at v4. |
| Accept state lock boilerplate | 10+ copies of mutex lock + poison guard | `MutexGuard` lifetime constraints make extraction non-trivial without macros. The pattern is idiomatic Rust. No correctness or security consequence. |
| Keep `search.rs` single test | `test_search_result_serialization` | The command is a stub returning `[]`. Testing the struct's JSON serialization is appropriate until a real search implementation is added. |
| Defer `menu.rs`/`screen_lock.rs` unit tests | Both files zero-tested | Require live OS handles (`AppHandle<Wry>`, HWND, NSWorkspace). E2E suite provides functional coverage. No practical path to unit-test without Tauri test infrastructure. |
| Accept `unsafe impl Send/Sync` on Rhai plugins | `rhai_loader.rs` | Required by `rhai::AST` not implementing `Send + Sync`. Justified: AST is immutable post-compilation; each invocation uses a fresh `Engine`. Documented in CLAUDE.md Gotcha #11. |
| No minimum password length | `register_password` in `auth_methods.rs` accepts a 1-character password | Mini Diarium's threat model is local encrypted storage, not multi-user authentication. Password strength is the user's responsibility. A strength meter or minimum length is a frontend concern and does not require backend changes. |

---

## 8. Summary Scorecard

| Dimension | Score | Notes |
|---|---|---|
| Architecture alignment | Excellent | No drift from CLAUDE.md; all four layers match |
| Command registration | Complete | All 49 commands verified in `generate_handler![]` |
| Cryptographic correctness | Excellent | AES-256-GCM, Argon2id, X25519 ECIES all correctly implemented |
| SQL injection surface | None | 100% parameterized queries |
| Sensitive data handling | Excellent | Zeroization complete; no plaintext on disk or in logs |
| `unsafe` code | Sound | Two sites; both documented and justified |
| Code style compliance | Near-complete | 2 low-severity violations (A1, A2); ≤30-min fixes |
| Test coverage — crypto/DB core | Excellent | 80+ tests on the most critical paths |
| Test coverage — import/export | Excellent | 80+ tests across four parsers and two exporters |
| Test coverage — commands | Partial | 3 files with zero tests; 5 untested public commands |
| Test coverage — migrations | Partial | End-to-end migration path tested; per-step isolation missing |
| Test coverage — OS integration | Minimal | `menu.rs`, `screen_lock.rs` not unit-testable; E2E covers functionally |

---

*Assessment conducted 2026-03-21 against branch `feature-v0.4.9`. Next scheduled assessment: after feature-v0.5.x milestone, or after any significant backend refactor.*
