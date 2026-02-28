use crate::commands::auth::DiaryState;
use crate::db::queries::{self, DiaryEntry};
use crate::db::schema::DatabaseConnection;
use crate::export::{json, markdown};
use log::{debug, error, info};
use tauri::State;

/// Export result containing the number of entries exported
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExportResult {
    pub entries_exported: usize,
    pub file_path: String,
}

/// Fetches and decrypts all diary entries from the database
pub(crate) fn fetch_all_entries(db: &DatabaseConnection) -> Result<Vec<DiaryEntry>, String> {
    queries::get_all_entries(db)
}

/// Exports all diary entries to a JSON file in Mini Diary-compatible format
#[tauri::command]
pub fn export_json(file_path: String, state: State<DiaryState>) -> Result<ExportResult, String> {
    info!("Starting JSON export to file: {}", file_path);

    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state.as_ref().ok_or_else(|| {
        let err = "Diary must be unlocked to export entries";
        error!("{}", err);
        err.to_string()
    })?;

    let entries = fetch_all_entries(db)?;
    let entries_exported = entries.len();
    debug!("Serializing {} entries to JSON...", entries_exported);

    let json_string = json::export_entries_to_json(entries)?;

    std::fs::write(&file_path, &json_string).map_err(|e| {
        let err = format!("Failed to write file: {}", e);
        error!("{}", err);
        err
    })?;

    info!(
        "JSON export complete: {} entries exported to {}",
        entries_exported, file_path
    );
    Ok(ExportResult {
        entries_exported,
        file_path,
    })
}

/// Exports all diary entries to a Markdown file
///
/// HTML content from TipTap is converted to Markdown syntax.
#[tauri::command]
pub fn export_markdown(
    file_path: String,
    state: State<DiaryState>,
) -> Result<ExportResult, String> {
    info!("Starting Markdown export to file: {}", file_path);

    let db_state = state
        .db
        .lock()
        .map_err(|_| "State lock poisoned".to_string())?;
    let db = db_state.as_ref().ok_or_else(|| {
        let err = "Diary must be unlocked to export entries";
        error!("{}", err);
        err.to_string()
    })?;

    let entries = fetch_all_entries(db)?;
    let entries_exported = entries.len();
    debug!("Converting {} entries to Markdown...", entries_exported);

    let md_string = markdown::export_entries_to_markdown(entries);

    std::fs::write(&file_path, &md_string).map_err(|e| {
        let err = format!("Failed to write file: {}", e);
        error!("{}", err);
        err
    })?;

    info!(
        "Markdown export complete: {} entries exported to {}",
        entries_exported, file_path
    );
    Ok(ExportResult {
        entries_exported,
        file_path,
    })
}

#[cfg(test)]
mod tests {
    use crate::db::queries::DiaryEntry;
    use crate::db::schema::create_database;
    use std::fs;

    fn cleanup_files(paths: &[&str]) {
        for path in paths {
            let _ = fs::remove_file(path);
        }
    }

    fn create_test_entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        let now = chrono::Utc::now().to_rfc3339();
        DiaryEntry {
            id: 1,
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: crate::db::queries::count_words(text),
            date_created: now.clone(),
            date_updated: now,
        }
    }

    #[test]
    fn test_export_json_writes_file() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let export_path = "test_export_output.json";
        cleanup_files(&[export_path]);

        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert entries
        crate::db::queries::insert_entry(
            &db,
            &create_test_entry("2024-01-01", "Entry 1", "Content one"),
        )
        .unwrap();
        crate::db::queries::insert_entry(
            &db,
            &create_test_entry("2024-01-02", "Entry 2", "Content two"),
        )
        .unwrap();

        // Export using the pure function (can't use Tauri State in unit tests)
        let entries = crate::db::queries::get_all_entries(&db).unwrap();

        let json_string = crate::export::json::export_entries_to_json(entries).unwrap();
        fs::write(export_path, &json_string).unwrap();

        // Verify file exists and contains valid JSON
        let content = fs::read_to_string(export_path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();

        // entries is now an array
        let entries_arr = parsed["entries"].as_array().unwrap();
        assert_eq!(entries_arr.len(), 2);
        let titles: Vec<&str> = entries_arr
            .iter()
            .map(|e| e["title"].as_str().unwrap())
            .collect();
        assert!(titles.contains(&"Entry 1"));
        assert!(titles.contains(&"Entry 2"));

        cleanup_files(&[export_path]);
    }

    #[test]
    fn test_export_empty_diary() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let export_path = "test_export_empty_output.json";
        cleanup_files(&[export_path]);

        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Export empty diary
        let entries = crate::db::queries::get_all_entries(&db).unwrap();
        assert_eq!(entries.len(), 0);

        let json_string = crate::export::json::export_entries_to_json(entries).unwrap();
        fs::write(export_path, &json_string).unwrap();

        let content = fs::read_to_string(export_path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(parsed["entries"].as_array().unwrap().len(), 0);

        cleanup_files(&[export_path]);
    }
}
