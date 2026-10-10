# Core write contract follow-ups (W-03 to W-06)

## Metadata

- Plan Status: COMPLETED
- Plan Format: manual-planning v2.1.0
- Template: milestoned
- Tracking: tracked (this project already commits plans)

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Resume

<!--
Written by `plan-status.py resume`; do not edit by hand. Restart prompt: "Continue <plan> from
its Resume block". Stop: done | ask | gate | question | context | limit.
-->

- Updated: 2026-10-10 11:27 UTC
- State: Plan COMPLETED; all milestones staged for user commits
- Green / Red: 2026-10-10: cargo test --workspace 282/586/42; fmt, clippy, build, bench --no-run, bun run pre-commit 12/12 exit 0
- Next runnable: none
- Live environment: none
- Next IDs: Task 6.4; DEC-003
- Risks: none
- Stop: done

## Context For A Clean Session

This plan fixes findings W-03, W-04, W-05 and W-06 of the adversarial review
[`docs/explorations/2026-10-10-core-write-contract-adversarial-review.md`](../explorations/2026-10-10-core-write-contract-adversarial-review.md)
(sections "W-03" to "W-06"). W-01, W-02, N-01 and the W-07 COMMIT/rollback tests are already
fixed (their "Status" lines in that file). Read the four sections before you start; this plan
restates only what you need to execute.

- Repository: `D:\Repos\mini-diarium`, branch `master` (trunk-based, no feature branches), clean
  at `e1bd681` except two unrelated plan-archive changes
  (`D docs/plans/2026-10-09-core-write-contract-plan.md`, `?? docs/archive/2026-10-09-core-write-contract-plan.md`).
  Do not stage those two paths with this plan's commits.
- Stack: Rust workspace (root `Cargo.toml`, `resolver = "2"`), three crates:
  `crates/mini-diarium-crypto` → `crates/mini-diarium-core` → `src-tauri` (app crate
  `mini-diarium`, lib `mini_diarium_lib`). `rusqlite 0.40` bundled. Frontend SolidJS + Bun
  (not changed by this plan).
- Shell: Windows. Run `cargo` bare from the repo root. Run `bun` scripts from the **PowerShell
  tool** (`bun run pre-commit`). From Git Bash, `cmd.exe /c ...` silently no-ops (root
  `CLAUDE.md` § Execution Environment).
- Exact commands:
  - Test: `cargo test --workspace` (the `--workspace` flag is required; without it the core
    tests do not run)
  - Lint: `cargo clippy --workspace --all-targets -- -D warnings`; format `cargo fmt --all --check`
  - Build without test features: `cargo build --workspace`
  - Benches compile: `cargo bench -p mini-diarium --no-run`
  - Full gate: `bun run pre-commit` (PowerShell tool)

### Repository facts

