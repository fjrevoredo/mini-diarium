//! The `backup` command group — reading and managing snapshots from the UI.
//!
//! Everything here is a thin wrapper over `mini_diarium_core::backup`; the engine, the
//! policy, and every filesystem call live in the core crate. Two properties shape the
//! surface:
//!
//! 1. **Snapshot metadata needs no key.** The manifest is a plaintext sidecar and
//!    `entries.date` is a plaintext column, so a snapshot can be described without unlocking
//!    anything. That is what makes [`list_backups_unauthenticated`] possible, and it is the
//!    whole point: the moment a user most needs to see their backups is the moment the
//!    journal will not open.
//! 2. **Paths never cross the IPC boundary.** The backups directory lives in `DiaryState`,
//!    and [`reveal_backups_folder`] hands it to the OS from Rust. Nothing here returns a
//!    path to the frontend, matching the Privacy Decision the manifest itself follows.
//!
//! Snapshot *file names* do cross, in both directions — they are the only handle the UI has
//! on a snapshot. They are generated stamps carrying no user-chosen text, and every name
//! coming back in is re-validated by the core store before it is joined onto a directory.

use std::path::PathBuf;

use log::{info, warn};
use tauri::{AppHandle, Emitter, State, Wry};

use crate::backup::{self, BackupHealth, SnapshotMeta, SnapshotTrigger};
use crate::commands::auth::DiaryState;

/// Everything the pre-auth view needs, in one round trip.
///
/// Bundled rather than split because the unlock screen has no journal open to re-query and
/// no reason to make two calls for two halves of the same directory read.
#[derive(Debug, serde::Serialize)]
pub struct BackupOverview {
    pub snapshots: Vec<SnapshotMeta>,
    pub health: BackupHealth,
}

/// Reads `db_path` and `backups_dir` out of the state without requiring an unlocked journal.
///
/// Both are set at startup and kept current across journal switches, so they are valid while
/// the journal is locked — which is exactly when the pre-auth view runs.
fn journal_paths(state: &DiaryState) -> Result<(PathBuf, PathBuf), String> {
    let db_path = state
        .db_path
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?
        .clone();
    let backups_dir = state
        .backups_dir
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?
        .clone();
    Ok((db_path, backups_dir))
}

/// Lists the active journal's snapshots, newest first.
#[tauri::command]
pub fn list_backups(state: State<DiaryState>) -> Result<Vec<SnapshotMeta>, String> {
    let (_, backups_dir) = journal_paths(&state)?;
    backup::list_snapshots(&backups_dir)
}

/// Aggregate state of the active journal's backups directory.
#[tauri::command]
pub fn get_backup_health(state: State<DiaryState>) -> Result<BackupHealth, String> {
    let (db_path, backups_dir) = journal_paths(&state)?;
    Ok(backup::backup_health(&backups_dir, &db_path))
}

/// The pre-auth read: snapshots plus health, with no database opened and no key involved.
///
/// Deliberately a separate command from [`list_backups`] rather than a flag on it. The
/// difference is not the payload — it is the promise, and a caller reaching for this name is
/// asserting that it must work against a journal that cannot be unlocked. `db_path` is only
/// ever `stat`ed here, never opened.
#[tauri::command]
pub fn list_backups_unauthenticated(state: State<DiaryState>) -> Result<BackupOverview, String> {
    let (db_path, backups_dir) = journal_paths(&state)?;
    Ok(BackupOverview {
        snapshots: backup::list_snapshots(&backups_dir)?,
        health: backup::backup_health(&backups_dir, &db_path),
    })
}

/// Takes a snapshot the user explicitly asked for.
///
/// `Manual` bypasses the deduplication and minimum-interval rules, so pressing the button
/// always produces a snapshot. Anything else would be a button that silently does nothing.
#[tauri::command]
pub fn create_backup_now(state: State<DiaryState>) -> Result<SnapshotMeta, String> {
    create_backup_now_inner(&state)
}

