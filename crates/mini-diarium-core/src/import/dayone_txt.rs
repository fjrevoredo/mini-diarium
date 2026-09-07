use crate::db::queries::DiaryEntry;
use chrono::{Datelike, NaiveDate, Utc};
use log::warn;

/// Parse Day One TXT export file
///
/// Day One TXT format splits entries with "\tDate:\t" delimiter. Date format is
/// either the modern `"MMMM D, YYYY at H:MM:SS AM/PM TZ"` or the legacy
/// `"DD MMMM YYYY"` — see [`parse_day_one_date`]. Real exports may also carry
/// additional tab-delimited metadata lines (e.g. `\tWeather:\t...`,
/// `\tLocation:\t...`) directly after the date line; these are skipped rather
/// than imported as content.
///
/// Example:
/// ```text
/// Entry content goes here.
/// This is the first entry.
///
///     Date:    June 24, 2016 at 10:59:06 AM MDT
///     Weather: Clear, 72°F
///
/// Another entry content.
/// Second entry here.
///
///     Date:    16 January 2024
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

        // Split on first newline to separate date from the rest of the entry
        let lines: Vec<&str> = part.splitn(2, '\n').collect();
        if lines.len() < 2 {
            warn!("Skipping Day One TXT entry - no content after date");
            continue;
        }

        let date_str = lines[0].trim();
        let content = strip_metadata_lines(lines[1]);

        // Extract title and text from content
        let (title, text) = extract_title_and_text(&content);

        // Blank entries are skipped before parsing the date, so a malformed date
        // on an otherwise-empty entry doesn't fail the whole import.
        if title.trim().is_empty() && text.trim().is_empty() {
            continue;
        }

        // Parse the date
        let date = parse_day_one_date(date_str)?;

        // Calculate word count
        let word_count = text.split_whitespace().count() as i32;

        entries.push(DiaryEntry {
            id: 0,
            date,
            title,
            text,
            word_count,
            date_created: now.clone(),
            date_updated: now.clone(),
            metadata: None,
            locked: false,
        });
    }

    Ok(entries)
}

/// Parse a Day One per-entry date line.
///
/// Modern Day One exports (per the official guide) use
/// `"MMMM D, YYYY at H:MM:SS AM/PM TZ"` (e.g. `"June 24, 2016 at 10:59:06 AM MDT"`).
/// Only the calendar date is ever needed (`date_created`/`date_updated` are set from
/// the import moment, not from this value), so everything from `" at "` onward —
/// time-of-day and timezone abbreviation — is discarded before parsing.
///
/// Older/legacy exports have been seen using `"DD MMMM YYYY"` (e.g.
/// `"15 January 2024"`, no time-of-day), which is tried as a fallback.
fn parse_day_one_date(date_str: &str) -> Result<String, String> {
    let date_only = date_str.split(" at ").next().unwrap_or(date_str).trim();

    let parsed_date = NaiveDate::parse_from_str(date_only, "%B %d, %Y")
        .or_else(|_| NaiveDate::parse_from_str(date_only, "%d %B %Y"))
        .map_err(|e| format!("Invalid Day One date format '{}': {}", date_str, e))?;

    // Convert to YYYY-MM-DD format
    Ok(format!(
        "{:04}-{:02}-{:02}",
        parsed_date.year(),
        parsed_date.month(),
        parsed_date.day()
    ))
}

