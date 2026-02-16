use crate::db::queries::DiaryEntry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Mini Diary JSON export format schema (actual format from Mini Diary app)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniDiaryJson {
    pub metadata: Metadata,
    /// Entries stored as a map with date (YYYY-MM-DD) as key
    pub entries: HashMap<String, Entry>,
}

/// Metadata section of the JSON export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    /// Application name (e.g., "Mini Diary")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub application: Option<String>,
    /// Application version (e.g., "3.3.0")
    pub version: String,
    /// Last update timestamp (human-readable format)
    #[serde(rename = "dateUpdated", skip_serializing_if = "Option::is_none")]
    pub date_updated: Option<String>,
}

/// Entry in the JSON export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    /// Last update timestamp (human-readable format)
    #[serde(rename = "dateUpdated")]
    pub date_updated: String,
    pub title: String,
    pub text: String,
}

/// Parses Mini Diary JSON and converts to DiaryEntry structs
///
/// # Arguments
/// * `json_str` - The JSON string to parse
///
/// # Returns
/// A vector of DiaryEntry structs ready for database insertion
pub fn parse_minidiary_json(json_str: &str) -> Result<Vec<DiaryEntry>, String> {
    // Parse JSON
    let mini_diary: MiniDiaryJson =
        serde_json::from_str(json_str).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    eprintln!(
        "[Parser] Parsed Mini Diary format version: {}",
        mini_diary.metadata.version
    );
    eprintln!("[Parser] Found {} entries", mini_diary.entries.len());

    // Convert entries to DiaryEntry format
    let now = chrono::Utc::now().to_rfc3339();
    let mut diary_entries: Vec<DiaryEntry> = Vec::new();

    for (date, entry) in mini_diary.entries {
        // Validate date format
        if !is_valid_date_format(&date) {
            eprintln!("[Parser] Warning: Invalid date format '{}', skipping", date);
            continue;
        }

        // Calculate word count
        let word_count = crate::db::queries::count_words(&entry.text);

        // Convert human-readable timestamp to ISO 8601 if possible
        // If conversion fails, use current timestamp
        let date_updated = parse_timestamp(&entry.date_updated).unwrap_or_else(|| now.clone());

        diary_entries.push(DiaryEntry {
            date: date.clone(),
            title: entry.title,
            text: entry.text,
            word_count,
            date_created: now.clone(), // We don't have this in the source, use import time
            date_updated,
        });
    }

    eprintln!(
        "[Parser] Successfully parsed {} valid entries",
        diary_entries.len()
    );
    Ok(diary_entries)
}

/// Attempts to parse a human-readable timestamp to ISO 8601
///
/// Example input: "Sun Feb 15 2026 15:15:14 GMT+0100"
/// Returns None if parsing fails
fn parse_timestamp(timestamp: &str) -> Option<String> {
    use chrono::DateTime;

    // Try to parse the timestamp
    // The format is like: "Sun Feb 15 2026 15:15:14 GMT+0100"
    if let Ok(dt) = DateTime::parse_from_rfc2822(timestamp) {
        return Some(dt.to_rfc3339());
    }

    // Try alternative parsing
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(timestamp, "%a %b %d %Y %H:%M:%S") {
        // Convert to UTC
        let utc_dt = chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(dt, chrono::Utc);
        return Some(utc_dt.to_rfc3339());
    }

    None
}

/// Validates date format (YYYY-MM-DD) with strict 4-digit year
fn is_valid_date_format(date: &str) -> bool {
    use chrono::NaiveDate;
    // Require exactly YYYY-MM-DD (10 chars) to reject 2-digit years
    date.len() == 10 && NaiveDate::parse_from_str(date, "%Y-%m-%d").is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_actual_minidiary_format() {
        let json = r#"{
            "metadata": {
                "application": "Mini Diary",
                "version": "3.3.0",
                "dateUpdated": "Sun Feb 15 2026 15:15:23 GMT+0100"
            },
            "entries": {
                "2024-01-01": {
                    "dateUpdated": "Sun Feb 15 2026 15:15:14 GMT+0100",
                    "title": "First Entry",
                    "text": "This is my first entry."
                },
                "2024-01-02": {
                    "dateUpdated": "Sun Feb 15 2026 15:15:10 GMT+0100",
                    "title": "Second Entry",
                    "text": "This is my second entry."
                }
            }
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 2);

        // Check entries exist (order not guaranteed with HashMap)
        let first = entries.iter().find(|e| e.date == "2024-01-01").unwrap();
        assert_eq!(first.title, "First Entry");
        assert_eq!(first.text, "This is my first entry.");
        assert_eq!(first.word_count, 5); // Auto-calculated
    }

    #[test]
    fn test_parse_minimal_json() {
        let json = r#"{
            "metadata": {
                "version": "3.3.0"
            },
            "entries": {
                "2024-01-01": {
                    "dateUpdated": "Sun Feb 15 2026 14:08:04 GMT+0100",
                    "title": "Test",
                    "text": "Test entry"
                }
            }
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].word_count, 2); // Auto-calculated
        assert!(!entries[0].date_created.is_empty()); // Auto-generated
    }

    #[test]
    fn test_parse_invalid_date_format() {
        let json = r#"{
            "metadata": {
                "version": "3.3.0"
            },
            "entries": {
                "01/01/2024": {
                    "dateUpdated": "Sun Feb 15 2026 14:08:04 GMT+0100",
                    "title": "Test",
                    "text": "Test"
                }
            }
        }"#;

        let result = parse_minidiary_json(json);
        // Should succeed but skip the invalid entry
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0); // Invalid entry skipped
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
                "version": "3.3.0"
            },
            "entries": {}
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_word_count_calculation() {
        let json = r#"{
            "metadata": {
                "version": "3.3.0"
            },
            "entries": {
                "2024-01-01": {
                    "dateUpdated": "Sun Feb 15 2026 14:08:04 GMT+0100",
                    "title": "Test",
                    "text": "One two three four five"
                }
            }
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries[0].word_count, 5);
    }

    #[test]
    fn test_multiple_entries_order() {
        let json = r#"{
            "metadata": {
                "version": "3.3.0"
            },
            "entries": {
                "2024-01-03": {
                    "dateUpdated": "Sun Feb 15 2026 14:08:04 GMT+0100",
                    "title": "Third",
                    "text": "Content"
                },
                "2024-01-01": {
                    "dateUpdated": "Sun Feb 15 2026 14:08:04 GMT+0100",
                    "title": "First",
                    "text": "Content"
                },
                "2024-01-02": {
                    "dateUpdated": "Sun Feb 15 2026 14:08:04 GMT+0100",
                    "title": "Second",
                    "text": "Content"
                }
            }
        }"#;

        let result = parse_minidiary_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 3);

        // Verify all entries are present
        assert!(entries.iter().any(|e| e.date == "2024-01-01"));
        assert!(entries.iter().any(|e| e.date == "2024-01-02"));
        assert!(entries.iter().any(|e| e.date == "2024-01-03"));
    }
}
