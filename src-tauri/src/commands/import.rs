use crate::commands::auth::DiaryState;
use crate::db::queries;
use crate::db::schema::DatabaseConnection;
use crate::import::{dayone, dayone_txt, jrnl, minidiary};
use log::{debug, error, info};
use tauri::State;

const MAX_IMPORT_FILE_SIZE: u64 = 100 * 1024 * 1024; // 100 MB

pub(crate) fn read_import_file(file_path: &str) -> Result<String, String> {
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
    pub entries_skipped: usize,
}

/// Imports Mini Diary JSON format
///
/// # Arguments
/// * `file_path` - Path to the JSON file to import
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ImportResult with counts of imported and skipped entries
#[tauri::command]
pub fn import_minidiary_json(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    info!("Starting Mini Diary import from file: {}", file_path);

    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
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

    // Import entries (each entry always creates a new row)
    debug!("Importing entries...");
    let result = import_entries(db, entries).map_err(|e| {
        error!("Import error: {}", e);
        e
    })?;

    // Search index hook: call search module's bulk_reindex() here when implemented.

    info!(
        "Mini Diary import complete: {} imported",
        result.entries_imported
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
/// ImportResult with counts of imported and skipped entries
#[tauri::command]
pub fn import_dayone_json(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    info!("Starting Day One JSON import from file: {}", file_path);

    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
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

    // Import entries
    debug!("Importing entries...");
    let result = import_entries(db, entries).map_err(|e| {
        error!("Import error: {}", e);
        e
    })?;

    // Search index hook: call search module's bulk_reindex() here when implemented.

    info!(
        "Day One JSON import complete: {} imported",
        result.entries_imported
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
/// ImportResult with counts of imported and skipped entries
#[tauri::command]
pub fn import_jrnl_json(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    info!("Starting jrnl import from file: {}", file_path);

    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
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

    // Import entries
    debug!("Importing entries...");
    let result = import_entries(db, entries).map_err(|e| {
        error!("Import error: {}", e);
        e
    })?;

    // Search index hook: call search module's bulk_reindex() here when implemented.

    info!("jrnl import complete: {} imported", result.entries_imported);
    Ok(result)
}

/// Imports Day One TXT format
///
/// # Arguments
/// * `file_path` - Path to the TXT file to import
/// * `state` - Application state containing the database connection
///
/// # Returns
/// ImportResult with counts of imported and skipped entries
#[tauri::command]
pub fn import_dayone_txt(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ImportResult, String> {
    info!("Starting Day One TXT import from file: {}", file_path);

    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
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

    // Import entries
    debug!("Importing entries...");
    let result = import_entries(db, entries).map_err(|e| {
        error!("Import error: {}", e);
        e
    })?;

    // Search index hook: call search module's bulk_reindex() here when implemented.

    info!(
        "Day One TXT import complete: {} imported",
        result.entries_imported
    );
    Ok(result)
}

/// Imports a list of entries into the database
///
/// Each entry always creates a new row (AUTOINCREMENT id). No merge logic.
pub(crate) fn import_entries(
    db: &DatabaseConnection,
    entries: Vec<queries::DiaryEntry>,
) -> Result<ImportResult, String> {
    let mut entries_imported = 0;
    let mut entries_skipped = 0;

    for entry in entries {
        // Skip entries with no meaningful content
        if entry.title.trim().is_empty() && entry.text.trim().is_empty() {
            entries_skipped += 1;
            continue;
        }
        // Always insert a new row — AUTOINCREMENT assigns the id
        queries::insert_entry(db, &entry)?;
        entries_imported += 1;
    }

    Ok(ImportResult {
        entries_imported,
        entries_skipped,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::DiaryEntry;
    use crate::db::schema::create_database;

    fn create_test_entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        let now = chrono::Utc::now().to_rfc3339();
        DiaryEntry {
            id: 0,
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
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let entries = vec![
            create_test_entry("2024-01-01", "Entry 1", "Text 1"),
            create_test_entry("2024-01-02", "Entry 2", "Text 2"),
        ];

        let result = import_entries(&db, entries).unwrap();

        assert_eq!(result.entries_imported, 2);
        assert_eq!(result.entries_skipped, 0);
    }

    #[test]
    fn test_import_same_date_creates_duplicates() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert existing entry
        let existing = create_test_entry("2024-01-01", "Morning", "Had breakfast");
        crate::db::queries::insert_entry(&db, &existing).unwrap();

        // Import entry with same date — should create a second entry (no merge)
        let entries = vec![create_test_entry("2024-01-01", "Evening", "Had dinner")];

        let result = import_entries(&db, entries).unwrap();

        assert_eq!(result.entries_imported, 1);
        assert_eq!(result.entries_skipped, 0);

        // Both entries should exist on the same date
        let all = crate::db::queries::get_entries_by_date(&db, "2024-01-01").unwrap();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn test_import_empty_list() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let result = import_entries(&db, vec![]).unwrap();

        assert_eq!(result.entries_imported, 0);
        assert_eq!(result.entries_skipped, 0);
    }
}