/// The testable core of [`create_backup_now`]. See `restore_backup_inner`'s doc comment for
/// why these commands split a `State`-free inner function out.
pub(crate) fn create_backup_now_inner(state: &DiaryState) -> Result<SnapshotMeta, String> {
    let _backup_ops = state
        .backup_ops
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;

    let (db_path, backups_dir) = journal_paths(state)?;

    let db_state = state
        .db
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;
    let db = db_state.as_ref().ok_or("Journal must be unlocked")?;

    let ctx = backup::BackupContext {
        db_path: &db_path,
        backups_dir: &backups_dir,
        app_version: Some(env!("CARGO_PKG_VERSION")),
    };

    let outcome = backup::create_snapshot(db, &ctx, SnapshotTrigger::Manual)?;
    outcome
        .created()
        .cloned()
        .ok_or_else(|| "Snapshot was skipped unexpectedly".to_string())
}

/// Re-checks one snapshot against the live master key and records the result.
///
/// Returns the updated record rather than a bare boolean so the UI refreshes the row it just
/// acted on without re-listing the whole directory.
#[tauri::command]
pub fn verify_backup(file_name: String, state: State<DiaryState>) -> Result<SnapshotMeta, String> {
    verify_backup_inner(file_name, &state)
}

/// The testable core of [`verify_backup`]. See `restore_backup_inner`'s doc comment for why
/// these commands split a `State`-free inner function out.
pub(crate) fn verify_backup_inner(
    file_name: String,
    state: &DiaryState,
) -> Result<SnapshotMeta, String> {
    let _backup_ops = state
        .backup_ops
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;

    let (_, backups_dir) = journal_paths(state)?;

    let db_state = state
        .db
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;
    let db = db_state.as_ref().ok_or("Journal must be unlocked")?;

    backup::verify_snapshot_file(db, &backups_dir, &file_name)
}

/// Deletes one snapshot.
///
/// Requires an unlocked journal — not because deletion needs a key, but because destroying a
/// backup should not be reachable from the screen shown to whoever finds the machine locked.
#[tauri::command]
pub fn delete_backup(file_name: String, state: State<DiaryState>) -> Result<(), String> {
    delete_backup_inner(file_name, &state)
}

/// The testable core of [`delete_backup`]. See `restore_backup_inner`'s doc comment for why
/// these commands split a `State`-free inner function out.
pub(crate) fn delete_backup_inner(file_name: String, state: &DiaryState) -> Result<(), String> {
    let _backup_ops = state
        .backup_ops
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;

    let (_, backups_dir) = journal_paths(state)?;

    {
        let db_state = state
            .db
            .lock()
            .map_err(|_| "Journal state lock failed".to_string())?;
        db_state.as_ref().ok_or("Journal must be unlocked")?;
    }

    backup::delete_snapshot(&backups_dir, &file_name)?;
    info!("Snapshot deleted by the user");
    Ok(())
}

/// Opens the active journal's backups directory in the OS file manager.
///
/// The path is resolved and handed over entirely in Rust. The frontend equivalent would
/// require sending the path to the WebView first, which the Privacy Decision avoids
/// everywhere else in this subsystem.
///
/// `opener:default` already grants `allow-reveal-item-in-dir`, so this needs no capability
/// change.
#[tauri::command]
pub fn reveal_backups_folder(state: State<DiaryState>) -> Result<(), String> {
    let (_, backups_dir) = journal_paths(&state)?;

    // `reveal_item_in_dir` selects an *item* inside its parent, so revealing the directory
    // itself would open the journal folder with `backups` highlighted. Revealing a snapshot
    // opens the backups folder, which is what the button promises. With no snapshots there
    // is nothing to select, so fall back to the directory.
    let target = backup::list_snapshots(&backups_dir)
        .ok()
        .and_then(|s| s.first().map(|meta| backups_dir.join(&meta.file_name)))
        .unwrap_or_else(|| backups_dir.clone());

    if !target.exists() {
        return Err("The backups folder does not exist yet".to_string());
    }

    tauri_plugin_opener::reveal_item_in_dir(&target)
        .map_err(|e| format!("Failed to open the backups folder: {e}"))
}