/// Strip leading tab-delimited metadata lines (e.g. `\tWeather:\t...`,
/// `\tLocation:\t...`) that real Day One TXT exports place right after the date
/// line. Any `\tKey:\tValue` shaped line is treated as metadata (no key
/// allowlist), matching the generic pattern independently observed across real
/// exports. Stops at the first line that is neither blank nor metadata-shaped —
/// that's where the actual entry content begins.
///
/// Must run before the block is trimmed as a whole, since trimming first would
/// destroy the leading-tab shape this function matches line by line.
fn strip_metadata_lines(rest: &str) -> String {
    let lines: Vec<&str> = rest.lines().collect();

    let content_start = lines
        .iter()
        .position(|line| {
            let is_metadata = line.starts_with('\t') && line[1..].split_once(":\t").is_some();
            !line.trim().is_empty() && !is_metadata
        })
        .unwrap_or(lines.len());

    lines[content_start..].join("\n").trim().to_string()
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
        assert_eq!(parse_day_one_date("15 January 2024").unwrap(), "2024-01-15");
        assert_eq!(
            parse_day_one_date("31 December 2023").unwrap(),
            "2023-12-31"
        );
        assert_eq!(parse_day_one_date("01 March 2024").unwrap(), "2024-03-01");
    }

    #[test]
    fn test_parse_day_one_date_invalid() {
        assert!(parse_day_one_date("2024-01-15").is_err()); // Wrong format
        assert!(parse_day_one_date("32 January 2024").is_err()); // Invalid day
        assert!(parse_day_one_date("15/January/2024").is_err()); // Wrong separator
        assert!(parse_day_one_date("January 15 2024").is_err()); // Wrong order
    }

    #[test]
    fn test_parse_day_one_date_still_rejects_wrong_order() {
        // Neither the modern ("Month D, YYYY") nor legacy ("D Month YYYY") format
        // accepts month-day-year without a comma.
        assert!(parse_day_one_date("January 15 2024").is_err());
    }

    #[test]
    fn test_parse_day_one_date_abbreviated_month() {
        // Chrono's %B accepts both full and abbreviated month names
        assert_eq!(parse_day_one_date("15 Jan 2024").unwrap(), "2024-01-15");
        assert_eq!(parse_day_one_date("31 Dec 2023").unwrap(), "2023-12-31");
    }

    #[test]
    fn test_parse_day_one_date_modern_format() {
        // Official Day One export format: "MMMM D, YYYY at H:MM:SS AM/PM TZ"
        assert_eq!(
            parse_day_one_date("June 24, 2016 at 10:59:06 AM MDT").unwrap(),
            "2016-06-24"
        );
        assert_eq!(
            parse_day_one_date("December 31, 2023 at 11:59:59 PM UTC").unwrap(),
            "2023-12-31"
        );
    }

    #[test]
    fn test_parse_day_one_date_modern_format_no_time() {
        // The " at ..." suffix is optional to parse_day_one_date itself.
        assert_eq!(parse_day_one_date("June 24, 2016").unwrap(), "2016-06-24");
    }

    #[test]
    fn test_parse_day_one_date_modern_format_unpadded_day() {
        assert_eq!(
            parse_day_one_date("June 4, 2016 at 9:00:00 AM MDT").unwrap(),
            "2016-06-04"
        );
    }

    #[test]
    fn test_parse_day_one_date_legacy_format_unpadded_day() {
        assert_eq!(parse_day_one_date("1 March 2024").unwrap(), "2024-03-01");
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
        let txt =
            "Entry before first date (ignored)\n\n\tDate:\t15 January 2024\n\nFirst entry content.";
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

    #[test]
    fn test_parse_dayone_txt_skips_entry_with_no_newline_after_date() {
        // A date line with nothing after it at all (no trailing newline) has no
        // content to import and must be skipped, not treated as an error.
        let txt = "\tDate:\t15 January 2024";
        let result = parse_dayone_txt(txt);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_parse_dayone_txt_no_metadata_lines_unchanged() {
        // No metadata lines present: strip_metadata_lines must be a no-op so this
        // matches parse_dayone_txt_basic's exact pre-change behavior.
        let txt = "\tDate:\t15 January 2024\n\nFirst entry content.";
        let result = parse_dayone_txt(txt).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].title, "First entry content.");
        assert_eq!(result[0].text, "");
    }

    #[test]
    fn test_parse_dayone_txt_skips_weather_and_location_metadata() {
        let txt = "\tDate:\tJune 24, 2016 at 10:59:06 AM MDT\n\tWeather:\tClear, 72\u{b0}F\n\tLocation:\tDenver, CO\n\nMorning Walk\n\nIt was a beautiful day.";
        let result = parse_dayone_txt(txt).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].date, "2016-06-24");
        assert_eq!(result[0].title, "Morning Walk");
        assert_eq!(result[0].text, "It was a beautiful day.");
        assert!(!result[0].title.contains("Weather"));
        assert!(!result[0].text.contains("Weather"));
        assert!(!result[0].title.contains("Location"));
        assert!(!result[0].text.contains("Location"));
    }

    #[test]
    fn test_parse_dayone_txt_skips_blank_entry() {
        let txt = "\tDate:\t15 January 2024\n\n\n\n\tDate:\t16 January 2024\n\nReal entry.";
        let result = parse_dayone_txt(txt).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].date, "2024-01-16");
        assert_eq!(result[0].title, "Real entry.");
    }

    #[test]
    fn test_parse_dayone_txt_blank_entry_with_unparseable_date_is_skipped_not_error() {
        // The blank-content check runs before date parsing, so a malformed date on
        // an otherwise-empty entry is skipped rather than failing the whole import.
        let txt = "\tDate:\tnot a real date\n\n   \n\n\tDate:\t16 January 2024\n\nReal entry.";
        let result = parse_dayone_txt(txt);
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].date, "2024-01-16");
    }

    #[test]
    fn test_parse_dayone_txt_sample_fixture() {
        // Real-export-shaped fixture: mixes a modern-format entry (with Weather/
        // Location metadata), a legacy-format entry, a leap-year date, and a
        // blank/metadata-only entry that must be skipped.
        let txt = include_str!("../../test-fixtures/dayone-sample.txt");
        let result = parse_dayone_txt(txt);

        assert!(result.is_ok(), "Failed to parse dayone-sample.txt");

        let entries = result.unwrap();
        assert_eq!(
            entries.len(),
            3,
            "Expected 3 importable entries (1 blank/metadata-only entry is skipped)"
        );

        assert_eq!(entries[0].date, "2016-06-24");
        assert_eq!(entries[0].title, "Morning Reflections");
        assert!(entries[0].text.starts_with("Started the day"));

        assert_eq!(entries[1].date, "2024-01-16");
        assert_eq!(entries[1].title, "Project Milestone");
        assert!(entries[1].text.starts_with("We finally completed"));

        assert_eq!(entries[2].date, "2024-02-29");
        assert_eq!(entries[2].title, "Leap Year Entry");
        assert!(entries[2].text.starts_with("This is a special entry"));
    }
}
