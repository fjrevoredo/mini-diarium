//! Rolling the live journal back to a snapshot.
//!
//! A snapshot is already a complete, valid encrypted database, so restoring is a full-file
//! atomic swap, not a merge and not a second `VACUUM INTO` pass — the same write-then-rename
//! pattern [`super::store`] uses for *taking* a snapshot, aimed the other direction.
//!
//! # The master key does not change
//!
//! This module never asks for a credential. `change_password` re-wraps the **same** master
//! key in O(1) — it never re-encrypts entries — so the plaintext master key is invariant for
//! the whole life of a journal (barring `reset_diary`, which creates a brand-new journal with
//! a brand-new key and is not a case this module can restore into). The key held by the live
//! connection at the moment restore is called is therefore the same key that decrypts *every*
//! snapshot this journal ever produced, however old, however many password changes have
//! happened since. [`precheck_restorable`] still verifies this empirically rather than
//! asserting it, because an adopted pre-upgrade snapshot or a snapshot surviving a
//! `reset_diary` is a real (if rare) way for that invariant to not hold.
//!
//! # Ownership
//!
//! [`restore_from_snapshot`] takes the live `DatabaseConnection` **by value**. That is not
//! incidental: owning it is what proves no other code path can reach the journal while the
//! file underneath it is being replaced. It always hands a connection back in
//! [`RestoreOutcome::db`] — the original, unchanged connection if nothing was touched yet, a
//! connection reopened on the restored content on success, or a connection rolled back to the
//! safety snapshot on a post-swap failure. `db` is only `None` in the unrecoverable case where
//! not even the rollback could be reopened, which the caller must treat as "locked" and report
//! plainly — the safety snapshot's file name is always included so the user is never left
//! without a name to act on.

use std::path::Path;

use zeroize::Zeroizing;

use crate::crypto::cipher;
use crate::db::schema::migrations::apply_pending;
use crate::db::schema::open_connection;
use crate::db::DatabaseConnection;

use super::store::{self, FsSnapshotStore, SnapshotStore};
use super::{create_snapshot, BackupContext, SnapshotMeta, SnapshotOutcome, SnapshotTrigger};

/// What happened when [`restore_from_snapshot`] was called.
///
/// Deliberately not a `Result`: every path — success, an aborted attempt, or a rolled-back
/// failure — needs to hand a usable connection back to the caller, and `Result<T, E>` cannot
/// carry a value on both branches without an awkward wrapper. See the module doc for what
/// each field means on each path.
pub struct RestoreOutcome {
    /// A connection the caller should install back into its session state.
    ///
    /// `None` only in the unrecoverable case: the swap or a rollback happened, but neither
    /// the restored file nor the safety snapshot could be reopened afterwards. The caller
    /// must treat the journal as locked in that case.
    pub db: Option<DatabaseConnection>,
    /// The safety snapshot taken before anything was touched, once one exists. `None` only
    /// when the attempt was aborted before that point (an unreadable or incompatible target
    /// snapshot, or a failure taking the safety snapshot itself).
    pub safety_snapshot: Option<SnapshotMeta>,
    /// `true` only when the journal now holds the restored snapshot's content.
    pub restored: bool,
    /// Present on every path except a full, clean success.
    pub error: Option<String>,
}

impl RestoreOutcome {
    fn aborted(db: DatabaseConnection, error: String) -> Self {
        Self {
            db: Some(db),
            safety_snapshot: None,
            restored: false,
            error: Some(error),
        }
    }

    fn unrecoverable(safety_snapshot: SnapshotMeta, reason: String, extra: String) -> Self {
        Self {
            db: None,
            safety_snapshot: Some(safety_snapshot.clone()),
            restored: false,
            error: Some(format!(
                "Restore failed ({reason}) and automatic recovery also failed ({extra}). Your \
                 original journal is preserved as the backup '{}' — restore it manually from \
                 the Backups panel.",
                safety_snapshot.file_name
            )),
        }
    }
}

