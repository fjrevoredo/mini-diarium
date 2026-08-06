# Backup System Redesign — First-Class Local Snapshots (TODO-0098)

## Metadata

- Plan Status: IN PROGRESS
- Created: 2026-08-04
- Last Updated: 2026-08-06 (Milestone 3 implemented except the Linux half of Task 3.4 — see Implementation Record — Milestone 3)
- Owner: Coding agent
- Approval: APPROVED (2026-08-04)
- Tracking: [TODO-0098](todo/TODO.md)
- Source assessment: [`docs/reports/2026-08-04-backup-system-assessment.md`](reports/2026-08-04-backup-system-assessment.md) (Option A, §6.1)
- Tags: `UX-GATE: REQUIRED` (Milestone 4), `PLATFORM-VERIFY` (Milestone 3, reveal-in-folder)

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

- Status: IN PROGRESS
- Purpose: Make backups visible. Read-only functionality only; nothing here can modify a journal.
- Exit Criteria: A user can see every snapshot with its date, trigger, entry count, size, and health from Preferences → Backups and from the unlock screen; a snapshot that failed to write is visibly distinguished; `bun run test:run`, `type-check`, `lint`, and `validate:locales` all green; `PLATFORM-VERIFY` for reveal-in-folder completed on Windows and one Linux desktop.

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

- Status: BLOCKED — Windows verified; **Linux verification outstanding** and cannot be done from this machine. Needs a maintainer run on one Linux desktop (Wayland preferred) before Milestone 3 can be closed.
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

Not run. This machine is Windows-only and the skill used for the Windows pass is
Windows-only by design. Milestone 3's exit criteria are not met until a maintainer repeats
the two checks above on one Linux desktop (Wayland preferred, given the recent `tao`
title-bar issue).

---

### Milestone 4: Restore

- Status: TO BE DONE
- Purpose: Deliver the capability whose absence made the incident recovery manual: getting data back out of a snapshot, in-app, without writing plaintext to disk.
- Exit Criteria: All seven UX-GATE scenarios signed off; a whole-journal restore and a per-entry restore both demonstrated end-to-end against a snapshot the app produced itself; no code path in the restore flow writes decrypted content to the filesystem; an E2E scenario covers the round trip.

#### Task 4.1: Read-only snapshot inspection

- Status: TO BE DONE
- Objective: A snapshot can be opened and browsed without registering it as a journal (finding B-6).
- Steps:
  1. Add core support for opening a snapshot read-only with a supplied credential, held separately from the live `DiaryState` connection and never written to `config.json`.
  2. Add `open_backup_readonly` / `list_backup_entries` / `close_backup` commands returning only `{ id, date, title, preview }`, mirroring the timeline's existing minimal-IPC shape.
  3. Handle the different-credential case (finding B-11): detect that the snapshot's auth slots differ from the live journal's and surface scenario UX-3's message before the credential prompt.
  4. Ensure the inspection connection is closed and its key zeroized on panel close, journal lock, app exit, and journal switch.
- Validation: Tests `test_inspect_does_not_register_a_journal` (assert `config.json` unchanged), `test_inspect_connection_is_dropped_on_lock`, and a test that a snapshot predating a password change is detected as needing the old credential.
- Notes: Two open connections with two different keys is the sharpest security edge in this plan. Review against the `security-stance` skill before implementation, particularly the auto-lock paths in root `CLAUDE.md` gotcha 4 — all three must tear down the inspection connection.

#### Task 4.2: Whole-journal restore

- Status: TO BE DONE
- Objective: Roll the journal back to a snapshot, reversibly.
- Steps:
  1. Take a `PreRestore` safety snapshot of the current state and verify it. Abort the restore if it fails.
  2. Lock the journal, close the live connection, atomically replace the database file, reopen, and re-run `apply_pending`.
  3. Surface scenario UX-2's confirmation and success message, naming the safety snapshot.
  4. On any failure after the file swap begins, restore from the safety snapshot and report clearly.
- Validation: Tests `test_restore_takes_a_verified_safety_snapshot_first` and `test_failed_restore_rolls_back_to_the_safety_snapshot`. Manual end-to-end run in the dev app.
- Notes: Blocked on UX-2 and UX-3 sign-off. Restoring an older snapshot may downgrade the schema version, which `apply_pending` then re-migrates — the pre-migration snapshot from Task 1.6 covers that path, so verify the two interact correctly rather than producing two snapshots for one action.

#### Task 4.3: Per-entry restore

