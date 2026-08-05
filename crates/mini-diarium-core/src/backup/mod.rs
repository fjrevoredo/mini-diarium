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
//! | this file | Orchestration — the sequence the three layers run in. |
//!
//! # Why snapshots are not file copies
//!
//! The previous implementation copied `diary.db` on unlock and kept the newest 30 files.
//! That has three failure modes this design removes: a busy week of unlocks could evict
//! *every* older backup (time depth was a function of how often the app was opened), a
//! partially written copy was indistinguishable from a good one, and the backup was taken
//! **after** unlock rather than before the migration that might damage the journal.

pub mod manifest;
pub mod policy;
pub mod store;

use std::path::Path;

use chrono::{Local, Utc};
use log::{debug, info, warn};

use crate::db::DatabaseConnection;

pub use manifest::{Manifest, MANIFEST_FILE, MANIFEST_SCHEMA_VERSION};
pub use policy::{
    plan_retention, should_snapshot, RetentionDecision, RetentionPolicy, SkipReason,
    SnapshotDecision, SnapshotMeta, SnapshotTrigger, DAILY_DAYS, MIN_AUTOMATIC_INTERVAL_SECS,
    MIN_STORAGE_BUDGET_BYTES, MONTHLY_MONTHS, RECENT_SNAPSHOTS, WEEKLY_WEEKS,
};
pub use store::{FsSnapshotStore, SnapshotStore, StoredSnapshot};

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
        SnapshotDecision::Take => {
            let meta = write_snapshot(db, ctx, &store, trigger)?;
            manifest.snapshots.push(meta.clone());
            SnapshotOutcome::Created(Box::new(meta))
        }
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
