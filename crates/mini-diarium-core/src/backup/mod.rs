//! Encrypted-journal snapshots.
//!
//! A *snapshot* is an ordinary, fully encrypted Mini Diarium database: same format, same
//! master key, openable by the app. Nothing here writes plaintext, and nothing here writes
//! key material into the backups directory.
//!
//! The module is split so the interesting half is testable without a filesystem:
//!
//! | File | Responsibility |
//! |---|---|
//! | [`policy`] | Pure decisions — when to snapshot, which snapshots to keep. No I/O, no clock. |
//! | [`store`] | The filesystem: `VACUUM INTO`, fsync, atomic rename, verification, naming. |
//! | [`manifest`] | The `manifest.json` sidecar, including adoption of pre-upgrade files. |
//! | [`inspect`] | Reading a snapshot read-only without adopting it (Milestone 4). |
//! | [`restore`] | Rolling the live journal back to a snapshot (Milestone 4). |
//! | this file | Orchestration — the sequence the layers run in. |
//!
//! # Why snapshots are not file copies
//!
//! The previous implementation copied `diary.db` on unlock and kept the newest 30 files.
//! That has three failure modes this design removes: a busy week of unlocks could evict
//! *every* older backup (time depth was a function of how often the app was opened), a
//! partially written copy was indistinguishable from a good one, and the backup was taken
//! **after** unlock rather than before the migration that might damage the journal.

pub mod inspect;
pub mod manifest;
pub mod policy;
pub mod restore;
pub mod store;

use std::path::Path;

use chrono::{Local, Utc};
use log::{debug, info, warn};

use crate::db::DatabaseConnection;

pub use inspect::{
    compare_snapshot_credentials, list_snapshot_entries, open_snapshot_readonly,
    SnapshotCredential, SnapshotCredentialReport, SnapshotEntry,
};
pub use manifest::{Manifest, MANIFEST_FILE, MANIFEST_SCHEMA_VERSION};
pub use policy::{
    plan_retention, should_snapshot, summarize_health, BackupFailure, BackupHealth,
    RetentionDecision, RetentionPolicy, SkipReason, SnapshotDecision, SnapshotMeta,
    SnapshotTrigger, DAILY_DAYS, MIN_AUTOMATIC_INTERVAL_SECS, MIN_STORAGE_BUDGET_BYTES,
    MONTHLY_MONTHS, RECENT_SNAPSHOTS, WEEKLY_WEEKS,
};
pub use restore::{restore_from_snapshot, RestoreOutcome};
pub use store::{
    is_snapshot_file_name, FsSnapshotStore, SnapshotStore, StoredSnapshot, SNAPSHOT_PREFIX,
};

/// What the engine needs to know beyond the open journal itself.
///
/// `db_path` is required rather than derived: the SQLite change counter that drives
/// deduplication lives in the live database's *file header*, and there is no way to read it
/// through an open connection.
#[derive(Debug, Clone, Copy)]
pub struct BackupContext<'a> {
    pub db_path: &'a Path,
    pub backups_dir: &'a Path,
    /// The **app** version, supplied by the caller. The core crate's own version is
    /// deliberately decoupled from the app's, so `CARGO_PKG_VERSION` here would be wrong.
    ///
    /// `None` where the version is genuinely not in scope — the pre-migration snapshot is
    /// taken from inside `db::schema::open`, which the app calls without passing one. An
    /// absent version is recorded as absent rather than guessed.
    pub app_version: Option<&'a str>,
}

/// What [`create_snapshot`] did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SnapshotOutcome {
    /// A new snapshot was written and verified.
    Created(Box<SnapshotMeta>),
    /// No snapshot was needed. The manifest and retention were still brought up to date.
    Skipped(SkipReason),
}

impl SnapshotOutcome {
    pub fn created(&self) -> Option<&SnapshotMeta> {
        match self {
            SnapshotOutcome::Created(meta) => Some(meta),
            SnapshotOutcome::Skipped(_) => None,
        }
    }
}