- Status: TO BE DONE
- Objective: Recover individual entries from a snapshot with no plaintext leaving the process (finding B-5).
- Steps:
  1. Add a two-pane view listing the snapshot's entries beside the live journal's, flagging entries missing from, or shorter in, the live journal.
  2. Add a `restore_entries_from_backup` command taking snapshot entry ids and copying decrypted content directly into the live journal in-process, re-encrypting with the live master key. Never serialize plaintext to disk, and never send more than the existing preview fields across IPC.
  3. Restore tags where the snapshot has them — this path is not constrained by the lossy JSON export format that drops them (finding B-5).
  4. Never overwrite: a restored entry is added alongside existing entries on that date (scenario UX-5), reusing `insert_entry_with_images` so image references are normalized correctly.
- Validation: Tests `test_restored_entry_is_added_not_overwritten`, `test_restore_entries_preserves_tags`, `test_restore_entries_writes_no_plaintext_to_disk` (assert no new files appear in temp or the journal directory during the operation). Manual end-to-end run.
- Notes: Blocked on UX-4 and UX-5 sign-off. The assessment's highest-value single feature.

#### Task 4.4: E2E coverage for the restore round trip

- Status: TO BE DONE
- Objective: The critical recovery flow is covered end-to-end against the real binary.
- Steps:
  1. Add a WebdriverIO scenario: create entries, take a manual snapshot, delete an entry, restore it from the snapshot, assert it is back.
  2. Follow `e2e/CLAUDE.md` conventions, including `typeText()` (`e2e/specs/helpers.ts:128`) for seeded text per gotcha 5.
- Validation: `cmd.exe /c bun run test:e2e` green locally and in CI.
- Notes: E2E runs on Linux/WebKitGTK in CI; keep the scenario free of platform-specific file-manager interaction.

---

### Milestone 5: Remaining Triggers, Warnings, And Documentation

- Status: TO BE DONE
- Purpose: Close the remaining Medium and Low findings and make the documented threat model honest.
- Exit Criteria: Findings B-9, B-11, B-13 closed; the backups documentation describes restore; `cargo test --workspace` and the full frontend gate green.

#### Task 5.1: Backups follow the journal

- Status: TO BE DONE
- Objective: Moving a journal no longer silently strands its backup history (finding B-13).
- Steps:
  1. In `change_diary_directory` (`auth_directory.rs:62`), offer to move the existing backups directory alongside the database.
  2. If the user declines, state plainly in the UI that the history stays at the old location.
- Validation: Tests `test_change_directory_moves_backups_when_requested` and its declining counterpart.
- Notes: The move must be all-or-nothing or resumable; a half-moved backup set is worse than either outcome. This interacts with the `Destructive` trigger added for the same command in Task 1.6 — snapshot first, then move.

#### Task 5.2: Credential-drift warnings

- Status: TO BE DONE
- Objective: Users learn that snapshots keep the credential they were taken with (finding B-11), in both its usability and security forms.
- Steps:
  1. Warn on `change_password` (`auth_core.rs:350`) that existing snapshots will still require the current password.
  2. Warn on `remove_auth_method` (`auth_slots.rs:194`) that the removed method remains valid against existing snapshots, and offer to review them.
  3. Show the required-credential hint per snapshot in the Backups panel, driven by the manifest's `auth_slot_types`.
- Validation: Component tests asserting both warnings render; the manifest-driven hint covered by a unit test.
- Notes: Point 2 is a genuine threat-model disclosure, not a convenience message. `PHILOSOPHY.md`'s "Honest threat documentation" non-negotiable applies.

#### Task 5.3: Local-only journal disclosure

- Status: TO BE DONE
- Objective: Local-only users understand the limit of their backups before they need them (finding B-9, Assumption 2).
- Steps:
  1. Persistent notice in the Backups panel for auto-key journals (scenario UX-7).
  2. State the limitation in `website/docs-src/09-backups.md` and in the passwordless ADR correction from Task 2.1.
  3. Verify no code path writes `auto_key` or any wrapped key into the backups directory.
- Validation: Test `test_backups_directory_never_contains_key_material` — run a full snapshot cycle on an auto-key journal and scan every file written for the journal's `auto_key` bytes.
- Notes: The step-3 test is the durable guard for Assumption 2 and should never be deleted.

#### Task 5.4: Document the restore procedure

- Status: TO BE DONE
- Objective: The repository finally contains a written restore procedure.
- Steps:
  1. Extend `website/docs-src/09-backups.md` with both restore paths, when to use each, and the safety-snapshot behavior.
  2. Mirror the essentials in `docs/USER_GUIDE.md`.
  3. Regenerate the site via the PowerShell tool.
- Validation: `bun run website:build-static` completes; both restore paths described; internal links resolve.
- Notes: Per root `CLAUDE.md`, `docs-src/` is the authoritative user reference — write it there first.

