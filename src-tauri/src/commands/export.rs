use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::{self, DatabaseConnection, DiaryEntry};
use crate::export::AttachmentAsset;
pub use crate::export::PrintLabels;
use log::{debug, error, info};
use tauri::State;
use zeroize::Zeroizing;

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

/// Writes a Markdown export's assets into `assets/` next to `file_path`: the embedded
/// image files as given, and each planned attachment decrypted through `read_attachment`.
///
/// Does nothing (and creates no directory) when there are no assets. Attachment bytes are
/// decrypted one at a time and written straight to their destination.
pub(crate) fn write_export_assets<R>(
    file_path: &str,
    images: &[(String, Vec<u8>)],
    attachments: &[AttachmentAsset],
    mut read_attachment: R,
) -> Result<(), String>
where
    R: FnMut(&AttachmentAsset) -> Result<Zeroizing<Vec<u8>>, String>,
{
    if images.is_empty() && attachments.is_empty() {
        return Ok(());
    }
    let assets_dir = std::path::Path::new(file_path)
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .join("assets");
    std::fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;
    for (filename, bytes) in images {
        std::fs::write(assets_dir.join(filename), bytes)
            .map_err(|e| format!("Failed to write asset '{}': {}", filename, e))?;
    }
    for asset in attachments {
        let bytes = read_attachment(asset)?;
        // No file name in the error: it contains the attachment's name, which is encrypted
        // at rest and must not reach logs or the debug dump.
        std::fs::write(assets_dir.join(&asset.filename), bytes.as_slice())
            .map_err(|e| format!("Failed to write attachment asset: {}", e))?;
    }
    debug!(
        "Wrote {} image and {} attachment asset file(s) to {}",
        images.len(),
        attachments.len(),
        assets_dir.display()
    );
    Ok(())
}

/// Reads one planned attachment asset's bytes from an unlocked journal.
pub(crate) fn read_attachment_asset(
    db: &DatabaseConnection,
    asset: &AttachmentAsset,
) -> Result<Zeroizing<Vec<u8>>, String> {
    db::read_attachment_bytes(db, asset.entry_id, asset.attachment_id)?
        .ok_or_else(|| "Attachment not found".to_string())
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
        let attachments = db::get_attachments_map(db)?;
        let entries_exported = entries.len();
        debug!("Serializing {} entries to JSON...", entries_exported);
        let json_string = crate::export::export_entries_to_json(entries, &tags, &attachments)?;
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
        let attachments = db::get_attachments_map(db)?;
        let entries_exported = entries.len();
        debug!("Converting {} entries to Markdown...", entries_exported);
        let (md_string, assets, attachment_assets) =
            crate::export::export_entries_to_markdown_with_assets(entries, &tags, &attachments);
        std::fs::write(&file_path, &md_string).map_err(|e| {
            let err = format!("Failed to write file: {}", e);
            error!("{}", err);
            err
        })?;
        write_export_assets(&file_path, &assets, &attachment_assets, |asset| {
            read_attachment_asset(db, asset)
        })?;
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
        let attachments = db::get_attachments_map(db)?;
        let entries_exported = entries.len();
        let generated_at = chrono::Utc::now().format("%Y-%m-%d").to_string();
        debug!("Generating print HTML for {} entries", entries_exported);
        let html_output = crate::export::generate_print_html(
            entries,
            &tags,
            &attachments,
            &generated_at,
            &labels,
        );
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

        let json_string = crate::export::export_entries_to_json(
            entries,
            &std::collections::HashMap::new(),
            &std::collections::HashMap::new(),
        )
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

        let json_string = crate::export::export_entries_to_json(
            entries,
            &std::collections::HashMap::new(),
            &std::collections::HashMap::new(),
        )
        .unwrap();
        fs::write(export_path, &json_string).unwrap();

        let content = fs::read_to_string(export_path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(parsed["entries"].as_array().unwrap().len(), 0);

        cleanup_files(&[export_path]);
    }

    #[test]
    fn test_markdown_export_writes_decrypted_attachment_assets() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let entry_id =
            db::insert_entry(&db, &create_test_entry("2024-01-15", "With file", "")).unwrap();
        let pdf = db::add_attachment_to_entry(&db, entry_id, "Report.pdf", b"%PDF bytes").unwrap();
        let mut stored = db::get_entry_by_id(&db, entry_id).unwrap().unwrap();
        stored.text = format!(
            "<p>See <span data-attachment-ref=\"{}\"></span></p>",
            pdf.id
        );
        db::update_entry(&db, &stored).unwrap();

        let entries = super::fetch_entries(&db, None, None).unwrap();
        let tags = db::get_tags_names_map(&db).unwrap();
        let attachments = db::get_attachments_map(&db).unwrap();
        let (markdown, images, planned) =
            crate::export::export_entries_to_markdown_with_assets(entries, &tags, &attachments);

        let out_dir = tempfile::tempdir().unwrap();
        let md_path = out_dir.path().join("export.md");
        super::write_export_assets(md_path.to_str().unwrap(), &images, &planned, |asset| {
            super::read_attachment_asset(&db, asset)
        })
        .unwrap();

        assert!(
            markdown.contains("See [Report.pdf](assets/attachment-1-Report.pdf)"),
            "got: {}",
            markdown
        );
        let written = fs::read(out_dir.path().join("assets/attachment-1-Report.pdf")).unwrap();
        assert_eq!(written, b"%PDF bytes");
    }

    #[test]
    fn test_write_export_assets_creates_nothing_without_assets() {
        let out_dir = tempfile::tempdir().unwrap();
        let md_path = out_dir.path().join("export.md");
        super::write_export_assets(md_path.to_str().unwrap(), &[], &[], |_| {
            unreachable!("no attachment to read")
        })
        .unwrap();
        assert!(!out_dir.path().join("assets").exists());
    }
}
