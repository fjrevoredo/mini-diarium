use crate::db::queries::DiaryEntry;
use chrono::{Datelike, NaiveDate, Utc};

/// Parse Day One TXT export file
///
/// Day One TXT format splits entries with "\tDate:\t" delimiter
/// Date format: "DD MMMM YYYY" (e.g., "15 January 2024")
///
/// Example:
/// ```text
/// Entry content goes here.
/// This is the first entry.
///
/// 	Date:	15 January 2024
///
/// Another entry content.
/// Second entry here.
///
/// 	Date:	16 January 2024
/// ```
///
/// # Arguments
/// * `txt` - Day One TXT export as string
///
/// # Returns
/// * `Result<Vec<DiaryEntry>>` - Parsed entries or error
///
/// # Errors
/// * Invalid date format
pub fn parse_dayone_txt(txt: &str) -> Result<Vec<DiaryEntry>, String> {
    let mut entries = Vec::new();
    let now = Utc::now().to_rfc3339();

    // Split on the date delimiter
    let parts: Vec<&str> = txt.split("\tDate:\t").collect();

    // First part before any date is ignored (it's usually empty or header text)
    // Each subsequent part contains: date\n\nentry_content
    for (i, part) in parts.iter().enumerate() {
        if i == 0 {
            // Skip the first part (before first date)
            continue;
        }

        // Split on first newline to separate date from content
        let lines: Vec<&str> = part.splitn(2, '\n').collect();
        if lines.len() < 2 {
            eprintln!(
                "Warning: Skipping Day One TXT entry - no content after date"
            );
            continue;
        }

        let date_str = lines[0].trim();
        let content = lines[1].trim();

        // Parse the date
        let date = parse_day_one_date(date_str)?;

        // Extract title and text from content
        let (title, text) = extract_title_and_text(content);

        // Calculate word count
        let word_count = text.split_whitespace().count() as i32;

        entries.push(DiaryEntry {
            date,
            title,
            text,
            word_count,
            date_created: now.clone(),
            date_updated: now.clone(),
        });
    }

    Ok(entries)
}

/// Parse Day One date format: "DD MMMM YYYY" (e.g., "15 January 2024")
fn parse_day_one_date(date_str: &str) -> Result<String, String> {
    // Parse using chrono with the Day One format
    let parsed_date = NaiveDate::parse_from_str(date_str, "%d %B %Y")
        .map_err(|e| format!("Invalid Day One date format '{}': {}", date_str, e))?;

    // Convert to YYYY-MM-DD format
    Ok(format!(
        "{:04}-{:02}-{:02}",
        parsed_date.year(),
        parsed_date.month(),
        parsed_date.day()
    ))
}

