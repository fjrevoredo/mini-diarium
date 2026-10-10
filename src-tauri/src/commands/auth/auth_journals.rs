use log::{debug, info, warn};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State, Wry};

use super::DiaryState;
use crate::backup::is_snapshot_file_name;
use crate::config::{self, JournalConfig, JournalInfo};

// Note: #[tauri::command] attributes are applied below, after the inner functions.

/// Path prefixes handed out by the XDG document portal under Flatpak.
///
/// A path below one of these is not a real location — it is a per-grant FUSE handle that
/// stops resolving once the grant lapses, so storing one as a journal's permanent path is
/// what left a Flathub user unable to reopen his journal. Plain prefix matching is enough
/// and needs no `#[cfg]`: these cannot occur on Windows or macOS.
const PORTAL_PATH_PREFIXES: [&str; 2] = ["/run/user/", "/run/flatpak/doc/"];

/// Whether `path` is an XDG-document-portal handle rather than a durable location.
fn is_portal_path(path: &str) -> bool {
    if let Some(rest) = path.strip_prefix(PORTAL_PATH_PREFIXES[0]) {
        // /run/user/<uid>/doc/... — only the doc subtree is a portal handle.
        if let Some((_uid, tail)) = rest.split_once('/') {
            return tail == "doc" || tail.starts_with("doc/");
        }
        return false;
    }
    path.starts_with(PORTAL_PATH_PREFIXES[1])
}

/// The journal folder, database path, and backups folder the backend starts with.
///
/// `e2e_dir` (from `MINI_DIARIUM_DATA_DIR`) bypasses journal config. Otherwise this is the
/// active journal, or the first one when no journal is active, or the legacy single-diary
/// folder. A saved filename that is not valid on this host (config.json copied from another
/// OS) is never joined into a path: the backend gets [`DiaryState::placeholder_paths`], which
/// belong to no journal and which the create and unlock commands refuse.
/// `get_active_journal_id` reports no active journal in that case, so the frontend shows the
/// picker, and opening that journal there returns the mapped "Invalid journal filename" error.
pub fn startup_journal_paths(
    app_dir: &Path,
    e2e_dir: Option<PathBuf>,
) -> (PathBuf, PathBuf, PathBuf) {
    let (diary_dir, db_filename) = if let Some(dir) = e2e_dir {
        (dir, None)
    } else {
        let journals = config::load_journals(app_dir);
        if !journals.is_empty() {
            let active_id = config::load_active_journal_id(app_dir);
            let active = active_id.and_then(|id| journals.iter().find(|j| j.id == id).cloned());
            let journal = active.or_else(|| journals.first().cloned());
            let db_filename = journal.as_ref().and_then(|j| j.db_filename.clone());
            let dir = journal
                .map(|j| PathBuf::from(&j.path))
                .filter(|p| p.is_dir())
                .unwrap_or_else(|| app_dir.to_path_buf());
            (dir, db_filename)
        } else {
            // Fresh install or legacy without migration trigger
            let dir = config::load_diary_dir(app_dir)
                .filter(|p| p.is_dir())
                .unwrap_or_else(|| app_dir.to_path_buf());
            (dir, None)
        }
    };

    let (db_path, backups_dir) = config::journal_db_paths(&diary_dir, db_filename.as_deref())
        .unwrap_or_else(|_| {
            warn!("Active journal has a filename that is not valid on this system");
            DiaryState::placeholder_paths(app_dir)
        });
    (diary_dir, db_path, backups_dir)
}

fn list_journals_inner(app_data_dir: &std::path::Path) -> Result<Vec<JournalInfo>, String> {
    let journals = config::load_journals(app_data_dir);
    Ok(journals.iter().map(JournalInfo::from).collect())
}

#[tauri::command]
pub fn list_journals(state: State<DiaryState>) -> Result<Vec<JournalInfo>, String> {
    list_journals_inner(&state.app_data_dir)
}

/// The active journal's id, or `None` unless it names a saved journal whose filename is valid
/// on this host. An empty id (saved when no usable journal is left), an id with no matching
/// journal, and a `config.json` copied from another OS all mean the backend has no journal
/// selected, so the frontend must show the picker instead of a create or unlock screen.
fn get_active_journal_id_inner(app_data_dir: &std::path::Path) -> Result<Option<String>, String> {
    let Some(active_id) = config::load_active_journal_id(app_data_dir) else {
        return Ok(None);
    };
    let usable = config::load_journals(app_data_dir)
        .iter()
        .find(|j| j.id == active_id)
        .is_some_and(|j| {
            config::journal_db_paths(Path::new(&j.path), j.db_filename.as_deref()).is_ok()
        });
    Ok(usable.then_some(active_id))
}

#[tauri::command]
pub fn get_active_journal_id(state: State<DiaryState>) -> Result<Option<String>, String> {
    get_active_journal_id_inner(&state.app_data_dir)
}

