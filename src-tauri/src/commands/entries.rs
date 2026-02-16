use crate::commands::auth::DiaryState;
use crate::db::queries::{self, DiaryEntry};
use tauri::State;

/// Saves a diary entry (insert or update)
///
/// Automatically updates the `date_updated` timestamp
#[tauri::command]
pub fn save_entry(
    date: String,
    title: String,
    text: String,
    state: State<DiaryState>,
) -> Result<(), String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state
        .as_ref()
        .ok_or("Diary must be unlocked to save entries")?;

    // Get current timestamp in ISO 8601 format
    let now = chrono::Utc::now().to_rfc3339();

    // Count words
    let word_count = queries::count_words(&text);

    // Check if entry exists
    let existing = queries::get_entry(db, &date)?;

    if let Some(mut entry) = existing {
        // Update existing entry
        entry.title = title;
        entry.text = text;
        entry.word_count = word_count;
        entry.date_updated = now;
        queries::update_entry(db, &entry)?;
    } else {
        // Create new entry
        let entry = DiaryEntry {
            date: date.clone(),
            title,
            text,
            word_count,
            date_created: now.clone(),
            date_updated: now,
        };
        queries::insert_entry(db, &entry)?;
    }

    Ok(())
}

/// Gets a diary entry for a specific date
#[tauri::command]
pub fn get_entry(date: String, state: State<DiaryState>) -> Result<Option<DiaryEntry>, String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state
        .as_ref()
        .ok_or("Diary must be unlocked to read entries")?;

    queries::get_entry(db, &date)
}

/// Deletes an entry if both title and text are empty
///
/// Returns true if the entry was deleted, false otherwise
#[tauri::command]
pub fn delete_entry_if_empty(
    date: String,
    title: String,
    text: String,
    state: State<DiaryState>,
) -> Result<bool, String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state
        .as_ref()
        .ok_or("Diary must be unlocked to delete entries")?;

    // Only delete if both title and text are empty/whitespace
    if title.trim().is_empty() && text.trim().is_empty() {
        queries::delete_entry(db, &date)
    } else {
        Ok(false)
    }
}

/// Gets all dates that have entries
///
/// Returns a sorted list of dates in YYYY-MM-DD format
#[tauri::command]
pub fn get_all_entry_dates(state: State<DiaryState>) -> Result<Vec<String>, String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state
        .as_ref()
        .ok_or("Diary must be unlocked to read entry dates")?;

    queries::get_all_entry_dates(db)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_database;
    use std::fs;
    use std::path::PathBuf;

    fn temp_db_path(name: &str) -> PathBuf {
        PathBuf::from(format!("test_entries_cmd_{}.db", name))
    }

    fn cleanup_db(path: &PathBuf) {
        let _ = fs::remove_file(path);
    }

    // Note: Command-level tests would require Tauri test infrastructure
    // The workflow tests below verify the underlying logic

    #[test]
    fn test_save_entry_workflow() {
        let db_path = temp_db_path("workflow");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        // Test inserting an entry directly
        let entry = DiaryEntry {
            date: "2024-01-01".to_string(),
            title: "Test".to_string(),
            text: "Content".to_string(),
            word_count: 1,
            date_created: chrono::Utc::now().to_rfc3339(),
            date_updated: chrono::Utc::now().to_rfc3339(),
        };

        queries::insert_entry(&db, &entry).unwrap();

        // Get the entry back
        let retrieved = queries::get_entry(&db, "2024-01-01").unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().title, "Test");

        cleanup_db(&db_path);
    }

    #[test]
    fn test_delete_if_empty_workflow() {
        let db_path = temp_db_path("delete_empty");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        // Insert entry
        let entry = DiaryEntry {
            date: "2024-02-01".to_string(),
            title: "Title".to_string(),
            text: "Text".to_string(),
            word_count: 1,
            date_created: chrono::Utc::now().to_rfc3339(),
            date_updated: chrono::Utc::now().to_rfc3339(),
        };
        queries::insert_entry(&db, &entry).unwrap();

        // Delete entry
        let deleted = queries::delete_entry(&db, "2024-02-01").unwrap();
        assert!(deleted);

        // Verify deletion
        let retrieved = queries::get_entry(&db, "2024-02-01").unwrap();
        assert!(retrieved.is_none());

        cleanup_db(&db_path);
    }

    #[test]
    fn test_get_all_dates_workflow() {
        let db_path = temp_db_path("all_dates");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        // Insert multiple entries
        for date in &["2024-01-01", "2024-01-15", "2024-02-01"] {
            let entry = DiaryEntry {
                date: date.to_string(),
                title: "Test".to_string(),
                text: "Content".to_string(),
                word_count: 1,
                date_created: chrono::Utc::now().to_rfc3339(),
                date_updated: chrono::Utc::now().to_rfc3339(),
            };
            queries::insert_entry(&db, &entry).unwrap();
        }

        let dates = queries::get_all_entry_dates(&db).unwrap();
        assert_eq!(dates.len(), 3);
        assert_eq!(dates[0], "2024-01-01");
        assert_eq!(dates[2], "2024-02-01");

        cleanup_db(&db_path);
    }

    #[test]
    fn test_word_count() {
        assert_eq!(queries::count_words("Hello world"), 2);
        assert_eq!(queries::count_words(""), 0);
        assert_eq!(queries::count_words("One two three four five"), 5);
    }
}
