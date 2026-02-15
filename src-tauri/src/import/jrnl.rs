use crate::db::queries::DiaryEntry;
use chrono::{Datelike, Utc};
use serde::Deserialize;

/// Root structure of a jrnl JSON export
#[derive(Debug, Deserialize)]
struct JrnlJson {
    entries: Vec<JrnlEntry>,
    #[allow(dead_code)]
    tags: serde_json::Value, // We don't use the tags summary
}

/// Individual jrnl entry
#[derive(Debug, Deserialize)]
struct JrnlEntry {
    title: String,
    body: String,
    date: String,     // Format: "YYYY-MM-DD"
    #[allow(dead_code)]
    time: String,     // Format: "HH:MM" (not used, we only care about date)
    #[allow(dead_code)]
    tags: Vec<String>, // We don't import tags
    #[allow(dead_code)]
    starred: bool,    // We don't import starred status
}

/// Parse a jrnl JSON export file into a list of DiaryEntry objects.
///
/// jrnl format:
/// ```json
/// {
///   "tags": { "@tag": 1 },
///   "entries": [
///     {
///       "title": "Entry title",
///       "body": "Entry body text",
///       "date": "2020-06-28",
///       "time": "18:22",
///       "tags": ["@work"],
///       "starred": false
///     }
///   ]
/// }
/// ```
///
/// # Arguments
///
/// * `json` - JSON string from jrnl export
///
/// # Returns
///
/// * `Ok(Vec<DiaryEntry>)` - Successfully parsed entries
/// * `Err(String)` - Parse error message
pub fn parse_jrnl_json(json: &str) -> Result<Vec<DiaryEntry>, String> {
    let jrnl_data: JrnlJson =
        serde_json::from_str(json).map_err(|e| format!("Failed to parse jrnl JSON: {}", e))?;

    let mut diary_entries = Vec::new();
    let now = Utc::now().to_rfc3339();

    for entry in jrnl_data.entries {
        // Validate date format (YYYY-MM-DD)
        if !is_valid_date_format(&entry.date) {
            eprintln!(
                "Warning: Skipping jrnl entry with invalid date format: {}",
                entry.date
            );
            continue;
        }

        // Calculate word count from body only (title is separate)
        let word_count = entry.body.split_whitespace().count() as i32;

        diary_entries.push(DiaryEntry {
            date: entry.date,
            title: entry.title,
            text: entry.body,
            word_count,
            date_created: now.clone(),
            date_updated: now.clone(),
        });
    }

    Ok(diary_entries)
}

