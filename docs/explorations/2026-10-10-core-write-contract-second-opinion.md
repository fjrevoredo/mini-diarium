# Core write contract: second opinion

**Artifact type:** Documentation, read-only review.
**Date:** 2026-10-10.
**Reviewed HEAD:** `88eb033c26c52fc11fecfbfd243dd64edbd95020` on `master`.
**Scope:** `git diff 4627248..HEAD -- crates src-tauri/src src`, the [adversarial review](2026-10-10-core-write-contract-adversarial-review.md), and the [completed plan](../plans/2026-10-09-core-write-contract-plan.md).
**Method:** Full diff review, current-code review, comparison with the merge-base, caller tracing, installed dependency source, and official SQLite documentation. No application tests, builds, UI sessions, or fault probes were run. No source file was changed. No commit was made.

## Outcome

The main implementation is sound for its current callers. The strongest existing product defect is **W-02**, but it predates this diff. **W-01 describes a valid conditional failure, not a demonstrated session-wide data-loss path in this app.** Its rollback explanation and proposed Rust type requirement need correction.

I also found **N-01: unresolved snapshot image references can bind to unrelated live images**. This is a missed data-integrity issue in the moved restore code, but it also predates these commits. I found no additional demonstrated data-integrity or security regression introduced by this diff.

| Finding | Verdict | Severity assessment | Fix assessment |
| --- | --- | --- | --- |
| W-01 | PARTLY | P2 impact if the required state occurs; P3 hardening on the evidence available, not a proven P2 release blocker | Ownership/state tracking can help, but the proposed counter is not a complete transaction-health guard |
| W-02 | CONFIRMED | P2 is reasonable; pre-existing | Correct direction; report restored source IDs, not only a count |
| W-03 | PARTLY | P3 API-contract issue; no new security boundary failure | Feature-gating removes the public bypass; renaming only makes it explicit |
| W-04 | PARTLY | P3 composition constraint; no current failing restore path | Document the constraint; deferred GC needs explicit outer-unit ownership |
| W-05 | CONFIRMED | P3; real change in error order and unnecessary I/O | Keeping the documented trade-off is reasonable; a closure has a lock-duration cost |
| W-06 | PARTLY | P3 maintenance risk, not a current broken contract | Nested tests help; the existing constant already documents unchanged propagation |
| W-07 | CONFIRMED | P3 test gaps, not proof of product defects | COMMIT test is valid; foreign-transaction expectations depend on the chosen contract |

## Sources and assumptions