/// Takes a snapshot of `db` if the policy calls for one, then applies retention.
///
/// Retention runs on every call, including the skipped ones: that is what lets an upgrading
/// install adopt and immediately thin an oversized legacy backup set without waiting for the
/// next write.
///
/// Returns `Err` only when a snapshot was required and could not be produced. Callers on the
/// unlock path log and continue; the pre-migration caller must **not** — see
/// `db::schema::open`.
pub fn create_snapshot(
    db: &DatabaseConnection,
    ctx: &BackupContext,
    trigger: SnapshotTrigger,
) -> Result<SnapshotOutcome, String> {
    let store = FsSnapshotStore::new(ctx.backups_dir);
    // Clear `.tmp` files abandoned by a crash or a kill before anything else looks at the
    // directory. They never match the listing filter, but they do consume disk.
    let _ = store.sweep_temp_files();

    let mut manifest = manifest::load_reconciled(ctx.backups_dir, &store);
    let policy = RetentionPolicy::for_journal_size(store::file_size(ctx.db_path).unwrap_or(0));
    let now = Utc::now();

    let decision = should_snapshot(
        &manifest.snapshots,
        &trigger,
        store::read_change_counter(ctx.db_path),
        &policy,
        now,
    );

    let outcome = match decision {
        SnapshotDecision::Skip(reason) => {
            debug!("Snapshot skipped ({:?}, trigger {:?})", reason, trigger);
            SnapshotOutcome::Skipped(reason)
        }
        SnapshotDecision::Take => match write_snapshot(db, ctx, &store, trigger.clone()) {
            Ok(meta) => {
                // A success clears the record: the health indicator reports the *current*
                // state, not a museum of everything that ever went wrong.
                manifest.last_failure = None;
                manifest.snapshots.push(meta.clone());
                SnapshotOutcome::Created(Box::new(meta))
            }
            Err(e) => {
                // Persist the failure before propagating. Lock and shutdown snapshots run on
                // a background thread with no UI attached, so without this record a journal
                // whose backups have silently stopped working looks identical to one whose
                // backups are simply up to date.
                manifest.last_failure = Some(BackupFailure {
                    at: now,
                    trigger: trigger.clone(),
                });
                if let Err(save_err) = manifest::save(ctx.backups_dir, &manifest) {
                    warn!("Failed to record a backup failure: {}", save_err);
                }
                return Err(e);
            }
        },
    };

    apply_retention(&mut manifest, &store, &policy, now);

    if let Err(e) = manifest::save(ctx.backups_dir, &manifest) {
        // The snapshot itself is on disk and verified; only its metadata failed to persist.
        // Losing the manifest costs deduplication until the next reconcile, not data.
        warn!("Failed to persist the backup manifest: {}", e);
    }

    Ok(outcome)
}

/// Writes and describes one snapshot.
fn write_snapshot(
    db: &DatabaseConnection,
    ctx: &BackupContext,
    store: &FsSnapshotStore,
    trigger: SnapshotTrigger,
) -> Result<SnapshotMeta, String> {
    // Read the change counter *before* writing, so the recorded value is the state the
    // snapshot actually captures.
    let sqlite_change_counter = store::read_change_counter(ctx.db_path);
    let file_name = store::snapshot_file_name(ctx.backups_dir, Local::now());

    let byte_size = store.write(db, &file_name)?;
    let described = store
        .read(&file_name)
        .map(|path| store::describe_snapshot(&path))
        .unwrap_or_default();

    info!(
        "Snapshot created ({} bytes, trigger {:?})",
        byte_size, trigger
    );

    Ok(SnapshotMeta {
        file_name,
        created_at: Utc::now(),
        trigger,
        byte_size,
        sqlite_change_counter,
        db_schema_version: described.db_schema_version,
        app_version: ctx.app_version.map(str::to_string),
        entry_count: described.entry_count,
        entry_date_range: described.entry_date_range,
        auth_slot_types: described.auth_slot_types,
        // `SnapshotStore::write` only returns `Ok` after proving the file opens and the live
        // master key decrypts it, so this is a fact rather than an assumption.
        verified: true,
    })
}

