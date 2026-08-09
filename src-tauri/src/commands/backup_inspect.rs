//! Looking inside a snapshot without restoring it.
//!
//! The engine and every filesystem call live in `mini_diarium_core::backup::inspect`; this
//! module is the IPC surface and the lifetime of the open snapshot. Two things shape it:
//!
//! 1. **A second open connection with a second key is the sharpest security edge in the
//!    backup work.** The inspection handle is kept in [`DiaryState::inspection`] rather than
//!    in its own managed state, precisely so it is torn down by the same function every lock
//!    path already funnels through (`lock_diary_inner_with`). An invariant enforced by the
//!    call graph beats one enforced by remembering to call a second thing.
//! 2. **A snapshot may need a different credential than the live journal.** After a password
//!    change the snapshot keeps the old wrapped key (finding B-11), so
//!    [`check_backup_credentials`] exists to say so *before* the user is asked to type
//!    anything (scenario UX-3).
//!
//! Nothing here registers a journal, writes to `config.json`, or opens the snapshot for
//! writing.

use log::info;
use tauri::State;

use crate::backup::{self, SnapshotCredential, SnapshotCredentialReport, SnapshotEntry};
use crate::commands::auth::DiaryState;
use crate::db::DatabaseConnection;

/// A snapshot currently open for reading, and which one it is.
pub struct InspectedSnapshot {
    pub file_name: String,
    pub db: DatabaseConnection,
}

/// What the panel needs after a successful open.
///
/// No entry count and no dates: the panel already holds those from the manifest, and
/// re-deriving them here would decrypt the whole snapshot to answer a question already
/// answered.
#[derive(Debug, serde::Serialize)]
pub struct OpenBackupInfo {
    pub file_name: String,
    /// `true` when this snapshot's credentials differ from the live journal's — the UX-3
    /// case, repeated here so a panel that opened without calling
    /// [`check_backup_credentials`] can still explain itself.
    pub credential_differs: bool,
}

/// Fails unless the live journal is unlocked, without holding the lock afterwards.
fn require_unlocked(state: &DiaryState) -> Result<(), String> {
    let db_state = state
        .db
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;
    db_state.as_ref().ok_or("Journal must be unlocked")?;
    Ok(())
}