/// Restores the live journal to the content of `file_name`.
///
/// Takes `db` — the live connection — by value, and a `PreRestore` safety snapshot of its
/// current state before anything is touched. Aborts before any write if the target snapshot
/// cannot be read, is too old a format to restore automatically, cannot be decrypted with the
/// live master key, or if the safety snapshot itself fails. See the module doc for what
/// happens on a failure that occurs after the file swap has already begun.
pub fn restore_from_snapshot(
    db: DatabaseConnection,
    ctx: &BackupContext,
    file_name: &str,
) -> RestoreOutcome {
    let store = FsSnapshotStore::new(ctx.backups_dir);

    let snapshot_path = match store.read(file_name) {
        Ok(path) => path,
        Err(e) => return RestoreOutcome::aborted(db, e),
    };

    // Stage a private copy *before* anything else touches the backups directory. The safety
    // snapshot taken next runs retention on every call, and retention can evict the very
    // file being restored — once staged, that no longer matters.
    let staged = match store::stage_restore_copy(ctx.db_path, &snapshot_path) {
        Ok(path) => path,
        Err(e) => return RestoreOutcome::aborted(db, e),
    };

    if let Err(e) = precheck_restorable(&staged, db.key()) {
        let _ = std::fs::remove_file(&staged);
        return RestoreOutcome::aborted(db, e);
    }

    let safety_snapshot = match create_snapshot(&db, ctx, SnapshotTrigger::PreRestore) {
        Ok(SnapshotOutcome::Created(meta)) => *meta,
        Ok(SnapshotOutcome::Skipped(_)) => {
            let _ = std::fs::remove_file(&staged);
            return RestoreOutcome::aborted(
                db,
                "The safety snapshot was unexpectedly skipped; restore aborted.".to_string(),
            );
        }
        Err(e) => {
            let _ = std::fs::remove_file(&staged);
            return RestoreOutcome::aborted(
                db,
                format!("Could not take a safety snapshot before restoring: {e}"),
            );
        }
    };

    // The master key never changes across a password change (see the module doc), so this
    // is the same key that will decrypt the restored content — and the same key the rollback
    // path below needs if the restore fails partway through.
    let key_bytes = Zeroizing::new(*db.key().as_bytes());
    drop(db);

    if let Err(swap_err) = store::finalize_restore(ctx.db_path, &staged) {
        return match reopen_current(ctx.db_path, &key_bytes) {
            Ok(db) => RestoreOutcome {
                db: Some(db),
                safety_snapshot: Some(safety_snapshot),
                restored: false,
                error: Some(swap_err),
            },
            Err(reopen_err) => RestoreOutcome::unrecoverable(safety_snapshot, swap_err, reopen_err),
        };
    }

    match reopen_current(ctx.db_path, &key_bytes) {
        Ok(db) => RestoreOutcome {
            db: Some(db),
            safety_snapshot: Some(safety_snapshot),
            restored: true,
            error: None,
        },
        Err(reopen_err) => roll_back(&store, ctx.db_path, &key_bytes, safety_snapshot, reopen_err),
    }
}

/// Rolls `db_path` back to `safety_snapshot` after a failure discovered post-swap.
///
/// Reuses the same stage-then-finalize primitives the forward restore uses, aimed at the
/// safety snapshot instead. The safety snapshot was just created and is therefore the newest
/// snapshot in the directory — `plan_retention` never evicts the single newest snapshot — so
/// it is still exactly where it was left.
fn roll_back(
    store: &FsSnapshotStore,
    db_path: &Path,
    key_bytes: &[u8; 32],
    safety_snapshot: SnapshotMeta,
    reason: String,
) -> RestoreOutcome {
    let safety_path = match store.read(&safety_snapshot.file_name) {
        Ok(path) => path,
        Err(e) => return RestoreOutcome::unrecoverable(safety_snapshot, reason, e),
    };
    let staged = match store::stage_restore_copy(db_path, &safety_path) {
        Ok(path) => path,
        Err(e) => return RestoreOutcome::unrecoverable(safety_snapshot, reason, e),
    };
    if let Err(e) = store::finalize_restore(db_path, &staged) {
        return RestoreOutcome::unrecoverable(safety_snapshot, reason, e);
    }

    match reopen_current(db_path, key_bytes) {
        Ok(db) => RestoreOutcome {
            db: Some(db),
            safety_snapshot: Some(safety_snapshot),
            restored: false,
            error: Some(format!(
                "Restore failed ({reason}) and was automatically rolled back. Your journal is \
                 unchanged."
            )),
        },
        Err(reopen_err) => RestoreOutcome::unrecoverable(safety_snapshot, reason, reopen_err),
    }
}