/// Validate date format is YYYY-MM-DD with calendar accuracy
fn is_valid_date_format(date_str: &str) -> bool {
    // Use chrono to validate the date is both well-formed and calendar-accurate
    // This correctly rejects dates like "2024-02-31" or "2023-02-29" (non-leap year)
    // Chrono's %Y-%m-%d format:
    //   - Requires 4-digit year (%Y) - rejects "24-01-15"
    //   - Accepts lenient month/day (accepts both "01" and "1")
    //   - Validates calendar accuracy (rejects Feb 31, non-leap year Feb 29, etc.)
    match chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        Ok(date) => {
            // Additional check: year must be >= 1000 to ensure 4-digit years
            // This rejects dates like "0024-01-15" which chrono accepts
            date.year() >= 1000
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_jrnl_json_basic() {
        let json = r#"{
            "tags": {},
            "entries": [
                {
                    "title": "First Entry",
                    "body": "This is my first journal entry.",
                    "date": "2024-01-15",
                    "time": "09:30",
                    "tags": [],
                    "starred": false
                }
            ]
        }"#;

        let result = parse_jrnl_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);

        let entry = &entries[0];
        assert_eq!(entry.date, "2024-01-15");
        assert_eq!(entry.title, "First Entry");
        assert_eq!(entry.text, "This is my first journal entry.");
        assert_eq!(entry.word_count, 6);
    }

    #[test]
    fn test_parse_jrnl_json_multiple_entries() {
        let json = r#"{
            "tags": {
                "@work": 1,
                "@personal": 1
            },
            "entries": [
                {
                    "title": "Morning Thoughts",
                    "body": "Started the day with coffee.",
                    "date": "2024-01-15",
                    "time": "08:00",
                    "tags": ["@personal"],
                    "starred": false
                },
                {
                    "title": "Work Update",
                    "body": "Completed the project on time.",
                    "date": "2024-01-16",
                    "time": "17:30",
                    "tags": ["@work"],
                    "starred": true
                }
            ]
        }"#;

        let result = parse_jrnl_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 2);

        assert_eq!(entries[0].date, "2024-01-15");
        assert_eq!(entries[0].title, "Morning Thoughts");
        assert_eq!(entries[0].text, "Started the day with coffee.");

        assert_eq!(entries[1].date, "2024-01-16");
        assert_eq!(entries[1].title, "Work Update");
        assert_eq!(entries[1].text, "Completed the project on time.");
    }

    #[test]
    fn test_parse_jrnl_json_empty_title() {
        let json = r#"{
            "tags": {},
            "entries": [
                {
                    "title": "",
                    "body": "Entry without a title.",
                    "date": "2024-01-15",
                    "time": "10:00",
                    "tags": [],
                    "starred": false
                }
            ]
        }"#;

        let result = parse_jrnl_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "");
        assert_eq!(entries[0].text, "Entry without a title.");
    }

    #[test]
    fn test_parse_jrnl_json_empty_body() {
        let json = r#"{
            "tags": {},
            "entries": [
                {
                    "title": "Just a Title",
                    "body": "",
                    "date": "2024-01-15",
                    "time": "10:00",
                    "tags": [],
                    "starred": false
                }
            ]
        }"#;

        let result = parse_jrnl_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Just a Title");
        assert_eq!(entries[0].text, "");
        assert_eq!(entries[0].word_count, 0);
    }

    #[test]
    fn test_parse_jrnl_json_word_count() {
        let json = r#"{
            "tags": {},
            "entries": [
                {
                    "title": "Word Count Test",
                    "body": "One two three four five six seven eight nine ten.",
                    "date": "2024-01-15",
                    "time": "10:00",
                    "tags": [],
                    "starred": false
                }
            ]
        }"#;

        let result = parse_jrnl_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries[0].word_count, 10);
    }

    #[test]
    fn test_parse_jrnl_json_invalid_date_format() {
        let json = r#"{
            "tags": {},
            "entries": [
                {
                    "title": "Invalid Date",
                    "body": "This should be skipped.",
                    "date": "2024/01/15",
                    "time": "10:00",
                    "tags": [],
                    "starred": false
                },
                {
                    "title": "Valid Entry",
                    "body": "This should be imported.",
                    "date": "2024-01-16",
                    "time": "10:00",
                    "tags": [],
                    "starred": false
                }
            ]
        }"#;

        let result = parse_jrnl_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        // Only the valid entry should be imported
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].date, "2024-01-16");
        assert_eq!(entries[0].title, "Valid Entry");
    }

    #[test]
    fn test_parse_jrnl_json_empty_entries() {
        let json = r#"{
            "tags": {},
            "entries": []
        }"#;

        let result = parse_jrnl_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 0);
    }

    #[test]
    fn test_parse_jrnl_json_malformed_json() {
        let json = r#"{
            "tags": {},
            "entries": [
                {
                    "title": "Incomplete
        }"#;

        let result = parse_jrnl_json(json);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse jrnl JSON"));
    }

    #[test]
    fn test_parse_jrnl_json_missing_required_field() {
        let json = r#"{
            "tags": {},
            "entries": [
                {
                    "title": "Missing Body Field",
                    "date": "2024-01-15",
                    "time": "10:00",
                    "tags": [],
                    "starred": false
                }
            ]
        }"#;

        let result = parse_jrnl_json(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_is_valid_date_format() {
        // Valid dates - standard format
        assert!(is_valid_date_format("2024-01-15"));
        assert!(is_valid_date_format("2023-12-31"));
        assert!(is_valid_date_format("2024-02-29")); // Leap year - valid
        assert!(is_valid_date_format("2000-02-29")); // Leap year (divisible by 400)
        assert!(is_valid_date_format("2024-01-01")); // First day of year
        assert!(is_valid_date_format("2024-12-31")); // Last day of year

        // Valid dates - chrono accepts lenient formatting (single digits)
        assert!(is_valid_date_format("2024-1-15"));  // Single digit month (chrono accepts this)
        assert!(is_valid_date_format("2024-01-5"));  // Single digit day (chrono accepts this)
        assert!(is_valid_date_format("2024-1-5"));   // Both single digit (chrono accepts this)

        // Invalid dates - format issues
        assert!(!is_valid_date_format("2024/01/15")); // Wrong separator
        assert!(!is_valid_date_format("24-01-15"));   // 2-digit year
        assert!(!is_valid_date_format(""));           // Empty string
        assert!(!is_valid_date_format("not-a-date")); // Garbage

        // Invalid dates - calendar accuracy (chrono validates these!)
        assert!(!is_valid_date_format("2024-13-01")); // Invalid month
        assert!(!is_valid_date_format("2024-01-32")); // Invalid day
        assert!(!is_valid_date_format("2024-00-15")); // Invalid month (0)
        assert!(!is_valid_date_format("2024-01-00")); // Invalid day (0)
        assert!(!is_valid_date_format("2024-02-30")); // February 30th doesn't exist
        assert!(!is_valid_date_format("2024-02-31")); // February 31st doesn't exist
        assert!(!is_valid_date_format("2023-02-29")); // Not a leap year
        assert!(!is_valid_date_format("1900-02-29")); // Not a leap year (divisible by 100 but not 400)
        assert!(!is_valid_date_format("2024-04-31")); // April only has 30 days
        assert!(!is_valid_date_format("2024-06-31")); // June only has 30 days
        assert!(!is_valid_date_format("2024-09-31")); // September only has 30 days
        assert!(!is_valid_date_format("2024-11-31")); // November only has 30 days
    }

    #[test]
    fn test_parse_jrnl_json_with_tags() {
        let json = r#"{
            "tags": {
                "@work": 2,
                "@personal": 1
            },
            "entries": [
                {
                    "title": "Tagged Entry",
                    "body": "This entry has tags.",
                    "date": "2024-01-15",
                    "time": "10:00",
                    "tags": ["@work", "@personal"],
                    "starred": true
                }
            ]
        }"#;

        let result = parse_jrnl_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        // Tags are not imported, but shouldn't cause errors
        assert_eq!(entries[0].title, "Tagged Entry");
        assert_eq!(entries[0].text, "This entry has tags.");
    }

    #[test]
    fn test_parse_jrnl_sample_fixture() {
        // Test with the actual fixture file to ensure real-world format works
        let json = include_str!("../../test-fixtures/jrnl-sample.json");
        let result = parse_jrnl_json(json);

        assert!(result.is_ok(), "Failed to parse jrnl-sample.json");

        let entries = result.unwrap();
        assert_eq!(entries.len(), 3, "Expected 3 entries in sample fixture");

        // Verify first entry
        assert_eq!(entries[0].date, "2024-01-15");
        assert_eq!(entries[0].title, "First Day");
        assert!(entries[0].text.contains("Started using jrnl"));

        // Verify second entry
        assert_eq!(entries[1].date, "2024-01-16");
        assert_eq!(entries[1].title, "Project Meeting");

        // Verify third entry
        assert_eq!(entries[2].date, "2024-01-17");
        assert_eq!(entries[2].title, "Weekend Plans");
    }
}
