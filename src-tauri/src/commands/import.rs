use crate::commands::auth::DiaryState;
use crate::db::queries;
use crate::db::schema::DatabaseConnection;
use crate::import::{dayone, dayone_txt, jrnl, merge, minidiary};
use log::{debug, error, info};
use tauri::State;

const MAX_IMPORT_FILE_SIZE: u64 = 100 * 1024 * 1024; // 100 MB

fn read_import_file(file_path: &str) -> Result<String, String> {
    let metadata = std::fs::metadata(file_path).map_err(|e| {
        let err = format!("Cannot access file: {}", e);
        error!("{}", err);
        err
    })?;
    if metadata.len() > MAX_IMPORT_FILE_SIZE {
        let err = format!(
            "File is too large ({} MB). Maximum supported size is 100 MB.",
            metadata.len() / 1_048_576
        );
        error!("{}", err);
        return Err(err);
    }
    std::fs::read_to_string(file_path).map_err(|e| {
        let err = format!("Failed to read file: {}", e);
        error!("{}", err);
        err
    })
}

/// Import result containing the number of entries imported
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportResult {
    pub entries_imported: usize,
    pub entries_merged: usize,
    pub entries_skipped: usize,
}

/// Imports Mini Diary JSON format
///
/// # Arguments
/// * `file_path` - Path to the JSON file to import
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ImportResult with counts of imported, merged, and skipped entries
#[tauri::command]
pub fn import_minidiary_json(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    info!("Starting Mini Diary import from file: {}", file_path);

    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or_else(|| {
        let err = "Diary must be unlocked to import entries";
        error!("{}", err);
        err.to_string()
    })?;

    // Read file
    debug!("Reading file...");
    let json_content = read_import_file(&file_path)?;

    // Parse JSON
    debug!("Parsing Mini Diary JSON...");
    let entries = minidiary::parse_minidiary_json(&json_content).map_err(|e| {
        error!("Parse error: {}", e);
        e
    })?;
    debug!("Parsed {} entries", entries.len());

    // Import entries with merge handling
    debug!("Importing entries...");
    let result = import_entries(db, entries).map_err(|e| {
        error!("Import error: {}", e);
        e
    })?;

    // Search index hook: call search module's bulk_reindex() here when implemented.

    info!(
        "Mini Diary import complete: {} imported, {} merged",
        result.entries_imported, result.entries_merged
    );
    Ok(result)
}

/// Imports Day One JSON format
///
/// # Arguments
/// * `file_path` - Path to the JSON file to import
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ImportResult with counts of imported, merged, and skipped entries
#[tauri::command]
pub fn import_dayone_json(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    info!("Starting Day One JSON import from file: {}", file_path);

    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or_else(|| {
        let err = "Diary must be unlocked to import entries";
        error!("{}", err);
        err.to_string()
    })?;

    // Read file
    debug!("Reading file...");
    let json_content = read_import_file(&file_path)?;

    // Parse JSON
    debug!("Parsing Day One JSON...");
    let entries = dayone::parse_dayone_json(&json_content).map_err(|e| {
        error!("Parse error: {}", e);
        e
    })?;
    debug!("Parsed {} entries", entries.len());

    // Import entries with merge handling
    debug!("Importing entries...");
    let result = import_entries(db, entries).map_err(|e| {
        error!("Import error: {}", e);
        e
    })?;

    // Search index hook: call search module's bulk_reindex() here when implemented.

    info!(
        "Day One JSON import complete: {} imported, {} merged",
        result.entries_imported, result.entries_merged
    );
    Ok(result)
}

/// Imports jrnl JSON format
///
/// # Arguments
/// * `file_path` - Path to the JSON file to import
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ImportResult with counts of imported, merged, and skipped entries
#[tauri::command]
pub fn import_jrnl_json(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    info!("Starting jrnl import from file: {}", file_path);

    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or_else(|| {
        let err = "Diary must be unlocked to import entries";
        error!("{}", err);
        err.to_string()
    })?;

    // Read file
    debug!("Reading file...");
    let json_content = read_import_file(&file_path)?;

    // Parse JSON
    debug!("Parsing jrnl JSON...");
    let entries = jrnl::parse_jrnl_json(&json_content).map_err(|e| {
        error!("Parse error: {}", e);
        e
    })?;
    debug!("Parsed {} entries", entries.len());

    // Import entries with merge handling
    debug!("Importing entries...");
    let result = import_entries(db, entries).map_err(|e| {
        error!("Import error: {}", e);
        e
    })?;

    // Search index hook: call search module's bulk_reindex() here when implemented.

    info!(
        "jrnl import complete: {} imported, {} merged",
        result.entries_imported, result.entries_merged
    );
    Ok(result)
}