/// Deletes everything retention decided against, and prunes the manifest to match.
fn apply_retention(
    manifest: &mut Manifest,
    store: &FsSnapshotStore,
    policy: &RetentionPolicy,
    now: chrono::DateTime<Utc>,
) {
    let decision = plan_retention(&manifest.snapshots, policy, now);

    if decision.budget_exceeded {
        warn!(
            "Backup storage budget exceeded; thinned the most recent snapshots to stay under \
             {} bytes",
            policy.storage_budget_bytes
        );
    }

    for evicted in &decision.evict {
        if let Err(e) = store.delete(&evicted.file_name) {
            warn!("Failed to evict an old snapshot: {}", e);
        }
    }
    if !decision.evict.is_empty() {
        debug!("Retention evicted {} snapshot(s)", decision.evict.len());
    }

    manifest.snapshots = decision.keep;
}

/// Lists the snapshots in `backups_dir`, newest first.
///
/// Needs no key and no open journal: it reconciles the manifest against the directory and
/// describes anything the manifest does not already know about.
pub fn list_snapshots(backups_dir: &Path) -> Result<Vec<SnapshotMeta>, String> {
    let store = FsSnapshotStore::new(backups_dir);
    Ok(manifest::load_reconciled(backups_dir, &store).snapshots)
}

/// Summarises the state of `backups_dir` for the UI's health indicator.
///
/// Needs no key and no open journal, for the same reason [`list_snapshots`] does not: every
/// field comes from the plaintext manifest or from the two directories themselves. `db_path`
/// is taken rather than a pre-computed size because it answers two questions — how large the
/// journal is, which scales the storage budget, and whether the journal is still where we
/// left it, which is what [`backups_dir_is_usable`] needs.
pub fn backup_health(backups_dir: &Path, db_path: &Path) -> BackupHealth {
    let store = FsSnapshotStore::new(backups_dir);
    let manifest = manifest::load_reconciled(backups_dir, &store);
    let policy = RetentionPolicy::for_journal_size(store::file_size(db_path).unwrap_or(0));

    summarize_health(
        &manifest.snapshots,
        &policy,
        manifest.last_failure,
        backups_dir_is_usable(backups_dir, db_path),
    )
}

/// Whether snapshots can be written — the backups directory exists, or the journal's own
/// directory does and it can therefore be created beside it.
///
/// Testing only for the backups directory would tell every new user their backups folder is
/// unreachable: the engine creates it on the first write, and the app nests it two levels
/// deep (`{journal dir}/backups/{db stem}`), so none of it exists until a snapshot is taken.
///
/// The journal's directory is the right second question, and a stronger one than "could
/// `create_dir_all` succeed". On Unix that weaker test is nearly always true — `/` exists,
/// so an unmounted `/media/user/USB` would happily get a backups folder created on the local
/// disk instead, and the check would report health while backing up to the wrong place. If
/// the journal's own directory is gone, the journal is unreachable and so is everything
/// beside it, on every platform.
///
/// A directory that exists and enumerates is still not proof of write permission. That last
/// failure surfaces through `last_failure` — but only when the manifest beside it is
/// writable, which a blocked path is precisely not. So this signal is the only honest one
/// there: when the path cannot hold a snapshot it cannot hold the record of that failure
/// either, and `directory_accessible` has to carry it alone.
fn backups_dir_is_usable(backups_dir: &Path, db_path: &Path) -> bool {
    match store::dir_state(backups_dir) {
        store::DirState::Usable => true,
        store::DirState::Blocked => false,
        // Not created yet: the normal first run, so ask the journal's own directory instead.
        store::DirState::Absent => db_path.parent().is_some_and(Path::is_dir),
    }
}

