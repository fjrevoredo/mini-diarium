use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::queries::{self, DiaryEntry, EntryMetadata};
use log::debug;
use tauri::State;

/// Creates a new blank diary entry for the given date and returns it with its assigned id
#[tauri::command]
pub fn create_entry(date: String, state: State<DiaryState>) -> Result<DiaryEntry, String> {
    with_unlocked_db(&state, |db| {
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: date.clone(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
        };
        queries::insert_entry(db, &entry)?;
        let new_id = db.conn().last_insert_rowid();
        debug!("Created entry id={} for {}", new_id, date);
        let created = queries::get_entry_by_id(db, new_id)?
            .ok_or_else(|| format!("Failed to retrieve newly created entry for {}", date))?;
        Ok(created)
    })
}

/// Pure inner of `save_entry` — takes `&DiaryState` so it can be tested without Tauri.
pub(crate) fn save_entry_inner(
    id: i64,
    title: &str,
    text: &str,
    metadata: Option<EntryMetadata>,
    state: &DiaryState,
) -> Result<(), String> {
    with_unlocked_db(state, |db| {
        let mut entry = queries::get_entry_by_id(db, id)?
            .ok_or_else(|| format!("No entry found with id: {}", id))?;

        let now = chrono::Utc::now().to_rfc3339();
        let word_count = queries::count_words(text);

        entry.title = title.to_string();
        entry.text = text.to_string();
        entry.word_count = word_count;
        entry.date_updated = now;
        entry.metadata = metadata;

        queries::update_entry(db, &entry)?;
        debug!("Saved entry id={}", id);

        Ok(())
    })
}

/// Saves (updates) a diary entry by id
#[tauri::command]
pub fn save_entry(
    id: i64,
    title: String,
    text: String,
    metadata: Option<EntryMetadata>,
    state: State<DiaryState>,
) -> Result<(), String> {
    save_entry_inner(id, &title, &text, metadata, &state)
}

/// Gets all diary entries for a specific date, newest-first
#[tauri::command]
pub fn get_entries_for_date(
    date: String,
    state: State<DiaryState>,
) -> Result<Vec<DiaryEntry>, String> {
    with_unlocked_db(&state, |db| queries::get_entries_by_date(db, &date))
}

/// Deletes an entry by id if both title and text are empty/whitespace
///
/// Returns true if the entry was deleted, false otherwise
#[tauri::command]
pub fn delete_entry_if_empty(
    id: i64,
    title: String,
    text: String,
    state: State<DiaryState>,
) -> Result<bool, String> {
    with_unlocked_db(&state, |db| {
        if title.trim().is_empty() && text.trim().is_empty() {
            debug!("Deleting empty entry id={}", id);
            queries::delete_entry_by_id(db, id)
        } else {
            Ok(false)
        }
    })
}

/// Deletes an entry by id
#[tauri::command]
pub fn delete_entry(id: i64, state: State<DiaryState>) -> Result<(), String> {
    with_unlocked_db(&state, |db| {
        let deleted = queries::delete_entry_by_id(db, id)
            .map_err(|e| format!("Failed to delete entry: {}", e))?;
        if !deleted {
            return Err("Entry not found".to_string());
        }
        Ok(())
    })
}

