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

use log::info;
use tauri::State;

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
    let (db_path, backups_dir) = journal_paths(&state)?;

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
    let (_, backups_dir) = journal_paths(&state)?;

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
    let (_, backups_dir) = journal_paths(&state)?;

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
}