/// Whether `path` can actually be restored: a v3+ journal the live master key decrypts.
///
/// The version check exists for a clear message rather than the generic one
/// `verify_snapshot`'s `auth_slots` query would produce for a table that predates v3.
/// Pre-v3 journals keep their key in the legacy `metadata` table under a password-derived
/// key, not a wrapped master key — the same reason [`super::inspect::open_snapshot_readonly`]
/// refuses them, and restore cannot do it either: `apply_pending` only covers v3 onward.
fn precheck_restorable(path: &Path, key: &cipher::Key) -> Result<(), String> {
    let description = store::describe_snapshot(path);
    let version = description
        .db_schema_version
        .ok_or_else(|| "This backup could not be read.".to_string())?;
    if version < 3 {
        return Err(
            "This backup uses a journal format older than version 3 and cannot be restored \
             automatically."
                .to_string(),
        );
    }

    store::verify_snapshot(path, key).map_err(|e| {
        format!(
            "This backup could not be restored: {e} It may have been taken with a different \
             password, or before this journal was reset."
        )
    })
}

/// Reopens `db_path` with `key_bytes`, running any pending schema migration.
///
/// A restored snapshot's schema version may be older than the app's current one — the
/// pre-migration snapshot is, by definition, always one migration behind — so this mirrors
/// what `open_database` does after unlocking, minus the credential step this module never
/// needs.
fn reopen_current(db_path: &Path, key_bytes: &[u8; 32]) -> Result<DatabaseConnection, String> {
    let conn = open_connection(db_path)?;
    let encryption_key = cipher::Key::from_slice(key_bytes).ok_or("Invalid master key size")?;
    let db = DatabaseConnection {
        conn,
        encryption_key,
    };
    apply_pending(&db)?;
    Ok(db)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{create_database, insert_entry, DiaryEntry};

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
    }

    impl Fixture {
        fn new(name: &str) -> Self {
            let dir = tempfile::Builder::new()
                .prefix(&format!("mini-diarium-restore-{name}-"))
                .tempdir()
                .unwrap();
            Self {
                db_path: dir.path().join("diary.db"),
                backups_dir: dir.path().join("backups"),
                _dir: dir,
            }
        }

        fn ctx(&self) -> BackupContext<'_> {
            BackupContext {
                db_path: &self.db_path,
                backups_dir: &self.backups_dir,
                app_version: Some("0.0.0-test"),
            }
        }
    }

    #[test]
    fn test_restore_replaces_the_journal_with_the_snapshots_content() {
        let fixture = Fixture::new("happy-path");
        let db = create_database(&fixture.db_path, "password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "Before")).unwrap();
        create_snapshot(&db, &fixture.ctx(), SnapshotTrigger::Manual).unwrap();
        let target = super::super::list_snapshots(&fixture.backups_dir).unwrap()[0]
            .file_name
            .clone();

        insert_entry(&db, &entry("2024-02-01", "After the snapshot")).unwrap();

        let outcome = restore_from_snapshot(db, &fixture.ctx(), &target);

        assert!(
            outcome.restored,
            "restore did not succeed: {:?}",
            outcome.error
        );
        assert!(outcome.error.is_none());
        let restored_db = outcome
            .db
            .expect("a successful restore returns a connection");
        let entries = crate::db::get_all_entries(&restored_db).unwrap();
        assert_eq!(
            entries.len(),
            1,
            "the entry written after the snapshot survived the restore"
        );
        assert_eq!(entries[0].title, "Before");
    }

    #[test]
    fn test_restore_migrates_a_pre_migration_snapshot_to_the_current_schema() {
        // The most valuable snapshot this plan produces is the pre-migration one — by
        // definition an older schema than the app expects. Restoring it must not leave the
        // journal stuck on that old schema, and `reopen_current` calling `apply_pending`
        // directly (rather than `open_database`, which would take a second pre-migration
        // snapshot of its own) must still actually run the migration.
        let fixture = Fixture::new("pre-migration-restore");

        // Roll a real v12 journal back, the same trick `open.rs`'s own pre-migration test
        // uses: build the current schema, then reverse the v12->v13 migration.
        let db = create_database(&fixture.db_path, "password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "Written before the migration")).unwrap();
        db.conn()
            .execute_batch(
                "ALTER TABLE entries DROP COLUMN locked;
                 UPDATE schema_version SET version = 12;",
            )
            .unwrap();

        // The snapshot itself must be taken while the file is still v12 — `VACUUM INTO`
        // copies whatever the live file currently is.
        create_snapshot(&db, &fixture.ctx(), SnapshotTrigger::Migration).unwrap();
        let target = super::super::list_snapshots(&fixture.backups_dir).unwrap()[0]
            .file_name
            .clone();
        assert_eq!(
            super::super::list_snapshots(&fixture.backups_dir).unwrap()[0].db_schema_version,
            Some(12),
            "fixture bug: the snapshot did not capture the pre-migration state"
        );

        // Bring the live journal up to date, the way opening it normally would.
        crate::db::schema::migrations::apply_pending(&db).unwrap();
        assert_eq!(
            crate::db::read_schema_version(&db).unwrap(),
            crate::db::SCHEMA_VERSION
        );
        insert_entry(&db, &entry("2024-06-01", "Written after the migration")).unwrap();

        let outcome = restore_from_snapshot(db, &fixture.ctx(), &target);

        assert!(
            outcome.restored,
            "restore did not succeed: {:?}",
            outcome.error
        );
        let restored_db = outcome
            .db
            .expect("a successful restore returns a connection");
        assert_eq!(
            crate::db::read_schema_version(&restored_db).unwrap(),
            crate::db::SCHEMA_VERSION,
            "the restored v12 snapshot was not migrated to the current schema"
        );
        let entries = crate::db::get_all_entries(&restored_db).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Written before the migration");

        // No second pre-migration snapshot: reopen_current calls apply_pending directly
        // rather than routing through open_database's migrate_with_pre_migration_snapshot.
        let snapshots = super::super::list_snapshots(&fixture.backups_dir).unwrap();
        assert!(
            !snapshots
                .iter()
                .any(|s| s.trigger == SnapshotTrigger::Migration && s.file_name != target),
            "restoring an old-schema snapshot must not itself trigger a second Migration snapshot"
        );
    }

    #[test]
    fn test_restore_takes_a_verified_safety_snapshot_first() {
        let fixture = Fixture::new("safety-first");
        let db = create_database(&fixture.db_path, "password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "Original")).unwrap();
        create_snapshot(&db, &fixture.ctx(), SnapshotTrigger::Manual).unwrap();
        let target = super::super::list_snapshots(&fixture.backups_dir).unwrap()[0]
            .file_name
            .clone();

        insert_entry(&db, &entry("2024-02-01", "Second entry")).unwrap();

        let outcome = restore_from_snapshot(db, &fixture.ctx(), &target);

        let safety = outcome
            .safety_snapshot
            .expect("a safety snapshot must be recorded");
        assert_eq!(safety.trigger, SnapshotTrigger::PreRestore);
        assert!(safety.verified);
        assert_eq!(
            safety.entry_count,
            Some(2),
            "the safety snapshot must capture the pre-restore state, not the target's"
        );

        let listed = super::super::list_snapshots(&fixture.backups_dir).unwrap();
        assert!(
            listed.iter().any(|s| s.file_name == safety.file_name),
            "the safety snapshot must be persisted, not just returned"
        );
    }

    #[test]
    fn test_restore_survives_a_password_change_between_snapshot_and_restore() {
        // The assumption the whole module rests on: `change_password` re-wraps the same
        // master key, so a snapshot taken before a password change is still restorable with
        // whatever password is current *now* — no credential is asked for at all.
        let fixture = Fixture::new("password-change");
        let db = create_database(&fixture.db_path, "old_password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "Before the password change")).unwrap();
        create_snapshot(&db, &fixture.ctx(), SnapshotTrigger::Manual).unwrap();
        let target = super::super::list_snapshots(&fixture.backups_dir).unwrap()[0]
            .file_name
            .clone();

        // The same O(1) re-wrap `change_password` performs: same master key, new wrapping.
        let (slot_id, _) = crate::db::get_password_slot(&db).unwrap().unwrap();
        let rewrapped = crate::auth::PasswordMethod::new("new_password".to_string())
            .wrap_master_key(db.key().as_bytes())
            .unwrap();
        crate::db::update_auth_slot_wrapped_key(&db, slot_id, &rewrapped).unwrap();

        insert_entry(&db, &entry("2024-03-01", "After the password change")).unwrap();

        let outcome = restore_from_snapshot(db, &fixture.ctx(), &target);

        assert!(
            outcome.restored,
            "restore did not succeed: {:?}",
            outcome.error
        );
        let restored_db = outcome.db.unwrap();
        let entries = crate::db::get_all_entries(&restored_db).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Before the password change");
    }

    #[test]
    fn test_restore_rejects_a_snapshot_the_live_key_cannot_decrypt() {
        let fixture = Fixture::new("wrong-key");
        let db = create_database(&fixture.db_path, "password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "Seed")).unwrap();
        create_snapshot(&db, &fixture.ctx(), SnapshotTrigger::Manual).unwrap();
        let target = super::super::list_snapshots(&fixture.backups_dir).unwrap()[0]
            .file_name
            .clone();

        let wrong_key = cipher::Key::from_slice(&[9u8; 32]).unwrap();
        let impostor = DatabaseConnection::from_parts(
            crate::db::schema::open_connection(&fixture.db_path).unwrap(),
            wrong_key,
        );

        let outcome = restore_from_snapshot(impostor, &fixture.ctx(), &target);

        assert!(!outcome.restored);
        assert!(
            outcome.db.is_some(),
            "the caller must get a connection back"
        );
        assert!(
            outcome.safety_snapshot.is_none(),
            "must abort before touching anything"
        );
        assert!(fixture.db_path.exists());
        assert_eq!(
            crate::db::schema::open_connection(&fixture.db_path)
                .unwrap()
                .query_row::<i64, _, _>("SELECT COUNT(*) FROM entries", [], |r| r.get(0))
                .unwrap(),
            1,
            "the live journal must be untouched"
        );
    }

    #[test]
    fn test_restore_rejects_a_pre_v3_snapshot() {
        let fixture = Fixture::new("pre-v3");
        let db = create_database(&fixture.db_path, "password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "Seed")).unwrap();
        create_snapshot(&db, &fixture.ctx(), SnapshotTrigger::Manual).unwrap();
        let target = super::super::list_snapshots(&fixture.backups_dir).unwrap()[0]
            .file_name
            .clone();

        // Roll the *snapshot file itself* back to a pre-v3 schema version, the same trick
        // used elsewhere to build an old-schema fixture without hand-writing DDL.
        {
            let path = fixture.backups_dir.join(&target);
            let conn = crate::db::schema::open_connection(&path).unwrap();
            conn.execute("UPDATE schema_version SET version = 2", [])
                .unwrap();
        }

        let outcome = restore_from_snapshot(db, &fixture.ctx(), &target);

        assert!(!outcome.restored);
        assert!(outcome.safety_snapshot.is_none());
        assert!(outcome.error.unwrap().contains("older than version 3"));
    }

    #[test]
    fn test_restore_refuses_a_hostile_file_name() {
        let fixture = Fixture::new("traversal");
        let db = create_database(&fixture.db_path, "password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "Seed")).unwrap();

        let outcome = restore_from_snapshot(db, &fixture.ctx(), "backup-../../diary.db");

        assert!(!outcome.restored);
        assert!(outcome.safety_snapshot.is_none());
        assert!(
            fixture.db_path.exists(),
            "the live journal must be untouched"
        );
    }

    #[test]
    fn test_failed_restore_rolls_back_to_the_safety_snapshot() {
        // Exercises `roll_back` directly rather than forcing a fault through the full
        // pipeline: by the time `restore_from_snapshot` reaches the post-swap reopen, the
        // target has already passed `precheck_restorable` against the exact bytes being
        // swapped in, so a *reachable* post-swap failure needs a fault the public API has no
        // way to inject deterministically (disk I/O, not application logic). What matters for
        // Task 4.2's contract is that the recovery mechanism itself puts the journal back —
        // which is exactly what this proves.
        let fixture = Fixture::new("rollback");
        let db = create_database(&fixture.db_path, "password".to_string()).unwrap();
        insert_entry(&db, &entry("2024-01-15", "Safe content")).unwrap();
        let safety = create_snapshot(&db, &fixture.ctx(), SnapshotTrigger::PreRestore)
            .unwrap()
            .created()
            .cloned()
            .unwrap();
        let key_bytes = *db.key().as_bytes();

        // Simulate the state right after a swap whose new content turned out to be
        // unusable: `diary.db` currently holds something other than the safety snapshot.
        insert_entry(&db, &entry("2024-06-01", "Never actually restored")).unwrap();
        drop(db);

        let store = FsSnapshotStore::new(&fixture.backups_dir);
        let outcome = roll_back(
            &store,
            &fixture.db_path,
            &key_bytes,
            safety.clone(),
            "simulated post-swap failure".to_string(),
        );

        assert!(!outcome.restored);
        assert!(outcome
            .error
            .as_deref()
            .unwrap()
            .contains("automatically rolled back"));
        let recovered = outcome
            .db
            .expect("rollback must hand back a usable connection");
        let entries = crate::db::get_all_entries(&recovered).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Safe content");
    }
}