/// Re-checks an existing snapshot against the live master key and records the result.
///
/// This is the on-demand form of the verification [`SnapshotStore::write`] already performs:
/// it is what turns an adopted pre-upgrade file's `verified: false` into a confirmed `true`,
/// and what catches a snapshot that has rotted on disk since it was written.
///
/// A snapshot that fails is **not** deleted. An unverified snapshot the user can see and
/// decide about is more useful than one that vanished while they were looking at it, and a
/// snapshot that this journal's key cannot read may still be readable by the credential it
/// was taken with (see the plan's finding B-11).
pub fn verify_snapshot_file(
    db: &DatabaseConnection,
    backups_dir: &Path,
    file_name: &str,
) -> Result<SnapshotMeta, String> {
    let store = FsSnapshotStore::new(backups_dir);
    let path = store.read(file_name)?;

    let verified = match store::verify_snapshot(&path, db.key()) {
        Ok(()) => true,
        Err(e) => {
            warn!("Snapshot verification failed: {}", e);
            false
        }
    };

    let mut manifest = manifest::load_reconciled(backups_dir, &store);
    let record = manifest
        .snapshots
        .iter_mut()
        .find(|s| s.file_name == file_name)
        .ok_or_else(|| "Snapshot not found".to_string())?;
    record.verified = verified;
    let updated = record.clone();

    if let Err(e) = manifest::save(backups_dir, &manifest) {
        warn!("Failed to persist the backup manifest: {}", e);
    }

    Ok(updated)
}

/// Deletes one snapshot and forgets it.
///
/// The name is validated against the engine's own naming rule before it reaches the
/// filesystem, so a caller cannot address anything outside the backups directory or delete
/// something the engine does not own — `manifest.json` included.
pub fn delete_snapshot(backups_dir: &Path, file_name: &str) -> Result<(), String> {
    let store = FsSnapshotStore::new(backups_dir);
    store.delete(file_name)?;

    let mut manifest = manifest::load_reconciled(backups_dir, &store);
    manifest.snapshots.retain(|s| s.file_name != file_name);
    manifest::save(backups_dir, &manifest)
}

/// Opens one snapshot read-only for inspection, addressed by file name.
///
/// The name goes through the same validation as [`delete_snapshot`] before it touches the
/// filesystem, so a caller cannot address anything outside the backups directory. The
/// returned connection is the caller's to hold and drop; dropping it zeroizes the key.
///
/// See [`inspect`] for why this cannot simply open the snapshot as a journal.
pub fn open_snapshot_file(
    backups_dir: &Path,
    file_name: &str,
    credential: inspect::SnapshotCredential,
) -> Result<DatabaseConnection, String> {
    let store = FsSnapshotStore::new(backups_dir);
    let path = store.read(file_name)?;
    inspect::open_snapshot_readonly(&path, credential)
}

/// Reports whether one snapshot still accepts the live journal's credentials, by file name.
///
/// Needs no key and no unlocked journal: auth-slot rows are plaintext. That is what lets the
/// UI warn *before* asking for a credential (scenario UX-3) rather than after a failure.
pub fn check_snapshot_credentials(
    backups_dir: &Path,
    file_name: &str,
    live_db_path: &Path,
) -> Result<inspect::SnapshotCredentialReport, String> {
    let store = FsSnapshotStore::new(backups_dir);
    let path = store.read(file_name)?;
    inspect::compare_snapshot_credentials(&path, live_db_path)
}