/// Whether registering `dir`/`db_filename` would point a journal at a backup snapshot.
///
/// Snapshots are real, openable databases, so nothing downstream rejects them — but opening
/// one as a journal *mutates it*, destroying the restore point the user was reaching for.
/// Both halves matter: the file may be named `backup-*.db` anywhere, or an ordinary name may
/// sit inside the engine's own `backups/` tree.
fn is_backup_location(dir: &std::path::Path, db_filename: Option<&str>) -> bool {
    if db_filename.is_some_and(is_snapshot_file_name) {
        return true;
    }
    dir.components()
        .any(|c| c.as_os_str().eq_ignore_ascii_case("backups"))
}

/// The two location rules, split out so they are testable without a matching filesystem —
/// a portal path is not even absolute on Windows, so exercising them through
/// `add_journal_inner` would only ever run on Linux.
///
/// Neither message may start with `"Failed to …"`: `mapTauriError` buckets that prefix as a
/// generic filesystem-permissions failure, which is exactly the mislabelling this fixes.
pub(crate) fn check_journal_location(path: &str, db_filename: Option<&str>) -> Result<(), String> {
    if is_portal_path(path) {
        return Err("Path is a temporary sandbox location".to_string());
    }
    if is_backup_location(std::path::Path::new(path), db_filename) {
        return Err("Path is a backup snapshot".to_string());
    }
    Ok(())
}

/// The database filename a journal actually uses — the stored `None` means `diary.db`.
fn effective_db_filename(db_filename: Option<&str>) -> &str {
    match db_filename {
        Some(name) if !name.is_empty() => name,
        _ => "diary.db",
    }
}

/// Whether two paths designate the same folder.
///
/// `canonicalize` is the reliable answer (it resolves `..`, symlinks, and Windows case) but
/// only works on a path that exists, so a lexical comparison backs it up.
fn same_directory(a: &Path, b: &Path) -> bool {
    if let (Ok(ca), Ok(cb)) = (a.canonicalize(), b.canonicalize()) {
        return ca == cb;
    }
    if cfg!(windows) {
        a.as_os_str().eq_ignore_ascii_case(b.as_os_str())
    } else {
        a == b
    }
}

/// Windows filenames are case-insensitive; elsewhere they are not.
fn same_db_filename(a: &str, b: &str) -> bool {
    if cfg!(windows) {
        a.eq_ignore_ascii_case(b)
    } else {
        a == b
    }
}

fn add_journal_inner(
    name: String,
    path: String,
    db_filename: Option<String>,
    app_data_dir: &std::path::Path,
) -> Result<JournalInfo, String> {
    let dir = PathBuf::from(&path);
    if !dir.is_absolute() {
        return Err("Path must be absolute".to_string());
    }
    // Validate only, never rewrite: the picker checked this exact filename on disk, so a
    // changed name would register a different file than the one the user picked.
    if let Some(filename) = db_filename.as_deref() {
        config::validate_db_filename(filename)?;
    }
    // Before `is_dir`, deliberately: an *expired* portal handle no longer exists on disk, so
    // probing the filesystem first would report "Directory does not exist" and never reach the
    // message that explains what actually went wrong — the exact case this guard is for.
    check_journal_location(&path, db_filename.as_deref())?;
    if !dir.is_dir() {
        return Err("Directory does not exist".to_string());
    }

    let mut journals = config::load_journals(app_data_dir);

    // Two entries pointing at one database is a broken flow, not a second journal: unlocking
    // the newcomer asks for the *first* journal's password under the second journal's name.
    // The message must not start with "Failed to …" — mapTauriError buckets that as a
    // filesystem-permissions failure.
    let new_db = effective_db_filename(db_filename.as_deref());
    if journals.iter().any(|j| {
        same_directory(Path::new(&j.path), &dir)
            && same_db_filename(effective_db_filename(j.db_filename.as_deref()), new_db)
    }) {
        return Err("Journal is already in your list".to_string());
    }

    let id = config::generate_journal_id();
    let journal = JournalConfig {
        id: id.clone(),
        name,
        path,
        auto_key: None,
        // Only the exact default is stored as `None`: on a case-sensitive filesystem
        // `Diary.db` is a different file, so folding it into the default would rewrite it.
        db_filename: db_filename.filter(|s| s != "diary.db"),
        require_all_auth: None,
    };
    journals.push(journal.clone());

    // Use existing active_id if set and non-empty; otherwise promote the new journal.
    let active_id = config::load_active_journal_id(app_data_dir)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| id.clone());
    config::save_journals(app_data_dir, &journals, &active_id)?;

    // Id only — the name is user-chosen and these records are captured into the debug dump.
    info!("Journal added: {}", id);
    Ok(JournalInfo::from(&journal))
}

#[tauri::command]
pub fn add_journal(
    name: String,
    path: String,
    db_filename: Option<String>,
    state: State<DiaryState>,
) -> Result<JournalInfo, String> {
    add_journal_inner(name, path, db_filename, &state.app_data_dir)
}