| Fact | Value | How it was verified |
| --- | --- | --- |
| Façade exports both primitives | `insert_entry`, `update_entry` in the `pub use queries::{…}` list | `crates/mini-diarium-core/src/db/mod.rs:30-31` |
| `update_entry` skips the lock and image links | doc comment says "does **not** check the entry lock" | `crates/mini-diarium-core/src/db/queries/entries/update.rs:43-52` |
| Core uses the primitives internally | `insert_entry_with_images` calls `insert_entry` and `update_entry`; `update_entry_with_images` calls `update_entry` | `entries/insert.rs:56,67`, `entries/update.rs:39` |
| **One production caller outside core** | `create_entry` calls `db::insert_entry` with a blank entry | `src-tauri/src/commands/entries.rs:38` |
| All other callers are tests or benches | `#[cfg(test)]` modules in core and app, plus `src-tauri/benches/{db_bench,backup_bench}.rs` | `grep -rnE "(insert_entry\|update_entry)\(" --include=*.rs crates src-tauri` (app `#[cfg(test)]` starts at `entries.rs:248`, `tags.rs:76`, `attachments.rs:237`, `export.rs:193`, `import.rs:68`) |
| `test-support` feature already exists | `test-support = []` in core; the app enables it **only** as a dev-dependency | `crates/mini-diarium-core/Cargo.toml:19-23`, `src-tauri/Cargo.toml:124-127` |
| Existing gate pattern | `#[cfg(any(test, feature = "test-support"))] pub fn from_parts` | `crates/mini-diarium-core/src/db/schema/mod.rs:69-73` |
| Benches get dev-dependency features | benches are dev targets; `db_bench.rs` imports `insert_entry, update_entry` from `mini_diarium_lib::db` | `src-tauri/benches/db_bench.rs:3-6`; CI runs `cargo bench --benches` (`.github/workflows/benchmark.yml:43`) |
| Only a non-test build enforces the gate | When a cargo run also builds test or bench targets (`cargo test`, `cargo clippy --all-targets`, `cargo llvm-cov nextest`), resolver 2 unifies the app's dev-dependency feature into the one core build, so a production call to a gated function **still compiles** there. `cargo build --workspace` and the CI "Build Tauri app" jobs (`tauri-action`) build without `test-support` and fail on it | Cargo reference § "Feature resolver version 2" (dev-dependency features are unified only "when those same dependencies are being built"); `.github/workflows/ci.yml:72,199,261,334` |
| No core integration tests or doctests use the primitives | `crates/mini-diarium-core/tests/` is empty; no `///` example names them | `ls crates/mini-diarium-core/tests`; the `grep` above returns no `///` line |
| Two docs use `insert_entry` as the façade example | "e.g. `mini_diarium_core::db::insert_entry`" and "e.g. `crate::db::insert_entry`" | `crates/mini-diarium-core/API.md:12`; `src-tauri/CLAUDE.md:12` (§ Workspace layout) |
| Blank insert skips the image branch | `insert_entry_with_images` runs `extract_and_replace_image_refs`; the update/link/GC block runs only if text changed or images were found | `entries/insert.rs:51-74` |
| Journal-wide image GC inside composed writes | `cleanup_orphaned_images` in insert (image branch), update, delete | `entries/insert.rs:69`, `entries/update.rs:28`, `entries/delete.rs:38`; definition `images/storage.rs:248-259` |
| Journal-wide attachment GC inside composed writes | `cleanup_orphaned_attachments` in delete and remove | `entries/delete.rs:39`, `attachments/storage.rs:263`; definition `:305-316` |
| Restore stores blobs, then inserts, then links | `copy_attachment_blobs` → `insert_entry_with_images` → `link_attachment` | `crates/mini-diarium-core/src/backup/restore_entries.rs:222-235` (inside `restore_one_entry`, `:208-244`) |
| An existing test already catches the basic W-04 mutation | `test_restore_entries_copies_attachments_and_remaps_refs` deletes the source entry from live before restore, so its blobs are new and unlinked; a GC after `copy_attachment_blobs` deletes them, the link fails on the foreign key, and `restored.len() == 1` fails. It does **not** cover a blob shared with a live entry, images, or leftover orphans | `restore_entries.rs:745-813` |
| Helper doc comment to extend | `with_write_transaction` | `crates/mini-diarium-core/src/db/queries/transaction.rs:19-52` |
| Six lock-enforcing writes, tested standalone only | `test_lock_refuses_*` call each write outside any unit | `crates/mini-diarium-core/src/db/queries/entries/lock.rs:191-257` |
| Lock string compare in commands | `e == db::ERR_ENTRY_LOCKED` | `src-tauri/src/commands/entries.rs:118,146` |
| Frontend exact match | `/^entry is locked$/i` | `src/lib/errors.ts:52-54`; test `src/i18n/i18n.test.ts:91-93` |
| App-boundary lock tests already exist | entries, tags, attachments | `entries.rs:755,803,844,883` (`fn test_*`), `tags.rs` (`test_add_tag_to_locked_entry_is_rejected`, `test_remove_tag_from_locked_entry_is_rejected`), `attachments.rs:350` (`test_locked_entry_rejects_add_and_remove_but_allows_save_copy`) |
| Attachment command reads the file before core's lock check | `read_source_file` runs inside `with_unlocked_db`, then `db::add_attachment_to_entry` | `src-tauri/src/commands/attachments.rs:143-152` |
| Docs that state the current exception | API.md "Transactions" / "Entry lock" bullets and "Entry CRUD" list; RUST_BEST_PRACTICES rule; backend Gotcha #1 | `crates/mini-diarium-core/API.md:84-115,189-191`; `docs/best-practices/RUST_BEST_PRACTICES.md` § "Compose Multi-Step Writes Under One Write Unit"; `src-tauri/CLAUDE.md` Gotcha #1 ("The low-level `update_entry` does not check the lock") |
| TODO counter drift | header says next is TODO-0140, but TODO-0141 exists | `docs/todo/TODO.md:16,58` |
| CHANGELOG `[0.7.5] - Unreleased` already has `### Internal` | append the bullet there | `CHANGELOG.md:37,46` |
| Related TODOs | TODO-0134 (attachment work out of the lock), TODO-0139 (error-string contract), TODO-0141 (check-then-write races) | `docs/todo/TODO.md:46,65,58` |

### Hard constraints

1. Never run `git commit` unless the user says so for that commit. Each `Commit:` step means:
   stage the listed paths and propose the message; the user commits. If the user tells you to
   commit, add **no** AI attribution (no `Co-Authored-By`, no session trailer) — a commit with
   attribution is permanent in trunk history.
2. Do not add a lock pre-check in the app crate (`src-tauri/src/commands/*`) — it splits the
   check from the write unit again and reverses Milestone 3 of TODO-0133 (archived plan DEC-009).
3. Do not wrap `ERR_ENTRY_LOCKED` in any `map_err` on a lock-refusal path — the frontend match
   is exact, and on the cleanup path a wrapped string turns `delete_entry_if_empty`'s `Ok(false)`
   into an `Err` on auto-lock and app close (TODO-0132).
4. `delete_entry_if_empty_inner` maps **only** `ERR_ENTRY_LOCKED` to `Ok(false)`. Do not widen
   the match — other errors would vanish on paths that cannot show them.
5. Do not skip journal-wide GC in nested units — every restore insert is nested, so GC would
   never run there (review W-04 § Fix).
6. Do not change benchmark function names in `src-tauri/benches/*` — CI stores results by name on
   `gh-pages`, and a rename breaks the history.
7. The app crate must not reach `db::queries` / `db::schema` / `.conn()` / `.key()` — the façade
   rule (`src-tauri/CLAUDE.md` § Workspace layout). Use façade names only.
8. Do not stage the two pre-existing plan-archive paths listed above — they belong to another
   change.
9. Prove the W-03 gate with `cargo build --workspace`, never with `cargo test` or
   `cargo clippy --all-targets` — those unify `test-support` into core (Repository facts), so a
   production call to a gated function compiles there and the check passes falsely.

## Goal

The core façade no longer gives production code a write that skips the entry lock or the image
links. The lock error contract and the orphan-GC ordering rule are pinned by tests and written
down where the next developer will read them. The attachment read-before-lock trade-off stays as
it is, is pinned by a test, and is handed to TODO-0134 with its constraints.

## Scope

- W-03: gate `insert_entry` / `update_entry` façade exports behind
  `#[cfg(any(test, feature = "test-support"))]`; move `create_entry` to `insert_entry_with_images`;
  align `API.md`, `RUST_BEST_PRACTICES.md`, `src-tauri/CLAUDE.md`.
