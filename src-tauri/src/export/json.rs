use crate::db::queries::DiaryEntry;
use serde_json::{json, Value};

/// Exports diary entries to an array-based JSON format with id field
///
/// The output format is an array of entries, each with an `id` field:
/// ```json
/// {
///   "metadata": { "exportedAt": "...", "version": "..." },
///   "entries": [
///     { "id": 42, "date": "2024-01-15", "title": "...", "text": "...", "dateUpdated": "..." }
///   ]
/// }
/// ```
///
/// # Arguments
/// * `entries` - Vector of diary entries to export
///
/// # Returns
/// Pretty-printed JSON string
pub fn export_entries_to_json(entries: Vec<DiaryEntry>) -> Result<String, String> {
    let now = chrono::Utc::now().to_rfc3339();

    // Build entries array
    let entries_array: Vec<Value> = entries
        .iter()
        .map(|entry| {
            json!({
                "id": entry.id,
                "date": entry.date,
                "title": entry.title,
                "text": entry.text,
                "dateUpdated": entry.date_updated,
            })
        })
        .collect();

    let export = json!({
        "metadata": {
            "application": "Mini Diarium",
            "version": env!("CARGO_PKG_VERSION"),
            "exportedAt": now,
        },
        "entries": entries_array,
    });

    serde_json::to_string_pretty(&export).map_err(|e| format!("Failed to serialize JSON: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_entry(id: i64, date: &str, title: &str, text: &str) -> DiaryEntry {
        DiaryEntry {
            id,
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
        assert!(parsed["metadata"]["exportedAt"].is_string());
        // entries should be an empty array
        let entries = parsed["entries"].as_array().unwrap();
        assert_eq!(entries.len(), 0);
    }

    #[test]
    fn test_export_single_entry() {
        let entries = vec![create_test_entry(
            42,
            "2024-01-15",
            "My Entry",
            "Entry content here",
        )];

        let result = export_entries_to_json(entries).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();

        let entries_arr = parsed["entries"].as_array().unwrap();
        assert_eq!(entries_arr.len(), 1);
        let entry = &entries_arr[0];
        assert_eq!(entry["id"], 42);
        assert_eq!(entry["date"], "2024-01-15");
        assert_eq!(entry["title"], "My Entry");
        assert_eq!(entry["text"], "Entry content here");
        assert_eq!(entry["dateUpdated"], "2024-01-01T12:00:00Z");
    }

    #[test]
    fn test_export_multiple_entries() {
        let entries = vec![
            create_test_entry(1, "2024-01-01", "First", "Content one"),
            create_test_entry(2, "2024-01-02", "Second", "Content two"),
            create_test_entry(3, "2024-01-03", "Third", "Content three"),
        ];

        let result = export_entries_to_json(entries).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();

        let entries_arr = parsed["entries"].as_array().unwrap();
        assert_eq!(entries_arr.len(), 3);
        assert_eq!(entries_arr[0]["title"], "First");
        assert_eq!(entries_arr[1]["title"], "Second");
        assert_eq!(entries_arr[2]["title"], "Third");
    }

    #[test]
    fn test_export_multiple_entries_same_date() {
        let entries = vec![
            create_test_entry(1, "2024-01-01", "Morning", "Had breakfast"),
            create_test_entry(2, "2024-01-01", "Evening", "Had dinner"),
        ];

        let result = export_entries_to_json(entries).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();

        let entries_arr = parsed["entries"].as_array().unwrap();
        assert_eq!(entries_arr.len(), 2);
        assert_eq!(entries_arr[0]["date"], "2024-01-01");
        assert_eq!(entries_arr[1]["date"], "2024-01-01");
        assert_eq!(entries_arr[0]["id"], 1);
        assert_eq!(entries_arr[1]["id"], 2);
    }

    #[test]
    fn test_export_entries_is_array_not_object() {
        let entries = vec![create_test_entry(1, "2024-01-15", "Test", "Content")];
        let result = export_entries_to_json(entries).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();

        // entries must be an array, not an object
        assert!(
            parsed["entries"].is_array(),
            "entries should be a JSON array"
        );
    }

    #[test]
    fn test_export_entries_have_id_field() {
        let entries = vec![create_test_entry(
            99,
            "2024-01-15",
            "Test Entry",
            "Some content here",
        )];

        let json_string = export_entries_to_json(entries).unwrap();
        let parsed: Value = serde_json::from_str(&json_string).unwrap();

        let entries_arr = parsed["entries"].as_array().unwrap();
        assert_eq!(entries_arr.len(), 1);
        assert_eq!(entries_arr[0]["id"], 99);
        assert_eq!(entries_arr[0]["title"], "Test Entry");
    }
}