/// Reads `db_path` and `backups_dir` out of the state. Valid while the journal is locked.
fn journal_paths(state: &DiaryState) -> Result<(std::path::PathBuf, std::path::PathBuf), String> {
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

/// Says whether a snapshot still accepts the credential the live journal accepts.
///
/// Needs no key: auth-slot rows are plaintext inside an otherwise encrypted journal.
#[tauri::command]
pub fn check_backup_credentials(
    file_name: String,
    state: State<DiaryState>,
) -> Result<SnapshotCredentialReport, String> {
    check_backup_credentials_inner(&file_name, &state)
}

/// The testable core of [`check_backup_credentials`]. See [`open_backup_readonly_inner`].
pub(crate) fn check_backup_credentials_inner(
    file_name: &str,
    state: &DiaryState,
) -> Result<SnapshotCredentialReport, String> {
    let (db_path, backups_dir) = journal_paths(state)?;
    backup::check_snapshot_credentials(&backups_dir, file_name, &db_path)
}

/// Opens a snapshot read-only and holds it for [`list_backup_entries`].
///
/// Exactly one credential is expected. A local-only journal supplies none and the device key
/// from `config.json` is used, mirroring `unlock_diary_auto`.
///
/// Opening a second snapshot closes the first: one inspection at a time keeps the number of
/// live master keys in the process bounded at two.
///
/// # Why this requires an unlocked journal
///
/// This decrypts diary content, and the pre-auth panel exists so a *locked* screen can report
/// that backups exist — not so it can read them. `verify_backup` and `delete_backup` already
/// take this line for weaker reasons; it applies with far more force to entry text.
///
/// It costs the legitimate user nothing, including in the case this feature was built for.
/// A snapshot that predates a password change needs the old password (finding B-11), but its
/// owner still knows the *current* one: they unlock the journal with today's password and
/// open the snapshot with the old one. The only case that genuinely cannot unlock first is a
/// journal too damaged to open at all, and the answer there is whole-journal restore
/// (Task 4.2), not browsing entries from the lock screen.
#[tauri::command]
pub fn open_backup_readonly(
    file_name: String,
    password: Option<String>,
    key_path: Option<String>,
    state: State<DiaryState>,
) -> Result<OpenBackupInfo, String> {
    open_backup_readonly_inner(file_name, password, key_path, &state)
}

/// The testable core of [`open_backup_readonly`].
///
/// Split out because a `State<DiaryState>` cannot be constructed outside a running Tauri app,
/// which would leave the guards below — the unlocked check, the one-credential check, and the
/// close-before-open ordering — reachable only by a human clicking. See "testable command
/// cores" in `docs/best-practices/TAURI_BEST_PRACTICES.md`.
pub(crate) fn open_backup_readonly_inner(
    file_name: String,
    password: Option<String>,
    key_path: Option<String>,
    state: &DiaryState,
) -> Result<OpenBackupInfo, String> {
    if password.is_some() && key_path.is_some() {
        return Err("Choose one way to open this backup, not two.".to_string());
    }

    require_unlocked(state)?;
    let (db_path, backups_dir) = journal_paths(state)?;
    let credential = resolve_credential(password, key_path, state)?;

    // Close any previous inspection *before* opening the next, so a failed open cannot leave
    // two snapshots' keys in memory at once.
    close_inspection(state);

    let db = backup::open_snapshot_file(&backups_dir, &file_name, credential)?;
    let credential_differs = backup::check_snapshot_credentials(&backups_dir, &file_name, &db_path)
        .map(|report| report.differs_from_live)
        .unwrap_or(false);

    *state
        .inspection
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())? = Some(InspectedSnapshot {
        file_name: file_name.clone(),
        db,
    });

    // File names are generated stamps, not user text, so this is safe at `info`.
    info!("Opened a backup for inspection: {}", file_name);

    Ok(OpenBackupInfo {
        file_name,
        credential_differs,
    })
}

/// Lists the open snapshot's entries — id, date, title, and a short preview only.
///
/// Requires an unlocked journal for the same reason [`open_backup_readonly`] does. The lock
/// path already closes the inspection, so this is belt-and-braces against a future caller
/// that populates `inspection` by some other route.
#[tauri::command]
pub fn list_backup_entries(state: State<DiaryState>) -> Result<Vec<SnapshotEntry>, String> {
    list_backup_entries_inner(&state)
}

/// The testable core of [`list_backup_entries`]. See [`open_backup_readonly_inner`].
pub(crate) fn list_backup_entries_inner(state: &DiaryState) -> Result<Vec<SnapshotEntry>, String> {
    require_unlocked(state)?;

    let inspection = state
        .inspection
        .lock()
        .map_err(|_| "Journal state lock failed".to_string())?;
    let open = inspection
        .as_ref()
        .ok_or("No backup is open for inspection")?;
    backup::list_snapshot_entries(&open.db)
}

/// Closes the open snapshot, zeroizing its master key. Closing nothing is not an error.
#[tauri::command]
pub fn close_backup(state: State<DiaryState>) -> Result<(), String> {
    close_inspection(&state);
    Ok(())
}

/// Drops any open inspection connection.
///
/// Deliberately infallible and callable from a teardown path: a poisoned lock must not leave
/// a decrypted snapshot open, and there is nothing useful for a lock handler to do with an
/// error anyway. Called from `lock_diary_inner_with`, which every lock path — the idle timer,
/// the OS session-lock listener, focus loss, journal switch, and app exit — funnels through.
pub(crate) fn close_inspection(state: &DiaryState) {
    let taken = match state.inspection.lock() {
        Ok(mut guard) => guard.take(),
        // A poisoned mutex still yields the value; dropping it is the whole point here.
        Err(poisoned) => poisoned.into_inner().take(),
    };
    if taken.is_some() {
        info!("Closed the backup opened for inspection");
    }
}