/// Pre-v3 migration snapshot, for journals that predate the auth-slot model.
///
/// v1/v2 journals have no `auth_slots` table and a password-derived key rather than a
/// wrapped master key, so the full verification in [`store`] cannot apply. This still gets
/// the important half — `VACUUM INTO` into a temp name, fsync, atomic rename, and a check
/// that the result opens — rather than the raw `fs::copy` it replaces.
pub fn create_pre_v3_snapshot(
    db: &DatabaseConnection,
    backups_dir: &Path,
) -> Result<String, String> {
    let store = FsSnapshotStore::new(backups_dir);
    let _ = store.sweep_temp_files();
    let file_name = store::snapshot_file_name(backups_dir, Local::now());
    store.write_openable_only(db, &file_name)?;
    Ok(file_name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{create_database, insert_entry, DiaryEntry};
    use chrono::Duration;

    fn entry(date: &str, title: &str) -> DiaryEntry {
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: title.to_string(),
            text: "body".to_string(),
            word_count: 1,
            date_created: format!("{date}T00:00:00Z"),
            date_updated: format!("{date}T00:00:00Z"),
            metadata: None,
            locked: false,
        }
    }

    struct Fixture {
        _dir: tempfile::TempDir,
        db_path: std::path::PathBuf,
        backups_dir: std::path::PathBuf,
        db: DatabaseConnection,
    }

    impl Fixture {
        fn new(name: &str) -> Self {
            let dir = tempfile::Builder::new()
                .prefix(&format!("mini-diarium-backup-{name}-"))
                .tempdir()
                .unwrap();
            let db_path = dir.path().join("diary.db");
            let backups_dir = dir.path().join("backups");
            let db = create_database(&db_path, "test_password".to_string()).unwrap();
            insert_entry(&db, &entry("2024-01-15", "Seed")).unwrap();
            Self {
                _dir: dir,
                db_path,
                backups_dir,
                db,
            }
        }

        fn ctx(&self) -> BackupContext<'_> {
            BackupContext {
                db_path: &self.db_path,
                backups_dir: &self.backups_dir,
                app_version: Some("0.6.4"),
            }
        }

        fn snapshot(&self, trigger: SnapshotTrigger) -> SnapshotOutcome {
            create_snapshot(&self.db, &self.ctx(), trigger).unwrap()
        }

        fn files(&self) -> Vec<String> {
            FsSnapshotStore::new(&self.backups_dir)
                .list()
                .unwrap()
                .into_iter()
                .map(|s| s.file_name)
                .collect()
        }
    }

    #[test]
    fn test_snapshot_is_created_recorded_and_verified() {
        let fixture = Fixture::new("create");

        let outcome = fixture.snapshot(SnapshotTrigger::Manual);
        let meta = outcome
            .created()
            .expect("a manual snapshot is never skipped");

        assert!(meta.verified);
        assert_eq!(meta.entry_count, Some(1));
        assert_eq!(meta.db_schema_version, Some(crate::db::SCHEMA_VERSION));
        assert_eq!(meta.app_version.as_deref(), Some("0.6.4"));
        assert!(meta.sqlite_change_counter.is_some());
        assert_eq!(meta.trigger, SnapshotTrigger::Manual);

        // Persisted, and readable back without a key.
        let listed = list_snapshots(&fixture.backups_dir).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0], *meta);
    }

    #[test]
    fn test_repeated_unlocks_without_writes_produce_one_snapshot() {
        // The E2E lanes unlock repeatedly against an unchanging journal; so does any user
        // who opens the app to read.
        let fixture = Fixture::new("dedup");

        assert!(fixture
            .snapshot(SnapshotTrigger::Unlock)
            .created()
            .is_some());
        for _ in 0..10 {
            assert_eq!(
                fixture.snapshot(SnapshotTrigger::Unlock),
                SnapshotOutcome::Skipped(SkipReason::Unchanged)
            );
        }

        assert_eq!(fixture.files().len(), 1);
    }

    #[test]
    fn test_a_write_makes_the_next_unlock_snapshot_again() {
        let fixture = Fixture::new("changed");
        assert!(fixture
            .snapshot(SnapshotTrigger::Unlock)
            .created()
            .is_some());

        insert_entry(&fixture.db, &entry("2024-02-01", "New")).unwrap();

        // Changed, but inside the minimum interval: still suppressed for an automatic
        // trigger, and still taken for a risky one.
        assert_eq!(
            fixture.snapshot(SnapshotTrigger::Unlock),
            SnapshotOutcome::Skipped(SkipReason::TooSoon)
        );
        assert!(fixture
            .snapshot(SnapshotTrigger::destructive("run_import_plugin"))
            .created()
            .is_some());
        assert_eq!(fixture.files().len(), 2);
    }

    #[test]
    fn test_burst_of_manual_snapshots_cannot_destroy_time_depth() {
        // End-to-end version of the policy-level guard: seed a year of monthly snapshots in
        // the manifest, then hammer the engine and confirm the old ones survive.
        let fixture = Fixture::new("burst");
        fixture.snapshot(SnapshotTrigger::Manual);

        let store = FsSnapshotStore::new(&fixture.backups_dir);
        let mut manifest = manifest::load_reconciled(&fixture.backups_dir, &store);
        let real = manifest.snapshots[0].clone();
        for month in 1..=12u32 {
            let mut old = real.clone();
            old.file_name = format!("backup-old-{month:02}.db");
            old.created_at = Utc::now() - Duration::days(30 * month as i64);
            std::fs::copy(
                fixture.backups_dir.join(&real.file_name),
                fixture.backups_dir.join(&old.file_name),
            )
            .unwrap();
            manifest.snapshots.push(old);
        }
        manifest::save(&fixture.backups_dir, &manifest).unwrap();

        for i in 0..50 {
            insert_entry(&fixture.db, &entry("2024-03-01", &format!("Burst {i}"))).unwrap();
            fixture.snapshot(SnapshotTrigger::Manual);
        }

        let files = fixture.files();
        for month in 1..=12u32 {
            assert!(
                files.contains(&format!("backup-old-{month:02}.db")),
                "burst activity evicted the snapshot from {month} month(s) ago"
            );
        }
    }

    #[test]
    fn test_retention_runs_even_when_the_snapshot_is_skipped() {
        let fixture = Fixture::new("skip-retention");
        fixture.snapshot(SnapshotTrigger::Manual);

        // 40 same-day legacy files, well past the recent tier, with nothing else to claim
        // them.
        let source = fixture.backups_dir.join(fixture.files()[0].clone());
        for i in 0..40 {
            std::fs::copy(
                &source,
                fixture
                    .backups_dir
                    .join(format!("backup-2020-01-01-{:02}h00.db", i)),
            )
            .unwrap();
        }

        // Unchanged journal → skipped, but the legacy set is still adopted and thinned.
        assert!(matches!(
            fixture.snapshot(SnapshotTrigger::Unlock),
            SnapshotOutcome::Skipped(_)
        ));

        let files = fixture.files();
        assert!(
            files.len() < 41,
            "an oversized legacy set was adopted without being thinned ({} files)",
            files.len()
        );
        assert!(
            files.len() >= RECENT_SNAPSHOTS,
            "retention thinned below the recent tier"
        );
    }

    #[test]
    fn test_health_summarizes_the_backups_directory() {
        let fixture = Fixture::new("health");

        // Nothing written yet: the directory does not exist, and that is a first-run state
        // rather than a fault. It must still report as usable — the engine creates it on the
        // first write, and telling a new user their backups folder is unreachable before
        // they have ever taken one is a false alarm. The app nests the directory two levels
        // (`{journal dir}/backups/{db stem}`), so check that shape, not just one level.
        let nested = fixture.backups_dir.join("nested-like-the-app-does");
        assert!(
            backup_health(&nested, &fixture.db_path).directory_accessible,
            "a never-backed-up journal must not report a broken folder"
        );

        let empty = backup_health(&fixture.backups_dir, &fixture.db_path);
        assert_eq!(empty.snapshot_count, 0);
        assert_eq!(empty.total_bytes, 0);
        assert!(
            empty.directory_accessible,
            "a journal that has never been backed up is not a broken one"
        );
        assert!(!empty.budget_exceeded);
        assert!(empty.last_failure.is_none());
        assert_eq!(empty.newest_created_at, None);

        fixture.snapshot(SnapshotTrigger::Manual);
        insert_entry(&fixture.db, &entry("2024-02-01", "Second")).unwrap();
        fixture.snapshot(SnapshotTrigger::Manual);

        let health = backup_health(&fixture.backups_dir, &fixture.db_path);
        assert_eq!(health.snapshot_count, 2);
        assert_eq!(health.verified_count, 2);
        assert!(health.directory_accessible);
        assert!(health.total_bytes > 0);
        // Two small snapshots cannot exceed the 2 GB floor.
        assert_eq!(health.budget_bytes, MIN_STORAGE_BUDGET_BYTES);
        assert!(!health.budget_exceeded);
        assert!(health.newest_created_at >= health.oldest_created_at);
        assert_eq!(health.recent, RECENT_SNAPSHOTS);
    }

    #[test]
    fn test_health_reports_a_vanished_journal_directory_as_unreachable() {
        // The failure this signal exists for: the journal lives on a removable or synced
        // drive that went away, taking its directory and the backups beside it.
        let fixture = Fixture::new("health-unreachable");
        fixture.snapshot(SnapshotTrigger::Manual);
        assert!(backup_health(&fixture.backups_dir, &fixture.db_path).directory_accessible);

        let gone = fixture
            .db_path
            .parent()
            .unwrap()
            .join("unmounted-drive")
            .join("journal");
        let health = backup_health(&gone.join("backups").join("diary"), &gone.join("diary.db"));

        assert!(
            !health.directory_accessible,
            "a journal whose own directory is gone must not report healthy backups"
        );
        assert_eq!(health.snapshot_count, 0);
    }

    #[test]
    fn test_a_failed_snapshot_is_recorded_and_cleared_by_the_next_success() {
        // The failure that matters most happens on the lock or shutdown path, on a
        // background thread with nothing watching. Unless it is persisted, a journal whose
        // backups have stopped working is indistinguishable from one that is up to date.
        let fixture = Fixture::new("failure-record");

        // Fault injection with a healthy backups directory: a connection to the real journal
        // carrying the wrong master key. `VACUUM INTO` succeeds, post-write verification
        // fails, the snapshot is deleted — and the manifest is still writable, which is what
        // makes the failure recordable.
        let wrong_key = crate::crypto::cipher::Key::from_slice(&[9u8; 32]).unwrap();
        let impostor = DatabaseConnection::from_parts(
            crate::db::schema::open_connection(&fixture.db_path).unwrap(),
            wrong_key,
        );

        let result = create_snapshot(&impostor, &fixture.ctx(), SnapshotTrigger::Lock);
        assert!(result.is_err(), "verification should have rejected this");
        drop(impostor);

        let health = backup_health(&fixture.backups_dir, &fixture.db_path);
        let failure = health
            .last_failure
            .expect("the failed attempt was not recorded");
        assert_eq!(failure.trigger, SnapshotTrigger::Lock);
        assert_eq!(
            health.snapshot_count, 0,
            "a snapshot that failed verification must leave no file behind"
        );

        // A success is the all-clear. The indicator reports the current state, not history.
        fixture.snapshot(SnapshotTrigger::Manual);
        assert!(backup_health(&fixture.backups_dir, &fixture.db_path)
            .last_failure
            .is_none());
    }

    #[test]
    fn test_verify_confirms_an_adopted_snapshot() {
        let fixture = Fixture::new("verify");
        fixture.snapshot(SnapshotTrigger::Manual);

        // Drop the manifest so the snapshot is re-adopted as unverified — the exact state a
        // user upgrading from a pre-manifest version sees.
        std::fs::remove_file(fixture.backups_dir.join(MANIFEST_FILE)).unwrap();
        let adopted = list_snapshots(&fixture.backups_dir).unwrap();
        assert_eq!(adopted.len(), 1);
        assert!(!adopted[0].verified);

        let verified =
            verify_snapshot_file(&fixture.db, &fixture.backups_dir, &adopted[0].file_name).unwrap();

        assert!(verified.verified);
        // Persisted, not just returned.
        assert!(list_snapshots(&fixture.backups_dir).unwrap()[0].verified);
    }

    #[test]
    fn test_verify_reports_a_snapshot_the_live_key_cannot_read_without_deleting_it() {
        let fixture = Fixture::new("verify-fail");
        fixture.snapshot(SnapshotTrigger::Manual);
        let file_name = fixture.files()[0].clone();

        let wrong_key = crate::crypto::cipher::Key::from_slice(&[9u8; 32]).unwrap();
        let impostor = DatabaseConnection::from_parts(
            crate::db::schema::open_connection(&fixture.db_path).unwrap(),
            wrong_key,
        );

        let checked = verify_snapshot_file(&impostor, &fixture.backups_dir, &file_name).unwrap();

        assert!(!checked.verified);
        assert!(
            fixture.backups_dir.join(&file_name).exists(),
            "a snapshot this journal's key cannot read may still be readable with the \
             credential it was taken with — it must not be deleted"
        );
    }

    #[test]
    fn test_delete_removes_the_file_and_its_record() {
        let fixture = Fixture::new("delete");
        fixture.snapshot(SnapshotTrigger::Manual);
        let file_name = fixture.files()[0].clone();

        delete_snapshot(&fixture.backups_dir, &file_name).unwrap();

        assert!(!fixture.backups_dir.join(&file_name).exists());
        assert!(list_snapshots(&fixture.backups_dir).unwrap().is_empty());
    }

    #[test]
    fn test_delete_refuses_to_address_anything_outside_the_backups_directory() {
        // Snapshot names reach this call from the frontend, so the name is untrusted input.
        let fixture = Fixture::new("delete-traversal");
        fixture.snapshot(SnapshotTrigger::Manual);
        assert!(fixture.db_path.exists());

        for hostile in [
            "backup-../../diary.db",
            "backup-..\\..\\diary.db",
            "../diary.db",
            MANIFEST_FILE,
        ] {
            assert!(
                delete_snapshot(&fixture.backups_dir, hostile).is_err(),
                "delete accepted a name it does not own: {hostile}"
            );
        }

        assert!(fixture.db_path.exists(), "the live journal was deleted");
        assert_eq!(list_snapshots(&fixture.backups_dir).unwrap().len(), 1);
    }

    #[test]
    fn test_health_reports_a_backups_path_blocked_by_a_file_as_unusable() {
        // The failure mode that made every other signal lie: with the path blocked, the
        // snapshot cannot be written *and* `manifest.json` cannot record that it failed, so
        // `directory_accessible` is the only place the truth can surface.
        let fixture = Fixture::new("health-blocked");

        // Shape 1 — the backups path itself is occupied by a file.
        std::fs::write(&fixture.backups_dir, b"not a directory").unwrap();

        assert!(
            create_snapshot(&fixture.db, &fixture.ctx(), SnapshotTrigger::Manual).is_err(),
            "a snapshot cannot be written into a path occupied by a file"
        );
        let health = backup_health(&fixture.backups_dir, &fixture.db_path);
        assert!(
            !health.directory_accessible,
            "a backups path occupied by a file must not report as usable"
        );
        assert!(
            health.last_failure.is_none(),
            "the failure record cannot be persisted into a blocked path — which is exactly \
             why `directory_accessible` has to carry this on its own"
        );

        // Shape 2 — the nesting the app really uses, with the intermediate level blocked.
        let nested = fixture.backups_dir.join("diary");
        let ctx = BackupContext {
            db_path: &fixture.db_path,
            backups_dir: &nested,
            app_version: Some("0.6.4"),
        };

        assert!(create_snapshot(&fixture.db, &ctx, SnapshotTrigger::Manual).is_err());
        let nested_health = backup_health(&nested, &fixture.db_path);
        assert!(
            !nested_health.directory_accessible,
            "a file occupying a parent of the backups directory must not report as usable"
        );
        assert!(nested_health.last_failure.is_none());
    }

    #[cfg(unix)]
    #[test]
    fn test_health_reports_an_unreadable_backups_directory_as_unusable() {
        use std::fs::Permissions;
        use std::os::unix::fs::PermissionsExt;

        let fixture = Fixture::new("health-unreadable");
        fixture.snapshot(SnapshotTrigger::Manual);
        assert!(backup_health(&fixture.backups_dir, &fixture.db_path).directory_accessible);

        std::fs::set_permissions(&fixture.backups_dir, Permissions::from_mode(0o000)).unwrap();
        let health = backup_health(&fixture.backups_dir, &fixture.db_path);
        // Restore first: an unreadable directory would fail the `TempDir` drop as well, and a
        // panic below must not leave the temp tree behind.
        std::fs::set_permissions(&fixture.backups_dir, Permissions::from_mode(0o700)).unwrap();

        assert!(
            !health.directory_accessible,
            "a backups directory that cannot be enumerated must not report as usable"
        );
    }

    #[test]
    fn test_a_failed_snapshot_is_an_error_not_a_silent_skip() {
        let fixture = Fixture::new("failure");
        // Occupy the backups directory path with a file so the directory cannot be created.
        std::fs::write(&fixture.backups_dir, b"not a directory").unwrap();

        let result = create_snapshot(&fixture.db, &fixture.ctx(), SnapshotTrigger::Migration);

        assert!(
            result.is_err(),
            "a snapshot that could not be written must surface as Err — the pre-migration \
             caller aborts on it"
        );
    }
}
