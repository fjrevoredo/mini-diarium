use log::info;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, State, Wry};

use super::DiaryState;

/// Core file-move logic for changing diary directory.  Separated so it can be
/// unit-tested without needing a live Tauri app handle.
fn change_diary_directory_inner(
    new_dir_path: PathBuf,
    current_db_path: PathBuf,
    db_filename: &str,
    db_path_slot: &Mutex<PathBuf>,
    backups_dir_slot: &Mutex<PathBuf>,
    app_data_dir: &std::path::Path,
    move_backups: bool,
) -> Result<(), String> {
    if !new_dir_path.is_dir() {
        return Err("Selected directory does not exist".to_string());
    }

    let new_db_path = new_dir_path.join(db_filename);
    let stem = std::path::Path::new(db_filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("diary");

    // Same-directory no-op check using canonicalize when possible
    let cur_dir = current_db_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_default();
    let canon_cur = std::fs::canonicalize(&cur_dir).unwrap_or(cur_dir);
    let canon_new = std::fs::canonicalize(&new_dir_path).unwrap_or(new_dir_path.clone());
    if canon_cur == canon_new {
        return Ok(());
    }

    let new_backups_dir = new_dir_path.join("backups").join(stem);

    // Refuse a destination collision *before* anything with a side effect runs — including
    // backup relocation. `relocate_backups` permanently deletes the old backups directory on
    // success, so if this check ran after it, a doomed move (destination already holds a
    // `diary.db`) would still strand the relocated backups in the colliding folder while
    // leaving `backups_dir_slot` pointed at a directory that no longer exists. This check has
    // no side effects, so it costs nothing to do first.
    if current_db_path.exists() && new_db_path.exists() {
        return Err("A journal file already exists at the chosen location. \
             Move or remove it first, then try again."
            .to_string());
    }

    // Stage and verify the destination database copy *before* anything irreversible runs —
    // including backup relocation, which permanently deletes the old backups directory on
    // success. Staging first means a failed copy leaves both `diary.db` and the old backups
    // directory completely untouched, and a failed relocation (after staging) still leaves the
    // old `diary.db` in place, so either failure is safe to retry.
    let staged_db_path = new_dir_path.join(format!("{db_filename}.staging"));
    let db_staged = if current_db_path.exists() {
        let source_len = std::fs::metadata(&current_db_path)
            .map_err(|e| format!("Failed to read journal file: {}", e))?
            .len();
        let copied_bytes = std::fs::copy(&current_db_path, &staged_db_path)
            .map_err(|e| format!("Failed to copy journal file: {}", e))?;
        if copied_bytes != source_len {
            let _ = std::fs::remove_file(&staged_db_path);
            return Err(format!(
                "Copy of the journal file was incomplete ({copied_bytes} of {source_len} bytes) \
                 — the journal was not moved"
            ));
        }
        true
    } else {
        false
    };
    // else: no existing diary to move — just update the path.

    if move_backups {
        let old_backups_dir = backups_dir_slot
            .lock()
            .map_err(|_| "State lock poisoned".to_string())?
            .clone();
        if let Err(e) = crate::backup::relocate_backups(&old_backups_dir, &new_backups_dir) {
            if db_staged {
                let _ = std::fs::remove_file(&staged_db_path);
            }
            return Err(e);
        }
    }

    if db_staged {
        std::fs::rename(&staged_db_path, &new_db_path).map_err(|e| {
            let _ = std::fs::remove_file(&staged_db_path);
            format!("Failed to move journal file to destination: {}", e)
        })?;
        // The one step with no earlier safe rollback: the destination now holds a verified
        // copy, so a failure here is not data loss, but it does leave two copies of the
        // journal on disk until the user resolves it manually.
        std::fs::remove_file(&current_db_path).map_err(|e| {
            format!(
                "The journal was copied to the new location{}, but the old file at {} could \
                 not be removed: {}. Verify the journal opens correctly at the new location, \
                 then manually delete the old file before retrying.",
                if move_backups {
                    " and its backups were relocated"
                } else {
                    ""
                },
                current_db_path.display(),
                e
            )
        })?;
    }

    // Persist choice and update in-memory state
    crate::config::save_diary_dir(app_data_dir, &new_dir_path)?;
    *db_path_slot
        .lock()
        .map_err(|_| "State lock poisoned".to_string())? = new_db_path;
    *backups_dir_slot
        .lock()
        .map_err(|_| "State lock poisoned".to_string())? = new_backups_dir;

    Ok(())
}

/// Pure inner for `change_diary_directory` — locks the DB then moves the file.
///
/// Separated from the Tauri command so the auto-lock + move sequence can be
/// unit-tested without needing an `AppHandle`. Does not emit events; the Tauri
/// command layer handles that.
pub(crate) fn change_diary_directory_with_auto_lock_inner(
    new_dir: &str,
    state: &DiaryState,
    move_backups: bool,
) -> Result<(), String> {
    // Refuse an unusable destination **before** anything is snapshotted, locked, or moved.
    // This path reaches the same folder chooser as journal creation, so on Flatpak it can hand
    // back the same per-grant `/run/user/*/doc/` handle — and here that is worse than a bad
    // config entry: the live database is *relocated* to a path that later stops resolving.
    // Moving a journal inside a `backups/` tree is refused for the same reason it cannot be
    // opened from one — retention prunes files there.
    {
        let db_filename = state
            .db_path
            .lock()
            .map_err(|_| "State lock poisoned".to_string())?
            .file_name()
            .and_then(|s| s.to_str())
            .map(str::to_string);
        super::check_journal_location(new_dir, db_filename.as_deref())?;
    }

    // Snapshot before the move, while the connection is still open and still points at the
    // old location. This snapshot lands in the *old* backups directory, same as every earlier
    // one — `move_backups` (Task 5.1) is what makes the whole history, including this one,
    // follow the journal to its new location a few steps below.
    crate::commands::backup_triggers::snapshot_before_destructive(state, "change_diary_directory");

    // Auto-lock: close the DB connection before moving the file.
    // Safe on all platforms — SQLite holds a file lock while open. `AwaitFileRelease`
    // because the lock-time snapshot runs on a background thread that keeps the file open;
    // moving it out from under that handle fails on Windows.
    if super::lock_diary_inner_with(state, super::LockCompletion::AwaitFileRelease)? {
        info!("Journal auto-locked for directory change");
    }

    let current_db_path = state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .clone();
    let db_filename = current_db_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("diary.db")
        .to_string();
    change_diary_directory_inner(
        PathBuf::from(new_dir),
        current_db_path,
        &db_filename,
        &state.db_path,
        &state.backups_dir,
        &state.app_data_dir,
        move_backups,
    )?;

    // Sync journal config: update the active journal's path to match
    let journals = crate::config::load_journals(&state.app_data_dir);
    if let Some(active_id) = crate::config::load_active_journal_id(&state.app_data_dir) {
        let updated: Vec<_> = journals
            .into_iter()
            .map(|mut j| {
                if j.id == active_id {
                    j.path = new_dir.to_string();
                }
                j
            })
            .collect();
        let _ = crate::config::save_journals(&state.app_data_dir, &updated, &active_id);
    }

    info!("Journal directory changed to: {}", new_dir);
    Ok(())
}

/// Changes the directory where the diary file is stored.
///
/// The diary must be locked before calling this command. The file is moved
/// (copy + delete) to the new directory, and the choice is persisted in
/// `{app_data_dir}/config.json` so the app finds it on the next launch.
///
/// If both the current directory and the new directory already contain a
/// `diary.db`, the command refuses to proceed to avoid data loss.
///
/// `move_backups` controls whether the journal's existing backup history moves alongside it
/// (TODO-0098 Task 5.1). When `false`, the history is left behind at the old location and the
/// frontend is responsible for telling the user so.
#[tauri::command]
pub fn change_diary_directory(
    new_dir: String,
    move_backups: bool,
    state: State<DiaryState>,
    app: AppHandle<Wry>,
) -> Result<(), String> {
    // Capture lock state first; the inner locks before the file move.
    let was_unlocked = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?
        .is_some();
    let result = change_diary_directory_with_auto_lock_inner(&new_dir, &state, move_backups);
    // Emit regardless of move outcome — the DB is already locked at this point if was_unlocked.
    if was_unlocked {
        super::emit_diary_locked(&app, "directory change");
    }
    result
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_change_diary_directory_same_dir_is_noop() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("diary.db");
        std::fs::write(&db_path, b"fake db").unwrap();

        let db_path_mutex = Mutex::new(db_path.clone());
        let backups_mutex = Mutex::new(dir.path().join("backups"));
        let cfg_dir = dir.path().to_path_buf();

        let result = change_diary_directory_inner(
            dir.path().to_path_buf(),
            db_path.clone(),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            &cfg_dir,
            false,
        );
        assert!(result.is_ok());
        assert!(db_path.exists());
    }

    /// Moving a journal reaches the same folder chooser as creating one, so it can reach the
    /// same document-portal handle. The refusal must happen before the file is touched — a
    /// journal relocated into a per-grant path is unreachable once the grant lapses.
    #[test]
    fn test_change_diary_directory_refuses_a_portal_destination_without_moving() {
        let src = tempfile::tempdir().unwrap();
        let app = tempfile::tempdir().unwrap();
        let db_path = src.path().join("diary.db");
        std::fs::write(&db_path, b"fake db").unwrap();

        let state = DiaryState::new(
            db_path.clone(),
            src.path().join("backups").join("diary"),
            app.path().to_path_buf(),
        );

        let result =
            change_diary_directory_with_auto_lock_inner("/run/user/1000/doc/abc123", &state, false);

        let err = result.unwrap_err();
        assert!(err.contains("sandbox"), "unexpected error: {err}");
        assert!(
            db_path.exists(),
            "the journal must not be moved when the destination is refused"
        );
        assert_eq!(
            *state.db_path.lock().unwrap(),
            db_path,
            "state must still point at the original location"
        );
    }

    #[test]
    fn test_change_diary_directory_moves_file() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        let src_db = src.path().join("diary.db");
        std::fs::write(&src_db, b"fake db content").unwrap();

        let db_path_mutex = Mutex::new(src_db.clone());
        let backups_mutex = Mutex::new(src.path().join("backups"));

        let result = change_diary_directory_inner(
            dst.path().to_path_buf(),
            src_db.clone(),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            cfg.path(),
            false,
        );
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        assert!(!src_db.exists(), "Source file should be removed");
        assert!(
            dst.path().join("diary.db").exists(),
            "Destination file should exist"
        );
    }

    #[test]
    fn test_change_diary_directory_both_have_diary_returns_err() {
        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        std::fs::write(src.path().join("diary.db"), b"src db").unwrap();
        std::fs::write(dst.path().join("diary.db"), b"dst db").unwrap();

        let db_path_mutex = Mutex::new(src.path().join("diary.db"));
        let backups_mutex = Mutex::new(src.path().join("backups"));

        let result = change_diary_directory_inner(
            dst.path().to_path_buf(),
            src.path().join("diary.db"),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            cfg.path(),
            false,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn test_change_diary_directory_no_diary_yet_updates_path() {
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        // db_path doesn't exist yet (fresh install scenario)
        let nonexistent = dst.path().join("nonexistent/diary.db");
        let db_path_mutex = Mutex::new(nonexistent.clone());
        let backups_mutex = Mutex::new(dst.path().join("nonexistent/backups"));

        let result = change_diary_directory_inner(
            dst.path().to_path_buf(),
            nonexistent,
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            cfg.path(),
            false,
        );
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);
        assert_eq!(*db_path_mutex.lock().unwrap(), dst.path().join("diary.db"));
    }

    #[test]
    fn test_change_diary_directory_auto_locks_and_moves_file() {
        use crate::db::create_database;

        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        let src_db = src.path().join("diary.db");
        let db = create_database(src_db.to_str().unwrap(), "test".to_string()).unwrap();

        let state = DiaryState::new(
            src_db.clone(),
            src.path().join("backups"),
            cfg.path().to_path_buf(),
        );
        *state.db.lock().unwrap() = Some(db);
        assert!(state.db.lock().unwrap().is_some(), "should start unlocked");

        let result = change_diary_directory_with_auto_lock_inner(
            dst.path().to_str().unwrap(),
            &state,
            false,
        );
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);

        assert!(
            state.db.lock().unwrap().is_none(),
            "DB should be locked after move"
        );
        assert!(!src_db.exists(), "source file should be gone");
        assert!(
            dst.path().join("diary.db").exists(),
            "file should be at destination"
        );
    }

    #[test]
    fn test_change_directory_moves_backups_when_requested() {
        use crate::backup::{create_snapshot, list_snapshots, BackupContext, SnapshotTrigger};
        use crate::db::create_database;

        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        let src_db = src.path().join("diary.db");
        let src_backups = src.path().join("backups").join("diary");
        let db = create_database(src_db.to_str().unwrap(), "test".to_string()).unwrap();

        create_snapshot(
            &db,
            &BackupContext {
                db_path: &src_db,
                backups_dir: &src_backups,
                app_version: Some("0.7.0"),
            },
            SnapshotTrigger::Manual,
        )
        .unwrap();
        let seeded_file_name = list_snapshots(&src_backups).unwrap()[0].file_name.clone();

        let state = DiaryState::new(
            src_db.clone(),
            src_backups.clone(),
            cfg.path().to_path_buf(),
        );
        *state.db.lock().unwrap() = Some(db);

        // `change_diary_directory_with_auto_lock_inner` also takes its own `Destructive`
        // snapshot into the old directory before locking, so the relocated set has that one
        // plus the seeded snapshot above — both must survive the move.
        let result =
            change_diary_directory_with_auto_lock_inner(dst.path().to_str().unwrap(), &state, true);
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);

        assert!(
            !src_backups.exists(),
            "the old backups directory must be gone once the move is requested and succeeds"
        );

        let new_backups_dir = dst.path().join("backups").join("diary");
        assert_eq!(*state.backups_dir.lock().unwrap(), new_backups_dir);

        let after = list_snapshots(&new_backups_dir).unwrap();
        assert_eq!(
            after.len(),
            2,
            "both the seeded snapshot and the pre-move Destructive snapshot must be relocated"
        );
        let seeded = after
            .iter()
            .find(|s| s.file_name == seeded_file_name)
            .expect("the seeded snapshot must be present at the new location");
        assert_eq!(
            seeded.trigger,
            SnapshotTrigger::Manual,
            "the trigger must be preserved, not downgraded to Adopted by the move"
        );
        assert!(
            seeded.verified,
            "the verified flag must be preserved by the move"
        );
    }

    #[test]
    fn test_change_directory_leaves_backups_behind_when_declined() {
        use crate::backup::{create_snapshot, list_snapshots, BackupContext, SnapshotTrigger};
        use crate::db::create_database;

        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        let src_db = src.path().join("diary.db");
        let src_backups = src.path().join("backups").join("diary");
        let db = create_database(src_db.to_str().unwrap(), "test".to_string()).unwrap();

        create_snapshot(
            &db,
            &BackupContext {
                db_path: &src_db,
                backups_dir: &src_backups,
                app_version: Some("0.7.0"),
            },
            SnapshotTrigger::Manual,
        )
        .unwrap();

        let state = DiaryState::new(
            src_db.clone(),
            src_backups.clone(),
            cfg.path().to_path_buf(),
        );
        *state.db.lock().unwrap() = Some(db);

        let result = change_diary_directory_with_auto_lock_inner(
            dst.path().to_str().unwrap(),
            &state,
            false,
        );
        assert!(result.is_ok(), "Expected Ok, got: {:?}", result);

        assert!(
            src_backups.exists(),
            "declining the move must leave the old backups directory untouched"
        );
        assert!(
            !list_snapshots(&src_backups).unwrap().is_empty(),
            "the old snapshots must remain in place when the move is declined"
        );

        let new_backups_dir = dst.path().join("backups").join("diary");
        assert_eq!(*state.backups_dir.lock().unwrap(), new_backups_dir);
        assert!(
            list_snapshots(&new_backups_dir).unwrap().is_empty(),
            "the new location must start with no backups when the user declined the move"
        );
    }

    #[test]
    fn test_change_directory_does_not_relocate_backups_when_the_destination_already_has_a_diary() {
        // Regression guard: `relocate_backups` permanently deletes the source directory on
        // success, so the destination-collision check must run *before* it — otherwise a
        // doomed move still strands the relocated backups in the colliding folder and leaves
        // the caller's `backups_dir_slot` pointed at a directory that no longer exists.
        use crate::backup::{create_snapshot, list_snapshots, BackupContext, SnapshotTrigger};
        use crate::db::create_database;

        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        let src_db = src.path().join("diary.db");
        let src_backups = src.path().join("backups").join("diary");
        let db = create_database(src_db.to_str().unwrap(), "test".to_string()).unwrap();
        create_snapshot(
            &db,
            &BackupContext {
                db_path: &src_db,
                backups_dir: &src_backups,
                app_version: Some("0.7.0"),
            },
            SnapshotTrigger::Manual,
        )
        .unwrap();
        drop(db);

        // A diary already sits at the destination — the collision this test exists for.
        std::fs::write(dst.path().join("diary.db"), b"someone else's journal").unwrap();

        let db_path_mutex = Mutex::new(src_db.clone());
        let backups_mutex = Mutex::new(src_backups.clone());

        let result = change_diary_directory_inner(
            dst.path().to_path_buf(),
            src_db.clone(),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            cfg.path(),
            true,
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("already exists"));
        assert!(
            src_backups.exists(),
            "backups must not be relocated when the overall move is refused"
        );
        assert_eq!(
            list_snapshots(&src_backups).unwrap().len(),
            1,
            "the source snapshot must remain intact"
        );
        assert_eq!(
            *backups_mutex.lock().unwrap(),
            src_backups,
            "state must still point at the original backups directory"
        );
    }

    #[test]
    fn test_change_diary_directory_leaves_everything_untouched_when_the_staged_db_copy_fails() {
        use crate::backup::{create_snapshot, list_snapshots, BackupContext, SnapshotTrigger};
        use crate::db::create_database;

        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        let src_db = src.path().join("diary.db");
        let src_backups = src.path().join("backups").join("diary");
        let db = create_database(src_db.to_str().unwrap(), "test".to_string()).unwrap();
        create_snapshot(
            &db,
            &BackupContext {
                db_path: &src_db,
                backups_dir: &src_backups,
                app_version: Some("0.7.0"),
            },
            SnapshotTrigger::Manual,
        )
        .unwrap();
        drop(db);

        // Occupy the staged copy's destination path with a directory, so `fs::copy` into it
        // fails on every platform without needing a permissions trick.
        std::fs::create_dir_all(dst.path().join("diary.db.staging")).unwrap();

        let db_path_mutex = Mutex::new(src_db.clone());
        let backups_mutex = Mutex::new(src_backups.clone());

        let result = change_diary_directory_inner(
            dst.path().to_path_buf(),
            src_db.clone(),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            cfg.path(),
            true,
        );

        assert!(result.is_err(), "Expected Err, got: {:?}", result);
        assert!(
            src_db.exists(),
            "the old journal file must be untouched when the staged copy fails"
        );
        assert!(
            src_backups.exists(),
            "the old backups directory must be untouched when the staged copy fails"
        );
        assert_eq!(
            list_snapshots(&src_backups).unwrap().len(),
            1,
            "the source snapshot must remain intact"
        );
        assert_eq!(
            *db_path_mutex.lock().unwrap(),
            src_db,
            "state must still point at the original journal path"
        );
        assert_eq!(
            *backups_mutex.lock().unwrap(),
            src_backups,
            "state must still point at the original backups directory"
        );
    }

    #[test]
    fn test_change_diary_directory_leaves_the_old_db_and_backups_untouched_when_relocation_fails_after_staging(
    ) {
        use crate::backup::{create_snapshot, list_snapshots, BackupContext, SnapshotTrigger};
        use crate::db::create_database;

        let src = tempfile::tempdir().unwrap();
        let dst = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();

        let src_db = src.path().join("diary.db");
        let src_backups = src.path().join("backups").join("diary");
        let db = create_database(src_db.to_str().unwrap(), "test".to_string()).unwrap();
        create_snapshot(
            &db,
            &BackupContext {
                db_path: &src_db,
                backups_dir: &src_backups,
                app_version: Some("0.7.0"),
            },
            SnapshotTrigger::Manual,
        )
        .unwrap();
        drop(db);

        // A regular file occupying the path `new_backups_dir`'s ancestor needs to be makes
        // `relocate_backups`'s `create_dir_all` fail on every platform — reusing the same
        // trick `relocate.rs`'s own
        // `test_relocate_backups_leaves_the_source_untouched_when_the_destination_cannot_be_created`
        // test uses.
        std::fs::write(dst.path().join("backups"), b"not a directory").unwrap();

        let db_path_mutex = Mutex::new(src_db.clone());
        let backups_mutex = Mutex::new(src_backups.clone());

        let result = change_diary_directory_inner(
            dst.path().to_path_buf(),
            src_db.clone(),
            "diary.db",
            &db_path_mutex,
            &backups_mutex,
            cfg.path(),
            true,
        );

        assert!(result.is_err(), "Expected Err, got: {:?}", result);
        assert!(
            src_db.exists(),
            "the old journal file must be untouched when relocation fails after staging"
        );
        assert!(
            src_backups.exists(),
            "the old backups directory must be untouched when relocation fails after staging"
        );
        assert_eq!(
            list_snapshots(&src_backups).unwrap().len(),
            1,
            "the source snapshot must remain intact"
        );
        assert!(
            !dst.path().join("diary.db.staging").exists(),
            "the staged database copy must be cleaned up when relocation fails"
        );
        assert!(
            !dst.path().join("diary.db").exists(),
            "no journal file must be left at the destination when relocation fails"
        );
        assert_eq!(
            *db_path_mutex.lock().unwrap(),
            src_db,
            "state must still point at the original journal path"
        );
        assert_eq!(
            *backups_mutex.lock().unwrap(),
            src_backups,
            "state must still point at the original backups directory"
        );
    }
}