fn resolve_credential(
    password: Option<String>,
    key_path: Option<String>,
    state: &DiaryState,
) -> Result<SnapshotCredential, String> {
    if let Some(password) = password {
        if password.is_empty() {
            return Err("Enter the password this backup was taken with.".to_string());
        }
        return Ok(SnapshotCredential::Password(password));
    }

    if let Some(key_path) = key_path {
        let private_key = crate::commands::auth::read_private_key_from_file(&key_path)?;
        return Ok(SnapshotCredential::PrivateKey(private_key));
    }

    // No credential supplied: the local-only case. The device key lives in `config.json`
    // beside the journal registration, exactly as `unlock_diary_auto` reads it.
    Ok(SnapshotCredential::AutoKey(load_auto_key(state)?))
}

fn load_auto_key(state: &DiaryState) -> Result<[u8; 32], String> {
    let active_id = crate::config::load_active_journal_id(&state.app_data_dir)
        .ok_or("No active journal configured")?;
    let auto_key_hex = crate::config::load_journals(&state.app_data_dir)
        .iter()
        .find(|journal| journal.id == active_id)
        .and_then(|journal| journal.auto_key.clone())
        .ok_or("Enter the password this backup was taken with.")?;

    let decoded = hex::decode(&auto_key_hex)
        .map_err(|_| "This device's key could not be read.".to_string())?;
    if decoded.len() != 32 {
        return Err("This device's key could not be read.".to_string());
    }
    let mut auto_key = [0u8; 32];
    auto_key.copy_from_slice(&decoded);
    Ok(auto_key)
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
            text: "<p>body text</p>".to_string(),
            word_count: 2,
            date_created: "2024-01-15T00:00:00Z".to_string(),
            date_updated: "2024-01-15T00:00:00Z".to_string(),
            metadata: None,
            locked: false,
        }
    }

    /// A state with a real journal, one entry, and one snapshot taken from it.
    fn state_with_snapshot(
        name: &str,
    ) -> (
        crate::commands::auth::test_helpers::TestFixture,
        DiaryState,
        String,
    ) {
        let (fixture, state, db_path, backups_dir) = make_state(name);

        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        insert_entry(&db, &entry("Inspected")).unwrap();
        backup::create_snapshot(
            &db,
            &backup::BackupContext {
                db_path: &db_path,
                backups_dir: &backups_dir,
                app_version: Some("0.0.0-test"),
            },
            backup::SnapshotTrigger::Manual,
        )
        .unwrap();
        drop(db);

        let file_name = backup::list_snapshots(&backups_dir).unwrap()[0]
            .file_name
            .clone();
        (fixture, state, file_name)
    }

    /// Puts the live journal into `state` so the unlocked-only commands are reachable.
    fn unlock(state: &DiaryState) {
        let (db_path, backups_dir) = journal_paths(state).unwrap();
        *state.db.lock().unwrap() = Some(
            crate::db::open_database(&db_path, "test_password".to_string(), &backups_dir).unwrap(),
        );
    }

    #[test]
    fn test_open_then_list_then_close_round_trip() {
        let (_dir, state, file_name) = state_with_snapshot("round_trip");
        unlock(&state);

        let opened = open_backup_readonly_inner(
            file_name.clone(),
            Some("test_password".to_string()),
            None,
            &state,
        )
        .unwrap();
        assert_eq!(opened.file_name, file_name);
        assert!(!opened.credential_differs);

        let entries = list_backup_entries_inner(&state).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Inspected");
        assert_eq!(entries[0].date, "2024-01-15");
        assert_eq!(entries[0].preview, "body text");

        close_inspection(&state);
        assert_eq!(
            list_backup_entries_inner(&state).unwrap_err(),
            "No backup is open for inspection"
        );
    }

    #[test]
    fn test_a_wrong_password_leaves_nothing_open() {
        // A failed open must not leave the previous inspection dangling either — the close
        // happens first precisely so two snapshots' keys are never live at once.
        let (_dir, state, file_name) = state_with_snapshot("wrong_password");
        unlock(&state);

        open_backup_readonly_inner(
            file_name.clone(),
            Some("test_password".to_string()),
            None,
            &state,
        )
        .unwrap();
        assert!(state.inspection.lock().unwrap().is_some());

        assert!(open_backup_readonly_inner(
            file_name,
            Some("not_the_password".to_string()),
            None,
            &state
        )
        .is_err());
        assert!(
            state.inspection.lock().unwrap().is_none(),
            "a failed open left the previous snapshot open"
        );
    }

    #[test]
    fn test_two_credentials_at_once_are_refused() {
        let (_dir, state, file_name) = state_with_snapshot("two_credentials");
        unlock(&state);

        let err = open_backup_readonly_inner(
            file_name,
            Some("test_password".to_string()),
            Some("C:/keys/journal.key".to_string()),
            &state,
        )
        .unwrap_err();

        assert!(err.contains("not two"), "got: {err}");
    }

    #[test]
    fn test_the_commands_that_read_content_refuse_a_locked_journal() {
        let (_dir, state, file_name) = state_with_snapshot("locked_refused");

        assert_eq!(
            open_backup_readonly_inner(
                file_name.clone(),
                Some("test_password".into()),
                None,
                &state
            )
            .unwrap_err(),
            "Journal must be unlocked"
        );
        assert_eq!(
            list_backup_entries_inner(&state).unwrap_err(),
            "Journal must be unlocked"
        );

        // The keyless metadata read is the exception, and deliberately so: it is what the
        // pre-auth panel is built on.
        assert!(check_backup_credentials_inner(&file_name, &state).is_ok());
    }

    #[test]
    fn test_inspection_is_dropped_when_the_journal_locks() {
        // The invariant that matters: no lock path may leave a decrypted snapshot open.
        let (_dir, state, file_name) = state_with_snapshot("lock_drops");
        let backups_dir = state.backups_dir.lock().unwrap().clone();

        let db = backup::open_snapshot_file(
            &backups_dir,
            &file_name,
            SnapshotCredential::Password("test_password".to_string()),
        )
        .unwrap();
        *state.inspection.lock().unwrap() = Some(InspectedSnapshot { file_name, db });

        close_inspection(&state);

        assert!(
            state.inspection.lock().unwrap().is_none(),
            "the inspection connection survived the lock path"
        );
    }

    #[test]
    fn test_nothing_is_open_for_inspection_by_default() {
        let (_dir, state, _, _) = make_state("nothing_open");
        assert!(state.inspection.lock().unwrap().is_none());
    }

    #[test]
    fn test_a_snapshot_of_the_current_state_is_not_reported_as_drifted() {
        let (_dir, state, file_name) = state_with_snapshot("no_drift");

        let report = check_backup_credentials_inner(&file_name, &state).unwrap();

        assert!(report.compared);
        assert!(!report.differs_from_live);
        assert_eq!(report.snapshot_slot_types, vec!["password".to_string()]);
    }

    #[test]
    fn test_a_name_outside_the_backups_directory_is_refused() {
        // `delete_backup` grew this guard in Milestone 3; every name-taking command needs it.
        let (_dir, state, _) = state_with_snapshot("traversal");
        unlock(&state);

        assert!(check_backup_credentials_inner("backup-../../diary.db", &state).is_err());
        assert!(open_backup_readonly_inner(
            "backup-../../diary.db".to_string(),
            Some("test_password".to_string()),
            None,
            &state
        )
        .is_err());
    }

    #[test]
    fn test_an_empty_password_is_refused_rather_than_falling_back_to_the_device_key() {
        let (_dir, state, _, _) = make_state("empty_password");
        assert!(
            resolve_credential(Some("password".to_string()), None, &state).is_ok(),
            "a password alone is a valid credential"
        );

        // An empty password is a user error worth naming, not a silent fallback to the
        // device key — which would otherwise open a local-only journal's snapshot on an
        // empty prompt.
        assert!(resolve_credential(Some(String::new()), None, &state).is_err());
    }
}