/// Gets all dates that have entries
///
/// Returns a sorted list of distinct dates in YYYY-MM-DD format
#[tauri::command]
pub fn get_all_entry_dates(state: State<DiaryState>) -> Result<Vec<String>, String> {
    with_unlocked_db(&state, queries::get_all_entry_dates)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_database;

    // Note: Command-level tests would require Tauri test infrastructure
    // The workflow tests below verify the underlying logic

    #[test]
    fn test_create_entry_workflow() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Create a blank entry
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-01-01".to_string(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
        };
        queries::insert_entry(&db, &entry).unwrap();
        let new_id = db.conn().last_insert_rowid();

        // Retrieve and verify
        let retrieved = queries::get_entry_by_id(&db, new_id).unwrap();
        assert!(retrieved.is_some());
        let e = retrieved.unwrap();
        assert_eq!(e.id, new_id);
        assert_eq!(e.date, "2024-01-01");
        assert_eq!(e.title, "");
        assert_eq!(e.text, "");
    }

    #[test]
    fn test_save_entry_workflow() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Create entry
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-01-01".to_string(),
            title: "Test".to_string(),
            text: "Content".to_string(),
            word_count: 1,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
        };
        queries::insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        // Update via update_entry
        let mut updated = queries::get_entry_by_id(&db, id).unwrap().unwrap();
        updated.title = "Updated Title".to_string();
        updated.text = "Updated Content".to_string();
        updated.word_count = 2;
        queries::update_entry(&db, &updated).unwrap();

        // Verify update
        let retrieved = queries::get_entry_by_id(&db, id).unwrap().unwrap();
        assert_eq!(retrieved.title, "Updated Title");
    }

    #[test]
    fn test_get_entries_for_date_multiple() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        let make_entry = |title: &str| DiaryEntry {
            id: 0,
            date: "2024-02-01".to_string(),
            title: title.to_string(),
            text: "Content".to_string(),
            word_count: 1,
            date_created: now.clone(),
            date_updated: now.clone(),
            metadata: None,
        };

        queries::insert_entry(&db, &make_entry("Morning")).unwrap();
        queries::insert_entry(&db, &make_entry("Afternoon")).unwrap();
        queries::insert_entry(&db, &make_entry("Evening")).unwrap();

        let entries = queries::get_entries_by_date(&db, "2024-02-01").unwrap();
        assert_eq!(entries.len(), 3);
        // Newest first (highest id first)
        assert_eq!(entries[0].title, "Evening");
        assert_eq!(entries[1].title, "Afternoon");
        assert_eq!(entries[2].title, "Morning");
    }

    #[test]
    fn test_delete_entry_if_empty_workflow() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert entry
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-02-01".to_string(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
        };
        queries::insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        // Delete empty entry
        let deleted = queries::delete_entry_by_id(&db, id).unwrap();
        assert!(deleted);

        // Verify deletion
        let retrieved = queries::get_entry_by_id(&db, id).unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_get_all_dates_workflow() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        let make_entry = |date: &str| DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: "Test".to_string(),
            text: "Content".to_string(),
            word_count: 1,
            date_created: now.clone(),
            date_updated: now.clone(),
            metadata: None,
        };

        // Insert multiple entries, two on the same date
        queries::insert_entry(&db, &make_entry("2024-01-01")).unwrap();
        queries::insert_entry(&db, &make_entry("2024-01-15")).unwrap();
        queries::insert_entry(&db, &make_entry("2024-01-15")).unwrap(); // second on same date
        queries::insert_entry(&db, &make_entry("2024-02-01")).unwrap();

        let dates = queries::get_all_entry_dates(&db).unwrap();
        // DISTINCT: only 3 unique dates
        assert_eq!(dates.len(), 3);
        assert_eq!(dates[0], "2024-01-01");
        assert_eq!(dates[2], "2024-02-01");
    }

    #[test]
    fn test_word_count() {
        assert_eq!(queries::count_words("Hello world"), 2);
        assert_eq!(queries::count_words(""), 0);
        assert_eq!(queries::count_words("One two three four five"), 5);
    }

    #[test]
    fn test_delete_entry_workflow() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert an entry
        let now = chrono::Utc::now().to_rfc3339();
        let entry = DiaryEntry {
            id: 0,
            date: "2024-03-01".to_string(),
            title: "To delete".to_string(),
            text: "Some content".to_string(),
            word_count: 2,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
        };
        queries::insert_entry(&db, &entry).unwrap();
        let id = db.conn().last_insert_rowid();

        // delete_entry_by_id returns Ok(true) when entry exists — mirrors command Ok(())
        let deleted = queries::delete_entry_by_id(&db, id).unwrap();
        assert!(deleted);

        // Entry is gone
        let retrieved = queries::get_entry_by_id(&db, id).unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_delete_entry_not_found() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // delete_entry_by_id returns Ok(false) for a non-existent id — the command
        // maps this to Err("Entry not found")
        let deleted = queries::delete_entry_by_id(&db, 9999).unwrap();
        assert!(!deleted);
    }

    #[test]
    fn test_save_entry_locked_returns_error() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let state = DiaryState::new(
            PathBuf::from("test_save_entry_locked.db"),
            PathBuf::from("test_save_entry_locked_backups"),
            PathBuf::from("."),
        );
        let err = save_entry_inner(1, "Title", "Text", None, &state).unwrap_err();
        assert!(err.contains("Journal must be unlocked"), "got: {}", err);
    }

    #[test]
    fn test_save_entry_unlocked_updates_content() {
        use crate::commands::auth::DiaryState;
        use std::path::PathBuf;
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let blank = DiaryEntry {
            id: 0,
            date: "2024-05-01".to_string(),
            title: String::new(),
            text: String::new(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
        };
        queries::insert_entry(&db, &blank).unwrap();
        let entry_id = db.conn().last_insert_rowid();
        let state = DiaryState::new(
            PathBuf::from("test_save_entry_unlocked.db"),
            PathBuf::from("test_save_entry_unlocked_backups"),
            PathBuf::from("."),
        );
        *state.db.lock().unwrap() = Some(db);
        let result = save_entry_inner(entry_id, "My Title", "My content here", None, &state);
        assert!(result.is_ok(), "err: {:?}", result.err());
        let db_guard = state.db.lock().unwrap();
        let retrieved = queries::get_entry_by_id(db_guard.as_ref().unwrap(), entry_id)
            .unwrap()
            .unwrap();
        assert_eq!(retrieved.title, "My Title");
        assert_eq!(retrieved.word_count, 3);
    }
}
