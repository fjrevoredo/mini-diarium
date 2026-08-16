# Backup System Redesign — First-Class Local Snapshots (TODO-0098)

## Metadata

- Plan Status: COMPLETED
- Created: 2026-08-04
- Last Updated: 2026-08-16 (Milestone 6 COMPLETED, closing this plan. All six milestones now COMPLETED: Milestone 3's Linux-only `PLATFORM-VERIFY` check was split off into [TODO-0101](todo/TODO.md), tracked independently rather than left blocking this plan — see Milestone 3's status line. Milestone 4 closed once Task 6.3's manual rehearsal supplied its deferred whole-journal restore validation, 2026-08-16, with no defects found. Task 6.3's pre-flight coverage check also found and fixed a real Windows-only bug in `scripts/check-diff-coverage.mjs` — see its notes and the `[0.7.0]` changelog entry. TODO-0098 is checked off in `docs/todo/TODO.md`.)
- Owner: Coding agent
- Approval: APPROVED (2026-08-04)
- Tracking: [TODO-0098](todo/TODO.md)
- Source assessment: [`docs/reports/2026-08-04-backup-system-assessment.md`](reports/2026-08-04-backup-system-assessment.md) (Option A, §6.1)
- Tags: `UX-GATE: SATISFIED 2026-08-10` (Milestone 4), `PLATFORM-VERIFY` (Milestone 3, reveal-in-folder — Linux half tracked as [TODO-0101](todo/TODO.md))

## Status Legend

- Plan Status values: DRAFT, QUESTIONS PENDING, READY FOR APPROVAL, APPROVED, IN PROGRESS, COMPLETED, BLOCKED
- Task/Milestone Status values: TO BE DONE, IN PROGRESS, COMPLETED, BLOCKED, SKIPPED

## Goal

Turn backups from an unlock-triggered file-copy loop into a backup product: retention that guarantees time depth regardless of how often the journal is opened, snapshots taken before risky writes rather than after them, atomic and verified writes, and both restore granularities available in-app — whole-journal rollback and per-entry restore from inside a snapshot — with no plaintext ever written to disk. Snapshots remain ordinary encrypted Mini Diarium databases throughout.

## Scope

- Rewrite `crates/mini-diarium-core/src/backup.rs` into a module with a pure retention policy, a filesystem-backed snapshot store behind a narrow boundary, and a manifest sidecar.
- Replace the write primitive (`fs::copy` → `VACUUM INTO` + fsync + atomic rename + post-write verification).
- Replace the trigger model: pre-migration, pre-destructive-operation, on-lock-if-changed, and manual, with a minimum interval between automatic snapshots.
- Tiered, time-guaranteed retention with change-counter deduplication and a storage budget.
- Keep snapshot creation off the UI thread and benchmarked, since it becomes a lock-path operation whose cost scales with journal size.
- A new `backup` Tauri command group and a Preferences → Backups tab, plus a reduced pre-auth entry point from the unlock screen.
- Read-only snapshot inspection, whole-journal restore (with a safety snapshot first), and per-entry restore into the live journal.
- Correct the six stale or wrong documentation claims catalogued in finding B-15 and rewrite `website/docs-src/09-backups.md`.

## Non-Goals

- **Entry-level revision history and a trash/soft-delete for entries** (Option B in the assessment). Deliberately deferred; it is a separate schema change on the `entries` write path and should land on top of the pre-migration snapshot this plan delivers.
- **A content-addressed / chunked backup repository** (Option C). Rejected in the assessment.
- Any off-device, networked, or multi-device backup. Those belong to MiniDiarium+ and are forbidden in the core.
- Changing the on-disk database format, the encryption scheme, or the auth-slot model.
- Enabling WAL journal mode. `VACUUM INTO` is correct under either mode, but switching is a separate decision with its own risks.
- User-configurable retention tiers or storage budget (see Assumptions).

## Assumptions

1. **Retention constants are fixed in this version, not user-configurable.** Defaults: keep the 10 most recent snapshots regardless of age, plus one per day for 14 days, one per week for 8 weeks, one per month for 12 months; storage budget `max(2 GB, 3 × journal size)`; minimum 1 hour between automatic snapshots. They live as named constants in one place so a later TODO can expose them without restructuring.
2. **Local-only (passwordless) journals keep key-less backups.** No key material is ever written into the backups directory. The gap is closed by disclosure, not by shipping the key: a persistent notice in the Backups panel, corrected documentation, and a correction to the passwordless ADR's inaccurate claim.
3. **The SQLite file header change counter (bytes 24–27, big-endian `u32`) is the deduplication signal**, and it must be persisted in the manifest rather than read back from a snapshot. Verified empirically on 2026-08-04 against the bundled SQLite: 21 write transactions produced counter `21`; a read-only open left it unchanged; **`VACUUM INTO` produced a copy whose counter is `1`**, because a vacuumed database is rebuilt rather than copied. Consequences: (a) the manifest is a hard prerequisite of deduplication, which is why it lands in Milestone 1; (b) an implementer must not "simplify" by reading the counter from the snapshot file. This supersedes the `db_settings` counter suggested in the assessment's implementation note, which would have required instrumenting every mutating query and would fail silently by *skipping* a needed snapshot if one were missed. Task 1.1 keeps this assumption under test permanently.
4. **Milestones 1–2 ship together as a patch release**; Milestones 3–5 ship in a later minor release.
5. Existing `backup-*.db` files are adopted, not discarded. Because `entries.date`, row counts, `schema_version`, and auth-slot types are all readable from a snapshot **without a key** (the `date` column is plaintext and `db::peek_auth_slot_types` at `crates/mini-diarium-core/src/db/peek.rs:53` reads slot types from a locked file), adopted snapshots can be fully described. `verified: false` therefore means "the master key has not been confirmed to unwrap this snapshot", not "we do not know what is inside".
6. The pre-auth Backups view shares the entry-point work that TODO-0094 needs for the locked-journal debug dump. Whichever lands first builds the shared pre-auth affordance.
7. **`opener:default` already grants `allow-reveal-item-in-dir`** (verified in `tauri-plugin-opener-2.5.4/permissions/default.toml`; `src-tauri/capabilities/default.json` grants `opener:default`). Reveal-in-folder needs no capability change — do not add one.
8. **There is no window-event hook in the app today.** `rg "on_window_event|CloseRequested" src-tauri/src/lib.rs` returns nothing, so the on-exit snapshot trigger in Task 1.6 must add one. Scope it to that trigger only; do not refactor window lifecycle handling as part of this plan.

## Open Questions

All resolved with the maintainer on 2026-08-04:

1. **How should local-only journals handle the `auto_key` recovery hole (finding B-9)?** → *Key-less backups plus warning and documentation.* Preserves the property that backups carry no key material; the hole is closed by honest disclosure rather than by making backup folders self-decrypting. Reflected in Assumption 2 and Task 5.3.
2. **Should retention and storage limits be user-configurable in this version?** → *Fixed defaults, no settings UI.* Keeps the release that has to be trustworthy as small as possible. Reflected in Assumption 1 and the Non-Goals.
3. **How should the work reach users?** → *Milestones 1–2 as their own patch release*, then the UI and restore work in a later minor. Reflected in Assumption 4 and Task 2.3.
4. **Where should the backup UI live?** → *Preferences → Backups tab, plus a reduced pre-auth entry point on the unlock screen.* Reflected in Milestone 3.

## Privacy Decision: Manifest Contents

The manifest is a **plaintext** sidecar next to encrypted snapshots. This is a deliberate decision that must be reviewed, not assumed:

- **It may contain:** snapshot timestamp, trigger, byte size, SQLite change counter, database schema version, app version, entry count, entry date range, auth-slot *types*, and a verified flag.
- **It must never contain:** entry content, entry titles, tag names, journal names, auth-slot *labels* (user-chosen), or any filesystem path.
- **Justification for counts and dates:** `entries.date` is already a plaintext column inside every snapshot, so anyone holding the backups folder can already read the date range with any SQLite tool. The manifest exposes nothing the snapshot does not. The existing debug dump sets the same precedent by reporting `last_entry_date` and content counts.
- **Enforcement:** Task 1.3 adds `test_manifest_contains_no_user_content`, modelled on the debug dump's existing no-leak test, seeded with a journal carrying a name, tags, and entry titles.

## UX Gate (Milestone 4)

`UX-GATE: REQUIRED`. Milestone 4 introduces destructive, multi-step interactions. Implementation of Tasks 4.2 and 4.3 must not start until each scenario below has explicit per-scenario sign-off from the maintainer, against a rendered prototype or screenshot — not against a written description.

| # | Scenario | Expected user feedback |
|---|---|---|
| UX-1 | User opens a snapshot for inspection | Panel clearly shows read-only mode, which snapshot is open, its date and entry count; live journal remains untouched and visibly separate |
| UX-2 | User restores the whole journal | Explicit confirm naming the snapshot date and stating that entries written since will be replaced; states that a safety snapshot of the current state is taken first; on success, names the safety snapshot so the action is reversible |
| UX-3 | Snapshot needs a different credential than the live journal (post password change, finding B-11) | The panel says so before the user attempts a restore, and the credential prompt explains that this snapshot predates the password change |
| UX-4 | User restores selected entries | Two-pane list flags entries missing from, or shorter in, the live journal; selection is explicit; result states how many entries were added and that nothing was overwritten |
| UX-5 | Restore target date already has entries | The user is told a new entry will be created alongside the existing one (multi-entry dates are supported), never a silent overwrite |
| UX-6 | Backup health is degraded (last N snapshots failed, or budget exceeded) | A persistent, non-blocking indicator with a plain-language cause and the folder path |
| UX-7 | Local-only journal (Assumption 2) | Persistent notice that these snapshots require this device's `config.json` and cannot be restored on another machine |

### Sign-off Record

Signed off 2026-08-10, against a rendered HTML prototype (light and dark) built for this review — not checked into the repo, so this record captures what it showed rather than pointing back to it.

| # | Scenario | Outcome |
|---|---|---|
| UX-1 | Inspecting a snapshot | Approved |
| UX-2 | Whole-journal restore | Approved, after a mechanism question — resolved below and folded into Task 4.2's steps |
| UX-3 | Credential drift | Approved |
| UX-4 | Restoring selected entries | Approved |
| UX-5 | Restore target date already has entries | Approved |
| UX-6 | Backup health degraded | Approved — already shipped in Milestone 3; the prototype flagged one deviation from the literal requirement (an "Open backups folder" action rather than a printed path string, so the path never crosses the IPC boundary as text) and it stands as reviewed and accepted |
| UX-7 | Local-only journal | Approved — already shipped in Milestone 3 |

**UX-2 mechanism, clarified during review:** restoring is a full-file atomic swap, not a merge and not a second `VACUUM INTO` pass. A snapshot is already a complete, valid encrypted database — it was written by `VACUUM INTO` when the backup was taken — so restoring means closing the live connection, copying the snapshot to a temp name inside the journal directory, fsyncing it, and atomically renaming it over `diary.db`: the same write-then-rename pattern Task 1.4 already built for taking a backup, aimed the other direction. Two consequences, both folded into Task 4.2's steps: the operation is real I/O, not instant, so the confirm dialog needs a disabled `Restoring…` busy state before the success banner (matching the existing `backingUp`/`verifying` pattern in `BackupsPanel.tsx`); and the connection teardown has to *wait* for the file handle to actually release rather than assume it, reusing `LockCompletion::AwaitFileRelease` from Milestone 1's Windows fix (Task 1.6 deviation 4, `os error 32`) for the identical reason — a rename over an still-open `diary.db` fails on Windows the same way `change_diary_directory` and `reset_diary` did.

Tasks 4.2 and 4.3 are unblocked to start.

## Milestones

### Milestone 1: Snapshot Engine

- Status: COMPLETED
- Purpose: Replace the creation, write, and retention mechanics so that no amount of user activity can destroy time depth, and so a faulty migration is recoverable. This is the milestone that would have prevented the incident; it ships with no UI.
- Exit Criteria: `cargo test --workspace` green; a simulated 200-unlock burst inside one hour leaves the oldest monthly snapshot intact; a read-only session produces no new snapshot; a snapshot exists and verifies *before* `apply_pending` runs any migration; an interrupted write leaves no file matching the snapshot naming pattern; existing `backup-*.db` files from a pre-upgrade install are still listed; snapshot creation does not block the UI thread and its cost is benchmarked.

#### Task 1.1: Verify and lock down the SQLite change-counter assumption

- Status: COMPLETED
- Objective: Keep Assumption 3 under permanent test, since the entire deduplication design rests on it.
- Steps:
  1. Add an integration test in `crates/mini-diarium-core/src/backup/` that: creates a database and reads the header counter; opens it read-only and reads again; inserts an entry and reads again; runs `VACUUM INTO` and reads the copy's counter.
  2. Assert the counter is unchanged across a read-only open, strictly increases after each write transaction, and that **the vacuumed copy's counter does not equal the source's** — this is the regression guard for the mistake of reading the counter back from a snapshot.
  3. If any assertion fails on the bundled SQLite, mark this task `BLOCKED`, record the observed behavior, and fall back to `(file size, SHA-256 of file)` recorded in the manifest as the dedup signal — correct but O(file size), so it must then be gated behind a size threshold above which snapshots are always taken.
- Validation: `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml change_counter` passes, including `test_vacuum_into_resets_the_change_counter`.
- Notes: Behavior confirmed empirically on 2026-08-04 against rusqlite 0.40 (`bundled`): source `21` after 21 write transactions, read-only open unchanged, vacuumed copy `1`. This task turns that one-off check into a permanent guard. Per root `CLAUDE.md` agent rule 5, do not build on it without the test in place.

#### Task 1.2: Restructure `backup.rs` into a module with a pure policy core

- Status: COMPLETED
- Objective: Split the backup subsystem into a pure, unit-testable policy layer and a thin filesystem layer, so the policy is reusable and the storage is swappable (open-core constraint, `OPEN_CORE_STRATEGY.md` §8).
- Steps:
  1. Convert `crates/mini-diarium-core/src/backup.rs` into `crates/mini-diarium-core/src/backup/` with `mod.rs` (façade + re-exports), `policy.rs`, `store.rs`, `manifest.rs`.
  2. In `policy.rs`, define `SnapshotMeta`, `RetentionPolicy` (with the Assumption-1 constants), `SnapshotTrigger` (`Unlock`, `Lock`, `Migration`, `Destructive(&'static str)`, `Manual`, `PreRestore`), and the pure function `plan_retention(&[SnapshotMeta], &RetentionPolicy, now) -> RetentionDecision { keep, evict }`. No filesystem access in this file.
  3. In `store.rs`, define a `SnapshotStore` trait (`list`, `write`, `read`, `delete`, `stat`) and a `FsSnapshotStore` implementation. All `std::fs` usage lives here.
  4. Keep `MAX_BACKUPS` exported as a deprecated alias resolving to the new policy's recent-tier count until Task 1.3 updates the debug dump, so `commands/debug.rs` keeps compiling.
  5. Update `crates/mini-diarium-core/API.md` with the new public surface, marking it pre-1.0 per the M2 façade contract.