- W-06: core tests that run each of the six lock-enforcing writes inside an outer
  `with_write_transaction` and assert the exact error; a no-wrap pointer in `RUST_BEST_PRACTICES.md`.
- W-04: document the "no journal-wide GC between storing and linking a blob" rule; add a restore
  regression test for links, bytes, a shared blob, and orphans.
- W-05: keep DEC-009; pin the current error order with an app test; add the W-05 constraints to
  TODO-0134.
- Bookkeeping: a new TODO (ID from `todo-manager`), CHANGELOG `### Internal` bullet, review doc
  "Status" lines.

## Non-Goals

- A deferred-GC mechanism in `with_write_transaction` (user chose document + test for W-04).
- Moving the attachment file read after the lock check, or any attach-path async/lock-scope work
  (TODO-0134).
- Structured error codes or a Rust↔`errors.ts` cross-language test (TODO-0139).
- Moving the emptiness check inside the delete unit (TODO-0141).
- Website docs: no user-facing behavior changes, so `website/docs-src/` is not touched.

## Assumptions

- With `resolver = "2"`, a dev-dependency feature is not enabled for normal lib/bin builds, so
  `cargo build --workspace` compiles core **without** `test-support`. Verified by
  `Cargo.toml:3` (`resolver = "2"`); Task 2.2 proves it with a compile error before Task 2.1's
  change is in place (see its Validation).
- No external consumer of `mini-diarium-core` exists; `API.md` is "pre-1.0 and internal"
  (`src-tauri/CLAUDE.md` § Workspace layout), so narrowing the façade needs no deprecation period.
- `insert_entry_with_images` on a blank entry is one extra `BEGIN IMMEDIATE`/`COMMIT` around the
  same single `INSERT`; no behavior difference for `create_entry` (`entries/insert.rs:51-74`).

## Open Questions

Resolved with the user on 2026-10-10:

- W-03 approach → gate both primitives behind `test-support`; `create_entry` moves to
  `insert_entry_with_images`.
- W-04 approach → document the ordering rule and add a regression test; no deferred GC.
- W-05 approach → keep the DEC-009 trade-off, pin it with a test, and hand it to TODO-0134.
- Tracking → create a new TODO for this work and close it at the end.

## Milestones

### Milestone 1: Bookkeeping And Baseline

- Status: COMPLETED
- Purpose: Give the work a TODO ID and prove the tree is green before any change.
- Exit Criteria: A new TODO exists with an ID assigned by `todo-manager`, and the baseline
  `cargo test --workspace` result is recorded.

#### Task 1.1: Create the TODO and record the baseline

- Status: COMPLETED
- Depends On: none
- Objective: A TODO entry that names W-03 to W-06 and links the review and this plan; a recorded
  green baseline.
- Steps:
  1. Load the `todo-manager` skill and add the TODO. Do not pick the ID by hand: the counter at
     `docs/todo/TODO.md:16` says TODO-0140 but TODO-0141 already exists (`:58`); let the skill
     resolve it, and fix the counter line if the skill does not.
  2. Text: "Core write contract follow-ups W-03 to W-06" with links to the review document and
     this plan; acceptance = this plan's Goal.
  3. Run `cargo test --workspace` and record the three per-crate pass counts in Notes.
  4. Commit: `docs(todo): add TODO-NNNN for core write contract follow-ups` — paths:
     `docs/todo/TODO.md`, this plan file.
- Validation: `grep -n "W-03" docs/todo/TODO.md` prints the new entry; `cargo test --workspace`
  exits 0.
- Notes: Replace `NNNN` in later commit messages with the assigned ID. Assigned ID: **TODO-0142** (todo-manager scan of `docs/todo/*.md`: highest was TODO-0141; the `Latest TODO ID` marker was fixed from TODO-0139 to TODO-0142). Baseline 2026-10-10 at `e1bd681`, `cargo test --workspace` exit 0: `mini-diarium` (app lib) 281 passed, app bin 0; `mini-diarium-core` 584 passed; `mini-diarium-crypto` 42 passed; 0 failed, 0 ignored; doctests 0 in all three crates.

### Milestone 2: W-03 — Narrow The Façade

- Status: COMPLETED
- Purpose: Production code can no longer call a public write that skips the lock or the image
  links.
- Exit Criteria: `cargo build --workspace` compiles with no production use of the two primitives;
  tests and benches still compile and pass; `API.md`, `RUST_BEST_PRACTICES.md` and
  `src-tauri/CLAUDE.md` describe the same rule.

#### Task 2.1: Move `create_entry` to the composed insert

- Status: COMPLETED
- Depends On: 1.1
- Objective: `create_entry` (`src-tauri/src/commands/entries.rs:38`) calls
  `db::insert_entry_with_images` and behaves the same.
- Steps:
  1. Replace `db::insert_entry(db, &entry)?` with `db::insert_entry_with_images(db, &entry)?`.
  2. Leave the `debug!` line and the read-back unchanged.
  3. Commit: `refactor(entries): create_entry uses the composed insert (W-03)` — path:
     `src-tauri/src/commands/entries.rs`.
- Validation: `cargo test -p mini-diarium test_create_entry_workflow` passes (`entries.rs:257`).
- Notes: Separate commit, so the façade change in 2.2 is a pure visibility change.

#### Task 2.2: Gate the primitives behind `test-support`

- Status: COMPLETED
- Depends On: 2.1
- Objective: `insert_entry` and `update_entry` are reachable at the `db` root only under
  `#[cfg(any(test, feature = "test-support"))]`.