/// Whether `dir` can be created *and written to*.
///
/// The write probe is the point. A directory can exist and still reject writes — a read-only
/// home, a sandbox that maps the path without granting access, a folder the user denied — and
/// `create_dir_all` reports every one of those as success.
fn ensure_usable_dir(dir: &Path) -> bool {
    if std::fs::create_dir_all(dir).is_err() {
        return false;
    }
    let probe = dir.join(".mini-diarium-write-probe");
    match std::fs::File::create(&probe) {
        Ok(_) => {
            let _ = std::fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

/// Resolves and creates the default journal folder. `documents_dir` is passed in rather than
/// looked up so this is testable without an `AppHandle`.
///
/// Falls back to the app's own data folder when the preferred location is unusable. Without
/// that fallback an unwritable Documents folder leaves the picker's Location field empty and
/// its **Add** button disabled — a create form that cannot create anything. Flatpak, where the
/// sandbox holds no filesystem permission, is the reported case; a read-only home or a denied
/// Documents folder on any OS produces the same dead end.
fn get_default_journal_dir_inner(
    app_data_dir: &std::path::Path,
    documents_dir: Option<&std::path::Path>,
) -> Result<String, String> {
    // Created eagerly: the picker shows this path as an accomplished fact, and `add_journal`
    // rejects a directory that does not exist.
    let preferred = config::default_journal_dir(app_data_dir, documents_dir);
    let dir = if ensure_usable_dir(&preferred) {
        preferred
    } else {
        let fallback = config::default_journal_dir(app_data_dir, None);
        if documents_dir.is_none() || !ensure_usable_dir(&fallback) {
            // No path in the message: `Failed to create` routes it to the frontend's
            // filesystem bucket, which is what this genuinely is.
            return Err("Failed to create the default journal folder".to_string());
        }
        // Path-free at warn level (Gotcha #10); the detail belongs in debug.
        warn!("Preferred default journal folder is not usable; using the app data folder");
        debug!(
            "Default journal folder fallback: {} -> {}",
            preferred.display(),
            fallback.display()
        );
        fallback
    };
    dir.to_str()
        .map(str::to_string)
        .ok_or_else(|| "Default journal folder path is not valid UTF-8".to_string())
}

/// Returns a ready-to-use folder for a new journal, creating it if needed.
///
/// Non-Flatpak platforms use this to pre-fill a native save dialog's `defaultPath`, which the
/// user still sees and can redirect. Flatpak's dialog-free create form pre-fills its Location
/// field from this instead, since a native save dialog there can hand back an unusable
/// temporary portal path (KI-10) — Browse… is still offered there and still overrides it.
#[tauri::command]
pub fn get_default_journal_dir(
    app: AppHandle<Wry>,
    state: State<DiaryState>,
) -> Result<String, String> {
    get_default_journal_dir_inner(
        &state.app_data_dir,
        app.path().document_dir().ok().as_deref(),
    )
}

fn remove_journal_inner(id: String, state: &DiaryState) -> Result<(), String> {
    let mut journals = config::load_journals(&state.app_data_dir);

    let idx = journals
        .iter()
        .position(|j| j.id == id)
        .ok_or("Journal not found")?;

    let active_id = config::load_active_journal_id(&state.app_data_dir);
    let removing_active = active_id.as_deref() == Some(&id);

    journals.remove(idx);

    if removing_active {
        // Switch to the next available journal, unless its saved filename is not valid on
        // this host — then leave no journal active, and the frontend shows the picker.
        let next = journals.first().and_then(|other| {
            config::journal_db_paths(Path::new(&other.path), other.db_filename.as_deref())
                .ok()
                .map(|paths| (other.id.clone(), paths))
        });
        if let Some((other_id, (db_path, backups_dir))) = next {
            *state
                .db_path
                .lock()
                .map_err(|_| "State lock poisoned".to_string())? = db_path;
            *state
                .backups_dir
                .lock()
                .map_err(|_| "State lock poisoned".to_string())? = backups_dir;
            config::save_journals(&state.app_data_dir, &journals, &other_id)?;
        } else {
            // No usable journal left — save with empty active id; frontend will show the picker
            config::save_journals(&state.app_data_dir, &journals, "")?;
        }
    } else {
        let current_active = active_id.unwrap_or_default();
        config::save_journals(&state.app_data_dir, &journals, &current_active)?;
    }

    info!("Journal removed: {}", id);
    Ok(())
}

#[tauri::command]
pub fn remove_journal(
    id: String,
    state: State<DiaryState>,
    app: AppHandle<Wry>,
) -> Result<(), String> {
    // Auto-lock if unlocked before removal
    let active_id = config::load_active_journal_id(&state.app_data_dir);
    if active_id.as_deref() == Some(&id) {
        super::auto_lock_diary_if_unlocked(state.clone(), app, "journal removal")?;
    }
    remove_journal_inner(id, &state)
}

fn rename_journal_inner(
    id: String,
    name: String,
    app_data_dir: &std::path::Path,
) -> Result<(), String> {
    let mut journals = config::load_journals(app_data_dir);
    let journal = journals
        .iter_mut()
        .find(|j| j.id == id)
        .ok_or("Journal not found")?;
    journal.name = name;

    let active_id = config::load_active_journal_id(app_data_dir).unwrap_or_default();
    config::save_journals(app_data_dir, &journals, &active_id)?;

    info!("Journal renamed: {}", id);
    Ok(())
}

#[tauri::command]
pub fn rename_journal(id: String, name: String, state: State<DiaryState>) -> Result<(), String> {
    rename_journal_inner(id, name, &state.app_data_dir)
}

fn switch_journal_inner(id: String, state: &DiaryState) -> Result<(), String> {
    let journals = config::load_journals(&state.app_data_dir);
    let journal = journals
        .iter()
        .find(|j| j.id == id)
        .ok_or("Journal not found")?;
    // Refuses a saved filename that is not valid on this host before any state changes.
    let (db_path, backups_dir) =
        config::journal_db_paths(Path::new(&journal.path), journal.db_filename.as_deref())?;

    // Update DiaryState paths
    *state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())? = db_path;
    *state
        .backups_dir
        .lock()
        .map_err(|_| "State lock poisoned".to_string())? = backups_dir;

    // Persist active journal id
    config::save_active_journal_id(&state.app_data_dir, &id)?;

    // Id only — the name is user-chosen and these records are captured into the debug dump.
    info!("Switched to journal: {}", id);
    Ok(())
}

#[tauri::command]
pub fn switch_journal(
    id: String,
    state: State<DiaryState>,
    app: AppHandle<Wry>,
) -> Result<(), String> {
    // Auto-lock if unlocked
    super::auto_lock_diary_if_unlocked(state.clone(), app, "journal switch")?;
    switch_journal_inner(id, &state)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    struct TestEnv {
        temp_dir: tempfile::TempDir,
        state: DiaryState,
        app_dir: PathBuf,
    }

    fn make_test_env(name: &str) -> TestEnv {
        let temp_dir = tempfile::Builder::new()
            .prefix(&format!("mini-diarium-auth-journals-{name}-"))
            .tempdir()
            .unwrap();
        let app_data_dir = temp_dir.path().join("app-data");
        fs::create_dir_all(&app_data_dir).unwrap();
        let db_path = temp_dir.path().join("diary.db");
        let backups_dir = temp_dir.path().join("backups").join("diary");
        let state = DiaryState::new(db_path, backups_dir, app_data_dir.clone());

        TestEnv {
            temp_dir,
            state,
            app_dir: app_data_dir,
        }
    }

    fn make_journal_dir(env: &TestEnv, name: &str) -> PathBuf {
        let dir = env.temp_dir.path().join(name);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn test_add_journal_inner() {
        let env = make_test_env("add");
        let journal_dir = make_journal_dir(&env, "journal");

        let result = add_journal_inner(
            "Test Journal".to_string(),
            journal_dir.to_str().unwrap().to_string(),
            None,
            &env.app_dir,
        );
        assert!(result.is_ok());
        let journal = result.unwrap();
        assert_eq!(journal.name, "Test Journal");
        assert_eq!(journal.id.len(), 16);

        let journals = config::load_journals(&env.app_dir);
        assert_eq!(journals.len(), 1);
    }

    #[test]
    fn test_add_journal_rejects_relative_path() {
        let env = make_test_env("add_relative");

        let result = add_journal_inner(
            "Bad".to_string(),
            "relative/path".to_string(),
            None,
            &env.app_dir,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("absolute"));
    }

    /// The document-portal handle that left a Flathub user unable to reopen his journal.
    #[test]
    fn test_rejects_document_portal_path() {
        let err = check_journal_location("/run/user/1000/doc/abc123", None).unwrap_err();
        assert!(err.contains("sandbox"), "unexpected error: {err}");
        // The message must not fall into mapTauriError's filesystem-permissions bucket.
        assert!(!err.starts_with("Failed to"), "wrong error bucket: {err}");

        assert!(check_journal_location("/run/user/1000/doc", None).is_err());
        assert!(check_journal_location("/run/flatpak/doc/abc123", None).is_err());
    }

    /// Over-matching would lock users out of ordinary folders, so the negative cases are
    /// as load-bearing as the positive ones.
    #[test]
    fn test_accepts_paths_that_only_look_like_portal_handles() {
        assert!(check_journal_location("/run/user/1000/journals", None).is_ok());
        assert!(check_journal_location("/run/user/1000", None).is_ok());
        assert!(check_journal_location("/run/user", None).is_ok());
        assert!(check_journal_location("/home/jon/Documents/doc/journal", None).is_ok());
        assert!(check_journal_location("/home/jon/run/user/1000/doc/x", None).is_ok());
    }

    #[test]
    fn test_rejects_backup_snapshot_by_filename_or_directory() {
        let by_name =
            check_journal_location("/home/jon/journal", Some("backup-2026-08-07-10h30m00.db"))
                .unwrap_err();
        assert!(by_name.contains("backup"), "unexpected error: {by_name}");
        assert!(!by_name.starts_with("Failed to"));

        let by_dir = check_journal_location("/home/jon/journal/backups/diary", Some("diary.db"))
            .unwrap_err();
        assert!(by_dir.contains("backup"), "unexpected error: {by_dir}");
    }

    #[test]
    fn test_accepts_names_that_merely_contain_backup() {
        assert!(
            check_journal_location("/home/jon/My Backups Of Nothing", Some("diary.db")).is_ok()
        );
        assert!(check_journal_location("/home/jon/journal", Some("backup-notes.txt")).is_ok());
        assert!(check_journal_location("/home/jon/journal", Some("my-backup.db")).is_ok());
    }

    #[test]
    fn test_default_journal_dir_is_created_and_usable() {
        let env = make_test_env("default_dir");
        let documents = env.temp_dir.path().join("Documents");

        let dir = get_default_journal_dir_inner(&env.app_dir, Some(&documents)).unwrap();

        assert!(
            std::path::Path::new(&dir).is_dir(),
            "the folder must exist — add_journal rejects a directory that does not"
        );
        // The whole point: the pre-filled location must survive add_journal's own checks.
        assert!(check_journal_location(&dir, Some("diary.db")).is_ok());
        assert_eq!(std::path::Path::new(&dir), documents.join("Mini Diarium"));
    }

    #[test]
    fn test_default_journal_dir_falls_back_when_documents_is_unavailable() {
        let env = make_test_env("default_dir_fallback");

        let dir = get_default_journal_dir_inner(&env.app_dir, None).unwrap();

        assert!(std::path::Path::new(&dir).is_dir());
        assert_eq!(std::path::Path::new(&dir), env.app_dir.join("journals"));
    }

    /// The regression the adversarial review asked for: a Documents folder that cannot be
    /// created must not leave the picker with an empty Location and a disabled Add button.
    /// Pointing `documents_dir` below a *file* makes `create_dir_all` fail on every platform,
    /// which is the same dead end a denied or read-only Documents folder produces.
    #[test]
    fn test_default_journal_dir_falls_back_when_documents_is_unusable() {
        let env = make_test_env("default_dir_denied");
        let blocker = env.temp_dir.path().join("not-a-directory");
        fs::write(&blocker, b"file").unwrap();
        let documents = blocker.join("Documents");

        let dir = get_default_journal_dir_inner(&env.app_dir, Some(&documents)).unwrap();

        assert_eq!(std::path::Path::new(&dir), env.app_dir.join("journals"));
        assert!(
            std::path::Path::new(&dir).is_dir(),
            "the fallback must be usable, not just named"
        );
        // The whole point of the fallback: the result has to survive add_journal's own checks.
        assert!(check_journal_location(&dir, Some("diary.db")).is_ok());
    }

    /// P2: the location check must run *before* the filesystem probe. A non-existent directory
    /// carrying a snapshot filename proves the ordering on every platform — an expired portal
    /// handle is likewise gone from disk, which is what made the old ordering miss it.
    #[test]
    fn test_location_check_precedes_the_existence_check() {
        let env = make_test_env("order_backup");
        let missing = env.temp_dir.path().join("gone");

        let err = add_journal_inner(
            "Snapshot".to_string(),
            missing.to_str().unwrap().to_string(),
            Some("backup-2026-08-07-10h30m00.db".to_string()),
            &env.app_dir,
        )
        .unwrap_err();

        assert!(err.contains("backup"), "unexpected error: {err}");
    }

    /// The reported case itself: an expired `/run/user/<uid>/doc/…` handle is absent from disk.
    /// Only meaningful on Unix — that path is not absolute on Windows.
    #[cfg(unix)]
    #[test]
    fn test_expired_portal_path_reports_the_portal_error_not_a_missing_directory() {
        let env = make_test_env("order_portal");

        let err = add_journal_inner(
            "Expired".to_string(),
            "/run/user/1000/doc/expired".to_string(),
            None,
            &env.app_dir,
        )
        .unwrap_err();

        assert!(err.contains("sandbox"), "unexpected error: {err}");
    }

    #[test]
    fn test_an_ordinary_missing_directory_still_reports_that_it_is_missing() {
        let env = make_test_env("order_missing");
        let missing = env.temp_dir.path().join("gone");

        let err = add_journal_inner(
            "Missing".to_string(),
            missing.to_str().unwrap().to_string(),
            None,
            &env.app_dir,
        )
        .unwrap_err();

        assert!(err.contains("does not exist"), "unexpected error: {err}");
    }

    /// P1: two config entries pointing at one database would ask for the first journal's
    /// password under the second journal's name.
    #[test]
    fn test_add_journal_rejects_a_duplicate_location() {
        let env = make_test_env("add_duplicate");
        let journal_dir = make_journal_dir(&env, "journal");
        let path = journal_dir.to_str().unwrap().to_string();

        add_journal_inner("First".to_string(), path.clone(), None, &env.app_dir).unwrap();

        let err = add_journal_inner("Second".to_string(), path.clone(), None, &env.app_dir)
            .expect_err("a second journal on the same database must be refused");
        assert!(err.contains("already in your list"), "unexpected: {err}");
        // Must not be bucketed as a filesystem-permissions failure by mapTauriError.
        assert!(!err.starts_with("Failed to"), "wrong error bucket: {err}");
        assert_eq!(
            config::load_journals(&env.app_dir).len(),
            1,
            "a rejected journal must not be persisted"
        );

        // An explicit "diary.db" is the same database as no filename at all.
        assert!(add_journal_inner(
            "Third".to_string(),
            path.clone(),
            Some("diary.db".to_string()),
            &env.app_dir,
        )
        .is_err());

        // A different database in the same folder is a genuinely different journal.
        assert!(add_journal_inner(
            "Other".to_string(),
            path,
            Some("work.db".to_string()),
            &env.app_dir,
        )
        .is_ok());
    }

    #[test]
    fn test_add_journal_rejects_a_snapshot_end_to_end() {
        let env = make_test_env("add_backup_name");
        let journal_dir = make_journal_dir(&env, "journal");

        let result = add_journal_inner(
            "Snapshot".to_string(),
            journal_dir.to_str().unwrap().to_string(),
            Some("backup-2026-08-07-10h30m00.db".to_string()),
            &env.app_dir,
        );

        assert!(result.unwrap_err().contains("backup"));
        assert!(
            config::load_journals(&env.app_dir).is_empty(),
            "a rejected journal must not be persisted"
        );
    }

    #[test]
    fn test_add_journal_still_accepts_a_normal_directory() {
        // Guard against the new rules over-matching: the common path must stay open.
        let env = make_test_env("add_normal");
        let journal_dir = make_journal_dir(&env, "My Backups Of Nothing");

        let result = add_journal_inner(
            "Normal".to_string(),
            journal_dir.to_str().unwrap().to_string(),
            Some("diary.db".to_string()),
            &env.app_dir,
        );
        assert!(result.is_ok(), "unexpected rejection: {result:?}");
    }

    /// Free-text filename input (the Flatpak create form) carries none of the validation a
    /// native save dialog would have applied, so `add_journal_inner` must refuse a bad name
    /// itself — and refuse it, not rewrite it.
    #[test]
    fn test_add_journal_rejects_an_invalid_db_filename() {
        let env = make_test_env("add_invalid_filename");
        let journal_dir = make_journal_dir(&env, "journal");

        let err = add_journal_inner(
            "Escaped".to_string(),
            journal_dir.to_str().unwrap().to_string(),
            Some("../../etc/passwd.db".to_string()),
            &env.app_dir,
        )
        .unwrap_err();

        assert_eq!(err, "Invalid journal filename");
        assert!(
            config::load_journals(&env.app_dir).is_empty(),
            "a rejected journal must not be persisted"
        );
    }

    /// Registers `filename` in a fresh folder and returns the filename `config.json` stored.
    fn register_and_read_back(env_name: &str, filename: &str) -> Option<String> {
        let env = make_test_env(env_name);
        let journal_dir = make_journal_dir(&env, "journal");

        let journal = add_journal_inner(
            "Picked".to_string(),
            journal_dir.to_str().unwrap().to_string(),
            Some(filename.to_string()),
            &env.app_dir,
        )
        .unwrap_or_else(|e| panic!("{filename:?} was refused: {e}"));

        assert_eq!(journal.db_filename, filename);
        config::load_journals(&env.app_dir)[0].db_filename.clone()
    }

    /// The picker checks the exact path it registers, so the stored name must be the picked one.
    #[test]
    fn test_add_journal_keeps_a_long_filename_unchanged() {
        let filename = format!("{}.db", "a".repeat(65));

        let stored = register_and_read_back("add_long_filename", &filename);

        assert_eq!(stored.as_deref(), Some(filename.as_str()));
    }

    /// Only the exact default is folded into `None`; a case variant is a different file on a
    /// case-sensitive filesystem.
    #[test]
    fn test_add_journal_keeps_case_variants_of_the_default_filename() {
        for (i, filename) in ["diary.DB", "Diary.db", "DIARY.DB"].into_iter().enumerate() {
            let stored = register_and_read_back(&format!("add_case_{i}"), filename);

            assert_eq!(stored.as_deref(), Some(filename));
        }
        // The exact default still round-trips as the absent value.
        assert_eq!(register_and_read_back("add_case_default", "diary.db"), None);
    }

    /// The picked file, existing on disk under an upper-case name, is the one the backend opens.
    #[test]
    fn test_switch_uses_an_upper_case_filename_unchanged() {
        let env = make_test_env("switch_upper_case");
        let dir = make_journal_dir(&env, "journal");
        fs::write(dir.join("Diary.DB"), b"").unwrap();

        let journal = add_journal_inner(
            "Upper".to_string(),
            dir.to_str().unwrap().to_string(),
            Some("Diary.DB".to_string()),
            &env.app_dir,
        )
        .unwrap();
        switch_journal_inner(journal.id, &env.state).unwrap();

        assert_eq!(*env.state.db_path.lock().unwrap(), dir.join("Diary.DB"));
        assert_eq!(
            *env.state.backups_dir.lock().unwrap(),
            dir.join("backups").join("Diary")
        );
    }

    /// Writes a config whose only journal carries `db_filename`, as if copied from another OS.
    fn save_foreign_journal(env: &TestEnv, dir: &Path, db_filename: &str, active: bool) -> String {
        let journal = JournalConfig {
            id: "foreignjournal01".to_string(),
            name: "Foreign".to_string(),
            path: dir.to_str().unwrap().to_string(),
            auto_key: None,
            db_filename: Some(db_filename.to_string()),
            require_all_auth: None,
        };
        let active_id = if active {
            journal.id.clone()
        } else {
            String::new()
        };
        config::save_journals(&env.app_dir, std::slice::from_ref(&journal), &active_id).unwrap();
        journal.id
    }

    /// Saved filenames that leave the journal folder once joined on this host.
    fn foreign_filenames() -> Vec<&'static str> {
        let mut names = vec!["..\\outside.db", "..", "sub/outside.db"];
        if cfg!(windows) {
            // A drive-relative prefix and an alternate data stream: one legal name on Unix.
            names.extend(["C:outside.db", "diary.db:stream"]);
        }
        names
    }

    #[test]
    fn test_switch_refuses_a_saved_filename_invalid_on_this_host() {
        for (i, filename) in foreign_filenames().into_iter().enumerate() {
            let env = make_test_env(&format!("switch_foreign_{i}"));
            let dir = make_journal_dir(&env, "journal");
            let before = env.state.db_path.lock().unwrap().clone();
            let id = save_foreign_journal(&env, &dir, filename, false);

            let err = switch_journal_inner(id, &env.state).unwrap_err();

            assert_eq!(err, "Invalid journal filename", "for {filename:?}");
            assert_eq!(
                *env.state.db_path.lock().unwrap(),
                before,
                "for {filename:?}"
            );
            assert_eq!(
                config::load_active_journal_id(&env.app_dir).as_deref(),
                Some("")
            );
        }
    }

    #[test]
    fn test_invalid_saved_filename_is_not_reported_as_the_active_journal() {
        let env = make_test_env("active_foreign");
        let dir = make_journal_dir(&env, "journal");
        save_foreign_journal(&env, &dir, "..\\outside.db", true);

        assert_eq!(get_active_journal_id_inner(&env.app_dir).unwrap(), None);
    }

    #[test]
    fn test_removal_does_not_fall_back_to_an_invalid_saved_filename() {
        let env = make_test_env("remove_foreign");
        let dir = make_journal_dir(&env, "journal");
        let removed = add_journal_inner(
            "Removed".to_string(),
            dir.to_str().unwrap().to_string(),
            Some("removed.db".to_string()),
            &env.app_dir,
        )
        .unwrap();
        let mut journals = config::load_journals(&env.app_dir);
        journals.push(JournalConfig {
            id: "foreignjournal01".to_string(),
            name: "Foreign".to_string(),
            path: dir.to_str().unwrap().to_string(),
            auto_key: None,
            db_filename: Some("..\\outside.db".to_string()),
            require_all_auth: None,
        });
        config::save_journals(&env.app_dir, &journals, &removed.id).unwrap();
        let before = env.state.db_path.lock().unwrap().clone();

        remove_journal_inner(removed.id, &env.state).unwrap();

        assert_eq!(*env.state.db_path.lock().unwrap(), before);
        assert_eq!(
            config::load_active_journal_id(&env.app_dir).as_deref(),
            Some("")
        );
    }

    /// Removal leaves an empty active id when the only remaining journal is unusable here.
    /// After a restart, the frontend must get no active journal (so it shows the picker), and
    /// the backend must refuse to create or open a database at the startup placeholder.
    #[test]
    fn test_restart_after_removal_to_an_unusable_journal_selects_nothing() {
        let env = make_test_env("restart_foreign");
        let dir = make_journal_dir(&env, "journal");
        let removed = add_journal_inner(
            "Removed".to_string(),
            dir.to_str().unwrap().to_string(),
            Some("removed.db".to_string()),
            &env.app_dir,
        )
        .unwrap();
        let mut journals = config::load_journals(&env.app_dir);
        journals.push(JournalConfig {
            id: "foreignjournal01".to_string(),
            name: "Foreign".to_string(),
            path: dir.to_str().unwrap().to_string(),
            auto_key: None,
            db_filename: Some("..\\outside.db".to_string()),
            require_all_auth: None,
        });
        config::save_journals(&env.app_dir, &journals, &removed.id).unwrap();
        remove_journal_inner(removed.id, &env.state).unwrap();
        assert_eq!(
            config::load_active_journal_id(&env.app_dir).as_deref(),
            Some("")
        );

        // Restart.
        assert_eq!(get_active_journal_id_inner(&env.app_dir).unwrap(), None);
        let (_, db_path, backups_dir) = startup_journal_paths(&env.app_dir, None);
        assert_eq!(
            (db_path.clone(), backups_dir.clone()),
            DiaryState::placeholder_paths(&env.app_dir)
        );
        let state = DiaryState::new(db_path.clone(), backups_dir, env.app_dir.clone());

        assert_eq!(
            state.ensure_journal_selected(&db_path).unwrap_err(),
            "No journal selected"
        );
        assert_eq!(
            super::super::perform_unlock(
                super::super::UnlockMode::Password("pw".to_string()),
                &state
            )
            .unwrap_err(),
            "No journal selected"
        );
        assert!(
            !db_path.exists(),
            "nothing may be written to the placeholder"
        );
    }

    /// The placeholder name must not collide with a legal journal: a journal registered in the
    /// app data folder under the placeholder's visible name can still be created and unlocked.
    #[test]
    fn test_journal_named_like_the_placeholder_can_be_created_and_unlocked() {
        let env = make_test_env("placeholder_name");
        let journal = add_journal_inner(
            "Look-alike".to_string(),
            env.app_dir.to_str().unwrap().to_string(),
            Some("no-active-journal".to_string()),
            &env.app_dir,
        )
        .unwrap();
        let journals = config::load_journals(&env.app_dir);
        config::save_journals(&env.app_dir, &journals, &journal.id).unwrap();

        assert_eq!(
            get_active_journal_id_inner(&env.app_dir).unwrap(),
            Some(journal.id)
        );
        let (_, db_path, backups_dir) = startup_journal_paths(&env.app_dir, None);
        assert_eq!(db_path, env.app_dir.join("no-active-journal"));
        let state = DiaryState::new(db_path.clone(), backups_dir, env.app_dir.clone());

        // Create: the guard that runs first in create_diary and create_diary_auto.
        state.ensure_journal_selected(&db_path).unwrap();
        crate::db::create_database(&db_path, "pw".to_string()).unwrap();

        super::super::perform_unlock(super::super::UnlockMode::Password("pw".to_string()), &state)
            .unwrap();
        assert!(state.db.lock().unwrap().is_some());
    }

    #[test]
    fn test_active_id_without_a_matching_journal_is_not_reported() {
        let env = make_test_env("active_missing");
        let dir = make_journal_dir(&env, "journal");
        add_journal_inner(
            "Real".to_string(),
            dir.to_str().unwrap().to_string(),
            None,
            &env.app_dir,
        )
        .unwrap();
        let journals = config::load_journals(&env.app_dir);

        config::save_journals(&env.app_dir, &journals, "").unwrap();
        assert_eq!(get_active_journal_id_inner(&env.app_dir).unwrap(), None);

        config::save_journals(&env.app_dir, &journals, "no-such-journal").unwrap();
        assert_eq!(get_active_journal_id_inner(&env.app_dir).unwrap(), None);

        config::save_journals(&env.app_dir, &journals, &journals[0].id).unwrap();
        assert_eq!(
            get_active_journal_id_inner(&env.app_dir).unwrap(),
            Some(journals[0].id.clone())
        );
    }

    #[test]
    fn test_add_journal_keeps_a_double_space_unchanged() {
        let stored = register_and_read_back("add_double_space", "work  notes.db");

        assert_eq!(stored.as_deref(), Some("work  notes.db"));
    }

    /// `:` is a legal filename character on Linux and macOS.
    #[cfg(unix)]
    #[test]
    fn test_add_journal_keeps_a_colon_unchanged_on_unix() {
        let stored = register_and_read_back("add_colon", "work:notes.db");

        assert_eq!(stored.as_deref(), Some("work:notes.db"));
    }

    /// Windows cannot hold `:` in a filename, so the name is refused rather than altered.
    #[cfg(windows)]
    #[test]
    fn test_add_journal_rejects_a_colon_on_windows() {
        let env = make_test_env("add_colon_windows");
        let journal_dir = make_journal_dir(&env, "journal");

        let err = add_journal_inner(
            "Picked".to_string(),
            journal_dir.to_str().unwrap().to_string(),
            Some("work:notes.db".to_string()),
            &env.app_dir,
        )
        .unwrap_err();

        assert_eq!(err, "Invalid journal filename");
    }

    #[test]
    fn test_rename_journal_inner() {
        let env = make_test_env("rename");
        let journal_dir = make_journal_dir(&env, "journal");

        let journal = add_journal_inner(
            "Original".to_string(),
            journal_dir.to_str().unwrap().to_string(),
            None,
            &env.app_dir,
        )
        .unwrap();

        rename_journal_inner(journal.id.clone(), "Renamed".to_string(), &env.app_dir).unwrap();

        let journals = config::load_journals(&env.app_dir);
        assert_eq!(journals[0].name, "Renamed");
    }

    #[test]
    fn test_switch_journal_updates_paths() {
        let env = make_test_env("switch");
        let dir_a = make_journal_dir(&env, "journal-a");
        let dir_b = make_journal_dir(&env, "journal-b");

        let ja = add_journal_inner(
            "A".to_string(),
            dir_a.to_str().unwrap().to_string(),
            None,
            &env.app_dir,
        )
        .unwrap();
        let jb = add_journal_inner(
            "B".to_string(),
            dir_b.to_str().unwrap().to_string(),
            None,
            &env.app_dir,
        )
        .unwrap();

        // Switch to B
        switch_journal_inner(jb.id.clone(), &env.state).unwrap();

        let db_path = env.state.db_path.lock().unwrap().clone();
        assert_eq!(db_path, dir_b.join("diary.db"));

        let backups = env.state.backups_dir.lock().unwrap().clone();
        assert_eq!(backups, dir_b.join("backups").join("diary"));

        let active = config::load_active_journal_id(&env.app_dir);
        assert_eq!(active, Some(jb.id));

        let _ = ja;
    }

    #[test]
    fn test_remove_only_journal_succeeds_leaving_empty_list() {
        let env = make_test_env("remove_only");
        let dir = make_journal_dir(&env, "journal");

        add_journal_inner(
            "Solo".to_string(),
            dir.to_str().unwrap().to_string(),
            None,
            &env.app_dir,
        )
        .unwrap();

        let journals = config::load_journals(&env.app_dir);
        let result = remove_journal_inner(journals[0].id.clone(), &env.state);
        assert!(result.is_ok(), "Removing last journal should succeed");

        let remaining = config::load_journals(&env.app_dir);
        assert!(
            remaining.is_empty(),
            "Journal list should be empty after removing last"
        );
    }
}
