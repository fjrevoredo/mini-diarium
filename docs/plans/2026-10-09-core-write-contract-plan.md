# Core write contract

## Metadata

- Plan Status: IN PROGRESS
- Plan Format: manual-planning v2.0.0
- Template: milestoned
- Tracking: tracked

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Context For A Clean Session

- Repository: `D:\Repos\mini-diarium`, branch `master` (trunk-based, no feature branches), at `3560fd8` when this plan was written.
- Backlog item: **TODO-0133** in `docs/todo/TODO.md`. Source: review findings R-02, R-11, R-05 (policy move) and R-13 (API surface) in `docs/explorations/2026-10-09-release-0.7.3-0.7.4-internal-review.md`. Read R-02 and R-05 there before you start.
- Stack: Rust 3-crate Cargo workspace (`mini-diarium-crypto` → `mini-diarium-core` → app crate `src-tauri/`), `rusqlite = 0.40` with `bundled` (`crates/mini-diarium-core/Cargo.toml:35`). Frontend SolidJS + Vitest.
- Shell: Windows. The Bash tool is Git Bash/MSYS, where `cmd.exe /c ...` silently does nothing. Run `bun` commands from the **PowerShell tool**, or use `MSYS_NO_PATHCONV=1 cmd.exe /c "..."`. `cargo` runs bare from the repo root.
- Exact commands:
  - Backend tests: `cargo test --workspace` (without `--workspace` the core and crypto tests do not run)
  - Lint: `cargo clippy --workspace --all-targets -- -D warnings`
  - Format: `cargo fmt --all -- --check`
  - Frontend tests: `bun run test:run`
  - Full gate: `bun run pre-commit` (includes the Codecov patch mirror `coverage:diff`)

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| Each core write function opens its own `BEGIN IMMEDIATE` | `entries/insert.rs:52-84`, `entries/update.rs:21`, `entries/delete.rs:20`, `entries/recalculate.rs:28`, `attachments/storage.rs:47-67` (`in_transaction`) | `Grep "BEGIN IMMEDIATE" crates/` |
| A migration helper with the same shape exists | `db/schema/migrations/mod.rs:51` `run_migration_transaction` | same grep |
| Restore of one entry is not atomic | `backup/restore_entries.rs:146-187`: blob copy (`copy_attachment_blobs`, autocommit), `insert_entry_with_images` (own txn), `link_attachment` per file (autocommit), tags; error path only calls `cleanup_orphaned_attachments` | read the file |
| Core handle is a shared reference | every core write takes `db: &DatabaseConnection`; `DatabaseConnection.conn: Connection` is `pub(crate)` (`db/schema/mod.rs:25-28`) | read the file |
| Lock check lives only in the app crate | `commands/entries.rs:57` (save), `:262` (hard delete), `commands/tags.rs:33,57`, `commands/attachments.rs:18-27` (`ensure_entry_unlocked`) | `Grep "is_entry_locked\|entry is locked" *.rs` |
| Core already enforces a lock rule in one place | `recalculate_all_word_counts` skips locked rows (`entries/recalculate.rs:13-19`) | read the file |
| "Entry is empty" rule lives in the app crate | `is_blank_html` (`commands/entries.rs:140`), `entry_is_blank` (`:201`), used by `delete_entry_if_empty_inner` (`:211-240`) and `entry_has_content` (`:278`), with tests at `:486-551` | read the file |
| Frontend matches the lock string exactly | `src/lib/errors.ts:52` `/^entry is locked$/i` | `Grep` |
| Hard delete wraps core errors | `commands/entries.rs:265-266` maps a `delete_entry_by_id` error to `"Failed to delete entry: …"` | read the file |
| Four helpers are public but used only inside core | `upsert_attachment_blob`, `link_attachment`, `cleanup_orphaned_attachments`, `mime_for_extension` exported at `db/mod.rs:39-42`, documented at `API.md:187-196`; no use under `src-tauri/src` | `Grep` over the repo |
| `API.md` documents the current transaction contract | `crates/mini-diarium-core/API.md:83-89` | read the file |
| Façade rule | `src-tauri/src` must not contain `rusqlite`, `db::queries::`, `db::schema::`, `.conn()`, `.key()` | `src-tauri/CLAUDE.md` "Workspace layout" |

