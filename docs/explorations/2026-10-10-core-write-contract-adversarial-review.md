# Adversarial Review: Core Write Contract (TODO-0133)

**Date:** 2026-10-10
**Scope:** the unpushed commits `7acfe90`..`88eb033` on `master` (merge-base with `origin/master`: `4627248`) that implement [`docs/plans/2026-10-09-core-write-contract-plan.md`](../plans/2026-10-09-core-write-contract-plan.md). The review covers the Rust and frontend code paths those commits touch, with a focus on data integrity and security. The `.agents/skills/manual-planning/*` changes and the archived plans are out of scope.
**Mode:** Read-only. No source file changed.
**Reviewers:** Claude (first pass) and an OpenCode agent (independent second opinion, [full text](2026-10-10-core-write-contract-second-opinion.md)). Each finding below shows the merged verdict. Where the second opinion corrected the first pass, the correction is applied in the text and noted.
**Method:** Full diff of `crates/mini-diarium-core/src` and `src-tauri/src`; the new helper `db/queries/transaction.rs`; `backup/restore_entries.rs`; every caller of the lock-enforcing writes; every remaining raw `BEGIN`/`COMMIT`/`ROLLBACK`; the open path (`db/schema/open.rs`, `commands/auth/auth_core.rs`); the restore command and UI; the lock path; the changed docs. The second opinion also read the installed `rusqlite 0.40.2` and SQLite `3.53.2` sources. No test was run, and no fault was injected.
**Evidence rule:** every claim about SQLite, rusqlite, or Rust behavior cites official documentation as `[S#]` (see [References](#references)). Where the official documentation is silent or ambiguous, the claim cites the bundled SQLite source as `[SRC#]` and says so. Claims about this repository cite `file:line` at `88eb033`.

## Summary

The plan reached its main goals. Each composed write is now atomic, per-entry restore is all-or-nothing at the SQL level, the lock check runs inside the same write unit as the write, and the exact `entry is locked` string still reaches the frontend. Neither reviewer found a plaintext-on-disk path, a new log of user data, a network path, or a façade-rule violation. **No finding is a regression that these commits introduced and that a current code path triggers.**

The findings fall into four classes. Keep them apart when you plan the work:

- **Existing product defects** (present at the merge-base, still present): W-02, N-01.
- **New behavior** (introduced by these commits, accepted trade-off): W-05.
- **Hardening and latent composition hazards** (no current trigger): W-01, W-03, W-04, W-06.
- **Test gaps**: W-07.

| ID | P | Class | Title |
|----|---|-------|-------|
| W-02 | P2 | Existing defect | A partial restore failure hides the entries already committed; a retry duplicates them |
| N-01 | P2 | Existing defect | Unresolved snapshot image refs bind to unrelated live images (restore); foreign image refs do the same (import) |
| W-01 | P3 | Hardening | `with_write_transaction` accepts a transaction it does not own; fail closed instead |
| W-03 | P3 | API contract | The façade still exports `update_entry` / `insert_entry`, which skip the lock and image composition |
| W-04 | P3 | Latent hazard | Journal-wide orphan GC runs inside nested units |
| W-05 | P3 | New behavior | `add_entry_attachment` reads the source file before the lock check |
| W-06 | P3 | Maintenance | The lock contract is a string compare |
| W-07 | P3 | Test gap | No tests for a failed COMMIT, an unowned transaction, or duplicate restore ids |

## Recommended order

1. **W-02** (partial-restore result + UI refresh) and **N-01** (restore and import image-ref validation). These are the two defects a user can hit.
2. **W-07** COMMIT-failure test.
3. **W-01** as an explicit fail-closed design decision, with a fault test first.
4. **W-03** to **W-06** as scoped API or maintenance work (with TODO-0139 and TODO-0134).

---

## W-02 — Partial restore failure hides committed entries; a retry duplicates them (P2, existing)

**Verdict:** CONFIRMED by both reviewers. Present at the merge-base `4627248`; these commits fixed incomplete *individual* entries, not hidden *batch* progress.

### Where

- `crates/mini-diarium-core/src/backup/restore_entries.rs:140-160` (`restore_entries_from_snapshot`); batch behavior pinned by `test_restore_keeps_earlier_entries_when_a_later_one_fails` (`:827-853`)
- `src-tauri/src/commands/backup_inspect.rs:259-292` (`restore_entries_from_backup_inner`; the error propagates at `:281` before a count can return)
- `src/components/backups/BackupInspectDialog.tsx:208-250` (restore handler)
- `website/docs-src/09-backups.md:102` ("Per-entry restore")

### What

Each requested id is its own committed unit. When a later id fails, the earlier ones stay, but:

- Core returns only `Err(String)`. Which entries were committed is lost.
- The UI clears the selection only after a successful call (`:212-213`). The `catch` (`:247-250`) only sets the error and clears the busy flag. The date, locked-date, and tag refresh, the picker reload, and `executeReloadCallbacks` are all on the success path only (`:218-246`). The checkboxes keep the old selection (`:468-472`), and the Restore button is enabled again (`:528-535`).
- Each picker row keeps its **old status** (Missing, ShorterInLive, or Present), so the UI does not show that some entries were added.
- The website says "the result states how many entries were added". On failure it does not.
- The core doc comment (`restore_entries.rs:138-139`) calls a retry "safe". That means non-overwriting, not duplicate-free.

Second-opinion corrections applied:

- `added_count = entry_ids.len()` is **not** a wrong count today. A successful call inserts one row per requested id. The problem is only the missing progress on error.
- The UI already sends unique ids (it uses a `Set`, `BackupInspectDialog.tsx:56,177-183,197`). Duplicate ids are an IPC input-contract question, not the cause of retry duplicates.
- Duplicates get new entry rows and link rows. Attachment and image **blobs** are de-duplicated by fingerprint, so they are not stored twice.

### Failure scenario

1. The user selects entries A, B, C and clicks Restore. A and B commit. C fails (for example a damaged attachment blob in the snapshot).
2. The dialog shows an error. A, B, C stay selected with their old status. The calendar does not show A or B.
3. The user clicks Restore again. A and B are added a second time. C fails again.
4. The journal holds two copies of A and B.

### Fix

1. **Core:** on failure, return the **source ids that were restored**, the failing id, and a generic error (no entry title). A count alone cannot tell the UI which selection to clear or which dates changed. Example shape: `RestoreEntriesOutcome { restored_ids: Vec<i64>, failed: Option<RestoreFailure { entry_id, error }> }`, returned as `Ok` with `failed` set. An ordered "completed prefix" contract also works, but explicit ids are less fragile.
2. **Core:** decide the input contract. If the selection is a set, de-duplicate `entry_ids` within one request (keep the first). Do **not** de-duplicate against entries already in the journal: restoring the same entry again on purpose is an allowed copy.
3. **Command:** pass the partial outcome through.
4. **UI:** on a partial result, remove the restored ids from the selection and run the same refresh as the success path. Scope `executeReloadCallbacks` to the dates that actually received entries. Keep a refresh failure separate from the restore failure. Do not infer completion from the date/title status match; it is only a heuristic. Show "N entries restored; one entry could not be restored". Add the i18n keys in all locales and run `bun run validate:locales`.
5. **Docs:** fix the doc comment at `restore_entries.rs:135-139`, `API.md` "Per-entry restore", and the website page; run `bun run website:build-static` (PowerShell tool).

### Tests to add

- Core: `[anchor, source]` with a fault on `source` → the outcome lists `anchor` as restored and `source` as failed.
- Core (if de-duplication is chosen): `[id, id]` → one entry added.
- Frontend (`BackupInspectDialog`): a partial result removes the restored ids from the selection and calls the refresh functions.

---

## N-01 — Unresolved image refs bind to unrelated live images (P2, existing)

**Verdict:** found by the second opinion; CONFIRMED by code reading in both reviews. Present at the merge-base. It is a content-correctness defect, not plaintext disclosure, a network path, or a lock bypass. It is in scope because these commits move the restore body and add a stronger completeness claim ("an entry is restored completely or not at all").

### Where

- `crates/mini-diarium-core/src/backup/restore_entries.rs:175-189` resolves snapshot images, then inserts the HTML into the live journal.
- `crates/mini-diarium-core/src/db/queries/images/refs.rs:13-34` (`resolve_image_refs_in_entries`) replaces only the ids that the entry's `entry_images` links return (`get_images_for_entry`, an inner join, `images/storage.rs:170-175`). It neither removes nor refuses an unresolved `image-id://N`.
- `images/refs.rs:89-96` (`extract_and_replace_image_refs`, run by `insert_entry_with_images`) accepts an `image-id://N` src when image N **exists in the live journal**, and `entries/insert.rs:61-69` then links it to the new row.
- **Import has the same path (found while checking N-01):** `src-tauri/src/commands/import.rs:44-56` strips foreign **attachment** refs (`strip_attachment_refs`) but not foreign **image** refs, then calls `insert_entry_with_images`. Mini Diarium exports resolve images to `data:` URIs, so a normal export is safe; a hand-made or third-party import file that contains `<img src="image-id://N">` links live image N.

### Failure scenario (restore)

1. A snapshot entry's HTML names image N, but its `entry_images` link is missing (an inconsistent stored entry, or damaged snapshot metadata; a missing link does not break a foreign key, because a foreign key constrains only rows that exist in the child table [S8]).
2. The live journal has a **different** image with id N. This needs diverged id history, for example a whole-journal restore followed by new images.
3. Snapshot resolution leaves `image-id://N` unchanged. The live insert sees that N exists and links the unrelated live image.
4. Restore returns success. The recovered entry shows the wrong image. The writes were atomic; the content is still wrong.

Snapshot opening checks the schema version and credentials, not entry/reference consistency (`backup/inspect.rs:109-140`). The cross-database image test (`restore_entries.rs:498-562`) covers only an intact link.

### Fix

- **Restore:** use a restore-specific resolver that resolves every image **src** reference against the snapshot, and fail the entry with a generic error when one cannot be resolved. Never pass an unresolved snapshot image id to the live insert. Match real `<img src>` attributes only; a literal `image-id://` in prose is harmless.
- **Import:** remove (or refuse) `image-id://` srcs in imported text before `insert_entry_with_images`, the same way `strip_attachment_refs` handles attachment refs. Consider a core `strip_image_refs` next to it.
- Optional defense in depth: give `extract_and_replace_image_refs` a mode that accepts only ids the caller already owns, so live-existence is never the only check.

### Tests to add

- Restore: delete the source entry's `entry_images` link in the snapshot, keep an unrelated live image with the same id → error, and no restored row, links, or images (reuse the table-dump assertion from the fault tests).
- Import: an entry with `<img src="image-id://N">` where live image N exists → the imported entry has no link to N.

---

## W-01 — The helper accepts a transaction it does not own (P3, hardening)

**Verdict:** PARTLY. The mechanism is real; no current trigger was found. The first pass rated it P2 and described it as a session-wide silent-loss path; the second opinion showed that the evidence supports only a P3 fail-closed hardening item. The corrections are applied below.

### Where

`crates/mini-diarium-core/src/db/queries/transaction.rs:26-49` (`with_write_transaction`) and `:75-97` (`RollbackGuard::drop`).

### What is real

The helper chooses `SAVEPOINT` only from `!db.conn().is_autocommit()`. rusqlite documents `is_autocommit` only as "Test for auto-commit mode" [S9], and SQLite's autocommit flag is disabled by any `BEGIN` and re-enabled only by `COMMIT` or `ROLLBACK` [S3]. So the flag says that *a* transaction is open, not *who* opened it. **If** an unowned transaction stays open on the `DiaryState` connection:

- each later composed write opens a savepoint and releases it, and "the RELEASE of an inner transaction does not cause any changes to be written to the database file … Content is not actually committed on the disk until the outermost transaction commits" [S2];
- the `DiaryState` mutex does not end a SQLite transaction (a transaction ends only at `COMMIT` or `ROLLBACK` [S1 §2]), so the transaction spans commands;
- when the connection is dropped, "if an sqlite3 object is destroyed while a transaction is open, the transaction is automatically rolled back" [S4];
- the lock snapshot uses `VACUUM INTO` (`backup/store.rs:466-473`). The VACUUM page says "A VACUUM will fail if there is an open transaction on the database connection" [S5], but it does not say explicitly whether that sentence covers `VACUUM INTO`. The bundled SQLite source confirms it does: `sqlite3RunVacuum` checks `!db->autoCommit` and returns "cannot VACUUM from within a transaction" before it looks at the `INTO` target [SRC1]. Lock-time snapshot failures are logged and swallowed (`commands/backup_triggers.rs:111-124`).

The old code issued `BEGIN IMMEDIATE`, which "will fail with an error, regardless of whether the transaction was started by SAVEPOINT or a prior BEGIN" [S1], so the first save failed visibly.

### What is not established (second-opinion corrections)

1. **Failed migrations do not leak into the app.** `db/schema/open.rs` returns the migration error before it returns the handle, and the app installs the connection only after a successful open (`commands/auth/auth_core.rs:175-189,244-248`). A batch migration that stops mid-batch leaves its transaction open on a local handle that then drops.
2. **A rollback I/O error does not leave the transaction open.** The official contract is that autocommit "is re-enabled by a COMMIT or ROLLBACK" [S3]; the documentation does not describe a `ROLLBACK` that fails and leaves the transaction open. The source confirms the detail: the `AutoCommit` opcode calls `sqlite3RollbackAll` and then sets `db->autoCommit = 1` unconditionally [SRC2], and the B-tree rollback moves the B-tree out of the write transaction even when the pager rollback returns an error [SRC3]. Only a failure **before** the ROLLBACK opcode runs (for example a prepare or allocation failure) could leave it open. No such case was shown. The antivirus/cloud-sync example in the first pass is not evidence for this state.
3. **Current callers propagate.** The restore loop and every composed write use `?`. No production code catches a nested error and continues.
4. **Case B is a different failure.** SQLite documents that `SQLITE_FULL`, `SQLITE_IOERR`, `SQLITE_INTERRUPT`, and `SQLITE_NOMEM` (and, per [S3], also `SQLITE_BUSY`) "might" make it "rollback and cancel the entire transaction", and that `sqlite3_get_autocommit()` is the only way to know [S1 §3, S3]. A trigger's `RAISE(ROLLBACK, …)` does the same: the ROLLBACK conflict algorithm "rolls back the current transaction" [S6, S7]. After SQLite discards the parent this way, a later helper call sees autocommit mode, opens and commits a **new** transaction, and the outer `COMMIT` then reports an error. The result is durable writes despite a reported failure, not saves that later disappear. `test_transaction_inner_failure_keeps_outer_usable` catches an ordinary closure error with the parent still open, which is safe; it does not bless continuing after parent loss.
5. **The lock snapshot can be skipped** by the dedup policy (`backup/mod.rs:123-136`, `backup/policy.rs:283-291`), so the `VACUUM INTO` warning is not guaranteed either.
6. The old hand-written blocks were not a correct ownership model either: they ran `ROLLBACK` on any error, also after a failed `BEGIN`, which rolled back a foreign parent.

Additional caveat on the guard itself: the drop guard runs only when a panic **unwinds**. The Rust reference states that the `unwind` handler calls `drop` on live objects, that the `abort` handler "aborts the process and is non-recoverable", and that the default is `unwind` on most targets [S12]; `catch_unwind` "only catches unwinding panics" [S13]. The workspace `[profile.release]` (`Cargo.toml:9-11`) sets no `panic` strategy, so release builds use `unwind` and the guard runs. Do not switch to `panic = "abort"` without revisiting this. A panic inside a command still poisons the `DiaryState` mutex [S11], so later commands fail with "Journal state lock failed" until restart; that is pre-existing.

### Fix

Make the ownership rule explicit and fail closed:

1. Track the units the helper opened. A `Cell<u32>` depth field on `DatabaseConnection` is enough. (First-pass correction: an `AtomicU32` is not needed. rusqlite documents `impl Send for Connection` and `impl !Sync for Connection` [S9]; `Mutex<T>` is `Send` and `Sync` when `T: Send` [S11]; `Cell<T>` is `Send` when `T: Send` and is always `!Sync` [S14]. So a `Cell` keeps `DatabaseConnection` `Send`, which is all the lock-path worker thread and the `Mutex` need, and the type is already `!Sync` because of the `Connection`.)
2. `depth == 0 && !is_autocommit()` → refuse the write with a static error and a `warn!` (no user data). **Never** roll back an unexpected parent and then report the save as done.
3. `depth > 0 && is_autocommit()` → the parent is gone; refuse new helper writes instead of opening a new transaction.
4. Before the outermost unit reports success, check transaction health, and define how a failed rollback marks the connection unusable. A counter alone does not prove that a nested rollback succeeded or that the same parent still exists.
5. Keep the DEC-006 rule for raw writes (propagate with `?`).

### Tests to add

First add a fault test that creates the unowned-transaction state (a `BEGIN` issued by hand before a composed write). Then test the chosen policy. Expecting a refusal is a policy change: today the helper is documented to accept an open transaction.

---

## W-03 — The façade still exports lock-bypassing writes (P3)

**Verdict:** PARTLY. The bypass is real; it is an accepted API exception (DEC-008), not a vulnerability. The lock is not a security boundary (TODO-0071).

### Where

`crates/mini-diarium-core/src/db/mod.rs:29-31` exports `update_entry` and `insert_entry`. `src-tauri/benches/db_bench.rs:73-90` uses `update_entry`.

### What

`update_entry` rewrites any row, locked or not, and does not update `entry_images` links (`db/queries/entries/update.rs:52-88`). That bypasses the accidental-edit rule and the image-store invariant. It contradicts the plan goal ("the façade no longer exports non-atomic building blocks that skip the lock") and the new rule in `RUST_BEST_PRACTICES.md:97` ("A public write must … enforce the rules for the rows it touches").

Second-opinion corrections applied: each function is **one SQL statement**, so it is atomic at the SQL level (outside `BEGIN`, a statement runs in an automatic transaction that commits when it finishes [S1 §2], and a failing statement's own changes are backed out [S7, ABORT]); what it lacks is the higher-level composition. `insert_entry` creates an unlocked row, so it is not a lock bypass; it only skips image extraction (a `data:` image stays inline in the encrypted text, which is not a plaintext disclosure). Production paths use the composed variants.

### Fix

- **Narrow:** put both primitives behind a Cargo feature (for example `test-support`) that the bench and the app crate's dev-dependencies turn on, and make them `pub(crate)` otherwise.
- **Or make the exception explicit:** rename to `update_entry_unchecked` / `insert_entry_raw`. `#[doc(hidden)]` alone does not restrict access.
- Either way, make `RUST_BEST_PRACTICES.md`, `API.md`, and the façade say the same thing. A source grep for `db::update_entry(` outside `#[cfg(test)]` is a useful extra guard, not a replacement for visibility.

---

## W-04 — Journal-wide orphan GC inside nested units (P3, latent)

**Verdict:** PARTLY. A composition constraint; no current restore fails.

### Where

`cleanup_orphaned_images` (`images/storage.rs:248-259`) runs inside `insert_entry_with_images` (only on its image-normalization branch, `entries/insert.rs:61-69`), `update_entry_with_images`, and `delete_entry_by_id`. `cleanup_orphaned_attachments` (`attachments/storage.rs:305-316`) runs inside `delete_entry_by_id` and `remove_attachment_from_entry`.

### What

A nested unit sees its parent's uncommitted rows (a savepoint is part of the same transaction [S2]). `restore_one_entry` stores attachment blobs (`:180-181`), then calls `insert_entry_with_images` (`:189`), then links the blobs (`:191-192`). That is safe today because the insert runs only the **image** GC, and it links its own images before that GC. If a future change runs `cleanup_orphaned_attachments` in that window, the restore's unlinked blobs are deleted and the later link fails. It fails loudly, not silently, for two documented reasons: inserting a child row whose parent key does not exist fails with "foreign key constraint failed" once `PRAGMA foreign_keys` is on for the connection [S8] (the app turns it on in `open_connection`, `db/schema/create.rs:15-18`), and `INSERT OR IGNORE` (used by `link_attachment`) "works like ABORT for foreign key constraint errors" [S7]. The unit then rolls back. The result is a failed restore, not damaged data.

### Fix

- Document the ordering constraint on `with_write_transaction` and in `RUST_BEST_PRACTICES.md`: a composed write that runs a journal-wide GC must not run between storing and linking a blob in the same unit.
- Do **not** simply skip GC in nested units: every restore insert is nested, so GC would never run there. Deferral needs an outer-unit "pending GC" mechanism that runs once after all links exist.
- Test: after a restore, the restored links exist, their bytes read back, a blob shared with a live entry survives, and no unexpected orphan remains. Do not assert that the live blob count equals the snapshot blob count (existing live data and de-duplication make that wrong). Existing coverage already checks names, remapped refs, and bytes (`restore_entries.rs:608-628`).

---

## W-05 — The attachment command reads the file before the lock check (P3, new behavior)

**Verdict:** CONFIRMED. Recorded as a trade-off in DEC-009.

### Where

`src-tauri/src/commands/attachments.rs:145-152` (`add_entry_attachment_inner`); the read is in `:29-58`.

### What

For a locked entry, the command reads a valid source file under the journal mutex, and only then does core refuse the entry. The lock path waits on that mutex (`commands/auth/mod.rs:84-89`). For an invalid or too-large file, the command now returns the file error before `entry is locked` (the old pre-check returned the lock error first). The read is bounded (metadata check, read stops at the cap plus one byte) and held in `Zeroizing`; slow storage can still delay it.

### Fix

Keeping the DEC-009 trade-off is reasonable. A core function that takes a byte-producing closure and calls it after `ensure_entry_unlocked` avoids the wasted read, but if it runs inside `BEGIN IMMEDIATE` it holds the SQLite write reservation during file I/O (`IMMEDIATE` takes a RESERVED lock at `BEGIN`, and only one connection can hold it [S1 §2.2, S10 §3]), which can make contention worse. Handle it with the attachment lock-duration work (TODO-0134). Do not add an app-crate pre-check; that breaks the Milestone 3 rule.

---

## W-06 — The lock contract is a string compare (P3, maintenance)

**Verdict:** PARTLY. The dependency is real; nothing is broken today.

### Where

`src-tauri/src/commands/entries.rs:117-123` and `:145-151` (`e == db::ERR_ENTRY_LOCKED`); `src/lib/errors.ts:52-54` (`/^entry is locked$/i`). Core returns the constant unchanged (`entries/lock.rs:16-20`) and the helper passes closure errors through (`transaction.rs:46`).

### What

A `map_err` wrap added **on a real lock-refusal path** would break the frontend message for that path, and, if on the cleanup path, turn the TODO-0132 `Ok(false)` into an `Err` on auto-lock or app close. (First-pass correction: the restore example does not apply, because restore targets a new unlocked row. A wrapped string also still goes through the other `mapTauriError` filters, so it is not a disclosure.)

### Fix

- Add core tests that call each of the six lock-enforcing writes **inside an outer `with_write_transaction`** and assert the error is exactly `ERR_ENTRY_LOCKED`. Keep the app-boundary tests too; a core test cannot detect a command wrapper.
- Keep the no-wrap rule (already at `lock.rs:4-8`); a pointer in `RUST_BEST_PRACTICES.md` helps.
- `delete_entry_if_empty` must keep mapping **only** the lock error to `Ok(false)`. Do not map other errors to `Ok(false)` to keep the lock path quiet.
- Long term: structured error codes (TODO-0139).

---

## W-07 — Test gaps (P3)

**Verdict:** CONFIRMED as gaps; they do not show a product defect.

| Gap | Why it matters | Test |
|-----|----------------|------|
| `COMMIT` failure | `RollbackGuard::commit` keeps the guard armed on failure so `Drop` rolls back (`transaction.rs:61-70`). No test drives it. | Set the journal mode explicitly (rollback journal). A second connection runs `BEGIN` and **steps** a `SELECT`, so it holds a SHARED lock. The first connection sets `busy_timeout(0)` (rusqlite gives new connections a 5000 ms default [S9]) and runs a write unit → `Err("COMMIT failed: …")` and `is_autocommit()` true. Basis: a writer needs an EXCLUSIVE lock to commit and "might have to wait until those SHARED locks clear" [S10 §5]; "COMMIT might also result in an SQLITE_BUSY return code if another thread or process has an open read connection. When COMMIT fails in this way, the transaction remains active" [S1 §2.3; also S10 §7]. That remaining transaction is exactly what the guard must roll back. Release the reader and confirm through a separate or reopened connection that the row is absent. Do not use a second writer; `BEGIN IMMEDIATE` "might fail with SQLITE_BUSY if another write transaction is already active" [S1 §2.2], which tests `BEGIN` failure, already covered. |
| Real whole-transaction rollback | The existing test simulates it with an explicit `ROLLBACK`. | A trigger with `RAISE(ROLLBACK, …)` inside a nested unit: it returns `SQLITE_CONSTRAINT` and applies the ROLLBACK conflict algorithm, which "rolls back the current transaction" [S6, S7]. |
| Unowned transaction | W-01 | A policy test, after the W-01 decision. |
| Duplicate restore ids | W-02 | After the input contract is decided. |
| Check-then-write races | Already tracked in TODO-0141. | Per TODO-0141. |

---

## Checked and sound

Both reviewers checked these points. The second opinion's limits are added in italics.

- **Lock check placement.** `ensure_entry_unlocked` is the first statement inside the write unit in all six enforcing functions (`entries/update.rs:23-24`, `entries/delete.rs:22-23`, `tags.rs:119-120,140-141`, `attachments/storage.rs:132-133,254-255`). `BEGIN IMMEDIATE` also excludes a writer on another connection ("IMMEDIATE causes the database connection to start a new write immediately" [S1 §2.2]; only one RESERVED lock may be active [S10 §3]); the app mutex is not the only protection. *Input validation and `BEGIN` can fail before the lock check.*
- **Exact error string.** `save_entry`, the tag commands, and the attachment commands pass the core error through `?`; `delete_entry_inner` passes it through unwrapped; `delete_entry_if_empty_inner` maps it to `Ok(false)`. *A request on a locked row can still return a different error first (a failed `BEGIN`, attachment validation, or the file read).*
- **Restore is exempt and stays unlocked.** `restore_entries.rs:302-311` builds an unlocked DTO and `insert_entry` never writes `locked` (`entries/insert.rs:25-26`).
- **Per-entry atomicity.** All SQL writes of one restored entry run in one unit (`restore_entries.rs:152-154,180-199`); the fault tests compare every user table (`:772-823`). *Atomicity does not prove the recovered content is correct; see N-01.*
- **The snapshot connection is separate and read-only** in the app path (`backup/inspect.rs:109,135-140`, `db/schema/create.rs:28-34`). *The public core function does not itself enforce that the caller passed a read-only, distinct handle.*
- **Panic safety.** The guard rolls back on an unwinding panic at both levels (`transaction.rs:208-237`). Release builds use the default `unwind` strategy (no `panic` key in `Cargo.toml:9-11`; default per [S12]). *An aborting panic does not unwind, so `Drop` does not run [S12, S13].*
- **Nesting semantics.** Same-name savepoints are allowed ("The transaction names need not be unique"), `RELEASE` and `ROLLBACK TO` target "the most recent savepoint with a matching name", and `ROLLBACK TO` "does not cancel the transaction" [S2]. This is what lets each nesting level address its own `md_write` savepoint, and what `test_transaction_two_levels_of_nesting` pins.
- **SQLite-initiated rollback.** The guard skips `ROLLBACK TO` when `is_autocommit()` is already true and returns the original error. This follows the documented method: "An application can tell which course of action SQLite took by using the sqlite3_get_autocommit()" [S1 §3, S3]. A `ROLLBACK TO` with no matching savepoint "fails with an error" [S2], which is the secondary error the skip avoids. *It does not protect later writes by a caller that continues after the parent is gone (W-01 case B).*
- **No plaintext on disk.** No new file write, and no decrypted buffer reaches SQLite. Precise scope: a savepoint makes SQLite record page images in a sub-journal (`openSubJournal`, "Append a record of the current state of page pPg to the sub-journal" [SRC4]). It stays in memory up to the statement-journal spill threshold (default 64 KiB in the bundled build [SRC5]; the threshold "determines the size threshold above which statement journals are moved from memory to disk" [S16]) and then goes to a temporary file. The bundled build uses the default `SQLITE_TEMP_STORE=1` ("Use files by default" [S16]; [SRC5]), and on Windows temporary files go to the folder from `GetTempPath()` unless `temp_store_directory` is set [S15]; the app sets no `temp_store` pragma. So those pages can land in `%TEMP%`, outside the journal folder. They hold the same bytes as the database pages: AES-GCM ciphertext plus the columns that are already plaintext in `diary.db` (dates, word counts, `locked`, fingerprints, attachment MIME type and size). This is not new plaintext, and statement journals already existed before this change for multi-row writes inside `BEGIN` [S15], but it is wider than "nothing leaves the journal folder". Optional hardening: `PRAGMA temp_store = MEMORY` on the live connection. *`test_restore_entries_writes_no_plaintext_to_disk` scans after completion, so it cannot prove the absence of plaintext in every transient file by itself.*
- **Logging.** New `debug!` lines log entry ids only; the restore `info!` logs a count only (`commands/backup_inspect.rs:283-287`).
- **Façade rule.** The four attachment helpers are `pub(crate)`; no driver call in `src-tauri/src`. The grep has one hit, an old `//!` doc comment in `commands/backup_triggers.rs:8`. *W-03 remains.*
- **Mutex order.** Restore takes `inspection` then `db`; the lock path finishes the inspection teardown before it takes the connection. No new inverse order.
- **Hard delete vs. cleanup.** They stay separate APIs; `delete_entry_by_id` does not consult the empty rule. The empty check is still outside the delete unit (TODO-0141).

## Pre-existing, not introduced by this change

- Restore holds the `DiaryState.db` mutex for the whole batch, so an auto-lock request waits until the batch ends while a decrypted snapshot is open. Related to TODO-0134.
- No single-instance guard: two app instances can open the same journal. This is the setup in which the TODO-0141 races become real.

## References

Official documentation (fetched 2026-10-10). Section numbers are given where the page has them.

| ID | Source | What it supports |
|----|--------|------------------|
| S1 | SQLite, *Transaction* — <https://www.sqlite.org/lang_transaction.html> (§2 transactions and nesting, §2.2 DEFERRED/IMMEDIATE/EXCLUSIVE, §2.3 COMMIT/ROLLBACK with pending statements and SQLITE_BUSY, §3 response to errors within a transaction) | `BEGIN` inside a transaction fails; `BEGIN IMMEDIATE` semantics; a busy `COMMIT` leaves the transaction active; errors that may roll back the whole transaction; use `sqlite3_get_autocommit()` to detect it |
| S2 | SQLite, *SAVEPOINT* — <https://www.sqlite.org/lang_savepoint.html> | names need not be unique; `RELEASE`/`ROLLBACK TO` target the most recent match; `ROLLBACK TO` keeps the transaction; inner `RELEASE` does not write to disk; unknown name → error |
| S3 | SQLite C API, *sqlite3_get_autocommit* — <https://www.sqlite.org/c3ref/get_autocommit.html> | autocommit disabled by `BEGIN`, re-enabled by `COMMIT`/`ROLLBACK`; `SQLITE_FULL`, `SQLITE_IOERR`, `SQLITE_NOMEM`, `SQLITE_BUSY`, `SQLITE_INTERRUPT` may roll back automatically; the function is the only way to know |
| S4 | SQLite C API, *Closing A Database Connection* — <https://www.sqlite.org/c3ref/close.html> | an open transaction is rolled back when the connection is destroyed |
| S5 | SQLite, *VACUUM* — <https://www.sqlite.org/lang_vacuum.html> | "A VACUUM will fail if there is an open transaction on the database connection" (silent on `VACUUM INTO` specifically; see SRC1) |
| S6 | SQLite, *CREATE TRIGGER* — <https://www.sqlite.org/lang_createtrigger.html> | `RAISE(ROLLBACK, …)` performs the ROLLBACK conflict processing and returns `SQLITE_CONSTRAINT` |
| S7 | SQLite, *The ON CONFLICT Clause* — <https://www.sqlite.org/lang_conflict.html> | ROLLBACK "rolls back the current transaction"; ABORT backs out the current statement only; IGNORE "works like ABORT for foreign key constraint errors" |
| S8 | SQLite, *Foreign Key Support* — <https://www.sqlite.org/foreignkeys.html> | FK enforcement is off by default and enabled per connection; a child insert with a missing parent fails; RESTRICT vs CASCADE |
| S9 | rusqlite 0.40.2, `Connection` — <https://docs.rs/rusqlite/0.40.2/rusqlite/struct.Connection.html> | `impl Send for Connection`, `impl !Sync for Connection`; `is_autocommit`; new connections default to a 5000 ms busy timeout |
| S10 | SQLite, *File Locking And Concurrency In SQLite Version 3* — <https://www.sqlite.org/lockingv3.html> (§3 lock states, §5 writing, §7 COMMIT) | a committing writer needs EXCLUSIVE and may wait for SHARED locks to clear; a failed `COMMIT` turns autocommit back off so it can be retried |
| S11 | Rust std, `std::sync::Mutex` — <https://doc.rust-lang.org/std/sync/struct.Mutex.html> | `impl<T: ?Sized + Send> Sync for Mutex<T>` and `Send for Mutex<T>`; poisoning after a panic while the lock is held |
| S12 | The Rust Reference, *Panic* — <https://doc.rust-lang.org/reference/panic.html> | `unwind` calls `drop` on live objects; `abort` "aborts the process and is non-recoverable"; default is `unwind` on most targets |
| S13 | Rust std, `std::panic::catch_unwind` — <https://doc.rust-lang.org/std/panic/fn.catch_unwind.html> | "only catches unwinding panics, not those that abort the process" |
| S14 | Rust std, `std::cell::Cell` — <https://doc.rust-lang.org/std/cell/struct.Cell.html> | `impl<T: Send> Send for Cell<T>`, `impl<T> !Sync for Cell<T>` |
| S15 | SQLite, *Temporary Files Used By SQLite* — <https://www.sqlite.org/tempfiles.html> | what a statement journal is and when it is created; Windows temp folder is `GetTempPath()` unless `temp_store_directory` is set |
| S16 | SQLite, *Compile-time Options* — <https://www.sqlite.org/compile.html> (`SQLITE_STMTJRNL_SPILL`, `SQLITE_TEMP_STORE`) | spill threshold moves statement journals from memory to disk; `SQLITE_TEMP_STORE` default is 1 ("Use files by default") |

Bundled SQLite source, used only where the official documentation is silent or ambiguous. Path: `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/libsqlite3-sys-0.38.2/sqlite3/sqlite3.c` (SQLite 3.53.2, the version `rusqlite 0.40.2` with `bundled` compiles, `Cargo.lock`).

| ID | Location | What it shows |
|----|----------|---------------|
| SRC1 | `sqlite3.c:161463-161464` (`sqlite3RunVacuum`) | `if( !db->autoCommit )` → "cannot VACUUM from within a transaction", checked before the `INTO` output is handled, so it applies to `VACUUM INTO` |
| SRC2 | `sqlite3.c:100499-100503` (`OP_AutoCommit`) | a `ROLLBACK` calls `sqlite3RollbackAll` and then sets `db->autoCommit = 1` unconditionally |
| SRC3 | `sqlite3.c:77679-77702` (`sqlite3BtreeRollback`) | the B-tree leaves the write transaction even when `sqlite3PagerRollback` returns an error |
| SRC4 | `sqlite3.c:64125-64147` (`openSubJournal`, `subjournalPage`) | savepoints record page images in a sub-journal opened through the VFS with `SQLITE_OPEN_SUBJOURNAL` and a spill threshold |
| SRC5 | `sqlite3.c:15743` (`SQLITE_TEMP_STORE 1`), `sqlite3.c:24042` (`SQLITE_STMTJRNL_SPILL (64*1024)`); `libsqlite3-sys-0.38.2/build.rs:175` sets `SQLITE_TEMP_STORE=2` only for `bundled-sqlcipher`, which this project does not use | the effective defaults in this build |
