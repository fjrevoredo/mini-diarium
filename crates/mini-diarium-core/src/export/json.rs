use crate::db::queries::DiaryEntry;
use serde_json::{json, Value};
use std::collections::HashMap;

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
pub fn export_entries_to_json(
    entries: Vec<DiaryEntry>,
    tags: &HashMap<i64, Vec<String>>,
) -> Result<String, String> {
    let now = chrono::Utc::now().to_rfc3339();

    // Build entries array
    let entries_array: Vec<Value> = entries
        .iter()
        .map(|entry| {
            let mut obj = json!({
                "id": entry.id,
                "date": entry.date,
                "title": entry.title,
                "text": entry.text,
                "dateUpdated": entry.date_updated,
                "tags": tags.get(&entry.id).cloned().unwrap_or_default(),
            });
            if let Some(ref meta) = entry.metadata {
                obj["metadata"] = serde_json::to_value(meta).unwrap_or(Value::Null);
            }
            obj
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
            metadata: None,
            locked: false,
        }
    }

    fn empty_tags() -> HashMap<i64, Vec<String>> {
        HashMap::new()
    }

    #[test]
    fn test_export_empty_list() {
        let result = export_entries_to_json(vec![], &empty_tags()).unwrap();
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

        let result = export_entries_to_json(entries, &empty_tags()).unwrap();
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

        let result = export_entries_to_json(entries, &empty_tags()).unwrap();
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

        let result = export_entries_to_json(entries, &empty_tags()).unwrap();
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
        let result = export_entries_to_json(entries, &empty_tags()).unwrap();
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

        let json_string = export_entries_to_json(entries, &empty_tags()).unwrap();
        let parsed: Value = serde_json::from_str(&json_string).unwrap();

        let entries_arr = parsed["entries"].as_array().unwrap();
        assert_eq!(entries_arr.len(), 1);
        assert_eq!(entries_arr[0]["id"], 99);
        assert_eq!(entries_arr[0]["title"], "Test Entry");
    }

    #[test]
    fn test_export_entry_with_tags() {
        let entries = vec![create_test_entry(42, "2024-01-15", "My Entry", "Content")];
        let tags = HashMap::from([(42i64, vec!["travel".to_string(), "work".to_string()])]);
        let result = export_entries_to_json(entries, &tags).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();
        let entry_tags = parsed["entries"][0]["tags"].as_array().unwrap();
        assert_eq!(entry_tags.len(), 2);
        assert_eq!(entry_tags[0].as_str().unwrap(), "travel");
        assert_eq!(entry_tags[1].as_str().unwrap(), "work");
    }

    #[test]
    fn test_export_entry_without_tags_has_empty_array() {
        let entries = vec![create_test_entry(1, "2024-01-15", "Entry", "Content")];
        let result = export_entries_to_json(entries, &empty_tags()).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();
        let entry_tags = parsed["entries"][0]["tags"].as_array().unwrap();
        assert!(entry_tags.is_empty());
    }

    #[test]
    fn test_json_export_preserves_link_markup() {
        // JSON export emits the raw HTML from the `text` column verbatim. A named
        // link inserted via the editor (TipTap's Link mark) must survive serialization
        // unchanged so re-import / re-render produces the original link.
        let entries = vec![create_test_entry(
            7,
            "2024-01-15",
            "Entry",
            r#"<p>See <a href="https://example.com">Visit site</a> please</p>"#,
        )];
        let result = export_entries_to_json(entries, &empty_tags()).unwrap();

        // The raw HTML appears verbatim in the JSON. The link's href and label
        // are both present.
        assert!(
            result.contains(r#"<a href=\"https://example.com\">Visit site</a>"#),
            "expected raw link HTML to survive serialization: {}",
            result
        );

        // Round-trip parse confirms the link is intact in the `text` field.
        let parsed: Value = serde_json::from_str(&result).unwrap();
        let text = parsed["entries"][0]["text"].as_str().unwrap();
        assert!(
            text.contains(r#"<a href="https://example.com">Visit site</a>"#),
            "expected link in parsed text: {}",
            text
        );
    }

    #[test]
    fn test_json_export_preserves_inline_marks_verbatim() {
        // JSON export emits `entry.text` verbatim — every inline mark the editor
        // supports (bold, italic, underline, strikethrough, inline code,
        // highlight, text color) must survive serialization byte-for-byte.
        let cases: &[(&str, &str)] = &[
            ("bold", "<p><strong>bold</strong></p>"),
            ("italic", "<p><em>italic</em></p>"),
            ("underline", "<p><u>underlined</u></p>"),
            ("strikethrough", "<p><s>struck</s></p>"),
            ("inline code", "<p><code>code</code></p>"),
            ("highlight", "<p><mark>highlighted</mark></p>"),
            (
                "text color",
                r#"<p><span style="color: #ff0000">red</span></p>"#,
            ),
        ];

        for (name, html) in cases {
            let entries = vec![create_test_entry(1, "2024-01-15", "Entry", html)];
            let result = export_entries_to_json(entries, &empty_tags()).unwrap();
            let parsed: Value = serde_json::from_str(&result).unwrap();
            let text = parsed["entries"][0]["text"].as_str().unwrap();
            assert_eq!(text, *html, "mark '{}' did not survive verbatim", name);
        }
    }

    #[test]
    fn test_export_entry_with_metadata_includes_font_fields() {
        use crate::db::queries::EntryMetadata;
        let mut entry = create_test_entry(1, "2024-01-01", "Styled", "<p>Hi</p>");
        entry.metadata = Some(EntryMetadata {
            font_family: Some("Merriweather".to_string()),
            font_size: Some(18.0),
        });

        let result = export_entries_to_json(vec![entry], &empty_tags()).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();
        let meta = &parsed["entries"][0]["metadata"];
        assert_eq!(meta["fontFamily"], "Merriweather");
        assert_eq!(meta["fontSize"], 18.0);
    }

    #[test]
    fn test_export_entry_without_metadata_omits_field() {
        let entry = create_test_entry(1, "2024-01-01", "Plain", "<p>No font</p>");
        let result = export_entries_to_json(vec![entry], &empty_tags()).unwrap();
        let parsed: Value = serde_json::from_str(&result).unwrap();
        assert!(
            parsed["entries"][0]["metadata"].is_null()
                || parsed["entries"][0].get("metadata").is_none(),
            "metadata field should be absent when None"
        );
    }
}