### Hard constraints

1. Plaintext never touches disk, and no log at `info!` or above holds user data — a violation breaks the product's core promise (`CLAUDE.md` Security Rules; `src-tauri/CLAUDE.md` Gotcha #10).
2. The lock error string stays exactly `entry is locked` and reaches the frontend unwrapped — otherwise `errors.ts:52` stops matching and the user sees a raw or wrongly bucketed error.
3. `delete_entry_if_empty` refuses a locked entry with `Ok(false)`, never an error — it runs on auto-lock and app-close paths that cannot show an error (TODO-0132).
4. Hard delete must not become blank-only, and blank-entry cleanup must stay a separate API — merging them deletes real entries or blocks explicit deletes.
5. The app crate reaches core only through the façade — a direct `rusqlite` or `.conn()` call in `src-tauri/src` breaks the open-core M2 contract.
6. A restored entry is always unlocked (`restore_entries.rs:128-131`) — lock enforcement must not block restore, which inserts **new** entries.
7. No schema change — this plan changes code paths only. A schema change would trigger the forward-compatibility checklist (`compat.rs`).

## Goal

Every multi-step write in core is atomic and can nest inside a larger write. Restoring one entry from a snapshot is all-or-nothing. Core, not the app crate, owns the entry-lock rule and the "entry is empty" rule, so a second consumer of the façade gets them too. The façade no longer exports non-atomic building blocks that skip the lock.

## Scope

- One nest-safe transaction helper in core; the five hand-written BEGIN/COMMIT/ROLLBACK blocks in `db/queries` use it.
- Per-entry atomic restore in `backup/restore_entries.rs`, with fault-injection tests.
- Lock enforcement and an `entry_is_empty` predicate in core; the app-crate copies removed.
- `pub(crate)` for the four internal attachment helpers; `API.md` updated.
- Docs: `API.md`, `src-tauri/CLAUDE.md` Gotcha #1, `RUST_BEST_PRACTICES.md` rule, CHANGELOG.

## Non-Goals

- Migrations keep `run_migration_transaction` and their own `BEGIN IMMEDIATE` statements. They run once per bump, their tests drive transactions by hand, and changing them adds risk for no user benefit.
- Atomicity across a whole multi-entry restore batch. The documented behavior (`restore_entries.rs:133-136`) stays: earlier entries of a batch may stay after an error.
- Moving attachment work off the event thread (TODO-0134, done after this plan).
- Structured error codes (TODO-0139).
- The app-crate fix for the soft-delete lock gap (TODO-0132). That fix ships first; this plan moves it into core.

## Assumptions

- TODO-0132 is done before Task 3.2 starts, so the regression test for a locked blank entry already exists. If it is not done, Task 3.2 adds that test itself. Check: `Grep "is_entry_locked" src-tauri/src/commands/entries.rs` shows a hit inside `delete_entry_if_empty_inner`.
- `rusqlite::Connection::is_autocommit()` reports whether a transaction is open, and SQLite allows nested `SAVEPOINT`s with the same name (`ROLLBACK TO` targets the newest one). Task 1.1 confirms both with unit tests before anything depends on them.
- `rusqlite`'s `Transaction` and `Savepoint` types need `&mut Connection`. The core API passes `&DatabaseConnection`, so the helper uses SQL statements (`BEGIN IMMEDIATE` / `SAVEPOINT`) plus a drop guard, not those types. Changing every signature to `&mut` would ripple through all callers and the app crate's `Mutex` guard.

## Open Questions

None. The design choices are recorded as DEC-001 and DEC-002 below; challenge them at approval if you disagree.

## Milestones

### Milestone 1: Nest-safe transaction helper

- Status: COMPLETED
- Purpose: Give core one way to run a write unit that works both alone and inside a larger one.
- Exit Criteria: The helper exists with tests, the five hand-written blocks use it, and `cargo test --workspace` passes with no change to test expectations.

#### Task 1.1: Add `with_write_transaction`

