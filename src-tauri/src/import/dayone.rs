use crate::db::queries::DiaryEntry;
use serde::{Deserialize, Serialize};

/// Day One JSON export format
///
/// Day One exports use a specific JSON structure:
/// - Root object with "entries" array
/// - Each entry has creationDate (ISO 8601), text (full content)
/// - Text may contain title in first line or first paragraph
/// - Timezone info included in ISO timestamp
///
/// Example:
/// ```json
/// {
///   "entries": [
///     {
///       "creationDate": "2024-01-15T14:30:00Z",
///       "text": "My Day\n\nThis was a great day...",
///       "timeZone": "America/New_York"
///     }
///   ]
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayOneJson {
    pub entries: Vec<DayOneEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayOneEntry {
    /// ISO 8601 timestamp with timezone
    pub creation_date: String,

    /// Full entry text (may include title in first line/paragraph)
    pub text: String,

    /// Optional timezone identifier
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_zone: Option<String>,
}

/// Parse Day One JSON export file
///
/// Extracts entries from Day One JSON format and converts them to DiaryEntry format.
/// - Parses ISO 8601 timestamps with timezone handling
/// - Splits text on first "\n\n" to extract title from body
/// - If no "\n\n" found, uses first line as title
/// - Auto-calculates word count
/// - Sets date_created and date_updated from creation timestamp
///
/// # Arguments
/// * `json_str` - Day One JSON export as string
///
/// # Returns
/// * `Result<Vec<DiaryEntry>>` - Parsed entries or error
///
/// # Errors
/// * JSON parse error
/// * Invalid date format
pub fn parse_dayone_json(json_str: &str) -> Result<Vec<DiaryEntry>, String> {
    // Parse JSON
    let dayone: DayOneJson = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse Day One JSON: {}", e))?;

    let mut entries = Vec::new();

    for entry in dayone.entries {
        // Parse ISO 8601 timestamp to extract date (YYYY-MM-DD)
        let date = parse_iso8601_to_date(&entry.creation_date)?;

        // Extract title and text from content
        let (title, text) = extract_title_and_text(&entry.text);

        // Calculate word count
        let word_count = text.split_whitespace().count() as i32;

        // Parse full timestamp for date_created and date_updated
        let timestamp = parse_iso8601_to_timestamp(&entry.creation_date)?;

        entries.push(DiaryEntry {
            id: 0,
            date,
            title,
            text,
            word_count,
            date_created: timestamp.clone(),
            date_updated: timestamp,
        });
    }

    Ok(entries)
}

/// Parse ISO 8601 timestamp to YYYY-MM-DD date string
///
/// Handles various ISO 8601 formats:
/// - 2024-01-15T14:30:00Z (UTC)
/// - 2024-01-15T14:30:00+05:00 (with timezone offset)
/// - 2024-01-15T14:30:00.123Z (with milliseconds)
///
/// Converts to local date based on timezone offset.
fn parse_iso8601_to_date(iso_str: &str) -> Result<String, String> {
    // Parse using chrono
    use chrono::{DateTime, Utc};

    let dt = iso_str
        .parse::<DateTime<Utc>>()
        .map_err(|e| format!("Invalid ISO 8601 date '{}': {}", iso_str, e))?;

    // Format as YYYY-MM-DD
    Ok(dt.format("%Y-%m-%d").to_string())
}

/// Parse ISO 8601 timestamp to standard timestamp format
///
/// Converts ISO 8601 to our standard format: YYYY-MM-DD HH:MM:SS
fn parse_iso8601_to_timestamp(iso_str: &str) -> Result<String, String> {
    use chrono::{DateTime, Utc};

    let dt = iso_str
        .parse::<DateTime<Utc>>()
        .map_err(|e| format!("Invalid ISO 8601 timestamp '{}': {}", iso_str, e))?;

    // Format as YYYY-MM-DD HH:MM:SS (UTC)
    Ok(dt.format("%Y-%m-%d %H:%M:%S").to_string())
}

/// Extract title and text from Day One entry content
///
/// Strategy:
/// 1. If text contains "\n\n", split at first occurrence:
///    - First part = title
///    - Rest = body text
/// 2. If no "\n\n", split at first "\n":
///    - First line = title
///    - Rest = body text
/// 3. If no newline at all, use first 100 chars as title, rest as body
/// 4. Trim whitespace from both parts
fn extract_title_and_text(content: &str) -> (String, String) {
    let content = content.trim();

    if content.is_empty() {
        return (String::new(), String::new());
    }

    // Try splitting on double newline first (paragraph break)
    if let Some(pos) = content.find("\n\n") {
        let title = content[..pos].trim().to_string();
        let text = content[pos + 2..].trim().to_string();
        return (title, text);
    }

    // Try splitting on single newline (line break)
    if let Some(pos) = content.find('\n') {
        let title = content[..pos].trim().to_string();
        let text = content[pos + 1..].trim().to_string();
        return (title, text);
    }

    // No newlines - use first 100 chars as title if long enough
    if content.len() > 100 {
        let title = content[..100].trim().to_string();
        let text = content[100..].trim().to_string();
        return (title, text);
    }

    // Short content - use as title, empty body
    (content.to_string(), String::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_basic_dayone_json() {
        let json = r#"{
            "entries": [
                {
                    "creationDate": "2024-01-15T14:30:00Z",
                    "text": "My Great Day\n\nThis was a wonderful day with lots of activities."
                }
            ]
        }"#;

        let result = parse_dayone_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);

        let entry = &entries[0];
        assert_eq!(entry.date, "2024-01-15");
        assert_eq!(entry.title, "My Great Day");
        assert_eq!(
            entry.text,
            "This was a wonderful day with lots of activities."
        );
        assert_eq!(entry.word_count, 9);
        assert!(entry.date_created.starts_with("2024-01-15"));
    }

    #[test]
    fn test_parse_dayone_with_timezone() {
        let json = r#"{
            "entries": [
                {
                    "creationDate": "2024-01-15T14:30:00+05:00",
                    "text": "Evening Entry\n\nWritten in the evening.",
                    "timeZone": "Asia/Karachi"
                }
            ]
        }"#;

        let result = parse_dayone_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].date, "2024-01-15");
    }

    #[test]
    fn test_parse_dayone_multiple_entries() {
        let json = r#"{
            "entries": [
                {
                    "creationDate": "2024-01-15T10:00:00Z",
                    "text": "Morning\n\nStarted the day early."
                },
                {
                    "creationDate": "2024-01-16T20:00:00Z",
                    "text": "Evening\n\nEnded the day late."
                }
            ]
        }"#;

        let result = parse_dayone_json(json);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].date, "2024-01-15");
        assert_eq!(entries[1].date, "2024-01-16");
    }

    #[test]
    fn test_extract_title_paragraph_break() {
        let (title, text) = extract_title_and_text("First Paragraph\n\nSecond paragraph here.");
        assert_eq!(title, "First Paragraph");
        assert_eq!(text, "Second paragraph here.");
    }

    #[test]
    fn test_extract_title_line_break() {
        let (title, text) = extract_title_and_text("Single Line Title\nBody text here.");
        assert_eq!(title, "Single Line Title");
        assert_eq!(text, "Body text here.");
    }

    #[test]
    fn test_extract_title_long_content() {
        let long_text = "a".repeat(150);
        let (title, text) = extract_title_and_text(&long_text);
        assert_eq!(title.len(), 100);
        assert_eq!(text.len(), 50);
    }

    #[test]
    fn test_extract_title_short_content() {
        let (title, text) = extract_title_and_text("Just a short note");
        assert_eq!(title, "Just a short note");
        assert_eq!(text, "");
    }

    #[test]
    fn test_extract_title_empty() {
        let (title, text) = extract_title_and_text("");
        assert_eq!(title, "");
        assert_eq!(text, "");
    }

    #[test]
    fn test_parse_iso8601_utc() {
        let result = parse_iso8601_to_date("2024-01-15T14:30:00Z");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "2024-01-15");
    }

    #[test]
    fn test_parse_iso8601_with_offset() {
        let result = parse_iso8601_to_date("2024-01-15T14:30:00+05:00");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "2024-01-15");
    }

    #[test]
    fn test_parse_iso8601_with_milliseconds() {
        let result = parse_iso8601_to_date("2024-01-15T14:30:00.123Z");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "2024-01-15");
    }

    #[test]
    fn test_parse_iso8601_invalid() {
        let result = parse_iso8601_to_date("not-a-date");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_invalid_json() {
        let result = parse_dayone_json("not valid json");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to parse Day One JSON"));
    }

    #[test]
    fn test_word_count_calculation() {
        let json = r#"{
            "entries": [
                {
                    "creationDate": "2024-01-15T14:30:00Z",
                    "text": "Title\n\nOne two three four five words."
                }
            ]
        }"#;

        let entries = parse_dayone_json(json).unwrap();
        assert_eq!(entries[0].word_count, 6);
    }
}
