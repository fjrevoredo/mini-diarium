use crate::db::queries::DiaryEntry;
use serde_json::{json, Map, Value};

/// Exports diary entries to Mini Diary-compatible JSON format
///
/// The output format matches the Mini Diary JSON schema, enabling round-trip
/// compatibility: export from Mini Diarium -> import into Mini Diary or re-import back.
///
/// # Arguments
/// * `entries` - Vector of diary entries to export
///
/// # Returns
/// Pretty-printed JSON string
pub fn export_entries_to_json(entries: Vec<DiaryEntry>) -> Result<String, String> {
    let now = chrono::Utc::now().to_rfc3339();

    // Build entries map: date -> { dateUpdated, title, text }
    let mut entries_map = Map::new();
    for entry in &entries {
        entries_map.insert(
            entry.date.clone(),
            json!({
                "dateUpdated": entry.date_updated,
                "title": entry.title,
                "text": entry.text,
            }),
        );
    }

    let export = json!({
        "metadata": {
            "application": "Mini Diarium",
            "version": env!("CARGO_PKG_VERSION"),
            "dateUpdated": now,
        },
        "entries": Value::Object(entries_map),
    });

    serde_json::to_string_pretty(&export).map_err(|e| format!("Failed to serialize JSON: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        DiaryEntry {
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: crate::db::queries::count_words(text),
            date_created: "2024-01-01T12:00:00Z".to_string(),
            date_updated: "2024-01-01T12:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_export_empty_list() {
        let result = export_entries_to_json(vec![]).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();

        assert_eq!(parsed["metadata"]["application"], "Mini Diarium");
        assert!(parsed["metadata"]["version"].is_string());
        assert!(parsed["metadata"]["dateUpdated"].is_string());
        assert_eq!(parsed["entries"].as_object().unwrap().len(), 0);
    }

    #[test]
    fn test_export_single_entry() {
        let entries = vec![create_test_entry(
            "2024-01-15",
            "My Entry",
            "Entry content here",
        )];

        let result = export_entries_to_json(entries).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();

        let entry = &parsed["entries"]["2024-01-15"];
        assert_eq!(entry["title"], "My Entry");
        assert_eq!(entry["text"], "Entry content here");
        assert_eq!(entry["dateUpdated"], "2024-01-01T12:00:00Z");
    }

    #[test]
    fn test_export_multiple_entries() {
        let entries = vec![
            create_test_entry("2024-01-01", "First", "Content one"),
            create_test_entry("2024-01-02", "Second", "Content two"),
            create_test_entry("2024-01-03", "Third", "Content three"),
        ];

        let result = export_entries_to_json(entries).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();

        let entries_obj = parsed["entries"].as_object().unwrap();
        assert_eq!(entries_obj.len(), 3);
        assert_eq!(parsed["entries"]["2024-01-01"]["title"], "First");
        assert_eq!(parsed["entries"]["2024-01-02"]["title"], "Second");
        assert_eq!(parsed["entries"]["2024-01-03"]["title"], "Third");
    }

    #[test]
    fn test_round_trip_export_import() {
        let entries = vec![
            create_test_entry("2024-01-15", "Test Entry", "Some content here"),
            create_test_entry("2024-02-20", "Another Entry", "More content"),
        ];

        // Export
        let json_string = export_entries_to_json(entries.clone()).unwrap();

        // Import back using the minidiary parser
        let imported = crate::import::minidiary::parse_minidiary_json(&json_string).unwrap();

        assert_eq!(imported.len(), 2);

        // Check both entries are present (order not guaranteed with HashMap)
        let entry1 = imported.iter().find(|e| e.date == "2024-01-15").unwrap();
        assert_eq!(entry1.title, "Test Entry");
        assert_eq!(entry1.text, "Some content here");

        let entry2 = imported.iter().find(|e| e.date == "2024-02-20").unwrap();
        assert_eq!(entry2.title, "Another Entry");
        assert_eq!(entry2.text, "More content");
    }
}