- Repository evidence uses line numbers at the reviewed HEAD. Relevant unchanged callers include `src-tauri/src/commands/auth/`, `commands/backup_inspect.rs`, `commands/backup_triggers.rs`, and `src/components/backups/BackupInspectDialog.tsx`.
- Installed versions are `rusqlite 0.40.2` and `libsqlite3-sys 0.38.2`: `Cargo.lock:2567-2569`, `Cargo.lock:3762-3764`.
- In the dependency evidence below, **SQLite source** means `C:/Users/Francisco/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/libsqlite3-sys-0.38.2/sqlite3/sqlite3.c`. It reports SQLite `3.53.2` at line 470.
- **rusqlite source** means `C:/Users/Francisco/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/rusqlite-0.40.2/src/lib.rs`.
- Official references: [transactions](https://www.sqlite.org/lang_transaction.html), [savepoints](https://www.sqlite.org/lang_savepoint.html), and [VACUUM](https://www.sqlite.org/lang_vacuum.html).
- The project security stance and domain guides were consulted. The second-brain project page was used for project context only, not as implementation evidence.
- No user clarification was needed. Claims about future callers, failed rollback preparation, or damaged backup state are marked as conditional. Existing test assertions were inspected, not independently rerun.

## W-01: foreign transactions and whole-transaction rollback

**Verdict: PARTLY.** The helper accepts any explicit open transaction. The review does not establish a current production path that leaves such a transaction unowned on `DiaryState.db`.

### What is correct

`crates/mini-diarium-core/src/db/queries/transaction.rs:30-38` selects SAVEPOINT solely from `is_autocommit()`. Lines 63-70 release a nested savepoint without committing its parent. Therefore, **if** an unowned explicit transaction remains open, later composed writes can return success without durable commits. Closing that connection rolls its transaction back. SQLite's savepoint and transaction documentation confirms both points.

The mutex does not end a SQLite transaction. `src-tauri/src/commands/auth/mod.rs:148-158` releases a Rust mutex guard after the command, but keeps the connection in `Mutex<Option<DatabaseConnection>>` (`:8-9`). Thus, an explicit transaction *can* span commands if something leaves it open. The question is how it gets into that state, not whether the mutex prevents it.

**VACUUM INTO really does fail inside that transaction.** The app uses it on the same moved connection: `crates/mini-diarium-core/src/backup/store.rs:466-473`. SQLite source `:161437-161465` checks `autoCommit` before distinguishing an INTO output and returns `cannot VACUUM from within a transaction`. Lock-time failures are logged, and the handle is dropped: `src-tauri/src/commands/backup_triggers.rs:111-124`.

### What is not established, or is overstated

1. **Failed migrations do not supply a live leak.** `crates/mini-diarium-core/src/db/schema/open.rs:84-87`, `:167-173`, and `:218-225` propagate migration errors before returning the handle. The app installs it only after a successful open: `src-tauri/src/commands/auth/auth_core.rs:175-189`, `:244-248`. A migration batch can stop with a transaction open, but that local handle then drops. It does not become the command connection.
2. **Rollback I/O failure does not by itself prove `is_autocommit() == false`.** SQLite source `:100499-100503` executes full rollback and then sets `autoCommit = 1`. Its B-tree rollback ends the transaction even when pager rollback reports an error (`:77679-77702`). A disk-recovery problem is serious, but it is not automatically the claimed still-open parent. A failure *before* the ROLLBACK opcode runs, such as preparation/allocation failure, remains a possible case. No such case was demonstrated here. The antivirus/cloud-sync claim is not evidence for this precise state transition.
3. **Current runtime helper callers propagate failures.** The restore loop and its nested writes use `?`: `crates/mini-diarium-core/src/backup/restore_entries.rs:152-154`, `:189-199`. The remaining helper callers return their result directly or propagate it. No production catch-and-continue composer was found.
4. **The inner-error test uses an ordinary closure error, not a whole-transaction rollback.** `crates/mini-diarium-core/src/db/queries/transaction.rs:172-190` explicitly asserts that the parent still exists. Catching that error is mechanically safe. The whole-rollback test instead propagates the failure (`:265-281`). The broad documentation instruction conflicts with the recovery examples, but those tests do not prove that continuing after a destroyed parent is supported.
5. **Case B is not the same silent-loss case as A.** After a destroyed parent, a later helper can open and commit a *new* transaction. The original outer COMMIT then reports an error (`transaction.rs:67-68`). The result is unexpected durable writes despite an outer failure, not successful session-wide saves that later disappear. This needs different wording.
6. **The lock snapshot may be skipped.** `crates/mini-diarium-core/src/backup/mod.rs:123-136` applies policy before writing. The unchanged on-disk counter or minimum interval can skip it (`backup/policy.rs:283-291`). Thus, W-01's step 4 is not guaranteed to call VACUUM or produce a warning. This does not rescue an uncommitted transaction; it limits the proposed sequence.
7. **The old behavior also attempted to roll back a foreign parent after BEGIN failed.** The merge-base implementations unconditionally issued ROLLBACK on any error. They did fail loudly, but were not a safe foreign-transaction ownership model either.

### Severity and fix

The hypothetical impact merits P2. The evidence supports a **P3 fail-closed hardening item**, pending a reproducible live leak or injected rollback failure. Do not describe it as an established current session-loss bug.

A depth/state guard can reject an unexpected parent and refuse new helper writes after parent loss. Keep the existing propagation rule for raw writes. Also check transaction health before reporting outer success, and define how rollback failure invalidates a connection. A counter alone does not prove that nested rollback succeeded or that the same parent still exists.

The proposed `AtomicU32` rationale is wrong: `rusqlite::Connection` is **Send, not Sync**, because it contains a `RefCell` (rusqlite source `:356-364`). Moving it to a worker needs Send. `Mutex<T>` supplies shared synchronization when `T` is Send. A `Cell` counter can preserve that property; an atomic is not required to make this handle Sync, and cannot make its `Connection` Sync.

Never automatically roll back an unexpected parent and continue as if the save succeeded. Refusal is the safer policy. First add a fault test that establishes the claimed state, then test the selected ownership policy.

## W-02: partial restore result and stale selection

**Verdict: CONFIRMED. P2 is reasonable. This is pre-existing, not introduced by the new helper.**

### Evidence and challenge

- `crates/mini-diarium-core/src/backup/restore_entries.rs:149-159` commits one standalone unit per requested ID and returns only an error when a later unit fails. The batch test pins this outcome at `:827-853`.
- `src-tauri/src/commands/backup_inspect.rs:281-291` propagates the error before it can return a count.
- **The UI really retains the selection.** `src/components/backups/BackupInspectDialog.tsx:212-213` clears it only after a successful invoke. The catch at `:247-250` sets the error and then clears only the busy flag. There is no error-triggered reset or refresh in this handler.
- Date/tag refresh and picker reload are also success-only (`:218-246`). Checkboxes read that retained selection (`:468-472`), and the restore button becomes enabled again (`:528-535`). A retry sends the same IDs (`:196-198`).
- Core always creates new rows (`restore_entries.rs:128-130`, `:189`). It does not make retries idempotent. The A/B/C scenario is correct when the dialog stays open and the user does not change the selection.
- The same batch/error behavior and UI handler are present at `4627248`. This diff fixes incomplete *individual entries*, not hidden batch progress.

Two limits matter. Entries are not always displayed as Missing: the picker can select present or shorter entries too. The correct general claim is that their **old status remains**. Also, duplicates share deduplicated blob storage; they gain new entry/link rows, not necessarily new physical blobs.

`added_count = entry_ids.len()` is **not a wrong success count today**. A successful call inserted one row for each occurrence, including duplicates. The problem is missing progress on error. Within one UI request, a `Set` already removes repeated IDs (`BackupInspectDialog.tsx:56`, `:177-183`, `:197`). Duplicate IPC/core IDs remain a separate input-contract issue, not the cause of normal UI retry duplication.

The website count promise (`website/docs-src/09-backups.md:102`) should state the failure behavior more precisely. The core's word “safe” (`restore_entries.rs:138-139`) means non-overwriting, not duplicate-free retry.

### Fix assessment

Report **restored source IDs**, the failed ID, and the error. A count alone is insufficient to remove the correct selection or identify dates that actually changed. An ordered completed-prefix contract could work, but explicit IDs are less fragile.

Refresh after partial progress and after uncertain failure. Reload callbacks must remain scoped to the dates that received entries. Keep refresh failures separate from restore failures. Do not infer completion from date/title status: that match is only a heuristic.

Deduplicate IDs within a request if the API defines the selection as a set. Do not deduplicate against existing journal entries: intentional repeated restore is an allowed copy operation. The proposed fix is otherwise right and does not require making the entire batch atomic.

## W-03: public low-level entry writes

**Verdict: PARTLY. P3 is appropriate for the API-contract exception.**

The exports exist at `crates/mini-diarium-core/src/db/mod.rs:30-31`. `update_entry` has no lock check and changes content without updating image links (`db/queries/entries/update.rs:52-88`). That is a real bypass of the accidental-edit rule and the higher-level image invariant. The bench does use it (`src-tauri/benches/db_bench.rs:73-90`). The new blanket rule at `docs/best-practices/RUST_BEST_PRACTICES.md:97` does not match this public exception.

However, “`update_entry` does neither” is incorrect if it includes standalone atomicity. It performs **one UPDATE**, so its SQL mutation is atomic (`update.rs:63-80`). `insert_entry` likewise performs one INSERT (`entries/insert.rs:22-42`). Both lack higher-level image composition, not SQLite single-statement atomicity.

`insert_entry` creates an unlocked row; it is not a lock-bypassing update. Keeping a data URI inside encrypted text is an image-storage invariant exception, not plaintext disclosure. The normal production paths inspected still use the composed variants.

The plan explicitly accepted public `update_entry` in DEC-008. That explains the choice, but does not make the original broad goal and new blanket rule consistent. This is an acknowledged API exception, not a newly discovered app vulnerability.

**Fix:** feature-gating the public export can actually narrow the production API. Renaming to `update_entry_unchecked` can instead make an accepted exception clear. `#[doc(hidden)]` does not restrict access; it is not a lock-enforcement fix. Whichever choice is made, document it consistently. A source-use check is a useful extra guard, not a substitute for visibility.

## W-04: GC inside nested compositions

**Verdict: PARTLY. P3 is reasonable as a composition constraint, not as a present restore defect.**

The journal-wide DELETEs exist at `crates/mini-diarium-core/src/db/queries/images/storage.rs:248-259` and `attachments/storage.rs:305-316`. Composed delete and attachment removal call them inside their units (`entries/delete.rs:22-39`, `attachments/storage.rs:254-264`). A nested unit sees its parent's uncommitted rows.

The example is valid **only after the proposed future GC change**. Current restore stores attachment blobs (`backup/restore_entries.rs:180-181`), calls the image-aware insert (`:189`), then links attachments (`:191-192`). That insert runs image GC, and only on its image-normalization branch (`entries/insert.rs:61-69`). It does not delete the unlinked attachments. Its own images are linked before its image GC.

If attachment GC ran in that window, later linking would fail a foreign key and the outer unit would roll back. That is a failed composition, not committed damaged data. There is no current failing path to fix here.

**Fix:** document the store/link/GC ordering constraint. “Skip nested GC” alone is unsafe: all restore inserts are nested, so GC could be omitted permanently. Deferral needs an outer-unit pending-GC mechanism that runs once after all links exist. A raw depth test is also ambiguous: during a standalone helper's closure, depth is already one.

A test should check restored links and readable bytes, shared-blob survival, and absence of unexpected orphans. Total live blob count need not equal snapshot blob count because of existing live data and content deduplication. Current attachment restore coverage already checks names, remapped refs, and bytes (`restore_entries.rs:608-628`).

## W-05: source-file read before lock refusal

**Verdict: CONFIRMED. P3 is appropriate.**

`src-tauri/src/commands/attachments.rs:149-151` reads the source before calling the lock-enforcing core operation. `with_unlocked_db` holds the journal mutex throughout (`commands/auth/mod.rs:152-157`). Core validation then precedes its write unit, whose first action is the lock check (`crates/mini-diarium-core/src/db/queries/attachments/storage.rs:129-135`).

For a **valid readable source**, a locked entry causes unnecessary file I/O. For an invalid path or invalid file, the command returns the source error first. This is a real change from the merge-base pre-check. A lock request waits on the same state locks and mutex (`commands/auth/mod.rs:84-89`, `commands/backup_triggers.rs:173-177`).

The read is bounded: metadata rejects oversize files, and the actual read stops at cap plus one byte (`attachments.rs:29-58`). The bytes use `Zeroizing`. This is not unbounded memory use or persistence of a refused attachment. Slow storage can still delay the operation; a size cap is not a time limit.

**Fix:** accepting the documented DEC-009 trade-off is reasonable. A core byte-producing closure can avoid I/O for a locked entry without a command-level pre-check. But if core invokes it inside `BEGIN IMMEDIATE`, it holds the SQLite writer reservation during file I/O too. That can worsen contention with another process. Do not present that option as a free performance fix. Keep it with the broader attachment lock-duration work.

## W-06: exact-string lock contract

**Verdict: PARTLY. The dependency is confirmed; no current failure was found. P3 is maintenance priority.**

The two app comparisons are at `src-tauri/src/commands/entries.rs:117-123` and `:145-151`. The frontend exact match is at `src/lib/errors.ts:52-54`. Core returns the constant directly (`crates/mini-diarium-core/src/db/queries/entries/lock.rs:16-20`), and the helper returns closure errors unchanged (`transaction.rs:46`).

A wrapper inserted on an actual lock-refusal path would break classification. But one wrapper does not automatically break every caller. The review's restore example targets a **new unlocked row**, so it is not a present lock-error route. A wrapped string also does not necessarily expose sensitive internals: `mapTauriError` still applies its other filters (`errors.ts:104-124`). The correct current conclusion is a fragile contract, not a silent security failure.

**Fix:** nested tests for the six operations are useful. Also retain app-boundary tests, since a core-only test cannot detect a command wrapper. The no-wrap rule already appears at `lock.rs:4-8`; another central pointer can help, but is not missing protection by itself. Structured error codes remain the stronger long-term solution.

The empty-entry cleanup must distinguish lock refusal from real database failure. Do not turn every future error into `Ok(false)` just to avoid an error on a lock path.

## W-07: missing failure tests

**Verdict: CONFIRMED as test gaps. P3 is appropriate.**

`crates/mini-diarium-core/src/db/queries/transaction.rs:61-70` keeps the guard armed when COMMIT or RELEASE fails. The inspected tests cover BEGIN contention, normal commit/rollback, nesting, panic, and propagated parent loss (`:130-299`), but not COMMIT failure. The restore tests do not cover duplicate input IDs. There is no test defining behavior for an unowned explicit transaction.

**The proposed two-connection COMMIT test is valid.** In rollback-journal mode, an explicit reader can hold a SHARED lock while `BEGIN IMMEDIATE` succeeds on the writer; the writer cannot complete COMMIT until that reader releases its lock. SQLite's transaction documentation states that BUSY leaves the transaction active. With zero writer busy timeout, this should exercise failed COMMIT followed by guard rollback.

Make journal mode explicit, step the reader's SELECT while its explicit transaction is open, and verify the row through a separate/reopened connection after releasing the reader. Do not substitute a second writer: that tests BEGIN failure, which is already covered.

The foreign-transaction test is a **policy test**, not automatically a missing failure test. The helper's current documented rule accepts an already-open transaction. A test that expects refusal requires first changing that ownership rule. Duplicate-ID deduplication likewise requires deciding the input contract; the UI already sends unique IDs.

A genuine SQLite `RAISE(ROLLBACK)` test would complement the explicit-ROLLBACK simulation. If catch-and-continue remains prohibited after parent loss, test that prohibition or guard directly. These gaps do not establish a faulty current COMMIT implementation.

## Recheck of “Checked and sound”

| Original claim | Second opinion and evidence |
| --- | --- |
| Lock check placement | Correct for the six operations: `entries/update.rs:23-24`, `entries/delete.rs:22-23`, `tags.rs:119-120,140-141`, `attachments/storage.rs:132-133,254-255`, all under `crates/mini-diarium-core/src/db/queries/`. Standalone BEGIN IMMEDIATE also excludes another connection's writer; the app mutex is not the only protection. Input validation and transaction acquisition can fail before lock refusal. |
| Exact error string | Correct when the core reaches the refusal. Current commands preserve it; cleanup maps it to false. It is not a guarantee that every request against a locked row returns that string: BEGIN can fail first, and attachment validation/read can fail first. |
| Restore is exempt and unlocked | Correct: `backup/restore_entries.rs:302-311` builds an unlocked DTO, and `db/queries/entries/insert.rs:25-26` omits `locked`. New-row tag checks do not block it. |
| Per-entry atomicity | Correct for the SQL writes and normal rollback paths: `backup/restore_entries.rs:152-154,180-199`. The three fault tests compare every user table (`:772-823`). Atomicity does not prove complete/correct recovered content: see N-01. |
| Snapshot is separate and read-only | Correct for the app path: `backup/inspect.rs:109,135-140` and `db/schema/create.rs:28-34`. The public core function takes ordinary handles and does not itself enforce that the caller supplied a read-only, distinct snapshot. |
| Panic safety | Correct for unwinding and successful SQL rollback, as asserted at `db/queries/transaction.rs:208-237`. An aborting panic does not run Drop. The test is not proof that rollback can never fail. |
| SQLite-initiated rollback | Correct for returning the original propagated error and skipping redundant rollback (`transaction.rs:46,80-94`). It does not protect later writes by a caller that continues after the parent is gone. |
| No plaintext on disk | No new plaintext-persistence route found. Entry fields, tags, attachment names, image/attachment bytes, and thumbnails reach SQLite encrypted. Savepoint sub-journals contain stored page data, not decrypted Rust buffers. The disk-scan test at `restore_entries.rs:858-883` scans after completion, so it alone cannot prove absence in every transient file. I did not independently rerun the plan's reported test pass. |
| Logging | Correct for this diff: changed/new command messages contain IDs or static text; the restore count log is at `commands/backup_inspect.rs:283-287`. No new secret or user-content log was found. |
| Façade rule | Correct for code visibility: `db/mod.rs:1-3,41-44` seals internals and omits the four helpers. The text grep is not literally empty because `commands/backup_triggers.rs:8` has an old doc-comment reference. This does not establish that all public writes enforce policy; W-03 remains. |
| Mutex order | Correct for these paths: restore takes inspection then DB (`commands/backup_inspect.rs:267-279`); lock finishes inspection teardown before connection hand-off (`commands/auth/mod.rs:84-89`). No new inverse acquisition was found. This is not proof that all pre-existing inspection-lifetime races are absent. |
| Hard delete versus cleanup | Correct: `commands/entries.rs:98-123` checks emptiness; core hard delete does not (`db/queries/entries/delete.rs:21-44`). The empty check remains outside the delete unit, and recalculation reads before BEGIN (`entries/recalculate.rs:25-27`), as already tracked in TODO-0141. Those races were not fixed or newly introduced here. |

Unless otherwise stated, core paths in this table are under `crates/mini-diarium-core/src/`, and command paths are under `src-tauri/src/`.

## N-01: unresolved snapshot image IDs can bind to live images

**NEW missed finding: CONFIRMED by code tracing. P2 data-integrity issue under damaged or inconsistent snapshot input. Pre-existing, not introduced by this diff.**

The moved restore body still trusts the generic image resolver to eliminate the snapshot ID space:

- `crates/mini-diarium-core/src/backup/restore_entries.rs:175-189` resolves snapshot images, then inserts the resulting HTML into the live database.
- `crates/mini-diarium-core/src/db/queries/images/refs.rs:19-31` replaces only IDs returned by the entry's snapshot image links. It neither refuses nor removes an unresolved `image-id://N` reference.
- `crates/mini-diarium-core/src/db/queries/images/storage.rs:170-175` uses an inner join on those links. A missing link makes the image absent from that result.
- During insertion, `images/refs.rs:89-96` accepts an existing image ID by checking **the live database**, not the snapshot. `entries/insert.rs:61-69` then links it to the restored row.

### Failure sequence

1. A snapshot entry's authenticated HTML names image N, but its `entry_images` link is missing. This can be an inconsistent stored entry or damaged/modified snapshot metadata. Deleting a link does not break a foreign key, so an FK check alone cannot detect the missing relationship.
2. The live journal has a different image with ID N. This requires divergent ID history, not ordinary AUTOINCREMENT reuse on the same uninterrupted journal. A whole-journal restore followed by new image creation can produce that divergence.
3. Snapshot resolution leaves N unchanged. Live insertion sees that N exists and links the unrelated live image.
4. Restore returns success. The recovered entry now displays the wrong image. All writes were atomic; the content was still wrong.

Snapshot opening checks version and credentials, not complete entry/reference consistency (`crates/mini-diarium-core/src/backup/inspect.rs:109-140`). The current cross-database image test covers an intact source link (`backup/restore_entries.rs:498-562`), so it does not cover this case.

**Fix direction:** the restore-specific resolver must resolve every actual image source reference against the snapshot or fail the entry with a generic error. Never pass an unresolved snapshot image source ID to the live insertion path. Do not reject a harmless literal mention of `image-id://` in prose; distinguish actual image attributes. A test should remove the source link, keep an unrelated live image at the same ID, and assert an error plus no restored row or links.

This issue exists in the merge-base restore body and unchanged image helpers. It is included because the diff moves this recovery boundary and adds a stronger completeness claim. It must not be reported as a regression caused by the transaction helper. It is not evidence of new plaintext disclosure, network access, or an entry-lock security bypass.

## Recommended priority

Address W-02's partial-result contract and N-01's restore-reference validation first. Add W-07's COMMIT-failure coverage. Treat W-01 as an explicit fail-closed ownership/health design decision, not a proven current transaction leak. Keep W-03 through W-06 as scoped API or maintenance work.

The review should retain the distinction between **existing product defects**, **new behavior**, **latent composition hazards**, and **test gaps**. Combining them into one list of regressions overstates what these commits broke.

---
**Task complete:** Read-only second opinion for W-01 through W-07, the soundness list, and the scoped diff.

- **Scope**: docs-only
- **TODO**: n/a; review request, no TODO changed
- **Changelog**: n/a; no application behavior changed
- **Tests**: n/a; source/dependency review only, no new test-pass claim
- **Format**: n/a; docs-only, proofread and local links checked
- **Visual check**: n/a; no rendered-output change
- **Files**: `docs/explorations/2026-10-10-core-write-contract-second-opinion.md`
---