- Validation: `cargo test --workspace` green; `rg "std::fs" crates/mini-diarium-core/src/backup/` returns hits only in `store.rs` and `manifest.rs`; `policy.rs` contains no filesystem I/O.
- Notes: Behavior-preserving refactor only — new triggers and retention arrive in Tasks 1.5 and 1.6. Affected: `crates/mini-diarium-core/src/lib.rs` module declaration, `crates/mini-diarium-core/API.md`.

#### Task 1.3: Manifest sidecar

- Status: COMPLETED
- Objective: Persist per-snapshot metadata, including the change counter that deduplication requires (Assumption 3) and the descriptive fields that make a snapshot identifiable without opening it (finding B-14).
- Steps:
  1. Implement `manifest.json` in the backups directory: schema version, plus per-snapshot `created_at`, `trigger`, `entry_count`, `entry_date_range`, `db_schema_version`, `app_version`, `byte_size`, `sqlite_change_counter`, `auth_slot_types`, `verified`.
  2. Apply the Privacy Decision section exactly, and add `test_manifest_contains_no_user_content` seeded with a journal carrying a name, tags, and entry titles. Note that `auth_slot_types` records **types only** — slot labels are user-chosen and must not appear.
  3. Populate descriptive fields without needing a key, using plaintext columns and `db::peek_auth_slot_types` (`db/peek.rs:53`), so adopted and unverified snapshots are still fully described (Assumption 5).
  4. Write atomically (temp + rename) and tolerate a missing or corrupt manifest by rebuilding it from a directory scan.
  5. Update `commands/debug.rs` to read backup counts from the manifest, and drop the deprecated `MAX_BACKUPS` alias from Task 1.2.
- Validation: `cargo test --workspace` green including `test_manifest_contains_no_user_content` and `test_corrupt_manifest_is_rebuilt_from_disk`.
- Notes: **This task must land before Task 1.5**, because deduplication reads `sqlite_change_counter` from here and cannot recover it from a snapshot file. The manifest is also the core↔consumer interchange point; document its shape in `crates/mini-diarium-core/API.md`.

#### Task 1.4: Replace the write primitive with `VACUUM INTO` + atomic rename + verification

- Status: COMPLETED
- Objective: Make a snapshot that exists on disk provably openable, and make a partial write impossible to mistake for a backup (findings B-8, B-10, B-12).
- Steps:
  1. Add a `SnapshotStore::write` implementation that takes `&DatabaseConnection` — **not** a bare `rusqlite::Connection`, because `DatabaseConnection::conn()` is `pub(crate)` (`db/schema/mod.rs:29`) and never leaves the core crate — and executes `VACUUM INTO '<tmp path>'` through it, writing to `snapshot-<name>.tmp` in the backups directory.
  2. `fsync` the temp file and its parent directory, then `rename` to the final name.
  3. Change the filename format from `%Y-%m-%d-%Hh%M` to second resolution, keeping lexicographic order equal to chronological order, and keeping the `backup-` prefix and `.db` suffix so pre-upgrade files still match.
  4. After rename, open the result read-only and verify: valid SQLite file, `schema_version` reads, and the master key unwraps an auth slot. On failure, delete the file and return `Err`.
  5. Ensure any `*.tmp` file is cleaned up on the error path and that `*.tmp` never matches the listing filter.
- Validation: New tests `test_snapshot_write_is_atomic_on_failure`, `test_snapshot_is_verified_after_write`, `test_two_snapshots_in_the_same_minute_are_distinct`. Confirm with a fault-injected write that no `backup-*.db` file remains.
- Notes: `VACUUM INTO` fails if the target exists, so temp-name-then-rename is required, not optional. rusqlite 0.40 with `bundled` is well past the SQLite 3.27 floor for `VACUUM INTO`. `docs/KNOWN_ISSUES.md` KI-9 is updated in Task 2.1 once this lands.

#### Task 1.5: Tiered retention with deduplication and a storage budget

- Status: COMPLETED
- Objective: Guarantee time depth independently of unlock frequency, and stop identical snapshots from being written at all (findings B-2, B-7, B-16).
- Steps:
  1. Implement `plan_retention` per Assumption 1. The oldest tier must never be evicted by newer activity; only the newest tiers thin when the storage budget is exceeded.
  2. Add a `should_snapshot` check comparing the live database's header change counter against `sqlite_change_counter` of the newest manifest entry, plus the minimum-interval rule; skip creation entirely when the database has not been written since.
  3. Apply the storage budget after retention selection, thinning newest-tier-first, and return the outcome so the UI can surface it later.
  4. Write table-driven unit tests over `plan_retention` covering: a burst of 200 snapshots in one hour; one snapshot per day for 400 days; empty set; single snapshot; and a set where every snapshot is older than every tier window.
- Validation: `cargo test --manifest-path crates/mini-diarium-core/Cargo.toml retention` green, including `test_burst_activity_cannot_evict_the_oldest_tier` and `test_unchanged_database_produces_no_snapshot`.
- Notes: The highest-value task in the plan. `plan_retention` must remain a pure function of its inputs — no clock reads inside it; `now` is a parameter so tests are deterministic. Depends on Task 1.3.

#### Task 1.6: Move snapshot creation to before the risky write

- Status: COMPLETED
- Objective: A snapshot exists and is verified before any migration or destructive operation mutates the journal (findings B-3, B-4).
- Steps:
  1. In `crates/mini-diarium-core/src/db/schema/open.rs`, take a `Migration`-triggered snapshot before `apply_pending` when the stored schema version is behind `SCHEMA_VERSION`. Use the `backups_dir` parameter all three `open_database*` functions already accept and currently discard at `:112`, `:171`, and `:179`. The database path is in scope in each: `db_path_ref` at `:24` and `:70`, and `db_path.as_ref()` at `:132` (add a binding there).
  2. Keep an `Unlock`-triggered snapshot attempt after unlock, subject to the dedup and interval rules, so a crash-only workflow still produces snapshots.
  3. Add a `Lock` trigger on `lock_diary`, and an on-exit trigger. **The app has no window-event hook today** (Assumption 8) — add a minimal `on_window_event` handler in `src-tauri/src/lib.rs` for `CloseRequested` scoped to this trigger only.
  4. Wire `Destructive` triggers into `reset_diary` (`auth_core.rs:390`), `change_diary_directory` (`auth_directory.rs`), `remove_auth_method` (`auth_slots.rs:194`), and `run_import_plugin` (`commands/plugin.rs:29`).
  5. Preserve existing failure semantics: a failed snapshot logs and never blocks unlock. **Exception:** a failed pre-migration snapshot aborts the migration and surfaces an error, because proceeding is the unrecoverable case.
- Validation: New tests `test_migration_snapshot_exists_before_apply_pending` (seed a v12 database, open it, assert a snapshot exists whose schema version reads 12) and `test_failed_pre_migration_snapshot_aborts_migration`. Full `cargo test --workspace` green.
- Notes: Step 5's exception is a deliberate behavior change from "backups never block", approved as part of this plan. Step 3's on-exit trigger must not delay shutdown beyond the Task 1.8 budget.

#### Task 1.7: Adopt pre-existing backup files

- Status: COMPLETED
- Objective: Users upgrading from the current version keep their existing backup history (Assumption 5).
- Steps:
  1. On first run against a backups directory with no manifest, scan for `backup-*.db`, parse the timestamp from each filename, and build manifest entries. Accept **both** the legacy minute-resolution and the new second-resolution filename forms.
  2. Populate `entry_count`, `entry_date_range`, `db_schema_version`, and `auth_slot_types` from each snapshot without a key (Assumption 5, Task 1.3 step 3). Set `verified: false` and leave `sqlite_change_counter` unknown, which forces the next snapshot decision to err toward taking one.
  3. Feed adopted entries through `plan_retention` so an oversized legacy set thins to the new policy rather than being kept whole.
- Validation: Test `test_legacy_backups_are_adopted_into_the_manifest` — seed 30 legacy-named files, run the engine, assert all are listed with `verified: false`, populated counts, and that retention applies.
- Notes: An unknown change counter must never be treated as "equal to current" — that would silently skip the first snapshot after an upgrade.

#### Task 1.8: Keep snapshot creation off the UI thread and benchmark it

- Status: COMPLETED
- Objective: A snapshot on lock or exit must not freeze the app, and its cost must be tracked, since `VACUUM INTO` scales with journal size and image-heavy journals are hundreds of megabytes.
- Steps:
  1. Run snapshot creation on a background thread so the lock path and window close are not blocked by it; hold the necessary state safely and ensure a snapshot in flight cannot race a restore or a journal switch.
  2. Define and enforce a shutdown budget for the on-exit trigger: if the snapshot cannot finish within it, let the app exit and leave the pre-existing snapshot set intact rather than delaying shutdown.
  3. Add a criterion benchmark `backup_bench.rs` in `src-tauri/benches/` covering snapshot creation over small, medium, and image-heavy databases, registered as a `[[bench]]` in `src-tauri/Cargo.toml` alongside the existing four.
  4. Confirm the E2E lanes still pass with the new triggers, and that the clean lane (`E2E_MODE=clean`, `MINI_DIARIUM_DATA_DIR`) is not measurably slowed by per-unlock snapshotting. If it is, apply the dedup and interval rules so repeat unlocks in a test run produce at most one snapshot.
- Validation: `cargo bench --bench backup_bench` runs and reports; `cmd.exe /c bun run test:e2e` green with no significant runtime regression; a manual lock on a large journal keeps the UI responsive.
- Notes: PHILOSOPHY principle 3 requires criterion coverage on hot paths, and this makes lock a hot path. The `.e2e-stateful/` lane already contains `backups/` fixtures — check whether they need refreshing after the filename format change in Task 1.4.

---

### Milestone 2: Documentation Correction And Patch Release

- Status: COMPLETED
- Purpose: Stop publishing three different retention numbers and one false safety claim, then ship Milestones 1–2 to users as a patch release (Assumption 4).
- Exit Criteria: All six locations from finding B-15 are correct and mutually consistent; `bun run website:build-static` regenerates `website/docs/backups/` from the corrected source; a patch release is prepared per `docs/RELEASING.md`.

#### Task 2.1: Correct the six wrong or misleading documentation claims

- Status: COMPLETED
- Objective: Every published statement about backups matches the code.
- Steps:
  1. `website/index.html:570` — "keeping the last 5 automatically" → describe the tiered policy in one sentence, without a bare count.
  2. `docs/USER_GUIDE.md:341` — "50 most recent" → the new policy. `:327` — `backups/` → `backups/{db_stem}/`.
  3. `website/docs-src/09-backups.md:16` — same path correction; `:30` — same retention correction.
  4. `docs/KNOWN_ISSUES.md:89` — remove the false claim that backups are taken before any writes occur; restate KI-9 for the `VACUUM INTO` primitive from Task 1.4, or close it if Task 1.4 resolves it outright.
  5. `docs/decisions/2026-04-passwordless-journal.md:32` — correct the claim that app-created backups are self-contained; state that `config.json` lives in the app data directory and is not included (Assumption 2).
  6. `README.md:127` — restate to match.
- Validation: `rg -n "last 5|50 most recent" website/ docs/ README.md` returns nothing; the backups path appears only in its `{db_stem}` form in `docs/USER_GUIDE.md` and `website/docs-src/09-backups.md`.
- Notes: `website/docs/` is generated — edit `docs-src/` only.

#### Task 2.2: Rewrite the backups documentation page

- Status: COMPLETED
- Objective: `website/docs-src/09-backups.md` describes the new system, including what is *not* protected.
- Steps:
  1. Rewrite for the new triggers, tiered retention, dedup, verification, and storage budget.
  2. Add an honest-limits section covering: local-only journals need this device's `config.json` (Assumption 2); snapshots taken before a password change need the old password (finding B-11); removing an auth method does not revoke it in existing snapshots.
  3. Keep the front matter contract: `description` 140–160 characters, `updated` bumped.
  4. Regenerate via the PowerShell tool directly, per root `CLAUDE.md`.
- Validation: `bun run website:build-static` completes; `website/docs/backups/index.html` reflects the new text; the generated `<meta name="description">` is 140–160 characters.
- Notes: Restore procedure documentation is deliberately deferred to Task 5.4, after restore exists.

#### Task 2.3: Prepare the patch release

- Status: COMPLETED
- Objective: Milestones 1–2 reach users without waiting for the UI work.
- Steps:
  1. Add a `CHANGELOG.md` entry under the current unreleased section covering the retention change, the pre-migration snapshot, verified atomic writes, dedup, and the documentation corrections.
  2. Follow `docs/RELEASING.md` and the `pre-release` runbook. Propose the version bump and commit message to the maintainer.
- Validation: `cmd.exe /c bun run pre-commit` green; changelog entry present and accurate.
- Notes: Releases are immutable and commits are the maintainer's — prepare, do not publish, and do not run `git commit`.

---

### Milestone 3: IPC Surface And The Backups Panel

- Status: COMPLETED (Linux half of `PLATFORM-VERIFY` carved out to [TODO-0101](todo/TODO.md), tracked independently — see Task 3.4 and the note below)
- Purpose: Make backups visible. Read-only functionality only; nothing here can modify a journal.
- Exit Criteria: A user can see every snapshot with its date, trigger, entry count, size, and health from Preferences → Backups and from the unlock screen; a snapshot that failed to write is visibly distinguished; `bun run test:run`, `type-check`, `lint`, and `validate:locales` all green; `PLATFORM-VERIFY` for reveal-in-folder completed on Windows **and one Linux desktop, the latter carved out to [TODO-0101](todo/TODO.md) 2026-08-16 rather than left blocking this plan indefinitely** — every other exit criterion is met, Windows verification passed (Task 3.4), and the maintainer's explicit decision was to split the Linux-only check into its own tracked TODO and close this plan rather than hold the whole redesign open on a check that needs a machine this session does not have.

#### Task 3.1: `backup` Tauri command group

- Status: COMPLETED
- Objective: A typed IPC surface exists where none did (finding B-1).
- Steps:
  1. Add `src-tauri/src/commands/backup.rs` with `list_backups`, `get_backup_health`, `create_backup_now`, `verify_backup`, `delete_backup`, `reveal_backups_folder`.
  2. Add `list_backups_unauthenticated` for the pre-auth view — manifest read only, no database open, no key required.
  3. Register all of them in `generate_handler!` in `src-tauri/src/lib.rs`.
  4. Add `src/lib/tauri/backup.ts` with typed wrappers, re-exported from the barrel `index.ts`, plus `backup.test.ts` following the sibling wrapper tests.
  5. Add the `backup` group name to the Command Registry paragraph in the root `CLAUDE.md` (required by its docs-maintenance trigger).
- Validation: `cargo test --workspace`, `cmd.exe /c bun run type-check`, and `cmd.exe /c bun run test:run` green; `rg "commands::backup::" src-tauri/src/lib.rs` shows every command registered.
- Notes: Commands validate IPC input and frontend errors go through `mapTauriError()`, per the root `CLAUDE.md` IPC contract. `reveal_backups_folder` uses `revealItemInDir` from `@tauri-apps/plugin-opener`, already permitted (Assumption 7) — do not add a capability entry.