/// What a completed restore attempt looked like, for the confirmation the frontend shows.
#[derive(Debug, serde::Serialize)]
pub struct RestoreSummary {
    /// `true` only when the journal now holds the restored snapshot's content.
    pub restored: bool,
    /// The safety snapshot taken before the restore began — present unless the attempt was
    /// aborted before that point (an unreadable, too-old, or undecryptable target).
    pub safety_snapshot: Option<String>,
    /// The safety snapshot's `created_at` timestamp, alongside its filename.
    ///
    /// The frontend's success message needs to *name* the safety snapshot without depending
    /// on a subsequent `list_backups` refresh succeeding — that refresh can fail (or simply
    /// not have run yet) even though the restore itself, and the safety snapshot it took,
    /// already committed. Carrying the timestamp here makes that message immutable: it comes
    /// straight from the restore outcome, not a re-query of the directory.
    pub safety_snapshot_created_at: Option<String>,
}

/// Rolls the live journal back to one snapshot.
///
/// Takes a `PreRestore` safety snapshot of the current state first, aborting if that fails,
/// then performs an atomic file swap — the same write-then-rename primitive that takes a
/// snapshot, aimed the other direction — and reopens the journal, migrating it if the restored
/// snapshot predates the current schema. No credential is asked for: `change_password`
/// re-wraps the master key rather than re-encrypting entries, so the key already held by the
/// live connection is the key every snapshot this journal ever produced was encrypted with.
///
/// On a failure discovered *after* the file swap has begun, the journal is automatically
/// rolled back to the safety snapshot and the error says so.
#[tauri::command]
pub fn restore_backup(
    file_name: String,
    app: AppHandle<Wry>,
    state: State<DiaryState>,
) -> Result<RestoreSummary, String> {
    let result = restore_backup_inner(file_name, &state);

    // The one case restore cannot paper over: neither the restored file nor the safety
    // snapshot could be reopened, and `state.db` is `None` now. The frontend must be told —
    // otherwise it keeps showing the unlocked app shell over a journal that is actually
    // locked, and the next entry read fails with a confusing error instead of this one.
    let now_locked = state.db.lock().map(|g| g.is_none()).unwrap_or(false);
    if now_locked {
        if let Err(e) = app.emit(
            "journal-locked",
            RestoreLockedEventPayload {
                reason: "restore-failed".to_string(),
            },
        ) {
            warn!("Failed to emit journal-locked event after a failed restore: {e}");
        }
    }

    result
}

/// The testable core of [`restore_backup`]. Split out so the whole restore sequence can be
/// unit-tested without an `AppHandle` — see "testable command cores" in
/// `docs/best-practices/TAURI_BEST_PRACTICES.md`. Does not emit events; the Tauri command
/// wrapper handles that after this returns.
///
/// Acquires `state.backup_ops` before `state.db`, the same order the other three
/// backups-directory-mutating commands (`create_backup_now_inner`, `verify_backup_inner`,
/// `delete_backup_inner`) use, so none of the four can run concurrently against each other.
pub(crate) fn restore_backup_inner(
    file_name: String,
    state: &DiaryState,
) -> Result<RestoreSummary, String> {
    let _backup_ops = state
        .backup_ops
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;

    let (db_path, backups_dir) = journal_paths(state)?;

    // A restore is about to replace the very file a decrypted inspection connection might be
    // reading from. Tear it down first, exactly as every lock path already does.
    crate::commands::backup_inspect::close_inspection(state);

    // The guard is held for the whole operation rather than released and reacquired around
    // it. Dropping it mid-operation would leave `state.db` reading `None` for as long as the
    // restore takes: a concurrent auto-lock check would see "already locked" and silently
    // no-op, and this call would then reinstall a connection into a journal an auto-lock path
    // had just decided should stay locked.
    let mut db_guard = state
        .db
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;
    let db = db_guard.take().ok_or("Journal must be unlocked")?;

    let ctx = backup::BackupContext {
        db_path: &db_path,
        backups_dir: &backups_dir,
        app_version: Some(env!("CARGO_PKG_VERSION")),
    };

    let outcome = backup::restore_from_snapshot(db, &ctx, &file_name);
    *db_guard = outcome.db;
    drop(db_guard);

    match outcome.error {
        None => {
            info!("Journal restored from a backup");
            // `to_rfc3339_opts(AutoSi, true)` matches the "Z"-suffixed format `SnapshotMeta`
            // itself serializes to elsewhere (chrono's serde impl), not `to_rfc3339()`'s
            // "+00:00" — both parse fine on the frontend, but staying consistent avoids two
            // different-looking timestamp formats for the same underlying value.
            let safety_snapshot_created_at = outcome.safety_snapshot.as_ref().map(|s| {
                s.created_at
                    .to_rfc3339_opts(chrono::SecondsFormat::AutoSi, true)
            });
            Ok(RestoreSummary {
                restored: outcome.restored,
                safety_snapshot: outcome.safety_snapshot.map(|s| s.file_name),
                safety_snapshot_created_at,
            })
        }
        Some(err) => Err(err),
    }
}

