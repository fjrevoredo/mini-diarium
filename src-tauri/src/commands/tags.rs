use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::queries::{self, Tag};
use tauri::State;

#[tauri::command]
pub fn create_tag(name: String, state: State<DiaryState>) -> Result<Tag, String> {
    with_unlocked_db(&state, |db| queries::create_tag(db, &name))
}

#[tauri::command]
pub fn get_all_tags(state: State<DiaryState>) -> Result<Vec<Tag>, String> {
    with_unlocked_db(&state, queries::get_all_tags)
}

#[tauri::command]
pub fn rename_tag(id: i64, name: String, state: State<DiaryState>) -> Result<(), String> {
    with_unlocked_db(&state, |db| queries::rename_tag(db, id, &name))
}

#[tauri::command]
pub fn delete_tag(id: i64, state: State<DiaryState>) -> Result<(), String> {
    with_unlocked_db(&state, |db| queries::delete_tag(db, id))
}

/// Pure inner of `add_tag_to_entry` — takes `&DiaryState` so it can be tested without Tauri.
pub(crate) fn add_tag_to_entry_inner(
    entry_id: i64,
    tag_id: i64,
    state: &DiaryState,
) -> Result<(), String> {
    with_unlocked_db(state, |db| {
        // A locked entry is read-only, including its tag associations (TODO-0071).
        if queries::is_entry_locked(db, entry_id)? {
            return Err("entry is locked".to_string());
        }
        queries::add_tag_to_entry(db, entry_id, tag_id)
    })
}

#[tauri::command]
pub fn add_tag_to_entry(
    entry_id: i64,
    tag_id: i64,
    state: State<DiaryState>,
) -> Result<(), String> {
    add_tag_to_entry_inner(entry_id, tag_id, &state)
}

/// Pure inner of `remove_tag_from_entry` — takes `&DiaryState` so it can be tested without Tauri.
pub(crate) fn remove_tag_from_entry_inner(
    entry_id: i64,
    tag_id: i64,
    state: &DiaryState,
) -> Result<(), String> {
    with_unlocked_db(state, |db| {
        // A locked entry is read-only, including its tag associations (TODO-0071).
        if queries::is_entry_locked(db, entry_id)? {
            return Err("entry is locked".to_string());
        }
        queries::remove_tag_from_entry(db, entry_id, tag_id)
    })
}

#[tauri::command]
pub fn remove_tag_from_entry(
    entry_id: i64,
    tag_id: i64,
    state: State<DiaryState>,
) -> Result<(), String> {
    remove_tag_from_entry_inner(entry_id, tag_id, &state)
}

#[tauri::command]
pub fn get_tags_for_entry(entry_id: i64, state: State<DiaryState>) -> Result<Vec<Tag>, String> {
    with_unlocked_db(&state, |db| queries::get_tags_for_entry(db, entry_id))
}

#[tauri::command]
pub fn get_entry_dates_by_tag(
    tag_id: i64,
    state: State<DiaryState>,
) -> Result<Vec<String>, String> {
    with_unlocked_db(&state, |db| queries::get_entry_dates_by_tag(db, tag_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::DiaryEntry;
    use crate::db::schema::create_database;
    use std::path::PathBuf;

    fn state_with_db(db: crate::db::schema::DatabaseConnection, name: &str) -> DiaryState {
        let state = DiaryState::new(
            PathBuf::from(format!("test_tags_{}.db", name)),
            PathBuf::from(format!("test_tags_{}_backups", name)),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);
        state
    }

    fn insert_entry_return_id(db: &crate::db::schema::DatabaseConnection, date: &str) -> i64 {
        let now = "2024-01-01T00:00:00Z".to_string();
        let entry = DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: "T".to_string(),
            text: "<p>content</p>".to_string(),
            word_count: 1,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        };
        queries::insert_entry(db, &entry).unwrap();
        db.conn().last_insert_rowid()
    }

    #[test]
    fn test_add_tag_to_locked_entry_is_rejected() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let entry_id = insert_entry_return_id(&db, "2024-06-01");
        let tag = queries::create_tag(&db, "work").unwrap();
        queries::set_entry_locked(&db, entry_id, true).unwrap();
        let state = state_with_db(db, "add_locked");

        let err = add_tag_to_entry_inner(entry_id, tag.id, &state).unwrap_err();
        assert_eq!(err, "entry is locked");

        // No association was created.
        let db_guard = state.db.lock().unwrap();
        let tags = queries::get_tags_for_entry(db_guard.as_ref().unwrap(), entry_id).unwrap();
        assert!(tags.is_empty(), "locked entry must not gain a tag");
    }

    #[test]
    fn test_remove_tag_from_locked_entry_is_rejected() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let entry_id = insert_entry_return_id(&db, "2024-06-02");
        let tag = queries::create_tag(&db, "personal").unwrap();
        // Associate the tag while still unlocked, then lock.
        queries::add_tag_to_entry(&db, entry_id, tag.id).unwrap();
        queries::set_entry_locked(&db, entry_id, true).unwrap();
        let state = state_with_db(db, "remove_locked");

        let err = remove_tag_from_entry_inner(entry_id, tag.id, &state).unwrap_err();
        assert_eq!(err, "entry is locked");

        // The tag association survived the rejected removal.
        let db_guard = state.db.lock().unwrap();
        let tags = queries::get_tags_for_entry(db_guard.as_ref().unwrap(), entry_id).unwrap();
        assert_eq!(tags.len(), 1, "locked entry must keep its tag");
    }

    #[test]
    fn test_add_tag_to_unlocked_entry_succeeds() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let entry_id = insert_entry_return_id(&db, "2024-06-03");
        let tag = queries::create_tag(&db, "idea").unwrap();
        let state = state_with_db(db, "add_unlocked");

        add_tag_to_entry_inner(entry_id, tag.id, &state).unwrap();

        let db_guard = state.db.lock().unwrap();
        let tags = queries::get_tags_for_entry(db_guard.as_ref().unwrap(), entry_id).unwrap();
        assert_eq!(tags.len(), 1);
    }
}