- Steps:
  1. In `crates/mini-diarium-core/src/db/mod.rs`, remove `insert_entry` and `update_entry` from
     the grouped `pub use queries::{…}` list (`:30-31`) and add a separate, commented re-export:
     `#[cfg(any(test, feature = "test-support"))] pub use queries::{insert_entry, update_entry};`
     with a "why" comment (test fixtures and benches only; they skip the lock and image links).
     Follow the `from_parts` pattern (`db/schema/mod.rs:64-73`).
  2. Update the doc comments on `insert_entry` (`entries/insert.rs:7-11`) and `update_entry`
     (`entries/update.rs:43-51`): crate-internal primitive; exported only with `test-support`.
  3. Keep the core-internal callers (`insert.rs:56,67`, `update.rs:39`) on the `queries` path —
     they do not use the `db` root, so they are not affected.
  4. Commit together with Task 2.3 (one logical change: code + contract docs).
- Validation:
  - `cargo build --workspace` passes (core built without `test-support`).
  - Negative proof that the gate works: before committing, temporarily revert Task 2.1's line and
    run `cargo build --workspace`; it **must fail** with an unresolved `db::insert_entry` in
    `commands/entries.rs`. Restore the line. Record the error line in Notes. Use only
    `cargo build` for this check (Hard constraint 9).
  - `cargo bench -p mini-diarium --no-run` passes (benches keep their imports and names).
  - `cargo test --workspace` and `cargo clippy --workspace --all-targets -- -D warnings` pass.
- Notes: If clippy reports `unused_imports` or `dead_code`, fix the cfg, not with `#[allow]`.
  Result 2026-10-10: `cargo build --workspace` exit 0. Negative proof (Task 2.1 line temporarily
  reverted, then restored; `git diff` of `entries.rs` against the staged version empty):
  `cargo build --workspace` exit 101 with
  ``error[E0425]: cannot find function `insert_entry` in module `db` `` at
  `src-tauri\src\commands\entries.rs:38:26`. `cargo bench -p mini-diarium --no-run` exit 0 (5
  bench executables). `cargo test --workspace` exit 0: app 281, core 584, crypto 42 passed.
  `cargo clippy --workspace --all-targets -- -D warnings` exit 0 (no `#[allow]` added).
  `cargo fmt --all --check` exit 0.

#### Task 2.3: Align the contract docs for W-03

- Status: COMPLETED
- Depends On: 2.2
- Objective: Every doc that names the exception says the same thing.
- Steps:
  1. `crates/mini-diarium-core/API.md`: in "Transactions" (`:102-105`) and "Entry lock"
     (`:111-113`), say the primitives exist only with `test-support`; in "Entry CRUD"
     (`:189-191`) move `insert_entry` / `update_entry` to a "test-support only" line.
  2. `docs/best-practices/RUST_BEST_PRACTICES.md` § "Compose Multi-Step Writes Under One Write
     Unit": add that a primitive needed by fixtures or benches is exported only under
     `test-support`, never in the default build.
  3. `src-tauri/CLAUDE.md` Gotcha #1: replace "The low-level `update_entry` does not check the
     lock." with the test-support rule.
  4. Replace the two façade examples that name `insert_entry` with a default-build name, for
     example `insert_entry_with_images`: `crates/mini-diarium-core/API.md:12` and
     `src-tauri/CLAUDE.md:12` (§ Workspace layout, "e.g. `crate::db::insert_entry`").
  5. In `src-tauri/CLAUDE.md` § Workspace layout, add one sentence: the gate is enforced only by
     a non-test build (`cargo build --workspace`, CI "Build Tauri app"), not by `cargo test` or
     `clippy --all-targets`.
  6. Commit: `refactor(core): export insert_entry/update_entry only with test-support (W-03)` —
     paths: `crates/mini-diarium-core/src/db/mod.rs`, `…/entries/insert.rs`,
     `…/entries/update.rs`, `crates/mini-diarium-core/API.md`,
     `docs/best-practices/RUST_BEST_PRACTICES.md`, `src-tauri/CLAUDE.md`.
- Validation: `grep -n "insert_entry\b\|update_entry\b" crates/mini-diarium-core/API.md src-tauri/CLAUDE.md docs/best-practices/RUST_BEST_PRACTICES.md`
  shows no sentence that presents `insert_entry` or `update_entry` as a normal public write or as
  the façade example.
- Notes: Follow `docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md` for the CLAUDE.md edit.
  Result 2026-10-10: the validation grep shows every remaining mention as `test-support`-only
  or as crate-internal history (Gotcha #1 schema notes on `preview_enc` and the search-index
  hook). The API.md "Entry lock" line `insert_entry*` was also narrowed to
  `insert_entry_with_images`.

### Milestone 3: W-06 — Pin The Lock Error Contract

- Status: COMPLETED
- Purpose: A future `map_err` on a lock-refusal path inside core fails a test.
- Exit Criteria: Each of the six lock-enforcing writes has a test that runs it inside an outer
  `with_write_transaction` and asserts the error is exactly `ERR_ENTRY_LOCKED`; the test was seen
  failing under a deliberate wrap; the no-wrap rule is in `RUST_BEST_PRACTICES.md`.

#### Task 3.1: Nested-unit lock tests

- Status: COMPLETED
- Depends On: 1.1
- Objective: New tests in `crates/mini-diarium-core/src/db/queries/entries/lock.rs` (`mod tests`,
  reuse `locked_fixture()` and `f.state()`).