/// Mirrors `auth::JournalLockedEventPayload`'s wire shape. That type stays private to `auth`
/// (it owns the user-facing lock flow); this is the one other place that needs to emit the
/// same event, for the unrecoverable-restore case above.
#[derive(Clone, serde::Serialize)]
struct RestoreLockedEventPayload {
    reason: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::auth::test_helpers::make_state;
    use crate::db::{create_database, insert_entry, DiaryEntry};

    fn entry(title: &str) -> DiaryEntry {
        DiaryEntry {
            id: 0,
            date: "2024-01-15".to_string(),
            title: title.to_string(),
            text: "body".to_string(),
            word_count: 1,
            date_created: "2024-01-15T00:00:00Z".to_string(),
            date_updated: "2024-01-15T00:00:00Z".to_string(),
            metadata: None,
            locked: false,
        }
    }

    /// The command bodies minus `State`, which cannot be constructed outside a Tauri app.
    /// Each of these is the whole of its command apart from the state extraction.
    fn seeded(
        name: &str,
    ) -> (
        crate::commands::auth::test_helpers::TestFixture,
        crate::commands::auth::DiaryState,
    ) {
        let (fixture, state, db_path, _backups) = make_state(name);
        let db = create_database(&db_path, "test".to_string()).unwrap();
        insert_entry(&db, &entry("Seed")).unwrap();
        *state.db.lock().unwrap() = Some(db);
        (fixture, state)
    }

    #[test]
    fn test_journal_paths_are_readable_while_the_journal_is_locked() {
        // The pre-auth view depends on this: `db_path` and `backups_dir` must survive the
        // journal being locked, or the unlock screen has nothing to read.
        let (_fixture, state, db_path, backups_dir) = make_state("backup_cmd_locked_paths");
        assert!(state.db.lock().unwrap().is_none());

        let (read_db, read_backups) = journal_paths(&state).unwrap();
        assert_eq!(read_db, db_path);
        assert_eq!(read_backups, backups_dir);
    }

    #[test]
    fn test_unauthenticated_overview_describes_snapshots_without_a_key() {
        let (_fixture, state) = seeded("backup_cmd_unauth");
        let (db_path, backups_dir) = journal_paths(&state).unwrap();

        {
            let db_state = state.db.lock().unwrap();
            let ctx = backup::BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: Some("0.6.6"),
            };
            backup::create_snapshot(db_state.as_ref().unwrap(), &ctx, SnapshotTrigger::Manual)
                .unwrap();
        }

        // Lock the journal, then read as the unlock screen would.
        *state.db.lock().unwrap() = None;

        let snapshots = backup::list_snapshots(&backups_dir).unwrap();
        let health = backup::backup_health(&backups_dir, &db_path);