---

### Milestone 6: Cleanup And Final Verification

- Status: TO BE DONE
- Purpose: Ensure the repository contains only intentional final artifacts and the complete change is verified.
- Exit Criteria: Intermediate artifacts are removed, all final verification passes, TODO-0098 is checked off, the changelog is complete, and the plan status is COMPLETED.

#### Task 6.1: Cleanup Intermediate Artifacts

- Status: TO BE DONE
- Objective: Remove artifacts created only to support implementation.
- Steps:
  1. Inspect the worktree for scratch scripts, seeded backup directories, debug logging added during Milestone 1, and obsolete plan fragments.
  2. Remove the deprecated `MAX_BACKUPS` alias if Task 1.3 did not already.
  3. Confirm no new `.db` fixtures are tracked. `.gitignore` already covers `*.db` and `test_*.db` and no `.db` files under `src-tauri/` are tracked, so this is a check, not a deletion.
  4. Keep the Task 1.1 change-counter test, all retention tests, the manifest privacy test, and the key-material test — they are the contract.
- Validation: Worktree diff contains only intended final changes; `cmd.exe /c bun run check:build-paths` green; `git status --short` shows no unexpected untracked files.
- Notes: Do not remove user-provided files or unrelated worktree changes.

#### Task 6.2: Close TODO-0098 and complete the changelog

- Status: TO BE DONE
- Objective: The originating TODO and the changelog reflect the shipped work.
- Steps:
  1. Mark TODO-0098 `[x]` in `docs/todo/TODO.md`.
  2. Add the Milestone 3–5 changelog entry (Milestones 1–2 were covered by Task 2.3), describing the Backups panel, both restore paths, and the disclosures.
- Validation: `rg "TODO-0098" docs/todo/TODO.md` shows `[x]`; changelog entry present.
- Notes: Archival of the completed TODO is the `todo-manager` or `pre-release` skill's job, not this task's.

#### Task 6.3: Final Verification

- Status: TO BE DONE
- Objective: Validate the integrated change after cleanup.
- Steps:
  1. Run every command in Pre-flight Checks below.
  2. Perform one full manual recovery rehearsal in the dev app: create entries, snapshot, damage the journal, recover via per-entry restore, then via whole-journal restore.
  3. Fix failures and rerun until verification passes, or record the blocker.
- Validation: All Pre-flight Checks pass and the rehearsal succeeds without any manual file manipulation outside the app.
- Notes: Step 2 is the real acceptance test for this plan. A backup system that has never been restored from is not verified.

---

## Approval Gate

Implementation must not start until the user approves this plan.

Milestone 4 carries a second gate: Tasks 4.2 and 4.3 must not start until all seven UX-GATE scenarios have per-scenario sign-off against a rendered prototype or screenshot.

## Pre-flight Checks

Run these before marking the plan COMPLETED. All commands verified to exist in `package.json` on 2026-08-04.

- [ ] `cargo clippy --workspace --all-targets` passes with zero warnings
- [ ] `cargo test --workspace` passes with zero failures
- [ ] `cmd.exe /c bun run type-check` passes
- [ ] `cmd.exe /c bun run lint` passes
- [ ] `cmd.exe /c bun run test:run` passes
- [ ] `cmd.exe /c bun run test:e2e` passes
- [ ] `cmd.exe /c bun run build` succeeds
- [ ] `cmd.exe /c bun run format` succeeds
- [ ] `cmd.exe /c bun run validate:locales` passes — new i18n keys present in all seven locales
- [ ] `cmd.exe /c bun run coverage:diff` passes the ≥80% patch gate
- [ ] `cmd.exe /c bun run check:build-paths` passes
- [ ] `cargo bench --bench backup_bench` runs (Task 1.8)
- [ ] Any text-processing function tested with non-ASCII strings (ASCII + RTL + CJK minimum)
- [ ] Manual recovery rehearsal (Task 6.3 step 2) completed
- [ ] Plan status updated to COMPLETED

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

## Execution Notes

- Update milestone and task status before starting and after validation.
- Update each task to COMPLETED immediately after its validation passes.
- Mark tasks or milestones BLOCKED with a short reason when progress cannot continue.
- Task 1.1 gates the dedup design. If its assumption fails, apply the fallback recorded in that task before proceeding to Task 1.5.
- Task 1.3 must land before Task 1.5. Deduplication cannot work without persisted change counters.
- If a bug is discovered mid-task, either fix it in that task or add a new BLOCKED task to this plan immediately. Do not defer it mentally.
- Do not run `git commit`. Propose commit messages and let the maintainer commit, per project convention.