- Steps:
  1. Add `test_lock_error_is_exact_inside_an_outer_write_unit`. For each of the six writes
     (`update_entry_with_images`, `delete_entry_by_id`, `add_tag_to_entry`,
     `remove_tag_from_entry`, `add_attachment_to_entry`, `remove_attachment_from_entry`), call it
     inside `crate::db::queries::with_write_transaction(&f.db, || …)` and assert
     `err == ERR_ENTRY_LOCKED` and `f.state() == before`. A table of `(name, closure)` pairs in
     one test is fine; the writes return different `Ok` types, so map each to
     `Result<(), String>` with `.map(|_| ())`. Use a fresh `locked_fixture()` per write, or
     re-read `before` per write. The assert message must name the write that failed.
     `with_write_transaction` is reachable as `crate::db::queries::with_write_transaction`
     (`db/queries/mod.rs:11`).
  2. After the outer unit returns, assert `f.db.conn().is_autocommit()` (the unit rolled back and
     left no transaction open).
  3. Mutation check (do not commit it). The standalone `test_lock_refuses_*` tests already catch a
     wrap inside one write, so the mutation must hit the **nested** path only: in
     `transaction.rs` (`with_write_transaction`, `:52`), temporarily replace `let value = f()?;`
     with `let value = f().map_err(|e| if nested { format!("nested: {}", e) } else { e })?;`.
     The new test must fail and the six standalone tests must still pass; revert. Record both
     results in Notes.
  4. Commit: `test(core): pin the exact lock error inside nested write units (W-06)` — path:
     `crates/mini-diarium-core/src/db/queries/entries/lock.rs`.
- Validation: `cargo test -p mini-diarium-core test_lock_error_is_exact_inside_an_outer_write_unit`
  passes; the mutation in step 3 made it fail.