/// Extract title and text from Day One entry content
///
/// Strategy (same as Day One JSON):
/// 1. If content has paragraph break (\n\n), first paragraph is title
/// 2. Otherwise, if content has line break (\n), first line is title
/// 3. Otherwise, if content is > 100 chars, first 100 chars is title
/// 4. Otherwise, entire content is title (text is empty)
fn extract_title_and_text(content: &str) -> (String, String) {
    if content.is_empty() {
        return (String::new(), String::new());
    }

    // Try paragraph break first
    if let Some(pos) = content.find("\n\n") {
        let title = content[..pos].trim().to_string();
        let text = content[pos + 2..].trim().to_string();
        return (title, text);
    }

    // Try line break
    if let Some(pos) = content.find('\n') {
        let title = content[..pos].trim().to_string();
        let text = content[pos + 1..].trim().to_string();
        return (title, text);
    }

    // Try 100-char limit
    if content.len() > 100 {
        let title = content[..100].trim().to_string();
        let text = content[100..].trim().to_string();
        return (title, text);
    }

    // Entire content is title
    (content.to_string(), String::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_day_one_date() {
        assert_eq!(
            parse_day_one_date("15 January 2024").unwrap(),
            "2024-01-15"
        );
        assert_eq!(
            parse_day_one_date("31 December 2023").unwrap(),
            "2023-12-31"
        );
        assert_eq!(
            parse_day_one_date("01 March 2024").unwrap(),
            "2024-03-01"
        );
    }

    #[test]
    fn test_parse_day_one_date_invalid() {
        assert!(parse_day_one_date("2024-01-15").is_err()); // Wrong format
        assert!(parse_day_one_date("32 January 2024").is_err()); // Invalid day
        assert!(parse_day_one_date("15/January/2024").is_err()); // Wrong separator
        assert!(parse_day_one_date("January 15 2024").is_err()); // Wrong order
    }

    #[test]
    fn test_parse_day_one_date_abbreviated_month() {
        // Chrono's %B accepts both full and abbreviated month names
        assert_eq!(
            parse_day_one_date("15 Jan 2024").unwrap(),
            "2024-01-15"
        );
        assert_eq!(
            parse_day_one_date("31 Dec 2023").unwrap(),
            "2023-12-31"
        );
    }

    #[test]
    fn test_extract_title_and_text_paragraph_break() {
        let content = "First paragraph title\n\nSecond paragraph is the body.";
        let (title, text) = extract_title_and_text(content);
        assert_eq!(title, "First paragraph title");
        assert_eq!(text, "Second paragraph is the body.");
    }

    #[test]
    fn test_extract_title_and_text_line_break() {
        let content = "First line title\nSecond line is body.";
        let (title, text) = extract_title_and_text(content);
        assert_eq!(title, "First line title");
        assert_eq!(text, "Second line is body.");
    }

    #[test]
    fn test_extract_title_and_text_long() {
        let content = "This is a very long entry that exceeds one hundred characters and should be split at the hundred character mark for the title extraction.";
        let (title, text) = extract_title_and_text(content);
        // Title is first 100 chars, trimmed
        assert!(title.len() <= 100);
        assert!(title.starts_with("This is a very long entry"));
        // Text should contain the remainder
        assert!(!text.is_empty());
        assert!(content.ends_with(&text) || content.contains(&text));
    }

    #[test]
    fn test_extract_title_and_text_short() {
        let content = "Short entry";
        let (title, text) = extract_title_and_text(content);
        assert_eq!(title, "Short entry");
        assert_eq!(text, "");
    }

    #[test]
    fn test_extract_title_and_text_empty() {
        let (title, text) = extract_title_and_text("");
        assert_eq!(title, "");
        assert_eq!(text, "");
    }

    #[test]
    fn test_parse_dayone_txt_basic() {
        let txt = "Entry before first date (ignored)\n\n\tDate:\t15 January 2024\n\nFirst entry content.";
        let result = parse_dayone_txt(txt);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].date, "2024-01-15");
        assert_eq!(entries[0].title, "First entry content.");
        assert_eq!(entries[0].text, "");
    }

    #[test]
    fn test_parse_dayone_txt_multiple_entries() {
        let txt = "\tDate:\t15 January 2024\n\nFirst entry title\n\nFirst entry body.\n\n\tDate:\t16 January 2024\n\nSecond entry title\n\nSecond entry body.";
        let result = parse_dayone_txt(txt);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 2);

        assert_eq!(entries[0].date, "2024-01-15");
        assert_eq!(entries[0].title, "First entry title");
        assert_eq!(entries[0].text, "First entry body.");

        assert_eq!(entries[1].date, "2024-01-16");
        assert_eq!(entries[1].title, "Second entry title");
        assert_eq!(entries[1].text, "Second entry body.");
    }

    #[test]
    fn test_parse_dayone_txt_word_count() {
        let txt = "\tDate:\t15 January 2024\n\nTitle here\n\nOne two three four five.";
        let result = parse_dayone_txt(txt);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries[0].word_count, 5); // Only counts body, not title
    }

    #[test]
    fn test_parse_dayone_txt_empty() {
        let txt = "";
        let result = parse_dayone_txt(txt);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 0);
    }

    #[test]
    fn test_parse_dayone_txt_no_entries() {
        let txt = "Just some text without any date markers.";
        let result = parse_dayone_txt(txt);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 0);
    }

    #[test]
    fn test_parse_dayone_txt_invalid_date() {
        let txt = "\tDate:\t32 January 2024\n\nThis should fail.";
        let result = parse_dayone_txt(txt);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid Day One date format"));
    }

    #[test]
    fn test_parse_dayone_txt_leap_year() {
        let txt = "\tDate:\t29 February 2024\n\nLeap year entry.";
        let result = parse_dayone_txt(txt);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries[0].date, "2024-02-29");
    }

    #[test]
    fn test_parse_dayone_txt_non_leap_year() {
        let txt = "\tDate:\t29 February 2023\n\nThis should fail.";
        let result = parse_dayone_txt(txt);
        assert!(result.is_err());
    }
}
