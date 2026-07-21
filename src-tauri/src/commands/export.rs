use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::{self, DatabaseConnection, DiaryEntry};
pub use crate::export::PrintLabels;
use log::{debug, error, info};
use tauri::State;

/// Export result containing the number of entries exported
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExportResult {
    pub entries_exported: usize,
    pub file_path: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PrintResult {
    pub entries_exported: usize,
    pub html: String,
}

pub(crate) fn fetch_entries(
    db: &DatabaseConnection,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<Vec<DiaryEntry>, String> {
    if date_from.is_none() && date_to.is_none() {
        db::get_all_entries(db)
    } else {
        db::get_entries_in_range(db, date_from, date_to)
    }
}

/// Exports all diary entries to a JSON file in Mini Diary-compatible format
#[tauri::command]
pub fn export_json(
    file_path: String,
    date_from: Option<String>,
    date_to: Option<String>,
    state: State<DiaryState>,
) -> Result<ExportResult, String> {
    info!("Starting JSON export to file: {}", file_path);
    with_unlocked_db(&state, |db| {
        let entries = fetch_entries(db, date_from.as_deref(), date_to.as_deref())?;
        let entries = db::resolve_image_refs_in_entries(db, entries)?;
        let tags = db::get_tags_names_map(db)?;
        let entries_exported = entries.len();
        debug!("Serializing {} entries to JSON...", entries_exported);
        let json_string = crate::export::export_entries_to_json(entries, &tags)?;
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
    })
}

/// Exports all diary entries to a Markdown file
///
/// HTML content from TipTap is converted to Markdown syntax.
#[tauri::command]
pub fn export_markdown(
    file_path: String,
    date_from: Option<String>,
    date_to: Option<String>,
    state: State<DiaryState>,
) -> Result<ExportResult, String> {
    info!("Starting Markdown export to file: {}", file_path);
    with_unlocked_db(&state, |db| {
        let entries = fetch_entries(db, date_from.as_deref(), date_to.as_deref())?;
        let entries = db::resolve_image_refs_in_entries(db, entries)?;
        let tags = db::get_tags_names_map(db)?;
        let entries_exported = entries.len();
        debug!("Converting {} entries to Markdown...", entries_exported);
        let (md_string, assets) =
            crate::export::export_entries_to_markdown_with_assets(entries, &tags);
        std::fs::write(&file_path, &md_string).map_err(|e| {
            let err = format!("Failed to write file: {}", e);
            error!("{}", err);
            err
        })?;
        if !assets.is_empty() {
            let assets_dir = std::path::Path::new(&file_path)
                .parent()
                .unwrap_or(std::path::Path::new("."))
                .join("assets");
            std::fs::create_dir_all(&assets_dir)
                .map_err(|e| format!("Failed to create assets directory: {}", e))?;
            for (filename, bytes) in &assets {
                std::fs::write(assets_dir.join(filename), bytes)
                    .map_err(|e| format!("Failed to write asset '{}': {}", filename, e))?;
            }
            debug!(
                "Wrote {} asset file(s) to {}",
                assets.len(),
                assets_dir.display()
            );
        }
        info!(
            "Markdown export complete: {} entries exported to {}",
            entries_exported, file_path
        );
        Ok(ExportResult {
            entries_exported,
            file_path,
        })
    })
}

/// Generates print-optimized HTML for one or more entries; caller triggers window.print()
#[tauri::command]
pub fn print_entries(
    date_from: Option<String>,
    date_to: Option<String>,
    labels: PrintLabels,
    state: State<DiaryState>,
) -> Result<PrintResult, String> {
    if labels.months.len() != 12 {
        return Err("labels.months must have exactly 12 entries".to_string());
    }
    info!("Starting print export");
    with_unlocked_db(&state, |db| {
        let entries = fetch_entries(db, date_from.as_deref(), date_to.as_deref())?;
        let entries = db::resolve_image_refs_in_entries(db, entries)?;
        let tags = db::get_tags_names_map(db)?;
        let entries_exported = entries.len();
        let generated_at = chrono::Utc::now().format("%Y-%m-%d").to_string();
        debug!("Generating print HTML for {} entries", entries_exported);
        let html_output =
            crate::export::generate_print_html(entries, &tags, &generated_at, &labels);
        info!("Print HTML generated: {} entries", entries_exported);
        Ok(PrintResult {
            entries_exported,
            html: html_output,
        })
    })
}

#[cfg(test)]
mod tests {
    use crate::db::{self, create_database, DiaryEntry};
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
            word_count: db::count_words(text),
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        }
    }

    #[test]
    fn test_fetch_entries_returns_all_when_no_dates() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        db::insert_entry(&db, &create_test_entry("2024-01-01", "A", "text a")).unwrap();
        db::insert_entry(&db, &create_test_entry("2024-06-15", "B", "text b")).unwrap();

        let result = super::fetch_entries(&db, None, None).unwrap();
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_fetch_entries_filters_by_date_range() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        db::insert_entry(&db, &create_test_entry("2024-01-01", "Jan", "text")).unwrap();
        db::insert_entry(&db, &create_test_entry("2024-06-15", "Jun", "text")).unwrap();
        db::insert_entry(&db, &create_test_entry("2024-12-31", "Dec", "text")).unwrap();

        let result = super::fetch_entries(&db, Some("2024-01-01"), Some("2024-06-30")).unwrap();
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_export_json_writes_file() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let export_path = "test_export_output.json";
        cleanup_files(&[export_path]);

        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        // Insert entries
        db::insert_entry(
            &db,
            &create_test_entry("2024-01-01", "Entry 1", "Content one"),
        )
        .unwrap();
        db::insert_entry(
            &db,
            &create_test_entry("2024-01-02", "Entry 2", "Content two"),
        )
        .unwrap();

        // Export using the pure function (can't use Tauri State in unit tests)
        let entries = db::get_all_entries(&db).unwrap();

        let json_string =
            crate::export::export_entries_to_json(entries, &std::collections::HashMap::new())
                .unwrap();
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
        let entries = db::get_all_entries(&db).unwrap();
        assert_eq!(entries.len(), 0);

        let json_string =
            crate::export::export_entries_to_json(entries, &std::collections::HashMap::new())
                .unwrap();
        fs::write(export_path, &json_string).unwrap();

        let content = fs::read_to_string(export_path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(parsed["entries"].as_array().unwrap().len(), 0);

        cleanup_files(&[export_path]);
    }
}