- Status: COMPLETED
- Depends On: none
- Objective: A `pub(crate)` helper in core runs a closure as one atomic unit and nests safely.
- Steps:
  1. Add `pub(crate) fn with_write_transaction<T>(db: &DatabaseConnection, f: impl FnOnce() -> Result<T, String>) -> Result<T, String>` in a new `crates/mini-diarium-core/src/db/queries/transaction.rs` (or next to `MAX_STORED_BLOB_BYTES` in `db/queries/mod.rs` if that reads better).
  2. When `db.conn.is_autocommit()` is true: `BEGIN IMMEDIATE`, run `f`, `COMMIT`; on `Err`, `ROLLBACK`.
  3. When a transaction is already open: `SAVEPOINT md_write`, run `f`, `RELEASE md_write`; on `Err`, `ROLLBACK TO md_write` then `RELEASE md_write`, so the outer transaction stays usable.
  4. Use a drop guard so a panic inside `f` also rolls back (the hand-written closures do not do this today).
  5. Handle an error that SQLite answers by rolling back the whole transaction (for example `SQLITE_FULL`, `SQLITE_IOERR`): if `is_autocommit()` is already true after the error, skip `ROLLBACK TO` / `RELEASE` and return the original error, not a secondary "no such savepoint" error.
  6. Unit tests: (a) commit alone, (b) rollback alone, (c) inner failure inside an outer unit rolls back only the inner work and the outer can still commit, (d) outer failure rolls back committed inner work, (e) panic in `f` leaves `is_autocommit()` true, (f) two levels of nesting.
- Validation: `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml transaction` — all six tests by name pass.
- Notes: Keep error messages in the existing `"BEGIN failed: …"` / `"COMMIT failed: …"` shape.

#### Task 1.2: Replace the hand-written blocks

- Status: COMPLETED
- Depends On: 1.1
- Objective: `insert_entry_with_images`, `update_entry_with_images`, `delete_entry_by_id`, `recalculate_all_word_counts`, and the attachment `in_transaction` all use the helper.
- Steps:
  1. Replace each block in `entries/insert.rs`, `entries/update.rs`, `entries/delete.rs`, `entries/recalculate.rs`, and `attachments/storage.rs`; delete `in_transaction`.
  2. Update the doc comments that say "wraps in `BEGIN IMMEDIATE` / `COMMIT`".
  3. Add one test that calls `insert_entry_with_images` inside an outer `with_write_transaction` that then fails, and asserts that the entry is gone.
- Validation: `cargo test --workspace` passes; `Grep "BEGIN IMMEDIATE" crates/mini-diarium-core/src/db/queries` finds only the helper (any other hit is a miss).
- Notes: None.

### Milestone 2: Atomic per-entry restore

- Status: COMPLETED
- Purpose: Fix R-02: one restored entry is never half-written.
- Exit Criteria: The three fault cases from the review leave the live journal unchanged for the failing entry, and earlier entries in the batch keep the documented behavior.

#### Task 2.1: Fault-injection tests first