        assert_eq!(snapshots.len(), 1);
        assert_eq!(snapshots[0].entry_count, Some(1));
        assert_eq!(snapshots[0].auth_slot_types, vec!["password".to_string()]);
        assert_eq!(health.snapshot_count, 1);
        assert!(health.directory_accessible);
    }

    #[test]
    fn test_the_unauthenticated_payload_carries_no_user_content() {
        // The pre-auth payload must pass the same privacy gate as the manifest itself.
        let (_fixture, state) = seeded("backup_cmd_privacy");
        let (db_path, backups_dir) = journal_paths(&state).unwrap();

        {
            let db_state = state.db.lock().unwrap();
            let db = db_state.as_ref().unwrap();
            insert_entry(db, &entry("A very memorable entry title")).unwrap();
            crate::db::create_tag(db, "confidential-tag-name").unwrap();
            let ctx = backup::BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: Some("0.6.6"),
            };
            backup::create_snapshot(db, &ctx, SnapshotTrigger::Manual).unwrap();
        }

        let overview = BackupOverview {
            snapshots: backup::list_snapshots(&backups_dir).unwrap(),
            health: backup::backup_health(&backups_dir, &db_path),
        };
        let json = serde_json::to_string(&overview).unwrap();

        for secret in [
            "A very memorable entry title",
            "confidential-tag-name",
            "body",
        ] {
            assert!(
                !json.contains(secret),
                "the pre-auth payload leaked {secret:?}"
            );
        }
        // And no filesystem path — `file_name` is a bare stamp, never a directory.
        assert!(!json.contains(backups_dir.to_str().unwrap()));
    }

    #[test]
    fn test_delete_rejects_a_name_the_engine_does_not_own() {
        let (_fixture, state) = seeded("backup_cmd_delete_guard");
        let (db_path, backups_dir) = journal_paths(&state).unwrap();

        assert!(backup::delete_snapshot(&backups_dir, "backup-../../diary.db").is_err());
        assert!(backup::delete_snapshot(&backups_dir, "manifest.json").is_err());
        assert!(db_path.exists(), "the live journal was reachable by name");
    }

    // ── Task 4.2: restore_backup ───────────────────────────────────────────────────────

    #[test]
    fn test_restore_replaces_the_journal_and_leaves_it_unlocked() {
        let (_fixture, state) = seeded("backup_cmd_restore_happy");
        let (db_path, backups_dir) = journal_paths(&state).unwrap();

        let target = {
            let db_state = state.db.lock().unwrap();
            let db = db_state.as_ref().unwrap();
            let ctx = backup::BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: Some("0.6.6"),
            };
            backup::create_snapshot(db, &ctx, SnapshotTrigger::Manual)
                .unwrap()
                .created()
                .unwrap()
                .file_name
                .clone()
        };
        insert_entry(
            state.db.lock().unwrap().as_ref().unwrap(),
            &entry("Written after the snapshot"),
        )
        .unwrap();

        let summary = restore_backup_inner(target.clone(), &state).unwrap();

        assert!(summary.restored);
        assert_eq!(summary.safety_snapshot.as_deref().map(|_| ()), Some(()));
        assert!(
            state.db.lock().unwrap().is_some(),
            "a successful restore must leave the journal unlocked"
        );
        assert_eq!(
            crate::db::get_all_entries(state.db.lock().unwrap().as_ref().unwrap())
                .unwrap()
                .len(),
            1,
            "the entry written after the snapshot must not survive the restore"
        );
    }

    #[test]
    fn test_restore_summary_names_the_safety_snapshots_timestamp() {
        // Task A4: the frontend must be able to name the safety snapshot in the success
        // message without depending on a subsequent list_backups refresh succeeding.
        let (_fixture, state) = seeded("backup_cmd_restore_safety_timestamp");
        let (db_path, backups_dir) = journal_paths(&state).unwrap();

        let target = {
            let db_state = state.db.lock().unwrap();
            let db = db_state.as_ref().unwrap();
            let ctx = backup::BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: Some("0.6.6"),
            };
            backup::create_snapshot(db, &ctx, SnapshotTrigger::Manual)
                .unwrap()
                .created()
                .unwrap()
                .file_name
                .clone()
        };

        let summary = restore_backup_inner(target, &state).unwrap();

        let safety_file_name = summary
            .safety_snapshot
            .clone()
            .expect("a successful restore always takes a safety snapshot");
        let safety_created_at = summary
            .safety_snapshot_created_at
            .clone()
            .expect("the safety snapshot's timestamp must be returned alongside its name");

        let listed = backup::list_snapshots(&backups_dir).unwrap();
        let actual = listed
            .iter()
            .find(|s| s.file_name == safety_file_name)
            .expect("the safety snapshot named in the summary must actually exist on disk");
        assert_eq!(
            safety_created_at,
            actual
                .created_at
                .to_rfc3339_opts(chrono::SecondsFormat::AutoSi, true),
            "safety_snapshot_created_at must match the safety snapshot's actual created_at"
        );
    }

    #[test]
    fn test_restore_refuses_a_locked_journal() {
        let (_fixture, state, _db_path, _backups_dir) = make_state("backup_cmd_restore_locked");
        assert_eq!(
            restore_backup_inner("backup-2026-01-01-00h00m00.db".to_string(), &state).unwrap_err(),
            "Journal must be unlocked"
        );
    }

    #[test]
    fn test_restore_of_an_unknown_snapshot_leaves_the_journal_untouched_and_unlocked() {
        let (_fixture, state) = seeded("backup_cmd_restore_missing");

        let err = restore_backup_inner("backup-does-not-exist.db".to_string(), &state)
            .expect_err("a missing snapshot must be refused");
        assert!(!err.is_empty());

        assert!(
            state.db.lock().unwrap().is_some(),
            "an aborted restore must not leave the journal locked"
        );
    }

    // ── Task A2: the four IPC-reachable backup commands serialize on `backup_ops` ──────
    //
    // `assert_serializes_on_backup_ops` lives in `auth::test_helpers` — shared with
    // `backup_triggers`'s own Task F3 tests, which prove the trigger paths serialize against
    // this same lock.

    use crate::commands::auth::test_helpers::assert_serializes_on_backup_ops;

    #[test]
    fn test_backup_ops_serializes_delete_backup_against_a_concurrent_holder() {
        let (_fixture, state) = seeded("backup_cmd_ops_lock_delete");
        assert_serializes_on_backup_ops(&state, || {
            // The target need not exist — `delete_backup_inner` still has to wait for
            // `backup_ops` before it can even read the directory to look for it.
            let _ = delete_backup_inner("backup-does-not-exist.db".to_string(), &state);
        });
    }

    #[test]
    fn test_backup_ops_serializes_create_backup_now_against_a_concurrent_holder() {
        let (_fixture, state) = seeded("backup_cmd_ops_lock_create");
        assert_serializes_on_backup_ops(&state, || {
            create_backup_now_inner(&state).expect("create_backup_now_inner should succeed");
        });
    }

    #[test]
    fn test_backup_ops_serializes_verify_backup_against_a_concurrent_holder() {
        let (_fixture, state) = seeded("backup_cmd_ops_lock_verify");
        assert_serializes_on_backup_ops(&state, || {
            // The target need not exist — `verify_backup_inner` still has to wait for
            // `backup_ops` before it can even try to read it.
            let _ = verify_backup_inner("backup-does-not-exist.db".to_string(), &state);
        });
    }

    #[test]
    fn test_backup_ops_serializes_restore_backup_against_a_concurrent_holder() {
        let (_fixture, state) = seeded("backup_cmd_ops_lock_restore");
        assert_serializes_on_backup_ops(&state, || {
            // The target need not exist — `restore_backup_inner` still has to wait for
            // `backup_ops` before it can even try to read it (it aborts cleanly afterward).
            let _ = restore_backup_inner("backup-does-not-exist.db".to_string(), &state);
        });
    }

    #[test]
    fn test_restore_closes_an_open_inspection_first() {
        // A restore is about to replace the very file an inspection connection might be
        // reading. Leaving it open would decrypt a second database pointing at a journal
        // state that no longer exists.
        let (_fixture, state) = seeded("backup_cmd_restore_closes_inspection");
        let (db_path, backups_dir) = journal_paths(&state).unwrap();

        let target = {
            let db_state = state.db.lock().unwrap();
            let db = db_state.as_ref().unwrap();
            let ctx = backup::BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: Some("0.6.6"),
            };
            backup::create_snapshot(db, &ctx, SnapshotTrigger::Manual)
                .unwrap()
                .created()
                .unwrap()
                .file_name
                .clone()
        };

        let inspected = backup::open_snapshot_file(
            &backups_dir,
            &target,
            backup::SnapshotCredential::Password("test".to_string()),
        )
        .unwrap();
        *state.inspection.lock().unwrap() =
            Some(crate::commands::backup_inspect::InspectedSnapshot {
                file_name: target.clone(),
                db: inspected,
            });

        restore_backup_inner(target, &state).unwrap();

        assert!(
            state.inspection.lock().unwrap().is_none(),
            "restore must tear down any open inspection connection"
        );
    }
}