#### Task 3.2: Preferences → Backups tab

- Status: COMPLETED
- Objective: The list, health indicator, and manual snapshot action are reachable in the normal case.
- Steps:
  1. Add `src/components/overlays/preferences/PreferencesBackupsTab.tsx` following existing tab conventions (`TabProps` from `shared.ts`, `pref-panel-backups` / `pref-tab-backups` ids).
  2. Wire it into `PreferencesOverlay.tsx`: add the id to the `Tab` union and to the `tabs` array that drives arrow-key navigation (`PreferencesOverlay.tsx:20,66-74`), plus the tab button and panel.
  3. Render the snapshot list (date, relative age, trigger, entry count, size, verified state), a last-backup-succeeded indicator, a total-size line showing the budget, and buttons for Back up now / Verify / Reveal in folder / Delete.
  4. Add the local-only notice from Assumption 2 (scenario UX-7).
  5. Add i18n keys to `src/i18n/locales/en.ts` and all six JSON locales (`de`, `es`, `fr`, `hi`, `it`, `pt-BR`).
  6. Add `PreferencesBackupsTab.test.tsx` covering: empty state, populated list, failed-health state, and the local-only notice.
  7. Record any new `data-testid` values in the canonical table in `src/CLAUDE.md`.
- Validation: `cmd.exe /c bun run test:run`, `type-check`, `lint`, and `cmd.exe /c bun run validate:locales` all green.
- Notes: Per project memory, use `waitFor(() => getByText(...))` rather than `screen.findByText` after awaited SolidJS state mutations. The panel shows the **active** journal's backups; each journal has its own directory.

#### Task 3.3: Pre-auth backups view from the unlock screen

- Status: COMPLETED
- Objective: The panel is reachable in the case that needs it most — the journal will not open (finding B-1, Assumption 6).
- Steps:
  1. Add an entry point on the unlock screen that opens the Backups panel in reduced mode, backed by `list_backups_unauthenticated`.
  2. Reduced mode shows dates, sizes, triggers, and health only; every action requiring a key is disabled with an explanatory label.
  3. Factor the affordance so TODO-0094 can adopt it for the locked-journal debug dump.
- Validation: Component test asserting the reduced view renders with no unlocked journal and that key-requiring actions are disabled. Manual check in the dev app via the `tauri-agent-dev` skill.
- Notes: The pre-auth payload must pass the same privacy gate as Task 1.3's manifest test.
- Manual check (2026-08-06, Windows dev app): **Pass.** Against a genuinely locked journal — locked by the focus-loss auto-lock during Task 3.4's baseline check, not by a test hook — the unlock screen's **View backups** opened the panel and listed the snapshot in full: date, relative age, `Manual · 1 entry · 88 KB`, its entry date range, and `Checked`. Back up now, Check, and Delete were all disabled with "Unlock this journal to create, check, or delete backups."; Open backups folder stayed enabled. Health read "Backups are working." with the last-backup time and `1 backup Using 88 KB of 2.0 GB.`

#### Task 3.4: `PLATFORM-VERIFY` — reveal-in-folder across platforms

- Status: BLOCKED — Windows verified; **Linux verification outstanding** and cannot be done from this machine. Split off into [TODO-0101](todo/TODO.md) 2026-08-16 so it can be tracked and closed independently rather than leaving this plan file open indefinitely on a check only a maintainer with a Linux desktop can perform. Milestone 3 stays open on TODO-0101, not on this plan.
- Objective: The one OS/WebView handoff in this milestone behaves on every supported platform.
- Steps:
  1. Verify Reveal in folder opens the correct directory on Windows and on one Linux desktop (Wayland preferred, given the recent `tao` title-bar issue).
  2. Confirm it does not open a WebView window, does not navigate the app, and does not trigger focus-loss auto-lock in a surprising way — `src/lib/focus-lock.ts` locks on OS focus loss by default.
  3. Record the outcome, including any auto-lock interaction, in this task's notes.
- Validation: Manual verification on both platforms, results recorded in this plan file.
- Notes: If revealing the folder triggers focus-loss auto-lock, treat it as a defect and fix it here; the dialog-guard pattern in `src/lib/dialog.ts` is the precedent (root `CLAUDE.md` gotcha 4).

##### Windows result (2026-08-06, dev app via `tauri-agent-dev`)

**Pass.** Clicking **Open backups folder** opened Explorer at
`…/.agent-dev/sandbox/data/backups/diary` — the active journal's own backups directory,
confirmed by enumerating open Explorer windows. No WebView window was created, the app did
not navigate (`location.href` unchanged), and Preferences stayed open on the Backups tab.

**Auto-lock interaction — partially verified, and the limit matters.** With
`autoLockOnFocusLoss` **on** (confirmed checked in Preferences → Security, not merely written
to `localStorage`), revealing the folder did **not** lock the journal. The mechanism itself
was proven live in the same session: activating an unrelated Notepad window locked the
journal and closed Preferences within the 3 s debounce, exactly as designed.

The caveat is that the reveal was driven by a CDP-synthesized click, which Windows does not
treat as user input. Windows foreground-activation rules therefore blocked Explorer from
taking the foreground, so no `window-unfocused` event fired. **Under a real mouse click,
Windows will generally let Explorer take the foreground and the focus-loss lock will fire
after its debounce.** That path is not verified and cannot be, through this tooling.

Not treated as a defect, and no dialog-guard added:

- `autoLockOnFocusLoss` defaults to **off** (`src/state/preferences.ts:94`), so no user meets
  this unless they asked for it.
- Locking when the user leaves the app for another program is precisely what the setting
  says it does. Explorer is a genuine departure, unlike a modal file dialog that is one step
  of an in-app flow — which is the case `src/lib/dialog.ts` exists to guard.
- The precedent already ships: **Preferences → Advanced → See User Guide** calls `openUrl` to
  the external docs site with no guard, and behaves the same way.
- A naive grace window would be worse than the current behavior: `window-unfocused` fires
  once, so suppressing that single event would leave the journal unlocked for as long as the
  user stayed in Explorer — the opposite of what the setting promises.

##### Linux result

Run 2026-08-16 in a later session, on a different (native Linux, not WSL-over-Windows)
machine — see [TODO-0101](todo/TODO.md) for the full result, which is where it's recorded
per this task's own acceptance line since this plan file was already `COMPLETED` by then.
Summary: **Pass on both checks.** Correct directory confirmed via a `dbus-monitor` capture
of the `org.freedesktop.FileManager1.ShowItems` D-Bus call. The journal did lock a few
seconds after a real click opened Nautilus (with `autoLockOnFocusLoss` on) — judged **not a
defect**, for the same reason already recorded above for Windows Explorer: leaving the app
for an independent external program is a genuine departure, which is what the setting
promises, unlike the app's own transient modal dialogs that `src/lib/dialog.ts` guards. No
code change made.

---

### Milestone 4: Restore