/// Imports Day One TXT format
///
/// # Arguments
/// * `file_path` - Path to the TXT file to import
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ImportResult with counts of imported, merged, and skipped entries
#[tauri::command]
pub fn import_dayone_txt(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    info!("Starting Day One TXT import from file: {}", file_path);

    let db_state = state.db.lock().unwrap();
    let db = db_state.as_ref().ok_or_else(|| {
        let err = "Diary must be unlocked to import entries";
        error!("{}", err);
        err.to_string()
    })?;

    // Read file
    debug!("Reading file...");
    let txt_content = read_import_file(&file_path)?;

    // Parse TXT
    debug!("Parsing Day One TXT...");
    let entries = dayone_txt::parse_dayone_txt(&txt_content).map_err(|e| {
        error!("Parse error: {}", e);
        e
    })?;
    debug!("Parsed {} entries", entries.len());

    // Import entries with merge handling
    debug!("Importing entries...");
    let result = import_entries(db, entries).map_err(|e| {
        error!("Import error: {}", e);
        e
    })?;

    // Search index hook: call search module's bulk_reindex() here when implemented.

    info!(
        "Day One TXT import complete: {} imported, {} merged",
        result.entries_imported, result.entries_merged
    );
    Ok(result)
}

/// Imports a list of entries into the database
///
/// Handles merging when entries with the same date already exist
fn import_entries(
    db: &DatabaseConnection,
    entries: Vec<queries::DiaryEntry>,
) -> Result<ImportResult, String> {
    let mut entries_imported = 0;
    let mut entries_merged = 0;
    let entries_skipped = 0;

    for entry in entries {
        // Check if entry already exists
        let existing = queries::get_entry(db, &entry.date)?;

        if let Some(existing_entry) = existing {
            // Entry exists - merge it
            let merged = merge::merge_entries(existing_entry, entry);
            queries::update_entry(db, &merged)?;
            entries_merged += 1;
        } else {
            // New entry - insert it
            queries::insert_entry(db, &entry)?;
            entries_imported += 1;
        }
    }

    Ok(ImportResult {
        entries_imported,
        entries_merged,
        entries_skipped,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::DiaryEntry;
    use crate::db::schema::create_database;
    use std::fs;

    fn temp_db_path(name: &str) -> String {
        format!("test_import_{}.db", name)
    }

    fn cleanup_db(path: &str) {
        let _ = fs::remove_file(path);
    }

    fn create_test_entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        let now = chrono::Utc::now().to_rfc3339();
        DiaryEntry {
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: crate::db::queries::count_words(text),
            date_created: now.clone(),
            date_updated: now,
        }
    }

    #[test]
    fn test_import_new_entries() {
        let db_path = temp_db_path("new_entries");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        let entries = vec![
            create_test_entry("2024-01-01", "Entry 1", "Text 1"),
            create_test_entry("2024-01-02", "Entry 2", "Text 2"),
        ];

        let result = import_entries(&db, entries).unwrap();

        assert_eq!(result.entries_imported, 2);
        assert_eq!(result.entries_merged, 0);
        assert_eq!(result.entries_skipped, 0);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_import_with_merge() {
        let db_path = temp_db_path("merge");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        // Insert existing entry
        let existing = create_test_entry("2024-01-01", "Morning", "Had breakfast");
        crate::db::queries::insert_entry(&db, &existing).unwrap();

        // Import entry with same date
        let entries = vec![create_test_entry("2024-01-01", "Evening", "Had dinner")];

        let result = import_entries(&db, entries).unwrap();

        assert_eq!(result.entries_imported, 0);
        assert_eq!(result.entries_merged, 1);

        // Verify merge happened
        let merged = crate::db::queries::get_entry(&db, "2024-01-01")
            .unwrap()
            .unwrap();
        assert!(merged.title.contains("Morning"));
        assert!(merged.title.contains("Evening"));

        cleanup_db(&db_path);
    }

    #[test]
    fn test_import_empty_list() {
        let db_path = temp_db_path("empty");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        let result = import_entries(&db, vec![]).unwrap();

        assert_eq!(result.entries_imported, 0);
        assert_eq!(result.entries_merged, 0);
        assert_eq!(result.entries_skipped, 0);

        cleanup_db(&db_path);
    }
}
