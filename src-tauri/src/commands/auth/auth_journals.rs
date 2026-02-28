use log::info;
use std::path::PathBuf;
use tauri::{AppHandle, State, Wry};

use super::DiaryState;
use crate::config::{self, JournalConfig};

// Note: #[tauri::command] attributes are applied below, after the inner functions.

fn list_journals_inner(app_data_dir: &std::path::Path) -> Result<Vec<JournalConfig>, String> {
    Ok(config::load_journals(app_data_dir))
}

#[tauri::command]
pub fn list_journals(state: State<DiaryState>) -> Result<Vec<JournalConfig>, String> {
    list_journals_inner(&state.app_data_dir)
}

fn get_active_journal_id_inner(app_data_dir: &std::path::Path) -> Result<Option<String>, String> {
    Ok(config::load_active_journal_id(app_data_dir))
}

#[tauri::command]
pub fn get_active_journal_id(state: State<DiaryState>) -> Result<Option<String>, String> {
    get_active_journal_id_inner(&state.app_data_dir)
}

fn add_journal_inner(
    name: String,
    path: String,
    app_data_dir: &std::path::Path,
) -> Result<JournalConfig, String> {
    let dir = PathBuf::from(&path);
    if !dir.is_absolute() {
        return Err("Path must be absolute".to_string());
    }
    if !dir.is_dir() {
        return Err("Directory does not exist".to_string());
    }

    let mut journals = config::load_journals(app_data_dir);

    let id = config::generate_journal_id();
    let journal = JournalConfig {
        id: id.clone(),
        name,
        path,
    };
    journals.push(journal.clone());

    // Use existing active_id if set and non-empty; otherwise promote the new journal.
    let active_id = config::load_active_journal_id(app_data_dir)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| id.clone());
    config::save_journals(app_data_dir, &journals, &active_id)?;

    info!("Journal added: {} ({})", journal.name, id);
    Ok(journal)
}