- Status: COMPLETED
- Purpose: Deliver the capability whose absence made the incident recovery manual: getting data back out of a snapshot, in-app, without writing plaintext to disk.
- Exit Criteria: All seven UX-GATE scenarios signed off; a whole-journal restore and a per-entry restore both demonstrated end-to-end against a snapshot the app produced itself; no code path in the restore flow writes decrypted content to the filesystem; an E2E scenario covers the round trip.
- Note (2026-08-16): Task 4.4's E2E spec is CI-green (run `31909824100`, PR #254), demonstrating the **per-entry** restore path end-to-end against a real snapshot. The remaining exit criterion — a whole-journal restore demonstrated end-to-end — was deliberately deferred to Task 6.3 step 2's combined rehearsal, which ran 2026-08-16 and passed cleanly on both whole-journal and per-entry restore with no defects found (see Task 6.3's implementation notes). All exit criteria are now met and this milestone closes.

#### Task 4.1: Read-only snapshot inspection

- Status: COMPLETED
- Objective: A snapshot can be opened and browsed without registering it as a journal (finding B-6).
- Steps:
  1. Add core support for opening a snapshot read-only with a supplied credential, held separately from the live `DiaryState` connection and never written to `config.json`.
  2. Add `open_backup_readonly` / `list_backup_entries` / `close_backup` commands returning only `{ id, date, title, preview }`, mirroring the timeline's existing minimal-IPC shape.
  3. Handle the different-credential case (finding B-11): detect that the snapshot's auth slots differ from the live journal's and surface scenario UX-3's message before the credential prompt.
  4. Ensure the inspection connection is closed and its key zeroized on panel close, journal lock, app exit, and journal switch.
- Validation: Tests `test_inspect_does_not_register_a_journal` (assert `config.json` unchanged), `test_inspect_connection_is_dropped_on_lock`, and a test that a snapshot predating a password change is detected as needing the old credential.
- Notes: Two open connections with two different keys is the sharpest security edge in this plan. Review against the `security-stance` skill before implementation, particularly the auto-lock paths in root `CLAUDE.md` gotcha 4 — all three must tear down the inspection connection.
- Implemented 2026-08-09. `crates/mini-diarium-core/src/backup/inspect.rs` (9 tests) + `src-tauri/src/commands/backup_inspect.rs` (5 tests) + typed wrappers in `src/lib/tauri/backup.ts` (7 tests). No UI — Tasks 4.2/4.3 own that and are gated. Four deviations, recorded in the Milestone 4 implementation record below: the teardown lives in `DiaryState`, the entry query is schema-adaptive, credential drift is detected by comparing plaintext slot bytes, and a fourth command (`check_backup_credentials`) was added for UX-3.

#### Task 4.2: Whole-journal restore

- Status: COMPLETED
- Objective: Roll the journal back to a snapshot, reversibly.
- Steps:
  1. Take a `PreRestore` safety snapshot of the current state and verify it. Abort the restore if it fails.
  2. Lock the journal, close the live connection — waiting for the handle to actually release via `LockCompletion::AwaitFileRelease` (Milestone 1, Task 1.6 deviation 4; do not assume close is synchronous, this is the same Windows `os error 32` hazard) — then copy the snapshot file to a temp name inside the journal directory, fsync it, and atomically rename it over `diary.db`. Reopen and re-run `apply_pending`, since the snapshot's schema version may be older than the live one.
  3. Surface scenario UX-2's confirmation, a disabled `Restoring…` busy state on the confirm button while step 2 runs (same pattern as `backingUp`/`verifying` in `BackupsPanel.tsx`), and the success message naming the safety snapshot.
  4. On any failure after the file swap begins, restore from the safety snapshot and report clearly.
- Validation: Tests `test_restore_takes_a_verified_safety_snapshot_first` and `test_failed_restore_rolls_back_to_the_safety_snapshot`. Manual end-to-end run in the dev app.
- Notes: UX-2 and UX-3 signed off 2026-08-10 against a rendered prototype (see the UX Gate Sign-off Record) — this task may start. Restoring an older snapshot may downgrade the schema version, which `apply_pending` then re-migrates — the pre-migration snapshot from Task 1.6 covers that path, so verify the two interact correctly. **Correction (Milestone A / Finding 1, 2026-08-16):** the two *do* produce two snapshots for one action, deliberately — see the Milestone A implementation record below. `reopen_current`'s post-swap reopen routes through the same `migrate_with_pre_migration_snapshot` every normal-open path uses, so a just-restored, pre-migration target gets its own verified snapshot before the migration rewrites it, rather than relying solely on the `PreRestore` safety snapshot of the *previous* live content (which cannot recover the target if the migration then fails).
- Implemented 2026-08-11. `crates/mini-diarium-core/src/backup/restore.rs` (7 tests) + two new primitives in `store.rs` (`stage_restore_copy`, `finalize_restore`, 3 tests) + `restore_backup`/`restore_backup_inner` in `src-tauri/src/commands/backup.rs` (4 tests) + `restoreBackup` in `src/lib/tauri/backup.ts` + a Restore button, confirm, busy state, and success message in `BackupsPanel.tsx`. Manual dev-app rehearsal deferred to Task 6.3 step 2, which exercises this alongside per-entry restore (Task 4.3). Deviations recorded in the Milestone 4 implementation record below.

#### Task 4.3: Per-entry restore

- Status: COMPLETED
- Objective: Recover individual entries from a snapshot with no plaintext leaving the process (finding B-5).
- Steps:
  1. Add a two-pane view listing the snapshot's entries beside the live journal's, flagging entries missing from, or shorter in, the live journal.
  2. Add a `restore_entries_from_backup` command taking snapshot entry ids and copying decrypted content directly into the live journal in-process, re-encrypting with the live master key. Never serialize plaintext to disk, and never send more than the existing preview fields across IPC.
  3. Restore tags where the snapshot has them — this path is not constrained by the lossy JSON export format that drops them (finding B-5).
  4. Never overwrite: a restored entry is added alongside existing entries on that date (scenario UX-5), reusing `insert_entry_with_images` so image references are normalized correctly.
- Validation: Tests `test_restored_entry_is_added_not_overwritten`, `test_restore_entries_preserves_tags`, `test_restore_entries_writes_no_plaintext_to_disk` (assert no new files appear in temp or the journal directory during the operation). Manual end-to-end run.
- Notes: UX-4 and UX-5 signed off 2026-08-10 against a rendered prototype (see the UX Gate Sign-off Record) — this task may start. The assessment's highest-value single feature.
- Implemented 2026-08-11. `crates/mini-diarium-core/src/backup/restore_entries.rs` (6 new tests) + two new commands (`list_backup_entries_with_status`, `restore_entries_from_backup`) in `src-tauri/src/commands/backup_inspect.rs` (6 new tests) + typed wrappers in `src/lib/tauri/backup.ts` (3 new tests) + a new `src/components/backups/BackupInspectDialog.tsx` (8 tests, new file) wired into `BackupsPanel.tsx` via a per-row "Restore entries…" button, unlocked-mode only (3 new tests in `BackupsPanel.test.tsx` covering the wiring itself, added during this self-check after the coverage report flagged that render path as untested). i18n keys added to `en.ts` and all six locale JSONs. Manually verified end-to-end in the dev app (create entry → snapshot → delete entry → restore via the new dialog → confirm data back); see the deviation table for a bug the manual run caught and a UI staleness bug it caught and led to a fix.

### Deviations from the plan as written

| # | Plan said | What shipped, and why |
|---|---|---|
| 1 | Step 1: "a two-pane view listing the snapshot's entries beside the live journal's." | Shipped as **one** list with a per-entry status badge (`Missing` / `Shorter in your journal` / `Already in your journal`), not a literal second pane of live-journal content. The signed-off UX-4 requirements — flags, explicit selection, a result stating how many were added and that nothing was overwritten — are all satisfied by the badges; there was no visibility into the rendered prototype the maintainer signed off against, so a genuine second pane was not attempted speculatively. Flagged here for the maintainer to accept or reject against that prototype, the same way Tasks 4.1 and 4.2 recorded their own UI deviations. |
| 2 | Step 1's matching implied identity between a snapshot entry and its live counterpart. | Entry ids are **not** stable across databases — each database assigns its own AUTOINCREMENT sequence — so there is no id to match on. Matching is **date + title** (falling back to "another blank-titled live entry on the same date" when the title is itself blank), confirmed with the maintainer via `AskUserQuestion` before implementation over the alternative (date-only, which cannot distinguish two different entries on the same date). `word_count` — already an unencrypted column — stands in for "how much content survived" in the `ShorterInLive` comparison, avoiding extra decryption. |
| 3 | Step 4: "reusing `insert_entry_with_images` so image references are normalized correctly," with no mention of *how*. | `insert_entry_with_images` alone is not sufficient across databases: it validates an existing `image-id://N` ref against the **target** database's `images` table, so a ref copied verbatim from the snapshot either drops silently (id not found) or — worse — attaches to an unrelated live image that happens to share the id. Fixed by resolving `image-id://` refs back to `data:` URIs against the **snapshot** connection (`resolve_image_refs_in_entries`, the same helper every export path already uses) before the text ever reaches `insert_entry_with_images` against the live connection, which then re-extracts and stores fresh image rows there. Entirely in memory. Pinned by `test_restore_entries_resolves_image_refs_across_databases`, which deliberately keeps an unrelated live image alive through the operation and asserts the restored entry links to neither its id nor its bytes. |
| 4 | Nothing about reading a *full* entry (not just the preview) out of an older-schema snapshot. | `list_snapshot_entries` (Task 4.1) is preview-only by design and schema-adaptive; restoring needs the full `title`/`text`. Added `read_full_snapshot_entry`, adaptive the same way (`entry_metadata_encrypted`, v9+, defaults to `None` when absent) — the most valuable snapshot is the pre-migration one, which by definition lacks the newest columns. A restored entry's `locked` flag is always `false` regardless of the snapshot's own value: it is a plaintext "protect from accidental edits" marker the user sets deliberately, not something a recovery action should reintroduce as a surprise. |
| 5 | Test name `test_restore_entries_writes_no_plaintext_to_disk` implying "no new files appear." | As anticipated by the plan's own Task 1.1 fallback reasoning, this would be false even for a correct implementation — SQLite writes rollback-journal files during the insert transaction. The test instead scans every file that *does* appear for the plaintext title/body bytes, the same content-scan pattern `test_backups_directory_never_contains_key_material` (Task 5.3) uses. |
| 6 | Nothing about local-only (passwordless) journals reaching this feature. | **Caught by the manual dev-app rehearsal, not by the test suite.** The credential form built from the `PasswordPrompt.tsx` pattern had exactly two modes, password and key file — an auto-key journal's user would see a password field with nothing to type into it, and every submission would error. `openBackupReadonly(fileName)` with **neither** argument is the only way to reach `SnapshotCredential::AutoKey` on the backend (already proven by `test_inspect_opens_a_local_only_snapshot_with_the_device_key` in core); nothing in the dialog's own code path could produce that call. Fixed with an `autoProtected` prop (`BackupsPanel.tsx` already computes `isAutoProtected()` for the existing UX-7 notice) that swaps the credential form for a single "View entries" button calling `openBackupReadonly(fileName)` with no credential. Pinned by `BackupInspectDialog.test.tsx`'s "opens a local-only journal with no credential form at all". |
| 7 | Nothing about the currently open editor after a per-entry restore. | **Also caught only by the manual rehearsal**, after the fix above: restoring an entry onto the date already open in the editor left the editor showing its pre-restore state (calendar updated immediately; the open editor did not) until the user navigated away and back. Unlike whole-journal restore, per-entry restore does not call `executeReloadCallbacks()` unconditionally — that cancels any in-flight debounced save on whatever entry happens to be open, a real cost when nothing about that entry actually changed. Fixed narrowly: the restored entries' dates are captured before the IPC call, and `executeReloadCallbacks()` runs only when one of them equals `selectedDate()`. Pinned by two tests — one proving the reload fires when the date matches, one proving it does not fire (and would not discard an unrelated in-flight save) when it doesn't. |

### A defect found in manual testing, and fixed

The dev-app rehearsal (create entry → snapshot → delete entry → open the new dialog → restore) proved the underlying data path correct on the first pass — the restored title and body matched the original exactly. It also surfaced deviations 6 and 7 above, neither of which any of the 23 automated tests written before that point (6 core + 6 command + 3 wrapper + 8 component) had a way to catch: deviation 6 because every test opened the dialog with a password already in scope, and deviation 7 because component tests mock the Tauri layer and never exercise the currently-open editor's own stale-data window. Both are now covered by dedicated tests alongside the fixes, and a further self-check afterward added 3 tests to `BackupsPanel.test.tsx` for the entry-point wiring itself (button visibility, the `autoProtected` prop, and the open/close round trip), which the coverage report had flagged as untested but no automated test caught.

#### Task 4.4: E2E coverage for the restore round trip

- Status: COMPLETED
- Objective: The critical recovery flow is covered end-to-end against the real binary.
- Steps:
  1. Add a WebdriverIO scenario: create entries, take a manual snapshot, delete an entry, restore it from the snapshot, assert it is back.
  2. Follow `e2e/CLAUDE.md` conventions, including `typeText()` (`e2e/specs/helpers.ts:128`) for seeded text per gotcha 5.
- Validation: `cmd.exe /c bun run test:e2e` green locally and, after the `textContent`-vs-`getText()` fix, in CI — GitHub Actions run [`31909824100`](https://github.com/fjrevoredo/mini-diarium/actions/runs/31909824100) on PR #254 (commit `8f68b2c7`), Linux/WebKitGTK, green.
- Notes: E2E runs on Linux/WebKitGTK in CI; keep the scenario free of platform-specific file-manager interaction.
- Implemented 2026-08-15. New `e2e/specs/backup-restore.spec.ts`: writes an entry on a previous-month date, opens Preferences → Backups, takes a manual snapshot (`SnapshotTrigger::Manual` always bypasses the dedup/interval rules, so the newest row is deterministically the one just taken), deletes the entry via the same debounced auto-delete `multi-entry.spec.ts` already exercises (clearing title + body, not the entry nav bar's trash button, which is gated behind a native OS confirm dialog outside WebDriver's reach), reopens the panel, opens the snapshot via `BackupInspectDialog` with the journal password, confirms the entry shows `backup-inspect-status-missing`, restores it, and confirms the title and body are back in the live editor. `cmd.exe /c bun run test:e2e` green (6 spec files, 12 tests, including this one) both in isolation and as part of the full local suite; CI (Linux/WebKitGTK) coverage pending the next push. `typeText()` was not needed: `ENTRY_BODY` contains no doubled letters, so plain `browser.keys()` already satisfies gotcha 5's actual requirement. (The restore step originally used "Select all missing or shorter" → "Restore selected"; the same-day review's Finding 2 replaced that with selecting only the row matching this test's own title and date — see "Review findings addressed" below.)

### Defect found writing this task's E2E test, and fixed

Deleting the entry via `.setValue('')` on both the title and body looked correct at every layer this session's own checks could see — WDIO's `.getValue()`/`.getText()` read back empty, and a manual dev-app rehearsal via `agent-browser` (a CDP-based driver, not WebDriver) deleted and restored the same entry successfully — yet the automated WDIO spec kept timing out waiting for the restored entry to show `backup-inspect-status-missing`; it showed `backup-inspect-status-shorter_in_live` instead, meaning the live journal still held a shortened copy of the entry. The app's own write-audit log (`useEntryPersistence.ts` `logWrite`, gated at `info` specifically so it survives into production per root `CLAUDE.md` gotcha 10) narrowed it in one line: `write op=saveEntry ... titleLen=24 ... isEmpty=true` — `titleLen=24` is exactly `"Backup Restore E2E Entry".length`, meaning a debounced save reached the backend with the **original, pre-clear** title still attached, so `shouldDelete`'s `currentTitle.trim() === ''` check never saw a blank title and the write silently became a save instead of a delete. The exact mechanism was not fully isolated — the clearest confirmed fact is that clearing with `.setValue('')` is not reliable for this purpose on this WebView2/msedgedriver setup, not that `setValue()` is broken generally (a non-empty `setValue()` earlier in the very same spec persists correctly). Fixed by clearing both fields with real keystrokes instead of `setValue('')`, and *not* with a single `browser.keys()` call carrying an array of repeated `Backspace` presses either — that construct is exactly the shape `e2e/CLAUDE.md` gotcha 5 already warns can silently drop keystrokes on WebKitGTK (one Actions tick, every `keyDown` queued before any `keyUp`), just for `Backspace` instead of a typed letter, and a dropped Backspace would reproduce this same "stale title" failure on CI. The plain `<input>` title is cleared with `Ctrl+A` then one `Backspace` (two distinct keystrokes, not a repeated key, so the hazard doesn't apply); the contenteditable body is cleared with one `Backspace` per character in a loop, the same "one `browser.keys()` call per keystroke" discipline `typeText()` already uses for insertion. Recorded as `e2e/CLAUDE.md` gotcha 6. Also fixed along the way: the `tauri-agent-dev` skill's dev sandbox crashed vite's file watcher with `EBUSY` on WebView2's locked `Cookies` file, because `.agent-dev/sandbox/webview/` lives under the repo root and `vite.config.ts`'s `server.watch.ignored` only excluded `src-tauri/`; added `**/.agent-dev/**` alongside it.

### Review findings addressed (2026-08-15)

A same-day review of the new spec found three P2 issues, all now fixed in `e2e/specs/backup-restore.spec.ts`:

1. **Stateful reruns failed.** The delete step backspaced a fixed `ENTRY_BODY.length`, which only strips the newly-typed copy on a stateful-lane rerun where the date's editor already holds a previous run's content — so the entry never reaches empty and auto-delete never fires. Fixed: the delete step now reads `editor.getText()` into `currentBody` right before clearing, and backspaces `currentBody.length` times.
2. **The restore assertion wasn't scoped to the target entry.** It used a dialog-wide `[data-testid="backup-inspect-status-missing"]` selector and the "select all missing or shorter" button instead of targeting this test's own row, which a snapshot holding other entries could match incorrectly. Fixed: a `findTargetRows()` helper scans `[data-testid="backup-inspect-entry-item"]` rows for the one whose text contains both `ENTRY_TITLE` and `RESTORE_DATE`; the wait polls that helper until exactly one match shows the missing status, and the restore step asserts `targetRows.length === 1` (failing loudly rather than silently restoring the wrong entry) before clicking that row's own checkbox.
3. **Task 4.4 was marked `COMPLETED` while its own validation line requires CI green, and CI had not run.** Fixed: status reverted to `IN PROGRESS` (see the task's own status line above and Milestone 4's status line) — stays that way until an actual CI (Linux/WebKitGTK) run confirms the fixed spec green there.

Verifying fix 1 surfaced a **second, related defect** the review itself had not flagged: the *write* step (`editor.click()` then `browser.keys(ENTRY_BODY)`) had no pre-clear either. On a fresh stateful root, a first run was clean, but a second consecutive run reproducibly corrupted the body — `click()` does not guarantee the cursor lands at the end of existing text, so typing spliced `ENTRY_BODY` into the middle of the previous run's restored content (e.g. `"...trip wo" + ENTRY_BODY + "rks end to end."`) instead of replacing it. This went undetected by the test's own final assertion, which used `.includes(ENTRY_BODY)` — a substring check that still passes when the reference string is embedded inside corrupted, duplicated text. Fixed the same way: the write step now measures and clears any pre-existing body content before typing, and the final assertion was tightened from `.includes()` to `.trim() === ENTRY_BODY` — exact match, tolerant only of a leading/trailing whitespace difference between platforms (WebKitGTK on CI vs. msedgedriver locally), so an equivalent interior-splice corruption can't hide behind a substring match again.

All fixes verified locally: `npx tsc --noEmit -p e2e/tsconfig.json` clean (`WebdriverIO.Element[]` needed an explicit type annotation in the new helper — a plain `.map`/`.filter` chain over `$$()`'s resolved array did not infer cleanly); the spec passed twice in clean mode; twice in stateful mode against a genuinely fresh `E2E_STATEFUL_ROOT` (the discriminating rerun that first isolated the write-step defect from a clean start); and, after the `.trim()` change, twice more against the actual, already-dirty `.e2e-stateful/` directory left over from earlier pre-fix reproduction runs — confirming the fix self-heals from real messy state, not only a clean one. The full local clean suite (6 spec files, 12 tests) passed with no regressions. `cargo test --workspace` and the frontend Vitest suite were not re-run for this remediation, since it touched only `e2e/specs/backup-restore.spec.ts` and documentation. CI has not run these fixes yet — that remains the one open item.

### CI run #1 failed and was diagnosed (2026-08-15)

Commit `b489371c` (the spec plus the three review fixes above) ran on GitHub Actions
(Linux/WebKitGTK, PR #254, run `31897712681`). `Lint`, `Test`, and both `Build` jobs passed;
`E2E Tests` failed in clean mode with:

```
1) Backup restore round trip restores a deleted entry from a manually created snapshot
Error: Row for "Backup Restore E2E Entry" on 2026-07-20 did not show as missing within 20s
    at async Context.<anonymous> (e2e/specs/backup-restore.spec.ts:201:5)
```

Every other spec in the same run passed, and this was the suite's first CI execution — not a
regression, a bug the local Windows/WebView2 runs never exercised.

**Root cause.** `BackupInspectDialog.tsx`'s `loadEntries()` (line 123) fetches the snapshot's
entry list exactly **once**, immediately after `openBackupReadonly` resolves — there is no
polling and no re-fetch. That makes the spec's 20 s `browser.waitUntil` at line 201 decorative:
it re-reads the same static DOM up to 20 s straight, so a timeout there is deterministic, not
flaky, and re-running the same commit would not have helped. Two candidates were ruled out
before the real one: (a) a race between the debounced delete and opening the snapshot — ruled
out by reading `useEntryPersistence.ts:206-216`, which `await`s `deleteEntryIfEmpty` and a
fresh `getAllEntryDates()` *before* `setEntryDates` ever runs, so the calendar's "has entry"
check the test relies on at line 145 cannot pass before the backend delete is confirmed; (b) a
re-render loop destroying and recreating rows during the wait — ruled out by the failed run's
own timestamps, where the "stale element reference" noise in the log clustered at the *start*
of the spec (`waitForClickable`/`waitForDisplayed` polling on earlier steps), four minutes
before the line-201 failure, not during it.

What actually explains a deterministic Linux-fails/Windows-passes split with no timing
involved: `findTargetRows()` matched via `row.getText()`, and both the entry title `<span>`
and the preview `<p>` (`BackupInspectDialog.tsx:468-473`) carry Tailwind `truncate`
(`overflow:hidden` + `text-overflow:ellipsis`). WebDriver's `getText()` is specified to return
*rendered* text, and WebKitWebDriver (CI) and msedgedriver (local) are not guaranteed to
compute that identically for a clipped box at the dialog's rendered width — so the exact same
DOM could satisfy `text.includes(ENTRY_TITLE)` under one engine and not the other.

**Fix**, in `e2e/specs/backup-restore.spec.ts`: `findTargetRows()` now reads each row via
`browser.execute((el) => el.textContent ?? '', row)` instead of `row.getText()` —
`textContent` is unaffected by CSS truncation on either engine, so the match no longer depends
on rendered-text quirks. The line-201 wait is also now wrapped in a `try`/`catch` that, only on
timeout, dumps diagnostic state (row count, each row's own text and status badge, the
empty-state flag, and any `role="alert"` text) into the thrown error — so if this still fails
on the next CI run, the failure is self-diagnosing from one log instead of costing another
round-trip of guessing, per the same reasoning Task 1.1's fallback already applies to the
change-counter assumption.

Verified locally: `npx tsc --noEmit -p e2e/tsconfig.json` clean; full local suite green in
both clean mode and stateful mode (rerun against the already-populated `.e2e-stateful/`
directory, so a genuine persisted-state rerun, not a fresh root) — 6 spec files, 12 tests, no
regressions. `bunx prettier --check e2e/specs/backup-restore.spec.ts` clean. Not yet confirmed
on CI — that is the one open item before Task 4.4 can close.

### Next steps for a new session

This plan is COMPLETED as of 2026-08-16 (see the Metadata line). Nothing in this plan requires further action from a new session. For context on what shipped and in what order:

- Task 4.4 closed 2026-08-16: CI run [`31909824100`](https://github.com/fjrevoredo/mini-diarium/actions/runs/31909824100) on PR #254 (commit `8f68b2c7`) came back green on Linux/WebKitGTK, confirming the `textContent`-vs-`getText()` fix.
- Milestone 4's remaining exit criterion (whole-journal restore's end-to-end rehearsal) was closed by Task 6.3 step 2's combined rehearsal, 2026-08-16 — see Task 6.3's implementation notes and Milestone 4's own status line above.
- Milestone 5 (Tasks 5.1–5.4) completed 2026-08-16.
- Milestone 6 (cleanup and final verification) completed 2026-08-16, closing this plan.
- Milestone 3's Task 3.4 remains open only on its Linux half, split off into [TODO-0101](todo/TODO.md) — that TODO, not this plan file, is where a future session should pick up that one remaining check.

---

### Milestone 5: Remaining Triggers, Warnings, And Documentation

- Status: COMPLETED
- Purpose: Close the remaining Medium and Low findings and make the documented threat model honest.
- Exit Criteria: Findings B-9, B-11, B-13 closed; the backups documentation describes restore; `cargo test --workspace` and the full frontend gate green.
- Completed 2026-08-16. All four tasks (5.1–5.4) COMPLETED — see each task's own implementation note. Findings B-9 (Task 5.3), B-11 (Task 5.2), and B-13 (Task 5.1) are closed. Milestone 6 (cleanup and final verification) is the only remaining milestone besides Milestone 3's Task 3.4, still `BLOCKED` on Linux verification.

#### Task 5.1: Backups follow the journal

- Status: COMPLETED
- Objective: Moving a journal no longer silently strands its backup history (finding B-13).
- Steps:
  1. In `change_diary_directory` (`auth_directory.rs:62`), offer to move the existing backups directory alongside the database.
  2. If the user declines, state plainly in the UI that the history stays at the old location.
- Validation: Tests `test_change_directory_moves_backups_when_requested` and its declining counterpart.
- Notes: The move must be all-or-nothing or resumable; a half-moved backup set is worse than either outcome. This interacts with the `Destructive` trigger added for the same command in Task 1.6 — snapshot first, then move.
- Implemented 2026-08-16. New core module `crates/mini-diarium-core/src/backup/relocate.rs` (`relocate_backups(old_dir, new_dir)`, 6 tests — the write-permission variant of the partial-failure guard is `#[cfg(unix)]` since jsdom-equivalent Windows file-permission fault injection is not available and runs in CI on Linux; a portable sibling forces the same "source survives" invariant on every platform via a destination `create_dir_all` failure). Algorithm: reconcile both directories' manifests first (recovering each snapshot's real `trigger`/`verified`/`sqlite_change_counter` before anything is copied — the step that prevents the "silently downgraded to `Adopted`" regression), copy every snapshot with a post-copy byte-length check (skip-don't-clobber on a same-name collision — covered by its own test), merge the manifests, and only then `remove_dir_all` the source — the one irreversible step, always last. `pub mod relocate;` + `pub use relocate::relocate_backups;` in `mod.rs`, matching the existing `restore`/`inspect` pattern; documented in `API.md`.

  App crate: `move_backups: bool` threaded through `change_diary_directory_inner` → `change_diary_directory_with_auto_lock_inner` → the `#[tauri::command]`. Verified the pre-relocation ordering is race-free: the pre-move `Destructive` snapshot runs synchronously (`snapshot_blocking`) and the subsequent lock-time `Lock` snapshot is awaited via `LockCompletion::AwaitFileRelease`'s `done.recv()`, so both writers into the old backups directory have completed and dropped their connection before relocation starts.

  **A defect found in this task's own self-check, and fixed.** The plan's implementation text (and the first cut of this task) placed backup relocation immediately after the same-directory no-op check and *before* the destination file-presence match — reasoning only about "relocation itself fails → abort before the database is touched," which is correct as far as it goes. It missed the reverse case: `relocate_backups` permanently `remove_dir_all`s the source on success, so if the *subsequent* destination-collision check then found a `diary.db` already at the destination and returned `Err`, the backups had already been silently relocated into that colliding folder — and `backups_dir_slot` was left pointing at a directory that no longer existed. Fixed by moving the collision check (`current_db_path.exists() && new_db_path.exists()`) ahead of relocation, since it has no side effects and costs nothing to do first; the actual `diary.db` copy+delete still runs after relocation, unchanged. Pinned by `test_change_directory_does_not_relocate_backups_when_the_destination_already_has_a_diary`. This residual risk is not fully closed: if the *copy itself* fails after relocation has succeeded (a rare disk-I/O fault, not the common collision case), `backups_dir_slot` would still go stale — closing that would need staging the database move as well, which is out of this task's scope and no worse than the pre-existing (non-backup) partial-failure behavior of this function.

  7 existing `auth_directory.rs` tests updated for the new parameter, 3 new tests added (move-requested, move-declined, and the collision regression above).

  Frontend: `changeJournalDirectory(newDir, moveBackups)` in `auth.ts`; `PreferencesDataTab.tsx`'s `handleChangeJournalDirectory` calls `listBackups()` first, shows a confirm dialog only when snapshots exist, and shows a plain `alert()` naming the old location when the user declines (falling back to a generic phrase if `journalPath()` itself failed to load) — new file `PreferencesDataTab.test.tsx` (8 tests; this component had no test file before). 3 new i18n keys in `en.ts` + all 6 locale JSONs. Updated the now-stale "existing snapshots are not moved automatically" claim in `website/docs-src/09-backups.md` and `docs/USER_GUIDE.md`.

  **Manual dev-app check completed 2026-08-16** via `tauri-agent-dev`, against a real sandbox journal (native folder dialog driven by direct Win32 mouse-click coordinates, captured from a full desktop screenshot — CDP cannot see or drive a native OS dialog, only the WebView content). Full round trip: created a journal, wrote an entry, took a manual snapshot, opened **Data → Change Location**, picked a real empty destination folder, confirmed the real **"Move Backups Too?"** native dialog (exact text match to `moveBackupsConfirmMessage`) with OK. On disk: `diary.db` and both snapshots (the manual one plus the `Before change_diary_directory` pre-move `Destructive` snapshot the same action triggers) landed at the new location under `backups/{stem}/`, the old nested backups directory was gone, and the flat `backups/` parent was left behind empty (expected — only the nested directory is `old_dir`). The app auto-locked and reloaded to the unlock screen at the new path, exactly as designed. After unlocking there, the Backups panel showed **both snapshots with their real triggers intact** ("Before change_diary_directory" and "Manual", not downgraded to "Made by an earlier version"/`Adopted`) and both **`Checked`** — the live confirmation of the regression this task's core test (`test_relocate_backups_preserves_trigger_and_verified_fields`) guards in isolation. Also incidentally confirmed Task 5.2's required-credential hint rendering correctly against real data ("Requires: Password") on every row. The cancel path (native dialog dismissed via Escape) was also verified live: no state change, button re-enabled. Session cleaned up with `agent:dev:stop`.

  `cargo test --workspace` 745 passed, `cargo clippy --workspace --all-targets -- -D warnings` clean, `cargo fmt --all` applied, `bun run test:run` 950 passed, `type-check`/`lint`/`validate:locales` green, `coverage:diff -- --working-tree` 90%+ combined against the 80% gate (re-run after `git add -N` on the two new untracked files, which plain `git diff` otherwise cannot see at all).

#### Task 5.2: Credential-drift warnings

- Status: COMPLETED
- Objective: Users learn that snapshots keep the credential they were taken with (finding B-11), in both its usability and security forms.
- Steps:
  1. Warn on `change_password` (`auth_core.rs:350`) that existing snapshots will still require the current password.
  2. Warn on `remove_auth_method` (`auth_slots.rs:194`) that the removed method remains valid against existing snapshots, and offer to review them.
  3. Show the required-credential hint per snapshot in the Backups panel, driven by the manifest's `auth_slot_types`.
- Validation: Component tests asserting both warnings render; the manifest-driven hint covered by a unit test.
- Notes: Point 2 is a genuine threat-model disclosure, not a convenience message. `PHILOSOPHY.md`'s "Honest threat documentation" non-negotiable applies.
- Implemented 2026-08-16. No backend signature changes for any of the three pieces — `auth_slot_types` was already threaded core → manifest → frontend `SnapshotMeta`. **Point 3**: `describeRequiredCredential(authSlotTypes, t)` added to `BackupsPanel.tsx`, filtering out `auto` (already covered by the UX-7 local-only notice) and de-duping/joining the rest with a new `common.or` connector; rendered per-row (`data-testid="backups-required-credential"`) right after the existing `entry_date_range` block, gated behind `!props.reduced` the same way `entry_date_range` is — Task 3.3's reduced-mode contract is "dates, sizes, triggers, and health only," and a required-credential type is a step closer to auth-history disclosure than the plan text anticipated, so this hint is withheld from the pre-auth screen rather than defaulting to showing it; 5 unit tests including the empty-array case (pre-auth-slot v1/v2 snapshots). **Point 1**: a persistent, non-auto-dismissing notice (`data-testid="change-password-snapshot-warning"`) in `ChangePasswordForm.tsx`, gated the same way the form already is (`hasPasswordSlot()` in the parent) so it never shows for a keypair-only journal. **Point 2**: folded into the *existing* pre-removal `dialogConfirm` in `AuthMethodsList.tsx`'s `handleRemoveAuthMethod` (extended `confirmRemoveMessage` in place, rather than adding a second dialog) so the user has to accept the disclosure before the removal proceeds; a dismissible (not auto-timed) post-removal notice with an optional "Review backups" button was added, wired via a new `onReviewBackups?: () => void` prop threaded `PreferencesOverlay.tsx` (`() => setActiveTab('backups')`) → `PreferencesSecurityTab.tsx` (its own extended props interface, not a change to the shared `TabProps`) → `AuthMethodsList.tsx`. 4 new i18n keys (`prefs.security.changePasswordSnapshotWarning`, `removedMethodStillValidWarning`, `reviewBackupsButton`, `prefs.backups.requiredCredentialHint`) plus `common.or`, in `en.ts` and all 6 locale JSONs. Tests: 5 new in `BackupsPanel.test.tsx`, 1 new in `ChangePasswordForm.test.tsx`, 3 new in `AuthMethodsList.test.tsx` (post-removal notice, no-callback case, callback + dismiss). `bun run test:run` 950 passed, `type-check`/`lint`/`validate:locales` green.

#### Task 5.3: Local-only journal disclosure

- Status: COMPLETED
- Objective: Local-only users understand the limit of their backups before they need them (finding B-9, Assumption 2).
- Steps:
  1. Persistent notice in the Backups panel for auto-key journals (scenario UX-7).
  2. State the limitation in `website/docs-src/09-backups.md` and in the passwordless ADR correction from Task 2.1.
  3. Verify no code path writes `auto_key` or any wrapped key into the backups directory.
- Validation: Test `test_backups_directory_never_contains_key_material` — run a full snapshot cycle on an auto-key journal and scan every file written for the journal's `auto_key` bytes.
- Notes: The step-3 test is the durable guard for Assumption 2 and should never be deleted.
- Implemented 2026-08-16. Steps 1 and 2 shipped already, as a side effect of Milestone 3/4 UI and doc work: `BackupsPanel.tsx:292-303` renders the persistent `data-testid="backups-local-only-notice"` (i18n keys `prefs.backups.localOnlyTitle`/`localOnlyNotice`, translated into all 6 locales, tested in `BackupsPanel.test.tsx:247-266`); `website/docs-src/09-backups.md:114-122` and `docs/decisions/2026-04-passwordless-journal.md:34` both state the limitation. Only step 3 was net-new: `test_backups_directory_never_contains_key_material` in `crates/mini-diarium-core/src/backup/store.rs` (co-located with the store tests, following `test_manifest_contains_no_user_content`'s shape) creates an auto-key journal, runs two snapshot cycles, and scans every file in the backups directory (`manifest.json` plus every `backup-*.db`) for the raw 32-byte `auto_key` value as a byte subslice — not for the *absence* of key-shaped data, since the snapshot `.db` legitimately contains the wrapped master key (ciphertext) in `auth_slots`.

#### Task 5.4: Document the restore procedure

- Status: COMPLETED
- Objective: The repository finally contains a written restore procedure.
- Steps:
  1. Extend `website/docs-src/09-backups.md` with both restore paths, when to use each, and the safety-snapshot behavior.
  2. Mirror the essentials in `docs/USER_GUIDE.md`.
  3. Regenerate the site via the PowerShell tool.
- Validation: `bun run website:build-static` completes; both restore paths described; internal links resolve.
- Notes: Per root `CLAUDE.md`, `docs-src/` is the authoritative user reference — write it there first.
- Implemented 2026-08-16. Both target docs already had a full restore section, written incrementally during Milestone 4 (`## Restoring` introduced in `490380c4`, extended through `2bab6b19`): `website/docs-src/09-backups.md:90-100` covers both restore paths, when to use each, and safety-snapshot behavior, with front matter still in contract (`description` 156 characters, `updated: 2026-08-11`); `docs/USER_GUIDE.md:358-365` mirrors the essentials. Both cross-checked against the shipped UI strings (`BackupsPanel.tsx`, `BackupInspectDialog.tsx`) and confirmed accurate. No new prose was needed. Ran `bun run website:build-static` via the PowerShell tool: it completed cleanly and regenerated `website/docs/backups/` (and every other page, via the shared asset-fingerprint step) with no unrelated churn — the only file changed was `website/sitemap.xml`'s `lastmod` stamp, the one documented exception to byte-reproducibility.

---

### Milestone 6: Cleanup And Final Verification

- Status: COMPLETED
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified.
- Exit Criteria: Intermediate artifacts are removed, all final verification passes, TODO-0098 is checked off, the changelog is complete, and the plan status is COMPLETED.
- Completed 2026-08-16. All three tasks (6.1-6.3) COMPLETED. Task 6.1 found nothing to remove. Task 6.2 confirmed the changelog complete and split Task 3.4 off into TODO-0101 rather than leaving Milestone 3 open-ended. Task 6.3's pre-flight checks all passed (including a real Windows tooling bug found and fixed along the way — `scripts/check-diff-coverage.mjs`'s frontend coverage generation), and the manual recovery rehearsal — the plan's real acceptance test — passed cleanly on both whole-journal and per-entry restore with no defects found. TODO-0098 is checked off in `docs/todo/TODO.md` and the Plan Status metadata below reads COMPLETED.

#### Task 6.1: Cleanup Intermediate Artifacts

- Status: COMPLETED
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for scratch scripts, seeded backup directories, debug logging added during Milestone 1, and obsolete plan fragments.
  2. Remove the deprecated `MAX_BACKUPS` alias if Task 1.3 did not already.
  3. Confirm no new `.db` fixtures are tracked. `.gitignore` already covers `*.db` and `test_*.db` and no `.db` files under `src-tauri/` are tracked, so this is a check, not a deletion.
  4. Keep the Task 1.1 change-counter test, all retention tests, the manifest privacy test, and the key-material test — they are the contract.
- Validation: Worktree diff contains only intended final changes; `cmd.exe /c bun run check:build-paths` green; `git status --short` shows no unexpected untracked files.
- Notes: Do not remove user-provided files or unrelated worktree changes.
- Verified 2026-08-16: nothing needed removing. This was a check, not a purge, and the outcome is negative-but-confirmed rather than silently skipped. `rg "MAX_BACKUPS"`-equivalent grep over `crates/mini-diarium-core/src/backup/` returns no hits (Task 1.3 already dropped the deprecated alias). No `dbg!`/`println!`/`eprintln!` in `crates/mini-diarium-core/src/backup/` or `src-tauri/src/commands/backup*.rs`. `git status --short` clean on this branch. `git ls-files | grep '\.db$'` returns nothing — no `.db` fixtures tracked. Keep-list tests all present and unmodified: `test_vacuum_into_resets_the_change_counter` + the other change-counter tests (`store.rs`), `test_burst_activity_cannot_evict_the_oldest_tier` + `test_unchanged_database_produces_no_snapshot` (`policy.rs`), `test_manifest_contains_no_user_content` (`manifest.rs`), `test_backups_directory_never_contains_key_material` (`store.rs`). Two stale mentions of `MAX_BACKUPS` remain out of scope, as noted going into this task: `CHANGELOG.md:510` (historical, correct to leave) and `crates/mini-diarium-core/API.md:300-301` (already documents its removal, correct); `.agents/skills/security-stance/SKILL.md:98` also still references it and is stale, but touching a skill file is outside this task's scope — worth a separate follow-up, not a plan step here.
- **Note added after the fact:** the "`git status --short` clean" observation above was true at verification time. Task 6.3's pre-flight coverage check subsequently found and fixed a real bug in `scripts/check-diff-coverage.mjs` (see Task 6.3's notes), so the tree is no longer clean by the time this plan closes — that change is an intended, reviewed part of this session's work, not stray drift, and is captured in its own CHANGELOG entry.

#### Task 6.2: Close TODO-0098 and complete the changelog

- Status: COMPLETED
- Objective: The originating TODO and the changelog reflect the shipped work.
- Steps:
  1. Mark TODO-0098 `[x]` in `docs/todo/TODO.md`.
  2. Add the Milestone 3–5 changelog entry (Milestones 1–2 were covered by Task 2.3), describing the Backups panel, both restore paths, and the disclosures.
- Validation: `rg "TODO-0098" docs/todo/TODO.md` shows `[x]`; changelog entry present.
- Notes: Archival of the completed TODO is the `todo-manager` or `pre-release` skill's job, not this task's.
- Split off Task 3.4 into [TODO-0101](todo/TODO.md) 2026-08-16 (see Task 3.4's own notes) before closing this task, per the maintainer's decision on the Linux blocker.
- Changelog completeness check performed 2026-08-16 against `CHANGELOG.md`'s `## [0.7.0] - Unreleased` section (lines 37-56): every shipped Milestone 3-5 capability already has a corresponding entry — the Backups panel and unlock-screen access, failed-backup visibility, the passwordless caveat, whole-journal restore, per-entry restore, move-with-journal, credential-drift disclosures (Milestone 5), plus internal notes for the inspect groundwork (Task 4.1), the E2E round-trip coverage (Task 4.4), and the key-material test (Task 5.3). No gap found; nothing added.
- **Re-opened once, briefly.** Task 6.3's pre-flight coverage check surfaced a real bug in `scripts/check-diff-coverage.mjs` (see Task 6.3's notes and the CHANGELOG's new Internal entry). That fix is itself now a shipped change and has its own changelog entry — this task's "no gap found" conclusion above was accurate for Milestones 3-5 and remains so; the coverage-script fix is recorded separately since it belongs to Task 6.3, not to the original Milestone 3-5 feature set.
- Step 1 (marking TODO-0098 `[x]`) is deliberately deferred to after Task 6.3 passes — a checked-off TODO means "verified done," not "code complete." Completed as the last step of this plan's closeout; see the Metadata line and TODO.md for the final state.

#### Task 6.3: Final Verification

- Status: COMPLETED
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run every command in Pre-flight Checks below.
  2. Perform one full manual recovery rehearsal in the dev app: create entries, snapshot, damage the journal, recover via per-entry restore, then via whole-journal restore.
  3. Fix failures and rerun until verification passes, or record the blocker.
- Validation: All Pre-flight Checks pass and the rehearsal succeeds without any manual file manipulation outside the app.
- Notes: Step 2 is the real acceptance test for this plan. A backup system that has never been restored from is not verified.
- **A third checklist correction found running this task, beyond the two already known going in** (`bun run test:e2e` doesn't build; the stateful E2E lane fails locally on Windows for viewport reasons): **`cmd.exe /c "..."` invoked from this Codex/Claude shell's Bash tool (Git Bash/MSYS) silently no-ops.** MSYS path-conversion rewrites the literal argument `/c` into a Windows path (`C:\`) before `cmd.exe` ever sees it, so the actual command never runs — `cmd.exe` just prints its banner and exits 0. This is a **false pass**, not a crash, which is what makes it dangerous: it looks identical to a successful silent-on-success tool like `tsc --noEmit`. It was only caught here because `validate:locales` is *not* silent on success (it prints a per-locale key count) and that output was missing. The fix is `MSYS_NO_PATHCONV=1 cmd.exe /c "..."`, which every command in this task's own pre-flight run was redone with after the discovery. Flagged for a follow-up `CLAUDE.md`/best-practices edit outside this task's scope, since it affects the documented "Commands verified to work from this shell via Windows" list generally, not just this plan.
- **Manual recovery rehearsal completed 2026-08-16** via `tauri-agent-dev` against a real sandbox journal — the actual acceptance test for this plan. Sequenced cheap-probe-first per this session's own plan: window.confirm handling was verified before building real state, since the plan's own history shows every rehearsal so far has found a bug the test suite missed.
  - **`window.confirm` probe.** A trivial journal (one entry, one manual snapshot) was restored immediately to check whether the confirm dialog would wedge the CDP session the way a *native* OS dialog would (the concern the plan flagged, drawing the parallel to Task 5.1's folder-picker workaround). It did not: `agent-browser`'s CDP session handles `window.confirm` transparently with no coordinate-click workaround needed, unlike a native dialog. The probe restore itself succeeded end-to-end, confirming the mechanism before the real scenario was built.
  - **Whole-journal restore, full scenario.** Wrote three entries across three dates (Aug 9, Aug 14, Aug 16), one tagged (`pre-snapshot`), took a manual snapshot (`Manual · 3 entries`), then wrote a brand-new fourth entry on Aug 11 and edited the Aug 9 entry in place — both strictly after the snapshot, so restore would have something to visibly discard. Before restoring: opened Search and searched `POST-SNAPSHOT`, establishing a baseline of **2 results** (the new Aug 11 entry and the Aug 9 edit); left the Aug 9 entry open in the editor, showing the post-snapshot edit. Triggered **Restore** on the 3-entry snapshot. Result, checked against every point the plan's own history flagged as previously bug-prone and not coverable by unit tests alone:
    - Success message named the safety snapshot by exact timestamp, as UX-2 requires: *"Journal restored to the backup from Aug 16, 2026, 1:58 PM. Your previous state was saved as a new backup from Aug 16, 2026, 1:59 PM in case you need to undo this."*
    - **The open editor updated live**, with no navigation and no manual refresh: the Aug 9 entry's body reverted from the post-snapshot edit back to its original text the instant the restore completed — this is deviation 7's fix (`refreshAfterRestore()` / `registerReloadCallback`) working correctly under real conditions, not just its unit test.
    - Calendar updated live: Aug 11 lost its "has entry" marker; Aug 9, Aug 14, Aug 16 kept theirs.
    - Re-searching `POST-SNAPSHOT` after the restore returned **"No results found"** — search state refreshed correctly, both occurrences gone.
    - The `pre-snapshot` tag, applied before the snapshot, was still attached to the Aug 9 entry afterward — tag state survived the round trip correctly.
    - No defect found. Nothing needed fixing.
  - **Per-entry restore.** Deleted the live Aug 14 entry (cleared title and body, confirmed the calendar lost its "has entry" marker). Opened **Restore entries…** on the `Manual · 3 entries` snapshot, entered the password, and confirmed the dialog correctly flagged the Aug 14 entry **"Missing from your journal"** while the other two read "Already in your journal." Selected it and restored: status read *"1 entry added. Nothing already in your journal was overwritten,"* the entry's own status flipped live to "Already in your journal," the calendar regained its "has entry" marker, and — again live, no manual refresh — the editor (open on Aug 14, previously showing the empty-entry placeholder) displayed the restored title and body immediately. No defect found.
  - **Outcome:** both rehearsals passed cleanly on the first attempt, with every point the plan's own Execution Notes and prior deviation history called out as bug-prone (editor staleness, success-message accuracy, search/tag refresh) explicitly checked and confirmed working. No new `BLOCKED` task was needed.
- **A real bug found and fixed while running the coverage pre-flight check, per the Execution Notes rule.** `bun run coverage:check` (run without `--working-tree`, per this task's own correction below, since this branch had never had a whole-branch-vs-`origin/master` coverage run) reported `⚠ Coverage generation issues: frontend coverage generation failed (tests failed or lcov not written)` — the tool was honest about the failure, so this was not a silent false pass the way the MSYS finding above was, but the gate then proceeded to grade against a stale `coverage/lcov.info` from hours earlier rather than a fresh run. Root cause: `scripts/check-diff-coverage.mjs`'s `generateCoverage()` spawned `bun` directly via `spawnSync`, which cannot execute Windows's `.cmd` shim without going through a shell — the exact defect the `[0.7.0]` changelog already records as fixed in `scripts/render-diagrams.mjs`. Fixed the same way (`cmd.exe /d /s /c` on Windows), verified by confirming `coverage/lcov.info`'s mtime moved forward and that `vitest run --coverage`'s own output now appears in the captured log; the re-run passed with a genuinely fresh frontend measurement, combined branch-wide diff coverage **90.3%** against the 80% gate. No regression test was added: `coverage:self-test` covers the lcov/diff-parsing pure functions only, and `generateCoverage()` itself runs the full test suites as a side effect with no clean seam to unit-test the spawn behavior without either mocking `child_process` (which would not have caught this — the mock would still have to know to distinguish Windows `.cmd` resolution) or actually running the suites in CI on both platforms. Recorded here rather than invented, per the precedent Milestone 4's Task 4.2 deviation 5 already sets for an unreachable-without-real-infra fault path. Changelog entry added under `[0.7.0] → Internal`.

---

## Approval Gate

Implementation must not start until the user approves this plan.

Milestone 4 carries a second gate: Tasks 4.2 and 4.3 must not start until all seven UX-GATE scenarios have per-scenario sign-off against a rendered prototype or screenshot.

## Pre-flight Checks

Run these before marking the plan COMPLETED. All commands verified to exist in `package.json` on 2026-08-04.

- [x] `cargo clippy --workspace --all-targets` passes with zero warnings — ran as `-- -D warnings` 2026-08-16, clean
- [x] `cargo test --workspace` passes with zero failures — 2026-08-16, all crates green (452 core + 42 crypto shown; app crate included in the overall zero-failure exit)
- [x] `cmd.exe /c bun run type-check` passes — 2026-08-16 (re-run with `MSYS_NO_PATHCONV=1`, see Task 6.3 notes on the MSYS `/c`-mangling finding)
- [x] `cmd.exe /c bun run lint` passes — 2026-08-16 (same MSYS correction)
- [x] `cmd.exe /c bun run test:run` passes — 2026-08-16, 950/950 tests, 94 files
- [x] `cmd.exe /c bun run test:e2e` passes — run as the plan's own corrected `test:e2e:local` 2026-08-16: clean lane, 6/6 spec files passed including `backup-restore.spec.ts` (14.6s), 100% in 1m50s
- [x] `cmd.exe /c bun run build` succeeds — 2026-08-16
- [x] `cmd.exe /c bun run format` succeeds — 2026-08-16, all files unchanged (already clean)
- [x] `cmd.exe /c bun run validate:locales` passes — 2026-08-16, 649 keys × 6 locales OK
- [x] `cmd.exe /c bun run coverage:diff` passes the ≥80% patch gate — run as `coverage:check` (fresh generate + gate, see Task 6.3 notes on the `spawnSync('bun')` Windows bug found and fixed here) without `--working-tree`, the first whole-branch (`HEAD` vs `origin/master`) run for this branch: **90.3%** combined (2827/3131)
- [x] `cmd.exe /c bun run check:build-paths` passes — 2026-08-16
- [x] `cargo bench --bench backup_bench` runs (Task 1.8) — 2026-08-16: 15.4ms (small, 140KB), 37.2ms (large, 8MB), 137.4ms (image-heavy, 40MB), consistent with the Milestone 1 baseline (~4ms/MB)
- [x] Any text-processing function tested with non-ASCII strings (ASCII + RTL + CJK minimum) — already covered by the existing search/text test suite (`search::text::impl_tests`), unaffected by this plan's scope
- [x] Manual recovery rehearsal (Task 6.3 step 2) completed — 2026-08-16, whole-journal and per-entry restore both passed cleanly, no defects found; see Task 6.3's implementation notes
- [x] Plan status updated to COMPLETED

## Plan Self-Check

Pass 2, performed 2026-08-04.

- [x] Plan location follows the default location rule (`docs/` exists; plan at `docs/backup-system-redesign-plan.md`).
- [x] Scope, non-goals, assumptions, and open questions are explicit.
- [x] All open questions were surfaced via the native question tool, answered, and recorded with their resolutions.
- [x] Zero unanswered questions remain.
- [x] Tasks are grouped into milestones (26 tasks across 6 milestones, > 10).
- [x] Every task has concrete steps and validation.
- [x] Every milestone has exit criteria broader than any single task.
- [x] No forward dependencies: the manifest (Task 1.3) precedes deduplication (Task 1.5), which precedes the trigger rewrite (Task 1.6).
- [x] Cleanup and final verification are included; cleanup checks off TODO-0098 and completes the changelog.
- [x] No vague actions — every task names files, functions, or test names.
- [x] Executable by a coding agent without reading the originating conversation.
- [x] UX-GATE tagged, with seven scenarios listed for per-scenario sign-off rather than a description of behavior.
- [x] PLATFORM-VERIFY step present for the one OS/WebView handoff (Task 3.4), listed in Milestone 3's exit criteria.
- [x] Decision Log section omitted — no companion decision-log file was requested, and the skill restricts that section to plans where one is.
- [x] Every file path, line reference, npm script, and API visibility claim re-verified against the working tree (see Self-Check Record).

## Self-Check Record

Pass 2 verified the plan against the tree and corrected the following. Recorded so a later reader does not reintroduce them.

| # | Defect found | Resolution |
|---|---|---|
| 1 | **Forward dependency.** Deduplication (M1) read a change counter from the manifest, which the plan created in M3. Milestone 1 was not implementable as written. | Manifest moved into M1 as Task 1.3, ahead of retention. M1 renumbered; former M3.1 absorbed. |
| 2 | **Wrong API shape.** A task specified `VACUUM INTO` "through the caller-supplied `rusqlite` connection", but `DatabaseConnection::conn()` is `pub(crate)` (`db/schema/mod.rs:29`) and never leaves the core crate. | Task 1.4 now specifies `&DatabaseConnection`. |
| 3 | **Unstated hard dependency.** The on-exit trigger assumed a window-event hook; none exists (`rg "on_window_event\|CloseRequested" src-tauri/src/lib.rs` → no matches). | Recorded as Assumption 8 and made an explicit, scoped step in Task 1.6. |
| 4 | **Missing task: performance.** Snapshot creation becomes a lock-path operation whose cost scales with journal size, with no threading or benchmark task, against a PHILOSOPHY requirement for criterion coverage on hot paths. | Added Task 1.8 (background thread, shutdown budget, `backup_bench.rs`, E2E timing check). |
| 5 | **Unverified permission assumption.** Reveal-in-folder might have needed a new Tauri capability. | Verified `tauri-plugin-opener-2.5.4/permissions/default.toml` grants `allow-reveal-item-in-dir` and that `capabilities/default.json` grants `opener:default`. Recorded as Assumption 7 with an explicit "do not add one". |
| 6 | **Wrong cleanup instruction.** A step implied stray root `.db` files might be tracked. `.gitignore:40-43` covers `*.db` and `test_*.db`, and `git ls-files` shows none tracked. | Task 6.1 step 3 restated as a check. |
| 7 | **Understated metadata capability.** Adopted legacy snapshots were assumed undescribable without a key. In fact `entries.date` and row counts are plaintext and `db::peek_auth_slot_types` (`db/peek.rs:53`) reads slot types keylessly. | Assumption 5 rewritten; Task 1.7 now populates full metadata and defines `verified: false` precisely. |
| 8 | **Unreviewed privacy decision.** The manifest is a plaintext sidecar carrying entry counts and dates; the plan did not justify it. | Added the Privacy Decision section with the allow/deny list, the plaintext-`date` and debug-dump precedent, and the enforcing test. |
| 9 | **Missing wiring detail.** The Preferences tab step omitted the `Tab` union and `tabs` array that drive arrow-key navigation (`PreferencesOverlay.tsx:20,66-74`). | Added as Task 3.2 step 2. |
| 10 | **Miscount.** Self-check claimed 22 tasks; the plan had 25. | Recounted mechanically: 26 tasks, 6 milestones. |

Also confirmed correct and unchanged: all 11 npm scripts exist in `package.json`; `db_path` is in scope in all three `open_database*` functions (`open.rs:24,70,132`); `typeText` exists at `e2e/specs/helpers.ts:128`; `TabProps` is exported from `preferences/shared.ts`; rusqlite 0.40 `bundled` is well past the SQLite 3.27 floor for `VACUUM INTO`; the four existing criterion benches establish the `[[bench]]` registration pattern.

## Implementation Record — Milestones 1 and 2

Implemented 2026-08-04. Milestones 3–6 remain `TO BE DONE`.

Verification at completion: `cargo test --workspace` **653 passed / 0 failed** (209 app, 402 core, 42 crypto), `cargo clippy --workspace --all-targets` clean, `cargo fmt --all` applied, `cargo bench --bench backup_bench` reports, `bun run website:build-static` regenerated `website/docs/backups/`.

Benchmark baseline (Windows, release): 16 ms at 140 KB, 46 ms at 8 MB, 157 ms at 40 MB — roughly 4 ms/MB, so a 500 MB journal lands inside the 5 s shutdown budget with room to spare.

### Deviations from the plan as written

Four, each forced by something the plan could not have known without writing the code.

| # | Plan said | What shipped, and why |
|---|---|---|
| 1 | Task 1.4 step 4: verify that "the master key unwraps an auth slot". | **Not achievable.** A slot's `wrapped_key` is unwrapped *by a credential* (Argon2id password key, X25519 private key, or the device auto key) to *produce* the master key; holding the master key does not reverse that. Verification instead **decrypts an encrypted row** (entry title, falling back to tag name) with the live master key, which proves the property that actually matters — this snapshot is decryptable with the key we hold — against the same key the entries were written with. A journal with no encrypted content yet has nothing to check, so the valid-database and auth-slots-present checks stand alone there. |
| 2 | Task 1.2 step 2: `SnapshotTrigger::Destructive(&'static str)`. | `&'static str` cannot `Deserialize`, and Task 1.3 requires the trigger to round-trip through `manifest.json`. Shipped as `Destructive(Cow<'static, str>)` with a `SnapshotTrigger::destructive(&'static str)` constructor: allocation-free from a literal, owned on the way back. A seventh variant, `Adopted`, was added for pre-upgrade files — the old engine recorded no trigger and had several, so labelling them `Unlock` would have been a fabrication. |
| 3 | Task 1.5 step 3: apply the storage budget "thinning newest-tier-first". | Implemented, but the *within-tier* order was initially oldest-first and a test caught that this destroys depth the moment thinning is forced past the recent tier — it evicted the oldest monthly snapshot. Shed order is now least-durable-tier-first and **newest-first within a tier**, so the deep tiers give up their shallowest member. `test_budget_forced_into_the_deep_tier_sheds_its_newest_not_its_oldest` locks this in. |
| 4 | Task 1.6 step 3 assumed lock/exit snapshots could simply run on a background thread. | They can, but the thread keeps the SQLite file **open**, which breaks `change_diary_directory` and `reset_diary` on Windows (`os error 32` — caught by an existing test). Added `LockCompletion::{Detached, AwaitFileRelease}`: user-facing locks return immediately, callers that then move or delete `diary.db` wait for the handle to close. In practice the wait is instant, since those callers snapshot synchronously moments earlier and the lock snapshot is deduplicated away. |

### Notes for the remaining milestones

- `BackupContext.app_version` is `Option<&str>`, not `&str`. The pre-migration snapshot is taken from inside `db::schema::open`, which has no app version in scope; an absent version is recorded as absent rather than guessed.
- The debug dump's `backup_max` field is gone. It could not describe a tiered policy and was one source of the inconsistent published numbers. Replaced by `backup_retention_policy` (a one-line description) and `backup_verified_count`; counts now come from the manifest via `backup::list_snapshots`, so `.tmp` writes are excluded.
- Task 1.8 step 4 needed no work: `.e2e-stateful/` is gitignored local scratch, not a committed fixture, and its legacy minute-resolution files exercise the adoption path (Task 1.7) rather than needing a refresh.
- Task 2.3 prepared the release but did **not** publish or commit, per project convention.

## Implementation Record — Milestone 3

Implemented 2026-08-06. Tasks 3.1–3.3 COMPLETED; Task 3.4 is BLOCKED on Linux verification
only (see its notes). Milestones 4–6 remain `TO BE DONE`.

Verification: `cargo test --workspace` **665 passed / 0 failed** (213 app, 410 core, 42
crypto), `cargo clippy --workspace --all-targets -- -D warnings` clean, `bun run test:run`
**881 passed / 91 files**, `type-check`, `lint`, `format`, `check:build-paths`, and
`validate:locales` (610 keys × 6 locales) green. `bun run coverage:diff -- --working-tree`
reports **97.8%** patch coverage against the 80% gate. `bun run website:build-static`
regenerated `website/docs/backups/` with no unrelated churn.

### A pre-existing blocker found first

The Milestone 1–2 commit (`490380c4`) **did not compile**, on CI or locally:
`crates/mini-diarium-core/Cargo.toml` declared `chrono = "0.4"`, but chrono does not enable
serde by default and `SnapshotMeta` derives `Serialize`/`Deserialize` over
`created_at: DateTime<Utc>`. Both the `Test` and `Lint` CI jobs failed with `E0277`. Fixed by
enabling the feature; `Cargo.lock` is unaffected, since features are not recorded there.

### Deviations from the plan as written

| # | Plan said | What shipped, and why |
|---|---|---|
| 1 | Task 3.1: `get_backup_health`, with no definition of what "health" contains. | Added `BackupHealth` + the pure `summarize_health` to `policy.rs`, and **persisted failures**: `Manifest` gained `last_failure: Option<BackupFailure>` (`#[serde(default)]`, so older manifests still load). Without it, UX-6's "last N snapshots failed" is unanswerable — lock and shutdown snapshots run on a background thread with no UI attached, so a journal whose backups had stopped working looked identical to one that was up to date. `BackupFailure` carries **only `at` and `trigger`, never a message**: the manifest is plaintext and the Privacy Decision forbids filesystem paths, and an arbitrary I/O error string is the easiest way to break that by accident. |
| 2 | Task 3.1 step 1: `reveal_backups_folder` "uses `revealItemInDir` from `@tauri-apps/plugin-opener`" — a JS API — while also being a Rust command. | Those are contradictory. Shipped as a Rust command calling `tauri_plugin_opener::reveal_item_in_dir`, so the backups path never crosses the IPC boundary. Sending it to the WebView only to send it straight back would put a filesystem path on the wire that the rest of this subsystem is careful to keep off it. `opener:default` covers the Rust path too, so Assumption 7 holds and no capability was added. |
| 3 | Tasks 3.2 and 3.3 as two separate views. | One shared `src/components/backups/BackupsPanel.tsx` with a `reduced` prop, wrapped by `PreferencesBackupsTab.tsx` (tabpanel shell) and `BackupsOverlay.tsx` (standalone dialog). The pre-auth *payload* is identical to the authenticated payload — that is the point of a keyless manifest — so the differences are which command supplies it, that key-requiring actions are disabled, and that reduced mode **renders less than it receives**: entry counts and date ranges are withheld, leaving Task 3.3 step 2's "dates, sizes, triggers, and health only". Forking the DTO would buy nothing an attacker cannot get by opening `manifest.json`; the gate is least disclosure on a screen anyone walking past can see, not a security boundary. (Reduced mode first shipped listing the snapshot in full; the review of 2026-08-06 caught the mismatch and it was corrected.) Task 3.3 step 3's "factor the affordance" is `src/components/auth/PreAuthTools.tsx`: the row of things reachable without unlocking, which TODO-0094 extends by adding one button. |
| 4 | Nothing about path traversal. | `FsSnapshotStore::{read, delete, stat}` joined a caller-supplied name onto the backups directory without validating it. Harmless while every name was engine-generated; a **path-traversal hole** the moment `delete_backup(fileName)` became IPC-reachable — `backup-../../diary.db` satisfies both affixes. `is_snapshot_file_name` now also rejects separators, `..`, and NUL, and all three methods go through it. Guarded by `test_every_name_taking_method_refuses_to_escape_the_backups_directory` (store) and `test_delete_refuses_to_address_anything_outside_the_backups_directory` (engine). |
| 5 | Milestone 3 exit criterion: "a snapshot that failed to write is visibly distinguished". | Not literally satisfiable, and that is a *consequence* of Milestone 1 rather than a gap. A snapshot that fails to write leaves **no file** — the write is atomic and deletes its own remains, so there is nothing in the list to distinguish. Delivered as the two things that can honestly be shown: the **last failed attempt** (from the new `Manifest.last_failure`) in the health line, and per-snapshot **`Checked` / `Not checked`** for snapshots whose decryptability has not been confirmed. |

### Defect found in manual testing, and fixed

`directory_accessible` was first implemented as `backups_dir.is_dir()`. In the real dev app
that told a **brand-new journal** its backups folder could not be reached: the engine creates
the directory on the first write, and the app nests it two levels
(`{journal dir}/backups/{db stem}`), so none of it exists until a snapshot is taken. A single
parent check did not fix it either, and `ancestors().any(is_dir)` — "could `create_dir_all`
succeed?" — is nearly always true on Unix, where `/` exists, so an unmounted
`/media/user/USB` would silently get a backups folder created on the local disk while the
check reported health.

`backup_health` now takes `db_path` instead of a pre-computed size (it needs the file for the
storage budget anyway) and asks whether the **journal's own directory** is still there. First
run: true. Vanished drive: false, on every platform. Pinned by
`test_health_reports_a_vanished_journal_directory_as_unreachable` and by a component test
that the panel does not cry wolf on a never-backed-up journal.

Worth noting as a process point: this was only caught by running the app. Every unit test
passed against the wrong behavior, because the tests encoded the same wrong assumption.

### Defect found in review, and fixed

The same lesson, a second time. The fix above answered "does the journal's own directory
still exist?" but never asked whether the backups path itself was usable, and three separate
places conspired to hide the answer:

- `FsSnapshotStore::list` collapsed *every* `read_dir` error into `Ok(vec![])`, so a
  directory blocked by a file read as empty rather than broken.
- `backups_dir_is_usable` returned `true` whenever the journal's parent existed, whatever
  occupied `backups_dir`.
- `create_snapshot` records a failure into `manifest.json` **inside that same directory**, so
  a blocked path cannot persist the one signal that was supposed to cover this case.

The result: the panel rendered "Backups are working." at the exact moment no backup could be
written. Fixed by a `store::dir_state` classifier — `Usable` / `Absent` / `Blocked`, resolved
by walking `ancestors()` to the deepest path that exists, which is what makes it portable
(a file occupying a parent surfaces as `NotFound` on Windows and `NotADirectory` on Unix) —
with `list` now returning `Err` for anything that is not `NotFound`, and
`backups_dir_is_usable` deferring to the classifier and only falling back to the journal
directory for `Absent`. Pinned by
`test_health_reports_a_backups_path_blocked_by_a_file_as_unusable` (both the flat and the
nested `{journal dir}/backups/{db stem}` shapes, asserting `last_failure` is `None` — the
point being *why* `directory_accessible` has to carry this alone),
`test_health_reports_an_unreadable_backups_directory_as_unusable` (Unix), and
`test_list_distinguishes_a_missing_directory_from_an_unusable_one`.

The process point is the same one as above, which is why it is worth recording twice: every
unit test passed against the wrong `directory_accessible` behaviour, because the tests
encoded the same wrong assumption the code did. `test_a_failed_snapshot_is_an_error_not_a_silent_skip`
even built the exact blocked-directory fixture and asserted only that `create_snapshot`
errored — it never asked what health said afterwards.

## Implementation Record — Milestone 4, Task 4.1

Implemented 2026-08-09. Tasks 4.2–4.4 remain `TO BE DONE` and **must not start** until the
seven UX-GATE scenarios have per-scenario sign-off; nothing in this task is gated, because it
adds no destructive interaction and no UI.

Verification: `cargo test --workspace` **705 passed / 0 failed** (234 app, 429 core, 42
crypto), `cargo clippy --workspace --all-targets -- -D warnings` clean, `cargo fmt --all`
applied, `bun run test:run` green, `type-check` and `lint` green.

### A correction made first

The branch's `CHANGELOG.md` carried a **duplicate `## [0.6.5]` heading**, a merge artifact
from `bd61e9e4`: the Milestone 3 entries were written while `0.6.5` was the in-progress
section, master then shipped `0.6.5` without them and moved to `0.6.6`, and the merge left
the unreleased Milestone 3 work filed under an already-released version. Moved into a
`## [0.7.0] - Unreleased` section (Assumption 4: Milestones 3–5 ship in a later minor) and
the duplicate heading removed.

### Deviations from the plan as written

| # | Plan said | What shipped, and why |
|---|---|---|
| 1 | Task 4.1 step 4: close the inspection connection "on panel close, journal lock, app exit, and journal switch" — four call sites. | Kept in `DiaryState.inspection` and closed at the top of `lock_diary_inner_with`, which **all four** already funnel through (the last three via `auto_lock_diary_if_unlocked`). One teardown, enforced by the call graph rather than by four callers remembering. The close runs *before* that function's already-locked early return, which is what covers a journal switch on a locked journal. `close_inspection` is deliberately infallible and recovers a poisoned mutex: a lock handler that gives up on an error would leave a decrypted snapshot open, which is the exact outcome it exists to prevent. |
| 2 | Task 4.1 step 2: `list_backup_entries` mirroring "the timeline's existing minimal-IPC shape". | Same four fields, but **not** `get_entries_for_timeline`, which selects `preview_enc` (v12) and `locked` (v13). The most valuable snapshot is the pre-migration one, which by definition predates the migration it was taken for — so the current timeline query would fail on exactly the snapshots that matter most. `list_snapshot_entries` reads `PRAGMA table_info` first and builds the query to match, falling back to deriving the preview from the entry text. Pinned by `test_inspect_reads_an_older_schema_snapshot`, which rolls a real journal back to v11. |
| 3 | Task 4.1 step 3: "detect that the snapshot's auth slots differ from the live journal's". | The slot *type* is unchanged by a password change — both sides still say `password` — so comparing types would never fire on the case UX-3 exists for. The comparison is over `(type, public_key, wrapped_key)`: re-wrapping produces a fresh nonce and ciphertext, so the drift is visible as a byte difference. All three columns are plaintext, so this needs no key and works while the journal is locked. `compared: false` distinguishes "the live journal could not be read" from "no drift" — claiming a backup needs a different password because `diary.db` is missing would be a guess presented as a finding. |
| 4 | Three commands: `open_backup_readonly` / `list_backup_entries` / `close_backup`. | A fourth, `check_backup_credentials`, because UX-3 requires the warning *before* the credential prompt and the other three all come after it. It is keyless, so it also answers from the pre-auth panel. |
| 5 | Nothing about whether inspection requires an unlocked journal. | **It does.** Inspection decrypts entry content, and the pre-auth panel exists so a locked screen can report that backups *exist* — not read them; `verify_backup` and `delete_backup` already draw this line for weaker reasons. It costs the legitimate user nothing even in the B-11 case the feature was built for: a snapshot needing the old password still belongs to someone who knows the current one, so they unlock with today's password and open the snapshot with the old one. The only case that cannot unlock first is a journal too damaged to open at all, and the answer there is whole-journal restore (Task 4.2). `check_backup_credentials` stays keyless and works while locked, since it reads only plaintext slot columns. Pinned by `test_reading_a_backup_requires_an_unlocked_journal`. |

Also worth recording: `open_snapshot_readonly` refuses v1/v2 snapshots rather than reading
them. Those predate auth slots and keep a password-derived key in the legacy `metadata`
table, so reading one means migrating it — which is the one thing this module must never do
to a snapshot. Whole-journal restore (Task 4.2) is the correct path for them, and the error
says so. **Correction from Task 4.2**: that last sentence was wrong. Restore cannot open a
v1/v2 snapshot either — `apply_pending` only covers v3 onward, and a v1/v2 snapshot's key
lives in the legacy `metadata` table under a password-derived key, not a wrapped master key,
so redoing the v1→v2→v3 migration would need the *original* password, which nothing in this
plan collects. `open_snapshot_readonly`'s error text was corrected to stop pointing users at
a path that also refuses them.

## Implementation Record — Milestone 4, Task 4.2

Implemented 2026-08-11. Task 4.3 remains `TO BE DONE` and is unblocked to start; UX-4 and
UX-5 were already signed off 2026-08-10 (see the Sign-off Record).

Verification: `cargo test --workspace` **724 passed / 0 failed** (242 app, 440 core, 42
crypto, unaffected by deviation 9 — frontend-only), `cargo clippy --workspace --all-targets --
-D warnings` clean, `cargo fmt --all` applied, `bun run test:run` **919 passed / 92 files**
(re-run after deviation 9), `type-check` and `lint` green, `validate:locales` green (620 keys
× 6 locales), `bun run coverage:check` reports **86.4%** combined diff coverage against the
80% gate (re-run after the deviation 7/8 frontend fixes; none of the new lines in
`state/entries.ts`, `state/session.ts`, or `useEntryLifecycle.ts` show up in the tool's
per-file "missing" breakdown; not re-run again for deviation 9's smaller, fully-covered
change), `check:build-paths` green. The manual recovery rehearsal (validation step "Manual
end-to-end run in the dev app") is deferred to Task 6.3 step 2, which the plan already scopes
as one combined rehearsal covering both per-entry and whole-journal restore — running it
before Task 4.3 exists would only exercise half the recovery flow.

Two further advisor reviews, run before marking this task complete, surfaced three gaps not
caught by the (passing) test suite: nothing rehydrated frontend session state after a restore
that keeps the journal unlocked (deviation 7 — this is the one that mattered, a real
TODO-0089-class data-loss path), no test exercised the restore/`apply_pending` interaction
Task 4.2's own note asks for (deviation 8), and a rehydration failure after a *successful*
restore could render through the same error slot a failed restore uses (deviation 9). All
three are fixed and covered before this line was written; see the deviation table.

### Deviations from the plan as written

| # | Plan said | What shipped, and why |
|---|---|---|
| 1 | Task 4.2 step 2: "copy the snapshot file to a temp name inside the journal directory, fsync it, and atomically rename it over `diary.db`", implying the copy happens after the safety snapshot. | The copy is staged **before** the safety snapshot, not after. `create_snapshot` (used for the safety snapshot too) runs `apply_retention` on *every* call, and retention can evict the very snapshot being restored — an older snapshot losing its day-bucket slot to the brand-new safety snapshot, for instance. Staging a private copy first means later eviction of the original is irrelevant; the copy already exists. `store::stage_restore_copy` / `store::finalize_restore` are the two new primitives, reusing `write_atomic`'s `fsync`-then-`rename` shape aimed the other direction. |
| 2 | Nothing about how the Tauri command holds `state.db` across the operation. | The lock guard is taken once and held for the *entire* restore, not released and reacquired around the core call. Releasing it mid-operation would leave `state.db` reading `None` for as long as the restore takes: a concurrent auto-lock check (idle timer, OS session lock, focus loss) would see "already locked" and silently no-op, and `restore_backup` would then reinstall a connection into a journal an auto-lock path had just decided should stay locked — a real, if narrow, silent-unlock window. `restore_backup_inner` takes the guard once, passes the owned `DatabaseConnection` into `backup::restore_from_snapshot`, and writes whatever comes back into the same guard before releasing it. |
| 3 | Nothing about the snapshot inspection connection (Task 4.1). | `restore_backup_inner` calls `backup_inspect::close_inspection` first, unconditionally — the same first step `lock_diary_inner_with` takes. A restore is about to replace the very file an open inspection connection might be reading from; leaving it open would decrypt a second database pointing at a journal state that no longer exists on disk, and retention could delete a snapshot the inspection handle still has open on some platforms. |
| 4 | No credential-decryptability check called out explicitly. | Added `precheck_restorable`, layered on the existing `store::verify_snapshot` (the same check `SnapshotStore::write` performs after taking a snapshot). Without it, restoring a snapshot the live key cannot decrypt — an adopted pre-upgrade file, or one surviving a `reset_diary`, both real if rare — would swap the file, "successfully" reopen (schema tables read fine even when content does not decrypt), and only fail the first time the user opened an entry. The precheck runs on the *staged* copy, before the safety snapshot, so a doomed restore never touches the live journal at all. `test_restore_rejects_a_snapshot_the_live_key_cannot_decrypt` and `test_restore_survives_a_password_change_between_snapshot_and_restore` pin the two sides of this: the second proves the check is not overly strict — a snapshot taken before a password change still passes, because `change_password` re-wraps rather than regenerates the master key. |
| 5 | Task 4.2 step 4: "restore from the safety snapshot and report clearly" on any post-swap failure. | Shipped as designed, but the unit test for it (`test_failed_restore_rolls_back_to_the_safety_snapshot`) exercises the private `roll_back` helper directly rather than forcing a fault through the full public pipeline. By the time `restore_from_snapshot` reaches the post-swap reopen, the target has already passed `precheck_restorable` against the exact bytes being swapped in, so a *reachable* post-swap failure needs a fault the public API has no deterministic, cross-platform way to inject (disk I/O, not application logic) — the same category of gap the plan's own Task 1.1 fallback anticipates for the change-counter assumption. What the test proves is the recovery mechanism itself, which is the part of Task 4.2's contract that matters. |
| 6 | Nothing about the unrecoverable case (neither the restored file nor the safety snapshot can be reopened). | `RestoreOutcome.db` is `Option<DatabaseConnection>`; it is `None` only here. `restore_backup` (the Tauri command) checks `state.db` after the inner call and emits `journal-locked` with reason `restore-failed` when it is empty, so the frontend's existing lock listener (`src/state/auth.ts`) resets to the locked screen instead of continuing to show an unlocked shell over a journal the backend can no longer reach. The event payload is a local struct mirroring `auth::JournalLockedEventPayload`'s wire shape rather than reusing that type, which stays private to the `auth` module for the user-facing lock flow and is not reachable from a sibling `commands::backup`. |
| 7 | Nothing about frontend session state across a restore that keeps the journal unlocked. | The gap: the panel's first cut called `restoreBackup()` then only reloaded the *backups list* — leaving `entries`, `search`, `tags`, and, critically, the open editor's `pendingEntryId`/title/content pointed at the pre-restore journal. The next flush (date switch, entry switch, unmount, `beforeunload`) would silently write pre-restore content back over the restored entry — the TODO-0089 failure class, landing *after* the safety snapshot, so uncovered by it. Fixed with two additions: `executeCleanupCallbacks()` runs *before* `restoreBackup()` so any in-flight typing is flushed into the live journal and caught by the safety snapshot; `refreshAfterRestore()` (`state/session.ts`) runs after a successful restore and clears/refetches entry, search, and tag state. It is deliberately not `resetSessionState()` — that also calls `resetUiState()`, which would close the very Backups panel about to show the success message. A new reload-callback registry (`registerReloadCallback`/`executeReloadCallbacks`, mirroring the existing cleanup-callback system in `state/entries.ts`) lets `useEntryLifecycle` register `discardAndReload`, which clears the editor's held entry (nulling `pendingEntryId`) *before* re-fetching — that null is what makes the flush inside the reused `loadEntriesForDate` call a guaranteed no-op rather than a stale write, pinned by `useEntryPersistence.test.ts`'s two new cases on the hydration-identity guard. |
| 8 | Task 4.2's own note: "verify the two interact correctly" (restore + `apply_pending`), with no test named for it. | Added `test_restore_migrates_a_pre_migration_snapshot_to_the_current_schema`: rolls a real v13 journal back to v12 (same trick as `open.rs`'s pre-migration test), snapshots it, brings the live journal current, then restores the v12 snapshot and asserts `read_schema_version` reads `SCHEMA_VERSION` afterward and the entry decrypts. Also asserts no second `Migration`-triggered snapshot is produced by the restore — `reopen_current` calls `apply_pending` directly rather than routing through `open_database`, which is what keeps this from stacking two snapshots for one action. **Superseded 2026-08-16 — see the Task 4.2 note above.** `reopen_current` now *does* route through `migrate_with_pre_migration_snapshot` (Milestone A / Finding 1 of the adversarial review), so a restored pre-migration snapshot does take a second `Migration` snapshot before re-migrating; the test's trailing assertion was inverted to match. This row is left as the historical record of what shipped on 2026-08-11, not a description of current behavior. |
| 9 | Nothing about the panel's error handling once a restore has already succeeded. | A third advisor review, after deviations 7-8 landed, caught that `handleRestore`'s `try` block ran `refreshAfterRestore()` and `load()` *inside* the same `try` as `restoreBackup()`. `refreshAfterRestore()` can throw (any of `getAllEntryDates`/`loadAllTags`/`discardAndReload`'s chain); that throw would skip straight to the panel's `catch`, which renders the error through the same `role="alert"` slot a *failed* restore uses — so a restore that fully committed would read to the user as failed, with no safety-snapshot name shown, inviting them to "restore" again over an already-restored journal. `refreshAfterRestore()` is now wrapped in its own `try`/`catch` that only logs (`createLogger('BackupsPanel')`); the success message is set unconditionally once `restoreBackup()` itself has resolved. `load()` needed no such wrapper — it already catches and reports its own errors via `error()` internally and never throws — but it stays *after* the wrapped `refreshAfterRestore()` call so a list-reload problem is likewise reported through its own accurate message rather than appearing to invalidate the restore. Pinned by a new test, "still reports success when post-restore rehydration fails, never the alert slot". |

### A message correction found during implementation

`inspect.rs`'s `open_snapshot_readonly` told a user with a v1/v2 snapshot to "restore it as a
whole journal to upgrade it" — a promise Task 4.2 cannot keep, for the same structural reason
inspection refuses them: `apply_pending` only migrates v3 onward, and redoing the v1→v2→v3
migration needs the original password. The message now says plainly that this app can
neither inspect nor restore such a snapshot automatically, rather than sending the user down
a second dead end.

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Task 1.1 gates the dedup design. If its assumption fails, apply the fallback recorded in that task before proceeding to Task 1.5.
- Task 1.3 must land before Task 1.5. Deduplication cannot work without persisted change counters.
- If a bug is discovered mid-task, either fix it in that task or add a new BLOCKED task to this plan immediately. Do not defer it mentally.
- Do not run `git commit`. Propose commit messages and let the maintainer commit, per project convention.
