use crate::db::queries::DiaryEntry;
use serde::{Deserialize, Serialize};

/// Mini Diary JSON export format schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniDiaryJson {
    pub metadata: Metadata,
    pub entries: Vec<Entry>,
}

/// Metadata section of the JSON export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exported_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_count: Option<usize>,
}

/// Entry in the JSON export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub date: String,
    pub title: String,
    pub text: String,
    #[serde(default)]
    pub word_count: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_created: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_updated: Option<String>,
}

/// Supported schema versions
const SUPPORTED_VERSIONS: &[&str] = &["1.0"];

/// Parses Mini Diary JSON and converts to DiaryEntry structs
///
/// # Arguments
/// * `json_str` - The JSON string to parse
///
/// # Returns
/// A vector of DiaryEntry structs ready for database insertion
pub fn parse_minidiary_json(json_str: &str) -> Result<Vec<DiaryEntry>, String> {
    // Parse JSON
    let mini_diary: MiniDiaryJson = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Check version compatibility
    if !SUPPORTED_VERSIONS.contains(&mini_diary.metadata.version.as_str()) {
        return Err(format!(
            "Unsupported schema version: {}. Supported versions: {}",
            mini_diary.metadata.version,
            SUPPORTED_VERSIONS.join(", ")
        ));
    }

    // Convert entries to DiaryEntry format
    let now = chrono::Utc::now().to_rfc3339();
    let diary_entries: Vec<DiaryEntry> = mini_diary
        .entries
        .into_iter()
        .map(|entry| {
            // Validate date format
            if !is_valid_date_format(&entry.date) {
                return Err(format!("Invalid date format '{}', expected YYYY-MM-DD", entry.date));
            }

            // Calculate word count if not provided
            let word_count = if entry.word_count > 0 {
                entry.word_count
            } else {
                crate::db::queries::count_words(&entry.text)
            };

            Ok(DiaryEntry {
                date: entry.date,
                title: entry.title,
                text: entry.text,
                word_count,
                date_created: entry.date_created.unwrap_or_else(|| now.clone()),
                date_updated: entry.date_updated.unwrap_or_else(|| now.clone()),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    Ok(diary_entries)
}

/// Validates date format (YYYY-MM-DD)
fn is_valid_date_format(date: &str) -> bool {
    use chrono::NaiveDate;
    NaiveDate::parse_from_str(date, "%Y-%m-%d").is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_json() {
        let json = r#"{
            "metadata": {
                "version": "1.0",
                "exported_at": "2024-01-15T10:00:00Z",
                "entry_count": 2
            },
            "entries": [
                {
                    "date": "2024-01-01",
                    "title": "First Entry",
                    "text": "This is my first entry.",
                    "word_count": 5,
                    "date_created": "2024-01-01T12:00:00Z",
                    "date_updated": "2024-01-01T12:00:00Z"
                },
                {
                    "date": "2024-01-02",
                    "title": "Second Entry",
                    "text": "This is my second entry.",
                    "word_count": 5,
                    "date_created": "2024-01-02T12:00:00Z",
                    "date_updated": "2024-01-02T12:00:00Z"
                }
            ]
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-01-01");
        assert_eq!(entries[0].title, "First Entry");
        assert_eq!(entries[0].text, "This is my first entry.");
        assert_eq!(entries[0].word_count, 5);
    }

    #[test]
    fn test_parse_minimal_json() {
        let json = r#"{
            "metadata": {
                "version": "1.0"
            },
            "entries": [
                {
                    "date": "2024-01-01",
                    "title": "Test",
                    "text": "Test entry"
                }
            ]
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].word_count, 2); // Auto-calculated
        assert!(!entries[0].date_created.is_empty()); // Auto-generated
    }

    #[test]
    fn test_parse_invalid_version() {
        let json = r#"{
            "metadata": {
                "version": "2.0"
            },
            "entries": []
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported schema version"));
    }

    #[test]
    fn test_parse_invalid_date_format() {
        let json = r#"{
            "metadata": {
                "version": "1.0"
            },
            "entries": [
                {
                    "date": "01/01/2024",
                    "title": "Test",
                    "text": "Test"
                }
            ]
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid date format"));
    }

    #[test]
    fn test_parse_invalid_json() {
        let json = r#"{ invalid json }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse JSON"));
    }

    #[test]
    fn test_is_valid_date_format() {
        assert!(is_valid_date_format("2024-01-01"));
        assert!(is_valid_date_format("2024-12-31"));
        assert!(is_valid_date_format("2024-02-29")); // Leap year

        assert!(!is_valid_date_format("2024-13-01")); // Invalid month
        assert!(!is_valid_date_format("2024-01-32")); // Invalid day
        assert!(!is_valid_date_format("01-01-2024")); // Wrong format
        assert!(!is_valid_date_format("2024/01/01")); // Wrong separator
        assert!(!is_valid_date_format("24-01-01")); // 2-digit year
    }

    #[test]
    fn test_empty_entries() {
        let json = r#"{
            "metadata": {
                "version": "1.0",
                "entry_count": 0
            },
            "entries": []
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_word_count_calculation() {
        let json = r#"{
            "metadata": {
                "version": "1.0"
            },
            "entries": [
                {
                    "date": "2024-01-01",
                    "title": "Test",
                    "text": "One two three four five"
                }
            ]
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries[0].word_count, 5);
    }
}