#[tauri::command]
pub fn add_journal(
    name: String,
    path: String,
    state: State<DiaryState>,
) -> Result<JournalConfig, String> {
    add_journal_inner(name, path, &state.app_data_dir)
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
        if let Some(other) = journals.first() {
            // Switch to the next available journal
            let other_path = PathBuf::from(&other.path);
            let other_id = other.id.clone();
            *state
                .db_path
                .lock()
                .map_err(|_| "State lock poisoned".to_string())? = other_path.join("diary.db");
            *state
                .backups_dir
                .lock()
                .map_err(|_| "State lock poisoned".to_string())? = other_path.join("backups");
            config::save_journals(&state.app_data_dir, &journals, &other_id)?;
        } else {
            // No journals left — save with empty active id; frontend will show empty picker
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
    let new_path = PathBuf::from(&journal.path);

    // Update DiaryState paths
    *state
        .db_path
        .lock()
        .map_err(|_| "State lock poisoned".to_string())? = new_path.join("diary.db");
    *state
        .backups_dir
        .lock()
        .map_err(|_| "State lock poisoned".to_string())? = new_path.join("backups");

    // Persist active journal id
    config::save_active_journal_id(&state.app_data_dir, &id)?;

    info!("Switched to journal: {} ({})", journal.name, id);
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

    fn make_test_env(name: &str) -> (DiaryState, PathBuf) {
        let app_data_dir = PathBuf::from(format!("test_journals_cmd_{}", name));
        let _ = fs::remove_dir_all(&app_data_dir);
        fs::create_dir_all(&app_data_dir).unwrap();
        let db_path = app_data_dir.join("diary.db");
        let backups_dir = app_data_dir.join("backups");
        let state = DiaryState::new(db_path, backups_dir, app_data_dir.clone());
        (state, app_data_dir)
    }

    fn cleanup(dir: &PathBuf) {
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_add_journal_inner() {
        let (_state, app_dir) = make_test_env("add");
        let journal_dir = std::env::temp_dir();

        let result = add_journal_inner(
            "Test Journal".to_string(),
            journal_dir.to_str().unwrap().to_string(),
            &app_dir,
        );
        assert!(result.is_ok());
        let journal = result.unwrap();
        assert_eq!(journal.name, "Test Journal");
        assert_eq!(journal.id.len(), 16);

        let journals = config::load_journals(&app_dir);
        assert_eq!(journals.len(), 1);

        cleanup(&app_dir);
    }

    #[test]
    fn test_add_journal_rejects_relative_path() {
        let (_state, app_dir) = make_test_env("add_relative");

        let result = add_journal_inner("Bad".to_string(), "relative/path".to_string(), &app_dir);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("absolute"));

        cleanup(&app_dir);
    }

    #[test]
    fn test_rename_journal_inner() {
        let (_state, app_dir) = make_test_env("rename");
        let journal_dir = std::env::temp_dir();

        let journal = add_journal_inner(
            "Original".to_string(),
            journal_dir.to_str().unwrap().to_string(),
            &app_dir,
        )
        .unwrap();

        rename_journal_inner(journal.id.clone(), "Renamed".to_string(), &app_dir).unwrap();

        let journals = config::load_journals(&app_dir);
        assert_eq!(journals[0].name, "Renamed");

        cleanup(&app_dir);
    }

    #[test]
    fn test_switch_journal_updates_paths() {
        let dir_a = std::env::temp_dir().join("journal_switch_a");
        let dir_b = std::env::temp_dir().join("journal_switch_b");
        fs::create_dir_all(&dir_a).unwrap();
        fs::create_dir_all(&dir_b).unwrap();

        let (state, app_dir) = make_test_env("switch");

        let ja = add_journal_inner(
            "A".to_string(),
            dir_a.to_str().unwrap().to_string(),
            &app_dir,
        )
        .unwrap();
        let jb = add_journal_inner(
            "B".to_string(),
            dir_b.to_str().unwrap().to_string(),
            &app_dir,
        )
        .unwrap();

        // Switch to B
        switch_journal_inner(jb.id.clone(), &state).unwrap();

        let db_path = state.db_path.lock().unwrap().clone();
        assert_eq!(db_path, dir_b.join("diary.db"));

        let backups = state.backups_dir.lock().unwrap().clone();
        assert_eq!(backups, dir_b.join("backups"));

        let active = config::load_active_journal_id(&app_dir);
        assert_eq!(active, Some(jb.id));

        let _ = ja;
        let _ = fs::remove_dir_all(&dir_a);
        let _ = fs::remove_dir_all(&dir_b);
        cleanup(&app_dir);
    }

    #[test]
    fn test_remove_non_active_journal() {
        let dir_a = std::env::temp_dir().join("journal_rm_a");
        let dir_b = std::env::temp_dir().join("journal_rm_b");
        fs::create_dir_all(&dir_a).unwrap();
        fs::create_dir_all(&dir_b).unwrap();

        let (state, app_dir) = make_test_env("remove");

        let ja = add_journal_inner(
            "A".to_string(),
            dir_a.to_str().unwrap().to_string(),
            &app_dir,
        )
        .unwrap();
        let jb = add_journal_inner(
            "B".to_string(),
            dir_b.to_str().unwrap().to_string(),
            &app_dir,
        )
        .unwrap();

        // Set A as active
        config::save_active_journal_id(&app_dir, &ja.id).unwrap();

        // Remove B (non-active)
        remove_journal_inner(jb.id.clone(), &state).unwrap();

        let journals = config::load_journals(&app_dir);
        assert_eq!(journals.len(), 1);
        assert_eq!(journals[0].id, ja.id);

        let _ = fs::remove_dir_all(&dir_a);
        let _ = fs::remove_dir_all(&dir_b);
        cleanup(&app_dir);
    }

    #[test]
    fn test_remove_only_journal_succeeds_leaving_empty_list() {
        let dir = std::env::temp_dir().join("journal_rm_only");
        fs::create_dir_all(&dir).unwrap();

        let (state, app_dir) = make_test_env("remove_only");

        add_journal_inner(
            "Solo".to_string(),
            dir.to_str().unwrap().to_string(),
            &app_dir,
        )
        .unwrap();

        let journals = config::load_journals(&app_dir);
        let result = remove_journal_inner(journals[0].id.clone(), &state);
        assert!(result.is_ok(), "Removing last journal should succeed");

        let remaining = config::load_journals(&app_dir);
        assert!(
            remaining.is_empty(),
            "Journal list should be empty after removing last"
        );

        let _ = fs::remove_dir_all(&dir);
        cleanup(&app_dir);
    }
}