- Status: COMPLETED
- Depends On: 1.2
- Objective: Tests that reproduce the three outcomes in the review table fail against the current restore code.
- Steps:
  1. In `restore_entries.rs` tests, add: `test_restore_rolls_back_entry_when_second_link_fails` (a `BEFORE INSERT ON entry_attachments` trigger that runs `SELECT RAISE(ABORT, 'injected')` on the second row), `test_restore_leaves_no_blob_when_second_snapshot_blob_is_corrupt` (overwrite the second blob's ciphertext in the snapshot), `test_restore_rolls_back_entry_when_tag_link_fails` (trigger on `entry_tags`).
  2. Each asserts: no new entry, no new `entry_attachments` rows, no new unlinked `attachments` rows, no new tags or tag links, and the snapshot and existing live entries unchanged.
  3. Run them and record in the Decision Log that they fail before Task 2.2 (expected).
- Validation: the three tests exist by name and fail before Task 2.2.
- Notes: Build triggers on the in-memory live DB through `open_connection_in_memory` fixtures already used in that file.

#### Task 2.2: Wrap each entry's restore in one unit

- Status: COMPLETED
- Depends On: 2.1
- Objective: Everything one entry's restore writes commits together or not at all.
- Steps:
  1. In `restore_entries_from_snapshot`, run the body for one id (blob copy, ref remap, insert, links, tags) inside `with_write_transaction(live_db, …)`.
  2. Remove the `let _ = cleanup_orphaned_attachments(live_db)` error paths; the rollback replaces them.
  3. Update the doc comment at `:133-136`: entries before the failing one stay, the failing one leaves nothing.
- Validation: the three Task 2.1 tests pass; all existing `restore_entries` tests pass; `cargo test --workspace` passes.
- Notes: The snapshot is a different connection and is only read, so reads from it inside the live transaction are safe.

### Milestone 3: Entry-protection policy in core

- Status: TO BE DONE
- Purpose: Fix R-05: core owns the lock rule and the empty rule, in one place each.
- Exit Criteria: No `is_entry_locked` call and no `"entry is locked"` literal remain in `src-tauri/src/commands/*` outside tests; core write operations refuse a locked entry; all existing lock tests still pass.

#### Task 3.1: Lock enforcement in core write operations

- Status: TO BE DONE
- Depends On: 1.2
- Objective: The user-facing core writes refuse a locked entry with one exported constant.
- Steps:
  1. Add `pub const ERR_ENTRY_LOCKED: &str = "entry is locked";` and `pub(crate) fn ensure_entry_unlocked(db, id)` in `entries/lock.rs`; export the constant from the `db` façade and list it in `API.md`.
  2. Call `ensure_entry_unlocked` inside the transaction of: `update_entry_with_images`, `delete_entry_by_id`, `add_tag_to_entry`, `remove_tag_from_entry`, `add_attachment_to_entry`, `remove_attachment_from_entry`.
  3. Inventory every other public core write that targets an existing entry (`Grep "pub fn" crates/mini-diarium-core/src/db/queries`) and record in the Decision Log, per function, whether it enforces, skips (as `recalculate_all_word_counts` does), or is exempt (`set_entry_locked`; `insert_entry*` and restore, which only create new rows; journal-wide operations such as deleting a tag, whose `ON DELETE CASCADE` removes links from locked entries too). The low-level `update_entry` stays unchecked because `insert_entry_with_images` uses it on a new row; decide whether it should become `pub(crate)` (only tests outside core use it: `commands/entries.rs:419`, `commands/export.rs:330`).
  4. Core tests: each enforced function returns `Err(ERR_ENTRY_LOCKED)` on a locked entry and leaves the row unchanged.
- Validation: `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml lock` — the new tests pass by name.
- Notes: Constraint 6 (restore) and constraint 2 (exact string) apply.

#### Task 3.2: Remove the app-crate copies

- Status: TO BE DONE
- Depends On: 3.1, 3.3
- Objective: Commands rely on core for the lock rule and still return the exact string.
- Steps:
  1. Remove the pre-checks at `commands/entries.rs:57`, `commands/tags.rs:33,57`, and `commands/attachments.rs:18-27` (`ensure_entry_unlocked`, `ERR_ENTRY_LOCKED`).
  2. Hard delete (`commands/entries.rs:258-272`): stop wrapping the core error as `"Failed to delete entry: …"` when it is `ERR_ENTRY_LOCKED`, or keep a pre-check that uses the core constant. The command must still return exactly `entry is locked`.
  3. `delete_entry_if_empty_inner` uses the core `entry_is_empty` from Task 3.3 and returns `Ok(false)` for a locked entry (constraint 3).
  4. Keep the existing app-crate lock tests unchanged; they now prove the core path: `test_save_entry_locked_returns_error`, `test_save_entry_rejects_locked_entry` (`commands/entries.rs`), `test_add_tag_to_locked_entry_is_rejected`, `test_remove_tag_from_locked_entry_is_rejected` (`commands/tags.rs`), `test_locked_entry_rejects_add_and_remove_but_allows_save_copy` (`commands/attachments.rs`).
- Validation: `Grep "is_entry_locked\|\"entry is locked\"" src-tauri/src/commands` finds hits only inside `#[cfg(test)]` modules; the locked-blank-entry test from TODO-0132 passes; `cargo test --workspace` passes.
- Notes: The façade greps in `## Pre-flight Checks` must stay empty.

#### Task 3.3: `entry_is_empty` in core

- Status: TO BE DONE
- Depends On: 1.2
- Objective: One core predicate says whether a stored entry is empty: blank title, blank body, and no attachments.
- Steps:
  1. Move `is_blank_html` and its tests (`commands/entries.rs:140-202`, `:486-551`) into core (for example `db/queries/entries/blank.rs`).
  2. Add `pub fn entry_is_empty(db, id) -> Result<Option<bool>, String>` (`None` when the entry does not exist) and export it from the façade; list it in `API.md`.
  3. Also export a text-only predicate (for example `pub fn is_blank_entry_text(title, text) -> bool`), because `delete_entry_if_empty_inner` first checks the **incoming** arguments before it reads the row. It then uses `entry_is_empty` for the on-disk check, and a missing entry (`None`) stays `Ok(false)`.
  4. `entry_has_content_inner` (`commands/entries.rs:275-280`) becomes `!entry_is_empty`, and a missing entry (`None`) still returns the error `"Entry not found"` (pinned by `test_entry_has_content_errors_for_missing_entry`).
  5. Keep hard delete and blank cleanup as separate APIs (constraint 4).
- Validation: the moved `is_blank_html` tests pass in core; these app-crate tests pass unchanged: `test_delete_entry_if_empty_workflow`, `test_delete_entry_if_empty_refuses_non_empty_text`, `test_delete_entry_if_empty_refuses_non_empty_title`, `test_delete_entry_if_empty_refuses_when_disk_row_still_has_content`, `test_delete_entry_if_empty_still_allows_genuinely_blank_entry`, `test_entry_has_content_true_for_entry_with_real_content`, `test_entry_has_content_false_for_blank_entry`, `test_entry_has_content_errors_for_missing_entry`.
- Notes: None.

### Milestone 4: Narrow the façade and record the rules

- Status: TO BE DONE
- Purpose: Fix the R-13 API-surface note and write down the rule so the next change follows it.
- Exit Criteria: The four helpers are crate-private, the docs describe the new contract, and the full gate passes.

#### Task 4.1: Make the four attachment helpers crate-private

- Status: TO BE DONE
- Depends On: 2.2, 3.1
- Objective: `upsert_attachment_blob`, `link_attachment`, `cleanup_orphaned_attachments`, `mime_for_extension` are `pub(crate)`.
- Steps:
  1. Remove them from the `pub use` list at `db/mod.rs:39-42` and narrow their visibility.
  2. Remove their entries from `API.md:187-196`, and note that per-entry restore and delete use them internally.
- Validation: `cargo build --workspace` and `cargo test --workspace` pass; `cargo clippy --workspace --all-targets -- -D warnings` reports no dead-code warning.
- Notes: Check `crates/mini-diarium-core/src/export/attachments.rs` still compiles (it uses one of them inside core).

#### Task 4.2: Docs and rules

- Status: TO BE DONE
- Depends On: 3.2, 4.1
- Objective: The docs describe the new contract.
- Steps:
  1. `crates/mini-diarium-core/API.md:83-89` ("Transactions"): composed writes run as one unit and nest as savepoints inside a caller's unit; list the lock-enforcing functions and `ERR_ENTRY_LOCKED`; add `entry_is_empty`.
  2. `src-tauri/CLAUDE.md` Gotcha #1: core now enforces the lock (list the functions), and per-entry restore is atomic.
  3. `docs/best-practices/RUST_BEST_PRACTICES.md`: add "Core write primitives do not open their own transaction. Compose them under `with_write_transaction`, so the outermost operation owns the transaction and multi-step operations stay atomic."
  4. `CHANGELOG.md`: one `Fixed` bullet ("Restoring entries from a backup no longer leaves a half-restored entry when an attachment or tag fails to copy"). Check that the top version block is `Unreleased`; if it has a date, add a new `Unreleased` block above it.
  5. `website/docs-src/09-backups.md:102` ("Per-entry restore") says tags come back with a recovered entry but does not mention attachments, and says nothing about failures. Add: attached files come back with the entry, and an entry that cannot be restored completely is not added at all. Update the page's `updated:` front-matter date and run `bun run website:build-static` (PowerShell tool).
- Validation: read each changed section; `Grep "BEGIN IMMEDIATE" crates/mini-diarium-core/API.md` matches the new wording only.
- Notes: Do not edit `PHILOSOPHY.md` (needs explicit maintainer approval; tracked as TODO-0137).

### Milestone 5: Cleanup And Final Verification

- Status: TO BE DONE
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified.
- Exit Criteria: Intermediate artifacts are removed, the `## Pre-flight Checks` list passes, all final verification passes, and the plan status is COMPLETED.

#### Task 5.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Depends On: 4.2
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for temporary documentation, one-off scripts, scratch tests, generated data, logs, and obsolete plan fragments.
  2. Remove only artifacts that are not part of the intended final repository state.
  3. Keep maintainable tests, fixtures, docs, and generated files that are part of the repository contract.
- Validation: `git status --porcelain` lists only intended changes.
- Notes: Do not remove user-provided files or unrelated worktree changes.

#### Task 5.2: Final Verification

- Status: TO BE DONE
- Depends On: 5.1
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run every item in `## Pre-flight Checks`.
  2. Run the checks under `## Final Verification`.
  3. Mark TODO-0133 done in `docs/todo/TODO.md` with the date, per the todo-manager format.
  4. Fix failures and rerun until verification passes, or record the blocker.
- Validation: all pre-flight items pass.
- Notes: Coverage gate: new core code needs ≥80% patch coverage (`coverage:diff`).

## Project Gates

- Post-task checklist: `docs/best-practices/POST_TASK_BEST_PRACTICES.md` (tests, formatting, CHANGELOG, TODO closed, summary template).
- No autonomous commits: suggest commit messages; the maintainer commits. One logical change per commit (suggested split: M1, M2, M3, M4).
- Façade rule: `src-tauri/src` stays free of `rusqlite`, `db::queries::`, `db::schema::`, `.conn()`, `.key()`.
- Security stance: load the `security-stance` skill before Milestone 3 (entry persistence and IPC error contract).
- No manual UI verification required: no UI behavior changes, and the lock error string is unchanged.

## Pre-flight Checks

Run before the plan may reach `COMPLETED`.

- [ ] `cargo fmt --all -- --check`
- [ ] `cargo clippy --workspace --all-targets -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] `bun run pre-commit` (PowerShell tool) — includes type-check, lint, frontend tests, and `coverage:diff`
- [ ] `Grep "rusqlite" src-tauri/src` — no matches expected (a pass produces no output)
- [ ] `Grep "db::queries::|db::schema::|\.conn\(\)|\.key\(\)" src-tauri/src` — no matches expected

## Decision Log

### DEC-001 — Nest-safe helper instead of transaction-free primitives

- Date: 2026-10-09
- Task: 1.1
- Decision: Public composed writes keep their standalone atomicity and nest as SAVEPOINTs when a transaction is already open (`is_autocommit()` check), instead of the review's other option of stripping transactions from every primitive and making each caller own one.
- Rationale: Callers in the app crate and tests keep working unchanged, and no public function can be called in a way that is silently non-atomic. Stripping transactions would make every existing caller responsible for opening one, which is the same class of mistake the review found.

### DEC-002 — SQL statements plus a drop guard, not rusqlite `Transaction`/`Savepoint`

- Date: 2026-10-09
- Task: 1.1
- Decision: The helper issues `BEGIN IMMEDIATE` / `SAVEPOINT` itself and rolls back from a drop guard.
- Rationale: rusqlite's types need `&mut Connection`, and every core function takes `&DatabaseConnection`. The drop guard gives the same rollback-on-panic property the review asked for without an API-wide signature change.

### DEC-003 — Task 1.1 assumptions verified; extra helper tests

- Date: 2026-10-09
- Task: 1.1
- Decision: The helper lives in `db/queries/transaction.rs`. Both rusqlite/SQLite assumptions hold and are pinned by tests: `test_transaction_is_autocommit_reports_open_transaction` (`is_autocommit()` is false inside `BEGIN` and inside a savepoint) and `test_transaction_two_levels_of_nesting` (stacked same-name `md_write` savepoints; the innermost `ROLLBACK TO` undoes only its own level). Beyond the six planned tests (a)–(f), two more cover Step 5 (`test_transaction_returns_original_error_after_sqlite_rolled_back_everything`, which simulates SQLite rolling back the whole transaction with an explicit `ROLLBACK`) and the BEGIN error shape (`test_transaction_begin_failure_is_reported`, a second connection holds the write lock). A nested failure reports `"SAVEPOINT failed: …"` / `"RELEASE failed: …"`, in the same shape as `"BEGIN failed: …"` / `"COMMIT failed: …"`.
- Rationale: The plan asks to confirm the assumptions with tests; Step 5 and the error shape had no planned test.

### DEC-004 — Task 2.1 fault tests fail before the fix (expected); fixture choices

- Date: 2026-10-09
- Task: 2.1
- Decision: The three tests exist by name in `backup/restore_entries.rs` and all three fail against the restore code before Task 2.2 (`cargo test --manifest-path crates/mini-diarium-core/Cargo.toml restore_entries`: 7 passed, 3 failed). Each failure is on the live `attachments` table: the second-link and tag-link cases leave the new entry, its first link, and its blobs; the corrupt-blob case leaves the first copied blob unlinked. The tests compare a dump of every user table (live journal and snapshot) before and after the failed restore, so "no new entry / links / blobs / tags / tag links, existing entries and snapshot unchanged" is one table-by-table assertion. Two divergences from the plan text: (1) the fixtures use the file-backed `Fixture` (temp dir + `create_snapshot`) already in that file, not `open_connection_in_memory`, because a restore needs a real snapshot file; (2) the tag fault uses a trigger that rejects every `entry_tags` insert (the source entry has one tag), and the source tag is deleted from the live journal first, so a non-atomic restore would also leave a new `tags` row.
- Rationale: Task 2.1 Step 3 asks to record the expected pre-fix failure; the fixture note in the plan did not match how restore tests in that file build a snapshot.

### DEC-005 — Task 2.2 shape and an extra batch test

- Date: 2026-10-09
- Task: 2.2
- Decision: The per-entry body moved into a private `restore_one_entry`, which `restore_entries_from_snapshot` runs under `with_write_transaction(live_db, …)` once per id. The whole body runs inside the unit, including the snapshot reads, because the snapshot is a separate read-only connection. `with_write_transaction` was already reachable as `crate::db::queries::with_write_transaction` (`pub(crate) use` in `db/queries/mod.rs`), so no visibility change was needed. Both `cleanup_orphaned_attachments` error paths are gone, and `restore_entries.rs` no longer imports it. One test beyond the plan, `test_restore_keeps_earlier_entries_when_a_later_one_fails`, pins the Milestone 2 exit criterion about batches: an earlier entry (with its attachment and tag) stays, and the failing later entry leaves nothing.
- Rationale: The exit criterion names the batch behavior, and no planned test covered it.

### DEC-006 — External review of Milestone 1: caught-and-continued auto-rollback is a documented caller contract

- Date: 2026-10-09
- Task: 1.1
- Decision: Review finding P2 (a caller that swallows a nested unit's whole-transaction-rollback error and keeps writing commits those writes in autocommit mode) is accepted as a caller contract, documented on `with_write_transaction`, not detected in code.
- Rationale: Every core caller propagates helper errors with `?`, so the case needs a caller that deliberately ignores the error. The outer `COMMIT` still reports failure. The helper cannot block later writes on a shared `&DatabaseConnection` without a stateful poison flag, which is out of proportion to the risk.

## Final Verification

Task 5.2 runs the pre-flight list. The end-to-end proof of the main fix is the three Task 2.1 fault-injection tests passing together with the existing restore tests, and the locked-entry tests in both crates passing with the app-crate pre-checks removed.

## Approval Gate

Implementation must not start until the user approves this plan.

## Plan Self-Check

```
$ uv run --no-project python .agents/skills/manual-planning/scripts/check-plan.py docs/plans/2026-10-09-core-write-contract-plan.md
0 error(s), 0 warning(s)
```

Run: 2026-10-09

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Task numbering is not an execution order. Follow `Depends On`.
- Write a `## Decision Log` entry **before starting the next task** whenever execution diverges from
  this plan, an unplanned problem is found, or a validation is deferred — never retrospectively.