- Notes: Core tests cannot see a command-layer wrap; the existing app tests (Repository facts)
  cover that side and stay.
  Result 2026-10-10: the new test passes (one table-driven test, fresh `locked_fixture()` per
  write; asserts exact error, `is_autocommit()` after the outer unit, and unchanged state).
  Mutation check (step 3 replacement applied to `transaction.rs:88`): `cargo test -p
  mini-diarium-core test_lock_` exit 101, 8 passed / 1 failed; the new test failed with
  `left: "nested: entry is locked"`, `right: "entry is locked"` ("update_entry_with_images
  inside an outer write unit must return the exact lock error"); all six standalone
  `test_lock_refuses_*` tests passed. Reverted with `git checkout -- transaction.rs`;
  `git status --porcelain` for the file is empty and a search for `format!("nested: ` finds 0
  matches. After revert: `cargo test --workspace` exit 0 (app 281, core 585, crypto 42);
  `cargo clippy --workspace --all-targets -- -D warnings` exit 0; `cargo fmt --all --check`
  exit 0 (after formatting the new test); `cargo build --workspace` exit 0.

#### Task 3.2: Document the no-wrap rule

- Status: COMPLETED
- Depends On: 3.1
- Objective: The rule is in the best-practices doc, not only in `lock.rs:4-8`.
- Steps:
  1. In `RUST_BEST_PRACTICES.md` § "Compose Multi-Step Writes Under One Write Unit", extend the
     lock bullet: pass `ERR_ENTRY_LOCKED` through unchanged (no `map_err` on that path); only
     `delete_entry_if_empty` maps it, and only it, to `Ok(false)`; structured codes are TODO-0139.
     Name the new test as the guard.
  2. Commit: `docs(rust): state the exact-lock-error rule (W-06)` — path:
     `docs/best-practices/RUST_BEST_PRACTICES.md`.
- Validation: `grep -n "ERR_ENTRY_LOCKED" docs/best-practices/RUST_BEST_PRACTICES.md` shows the
  new sentence.
- Notes: Result 2026-10-10: added a sub-bullet under the lock bullet (line 100); the grep shows
  lines 99 and 100. The sentence says the `Ok(false)` mapping lives in `delete_entry_if_empty`
  (app crate, `commands/entries.rs:117-123`), which matches the code. This file also holds the
  staged Task 2.3 hunk (line 98), so its index copy now carries both commits' hunks; split them
  at commit time (see the hand-off report).

### Milestone 4: W-04 — Orphan-GC Ordering Rule

- Status: COMPLETED
- Purpose: The latent hazard (a journal-wide GC between storing and linking a blob in one unit)
  is written down at the code that creates it and caught by a test.
- Exit Criteria: The rule is in the helper's doc comment, both GC functions' doc comments,
  `restore_one_entry`, and `RUST_BEST_PRACTICES.md`; a restore test fails if a GC is inserted
  between `copy_attachment_blobs` and `link_attachment`.

#### Task 4.1: Restore regression test for links, bytes, shared blobs and orphans

- Status: COMPLETED
- Depends On: 1.1
- Objective: New test in `crates/mini-diarium-core/src/backup/restore_entries.rs` `mod tests`,
  next to `test_restore_entries_copies_attachments_and_remaps_refs` (`:745`).
- Steps:
  1. Add `test_restore_keeps_shared_blobs_and_leaves_no_orphans`. Build it like
     `test_restore_entries_copies_attachments_and_remaps_refs` (`:745-813`, `Fixture::new` +
     `snapshot_and_open`):
     - live anchor entry with attachment bytes `X` (`crate::db::add_attachment_to_entry`);
     - source entry with attachment bytes `X` (same fingerprint, so restore re-uses the anchor's
       live blob), attachment bytes `Y`, and an embedded `data:` PNG image inserted through
       `insert_entry_with_images` (`crate::db::queries::images::test_support::valid_png_bytes`);
     - `snapshot_and_open()`, then `delete_entry_by_id(source)` on live, so `Y` and the image
       exist only in the snapshot;
     - restore `[source_id]`.
  2. Assert: `outcome.failed.is_none()`; the restored entry links two attachments
     (`list_entry_attachments`) and one image (`get_images_for_entry`); the restored `X` link
     uses the **same** live attachment id as the anchor's; `read_attachment_bytes` returns `X`
     for both the anchor and the restored entry and `Y` for the restored entry; no orphan rows
     (`SELECT COUNT(*) FROM attachments WHERE id NOT IN (SELECT attachment_id FROM entry_attachments)` = 0,
     same for `images` / `entry_images`).
  3. Do **not** assert that the live blob count equals the snapshot blob count (review W-04 §
     Fix: de-duplication and existing live data make that wrong).
  4. Mutation check (do not commit it): temporarily add
     `crate::db::queries::attachments::cleanup_orphaned_attachments(live_db)?;` after
     `copy_attachment_blobs` in `restore_one_entry` (`:222-226`); the new test must fail (the
     unlinked `Y` blob is deleted, its link fails); revert. Record the failure line in Notes.
     The existing attachment test also fails under this mutation (Repository facts); that is
     expected. The new test adds the shared-blob, image, and orphan checks.
  5. Commit: `test(restore): pin blob links, shared blobs and orphans after restore (W-04)` —
     path: `crates/mini-diarium-core/src/backup/restore_entries.rs`.
- Validation: `cargo test -p mini-diarium-core test_restore_keeps_shared_blobs_and_leaves_no_orphans`
  passes; the mutation in step 4 made it fail.
- Notes: If the mutation does **not** make the test fail, the test does not guard W-04: change the
  fixture (the snapshot's non-shared blob is the one the GC would delete) before you continue.
  Result 2026-10-10: the new test passes. It uses `valid_png_bytes` for the image and adds a
  "fixture bug" guard before the restore (live holds 1 attachment, 0 images, so `Y` and the
  image exist only in the snapshot). Mutation check (the GC call added after the
  `copy_attachment_blobs` block in `restore_one_entry`): `cargo test -p mini-diarium-core
  restore` exit 101, 23 passed / 6 failed; the new test failed at `restore_entries.rs:851` with
  `restore must succeed, got: Some(RestoreFailure { entry_id: 2, error: "Failed to link
  attachment: FOREIGN KEY constraint failed" })`. Also failed as expected:
  `test_restore_entries_copies_attachments_and_remaps_refs`,
  `test_restore_of_entry_locked_in_snapshot_is_not_blocked_by_lock_enforcement`, and three
  fault-injection tests (FK failure fires before the injected fault). Reverted with the Edit
  tool; `git diff` of the file shows only the new test; `git grep -n
  "cleanup_orphaned_attachments(live_db)"` on the file prints nothing (exit 1).

#### Task 4.2: Document the ordering rule

- Status: COMPLETED
- Depends On: 4.1
- Objective: The rule is written where a developer adds a GC call or a composed write.
- Steps:
  1. `transaction.rs` doc comment of `with_write_transaction` (`:19-52`): a nested unit sees the
     parent's uncommitted rows, so a journal-wide GC inside it also sees the parent's unlinked
     blobs; a composed write must not run a journal-wide GC between storing a blob and linking it
     in the same unit.
  2. One-line pointer in the doc comments of `cleanup_orphaned_images` (`images/storage.rs:248-250`)
     and `cleanup_orphaned_attachments` (`attachments/storage.rs:305-307`).
  3. A short comment in `restore_one_entry` at the store → insert → link sequence, naming the
     test from Task 4.1.
  4. `RUST_BEST_PRACTICES.md` § "Compose Multi-Step Writes…": one bullet with the rule and the
     reason "skipping GC in nested units is not the fix — every restore insert is nested".
  5. Commit: `docs(core): document the orphan-GC ordering rule for write units (W-04)` — paths:
     `…/db/queries/transaction.rs`, `…/images/storage.rs`, `…/attachments/storage.rs`,
     `crates/mini-diarium-core/src/backup/restore_entries.rs`,
     `docs/best-practices/RUST_BEST_PRACTICES.md`.
- Validation: `cargo test --workspace` passes (doc-comment edits only);
  `cargo fmt --all --check` passes.
- Notes: No behavior change in this task.
  Result 2026-10-10: doc comments and one code comment only; no benchmark touched. The
  `with_write_transaction` paragraph and the `RUST_BEST_PRACTICES.md` bullet name the Task 4.1
  test as the guard. `cargo fmt --all --check` exit 0; `cargo test --workspace` exit 0 (app
  281, core 586, crypto 42); `cargo clippy --workspace --all-targets -- -D warnings` exit 0;
  `cargo build --workspace` exit 0. `restore_entries.rs` and `RUST_BEST_PRACTICES.md` now
  carry hunks of more than one proposed commit in the index; split them at commit time.

### Milestone 5: W-05 — Keep The Trade-off, Hand It To TODO-0134

- Status: COMPLETED
- Purpose: The read-before-lock order is a recorded, tested choice, and TODO-0134 carries its
  constraints.
- Exit Criteria: An app test pins the current error order on a locked entry; the command has a
  comment that names the trade-off; TODO-0134 lists the W-05 constraints.

#### Task 5.1: Pin the current error order

- Status: COMPLETED
- Depends On: 1.1
- Objective: New test in `src-tauri/src/commands/attachments.rs` `mod tests`, next to
  `test_locked_entry_rejects_add_and_remove_but_allows_save_copy` (`:350`).
- Steps:
  1. Add `test_locked_entry_reports_file_error_before_lock_error`: use the module's `fixture(…)`,
     `f.lock_entry()` and `f.write_file("empty.txt", b"")` helpers (used at `:350-356`); call
     `add_entry_attachment_inner`; assert the error is exactly `"Attachment file is empty"`
     (`read_source_file`, `:35`), not `ERR_ENTRY_LOCKED`; assert
     `list_entry_attachments_inner` is empty.
  2. Extend the existing comment inside `add_entry_attachment_inner` (`:148`, "Core refuses a
     locked entry …"): the source file is read before core checks the lock, so a bad file on a
     locked entry reports the file error (archived plan DEC-009, review W-05); TODO-0134 owns any
     change; do not add an app pre-check.
  3. Commit: `test(attachments): pin read-before-lock error order (W-05)` — path:
     `src-tauri/src/commands/attachments.rs`.
- Validation: `cargo test -p mini-diarium test_locked_entry_reports_file_error_before_lock_error`
  passes.
- Notes: This is a characterization test: it fails on purpose when TODO-0134 changes the order,
  so that change is deliberate. TODO-0134 updates or replaces it.
  Result 2026-10-10: the new test passes (`cargo test -p mini-diarium
  test_locked_entry_reports_file_error_before_lock_error`: 1 passed). It asserts the error is
  exactly `"Attachment file is empty"` and not `ERR_ENTRY_LOCKED`, and that the entry has no
  attachments. Control assertion (DEC-002): a valid file on the same locked entry returns
  `ERR_ENTRY_LOCKED`, so the lock is really in effect. The comment in
  `add_entry_attachment_inner` names DEC-009, W-05, the test, TODO-0134, and the no-pre-check
  rule. No production code change. `cargo test --workspace` exit 0 (app 282, core 586, crypto
  42); `cargo clippy --workspace --all-targets -- -D warnings` exit 0; `cargo fmt --all
  --check` exit 0; `cargo build --workspace` exit 0.

#### Task 5.2: Add the W-05 constraints to TODO-0134

- Status: COMPLETED
- Depends On: 5.1
- Objective: TODO-0134 (`docs/todo/TODO.md:46`) states what a fix for W-05 must respect.
- Steps:
  1. With the `todo-manager` skill (or the Edit tool if the skill has no edit operation), append
     to TODO-0134: "Also covers review W-05: the source file is read before core's lock check.
     Constraints: no app-crate lock pre-check; do not do file I/O inside `BEGIN IMMEDIATE` (it
     holds the RESERVED lock); update `test_locked_entry_reports_file_error_before_lock_error`."
     Link the review section.
  2. Commit together with Task 6.1 (bookkeeping commit).
- Validation: `grep -n "W-05" docs/todo/TODO.md` prints the TODO-0134 line.
- Notes: Result 2026-10-10: edited with the Edit tool (`todo-manager` has no edit-in-place
  operation for an open item's text). The sentence links the review's W-05 section anchor.
  `grep -n "W-05" docs/todo/TODO.md` prints line 46 (TODO-0134) and line 59 (TODO-0142).
  `docs/todo/TODO.md` is staged; its index copy also holds the Task 1.1 TODO-0142 hunk.

### Milestone 6: Cleanup And Final Verification

- Status: COMPLETED
- Purpose: Ensure the repository contains only intentional final artifacts, the bookkeeping is
  closed, and the complete change is verified.
- Exit Criteria: Intermediate artifacts are removed, the `## Pre-flight Checks` list passes, all
  final verification passes, and the plan status is COMPLETED.

#### Task 6.1: Bookkeeping — review status, CHANGELOG, TODO

- Status: COMPLETED
- Depends On: 2.3, 3.2, 4.2, 5.2
- Objective: The review document, CHANGELOG and TODO list show the work as done.
- Steps:
  1. In the review document, add a `**Status:**` line under each of W-03, W-04, W-05, W-06,
     in the same form as W-01/W-02 (date 2026-10-10 or the actual date, one or two sentences,
     test names).
  2. CHANGELOG: add one bullet at the end of the existing `### Internal` section of
     `## [0.7.5] - Unreleased` (`CHANGELOG.md:46`), in the `- **Title (TODO-NNNN)**: text` form
     the file uses. Text: the façade
     exports `insert_entry`/`update_entry` only with `test-support`; new tests pin the lock error
     inside nested units and the orphan-GC ordering; W-05 handed to TODO-0134.
  3. Close the new TODO with the `todo-manager` skill (date stamp, `[x]`).
  4. Commit: `docs: close TODO-NNNN core write contract follow-ups` — paths: the review document,
     `CHANGELOG.md`, `docs/todo/TODO.md`, this plan file.
- Validation: `grep -n "Status:" docs/explorations/2026-10-10-core-write-contract-adversarial-review.md`
  lists W-01, W-02, N-01, W-03, W-04, W-05, W-06; `grep -n "TODO-NNNN" docs/todo/TODO.md` shows
  `[x]`.
- Notes: No `website/docs-src/` change (Non-Goals); say so in the summary.
  Result 2026-10-10: `**Status:**` lines added under W-03, W-04, W-05, W-06 (the validation grep
  lists W-02, N-01, W-01, W-03, W-04, W-05, W-06); CHANGELOG `[0.7.5]` `### Internal` bullet
  (TODO-0142); TODO-0142 closed `[x]` with `(2026-10-10)`. No `website/docs-src/` change.

#### Task 6.2: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Depends On: 6.1
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Run `git status --porcelain`. Confirm that both mutation checks (Tasks 3.1 and 4.1) and the
     temporary revert in Task 2.2 are gone from the files (commands below).
  2. Remove only artifacts that are not part of the intended final repository state (scratch
     files, logs, `lcov` leftovers outside their normal paths).
  3. Keep the new tests and docs.
- Validation: each `grep` below passes by printing **nothing** and exiting 1.
  - `grep -n 'format!("nested: ' crates/mini-diarium-core/src/db/queries/transaction.rs`
  - `grep -n "cleanup_orphaned_attachments(live_db)" crates/mini-diarium-core/src/backup/restore_entries.rs`
  - `grep -n "db::insert_entry(db" src-tauri/src/commands/entries.rs`
  - `git status --porcelain` shows only this plan's uncommitted paths (if any) plus the two
    pre-existing plan-archive paths from Context.
- Notes: Do not remove user-provided files or unrelated worktree changes.
  Result 2026-10-10: the three greps print nothing and exit 1. `git status --porcelain` shows
  only this plan's staged paths plus the two pre-existing plan-archive paths. Removed one
  artifact: a companion `-notes.md` file that `plan-status.py note` created in Task 6.1 (its
  line moved to the Task 6.1 Notes). Ignored files (`coverage/`, `src-tauri/lcov.info`, test
  `.db` files) predate this plan and sit in their normal paths; not touched.

#### Task 6.3: Final Verification

- Status: COMPLETED
- Depends On: 6.2
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run every item in `## Pre-flight Checks`.
  2. Run the checks under `## Final Verification`.
  3. Fix failures and rerun until verification passes, or record the blocker.
  4. Set the plan to `COMPLETED` (`plan-status.py set-plan`), paste the final `check-plan.py`
     output, and Commit: `docs(plan): complete core write contract follow-ups plan` — path: this
     plan file only.
  5. Report with the summary template in `docs/best-practices/POST_TASK_BEST_PRACTICES.md`
     § "Summary Template".
- Validation: All pre-flight items checked; the named tests from Tasks 3.1, 4.1, 5.1 appear as
  `ok` in `cargo test --workspace` output (verify by name, not by the total).
- Notes: E2E is not required: no UI, IPC shape or frontend change
  (`POST_TASK_BEST_PRACTICES.md` § 1, E2E rule).
  Result 2026-10-10 (PowerShell tool): `cargo fmt --all --check` exit 0; `cargo clippy
  --workspace --all-targets -- -D warnings` exit 0; `cargo build --workspace` exit 0; `cargo test
  --workspace` exit 0 (app 282, core 586, crypto 42 passed; 0 failed), with
  `test_lock_error_is_exact_inside_an_outer_write_unit`,
  `test_restore_keeps_shared_blobs_and_leaves_no_orphans` and
  `test_locked_entry_reports_file_error_before_lock_error` each `... ok`; `cargo bench -p
  mini-diarium --no-run` exit 0 (5 executables); `bun run pre-commit` exit 0, 12/12 checks
  (frontend 1221 tests in 115 files, backend nextest 910/910, diff coverage 98.2% vs 80%).

## Project Gates

- Commits: the agent stages and proposes; the user commits (Hard constraint 1). Trunk-based on
  `master`, one logical change per commit (root `CLAUDE.md` § Agent Workflow Rules 6).
- TODO operations go through the `todo-manager` skill (root `CLAUDE.md` § Agent Workflow Rules 4).
- CLAUDE.md edits follow `docs/best-practices/CONTEXT_FILES_BEST_PRACTICES.md`.
- Every lint suppression needs a "why" comment; prefer fixing the cfg over `#[allow]`.
- Post-task checklist: `docs/best-practices/POST_TASK_BEST_PRACTICES.md`.
- Manual UI verification: none (no UI change).

## Pre-flight Checks

- [x] `cargo fmt --all --check`
- [x] `cargo clippy --workspace --all-targets -- -D warnings`
- [x] `cargo build --workspace` (core without `test-support`)
- [x] `cargo test --workspace`
- [x] `cargo bench -p mini-diarium --no-run`
- [x] `bun run pre-commit` (PowerShell tool; includes the coverage gate)

## Decision Log

Write an entry **before moving to the next task**, never retrospectively.
An entry is required when implementation diverges from what this plan specifies (different path,
signature, or approach), when a validation failure forces the plan to adapt, when an unplanned
problem is found, or when a validation is deliberately deferred.
No entry is needed when execution matches the plan.

### DEC-001 — Plan file is excluded locally; force-add it

- Date: 2026-10-10
- Task: 1.1
- Decision: Stage the plan with git add -f
- Rationale: docs/plans/ is listed in the local .git/info/exclude (not .gitignore); the previous plan in docs/plans/ is tracked, and Task 1.1 names this plan file as a commit path.

### DEC-002 — Add a lock control assertion to the W-05 test

- Date: 2026-10-10
- Task: 5.1
- Decision: test_locked_entry_reports_file_error_before_lock_error also asserts that a valid file on the same locked entry returns ERR_ENTRY_LOCKED
- Rationale: Without it the test would also pass if lock_entry() silently did nothing; the control proves the file error wins over a lock that is really in effect. Assertions only; no production code change, no app-crate pre-check.

## Final Verification

The end-to-end proof is: (1) `cargo build --workspace` passes while the Task 2.2 negative check
showed that a production call to `db::insert_entry` does not compile; (2) the Task 3.1 and 4.1
tests pass and were each seen failing under their mutation; (3) the Task 5.1 test passes; (4) all
pre-flight checks pass. Task 6.3 runs it.

## Approval Gate

Approved by the user on 2026-10-10.

## Plan Self-Check

Paste the output of `check-plan.py` here, with the date it was run:

```
$ python .claude/skills/manual-planning/scripts/check-plan.py docs/plans/2026-10-10-core-write-contract-follow-ups-w-03-to-w-06-plan.md
0 error(s), 0 warning(s)
```

Run: 2026-10-10

Final run after Milestone 6 (plan COMPLETED), 2026-10-10:

```
$ python .claude/skills/manual-planning/scripts/check-plan.py docs/plans/2026-10-10-core-write-contract-follow-ups-w-03-to-w-06-plan.md
0 error(s), 0 warning(s)
```

## Execution Notes

- Start each session with `plan-status.py <plan> brief`. Before stopping, run `plan-status.py <plan>
  resume` and end with `Stop: <reason> — <detail>`.
- Set status with `plan-status.py set` before starting a task and right after its validation passes.
- Follow `Depends On`, not task numbering. Milestones 3, 4 and 5 depend only on 1.1 and can run in
  any order after it.
- Write a `## Decision Log` entry **before starting the next task** whenever execution diverges from
  this plan, an unplanned problem is found, or a validation is deferred — never retrospectively.
