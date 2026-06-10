use crate::db::queries::DiaryEntry;
use std::collections::{BTreeMap, HashMap};

pub struct PrintLabels {
    pub generated_label: String,
    pub tags_label: String,
    pub months: Vec<String>,
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn format_date(date: &str, months: &[String]) -> String {
    // date is YYYY-MM-DD
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 {
        return date.to_string();
    }
    let year = parts[0];
    let month_idx: usize = parts[1].parse::<usize>().unwrap_or(1).saturating_sub(1);
    let day: u32 = parts[2].parse().unwrap_or(1);
    let month_name = months
        .get(month_idx)
        .map(|s| s.as_str())
        .unwrap_or(parts[1]);
    format!("{} {}, {}", month_name, day, year)
}

pub fn generate_print_html(
    entries: Vec<DiaryEntry>,
    tags: &HashMap<i64, Vec<String>>,
    generated_at: &str,
    labels: &PrintLabels,
) -> String {
    // CSS lives in index.css (@media print) — loaded at app startup, not injected dynamically.
    let mut html = String::new();

    html.push_str(&format!(
        r#"<div class="md-print-doc-header"><h1>Mini Diarium</h1><p class="md-print-generated">{} {}</p></div>"#,
        escape_html(&labels.generated_label),
        escape_html(generated_at),
    ));

    if entries.is_empty() {
        html.push_str("<p>No entries found.</p>");
        return html;
    }

    // Group entries by date; BTreeMap preserves ISO date sort order (chronological)
    let mut by_date: BTreeMap<&str, Vec<&DiaryEntry>> = BTreeMap::new();
    for entry in &entries {
        by_date.entry(entry.date.as_str()).or_default().push(entry);
    }

    for (date, day_entries) in &by_date {
        let formatted_date = format_date(date, &labels.months);
        html.push_str(&format!(
            r#"<div class="md-print-day"><div class="md-print-day-date">{}</div>"#,
            escape_html(&formatted_date)
        ));

        for entry in day_entries {
            html.push_str(r#"<div class="md-print-entry">"#);

            if !entry.title.is_empty() {
                html.push_str(&format!(
                    r#"<div class="md-print-entry-title">{}</div>"#,
                    escape_html(&entry.title)
                ));
            }

            if let Some(entry_tags) = tags.get(&entry.id) {
                if !entry_tags.is_empty() {
                    let mut sorted_tags = entry_tags.clone();
                    sorted_tags.sort();
                    let tag_list: Vec<String> =
                        sorted_tags.iter().map(|t| escape_html(t)).collect();
                    html.push_str(&format!(
                        r#"<div class="md-print-entry-tags">{} {}</div>"#,
                        escape_html(&labels.tags_label),
                        tag_list.join(", ")
                    ));
                }
            }

            html.push_str(&format!(
                r#"<div class="md-print-entry-content">{}</div>"#,
                entry.text
            ));

            html.push_str("</div>"); // .md-print-entry
        }

        html.push_str("</div>"); // .md-print-day
    }

    html
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_labels() -> PrintLabels {
        PrintLabels {
            generated_label: "Generated:".to_string(),
            tags_label: "Tags:".to_string(),
            months: vec![
                "January".to_string(),
                "February".to_string(),
                "March".to_string(),
                "April".to_string(),
                "May".to_string(),
                "June".to_string(),
                "July".to_string(),
                "August".to_string(),
                "September".to_string(),
                "October".to_string(),
                "November".to_string(),
                "December".to_string(),
            ],
        }
    }

    fn make_entry(id: i64, date: &str, title: &str, text: &str) -> DiaryEntry {
        let now = "2024-01-15T10:00:00Z".to_string();
        DiaryEntry {
            id,
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: 0,
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
        }
    }

    #[test]
    fn test_two_entries_different_dates_generate_two_day_divs() {
        let entries = vec![
            make_entry(1, "2024-01-15", "Entry A", "<p>Content A</p>"),
            make_entry(2, "2024-02-20", "Entry B", "<p>Content B</p>"),
        ];
        let tags = HashMap::new();
        let html = generate_print_html(entries, &tags, "2024-03-01", &make_labels());
        let count = html.matches("md-print-day\"").count();
        assert_eq!(count, 2, "Expected 2 day divs, got {}", count);
    }

    #[test]
    fn test_output_contains_no_style_tag() {
        // CSS lives in index.css; the HTML fragment must not embed a <style> block.
        let entries = vec![make_entry(1, "2024-01-15", "Test", "<p>Hello</p>")];
        let html = generate_print_html(entries, &HashMap::new(), "2024-03-01", &make_labels());
        assert!(
            !html.contains("<style>"),
            "HTML fragment must not embed a <style> block"
        );
        assert!(
            !html.contains("@page"),
            "@page belongs in index.css, not in the fragment"
        );
    }

    #[test]
    fn test_title_is_html_escaped() {
        let entries = vec![make_entry(
            1,
            "2024-01-15",
            "<script>alert(1)</script>",
            "<p>ok</p>",
        )];
        let html = generate_print_html(entries, &HashMap::new(), "2024-03-01", &make_labels());
        assert!(
            html.contains("&lt;script&gt;"),
            "Title should be HTML-escaped"
        );
        assert!(
            !html.contains("<script>alert(1)</script>"),
            "Raw script tag must not appear"
        );
    }

    #[test]
    fn test_entry_content_is_verbatim() {
        let raw_html = "<p>Hello <strong>world</strong></p>";
        let entries = vec![make_entry(1, "2024-01-15", "Title", raw_html)];
        let html = generate_print_html(entries, &HashMap::new(), "2024-03-01", &make_labels());
        assert!(
            html.contains(raw_html),
            "Entry content must be embedded verbatim"
        );
    }

    #[test]
    fn test_tags_section_only_when_tags_exist() {
        let entries = vec![
            make_entry(1, "2024-01-15", "With Tags", "<p>A</p>"),
            make_entry(2, "2024-01-16", "No Tags", "<p>B</p>"),
        ];
        let mut tags = HashMap::new();
        tags.insert(1i64, vec!["travel".to_string(), "work".to_string()]);

        let html = generate_print_html(entries, &tags, "2024-03-01", &make_labels());
        // Count the div elements (not CSS rule occurrences) by matching the opening div tag
        let div_count = html.matches(r#"<div class="md-print-entry-tags">"#).count();
        assert_eq!(div_count, 1, "Only one entry should have a tags div");
    }

    #[test]
    fn test_generated_label_appears() {
        let entries = vec![make_entry(1, "2024-01-15", "T", "<p>c</p>")];
        let html = generate_print_html(entries, &HashMap::new(), "2024-06-10", &make_labels());
        assert!(
            html.contains("Generated:"),
            "generated_label should appear in output"
        );
        assert!(
            html.contains("2024-06-10"),
            "generated_at date should appear in output"
        );
    }

    #[test]
    fn test_empty_entries_returns_no_entries_message() {
        let html = generate_print_html(vec![], &HashMap::new(), "2024-03-01", &make_labels());
        assert!(
            html.contains("No entries found."),
            "Empty diary should show 'No entries found.' message"
        );
        // Verify no day div elements were emitted (the class name appears in CSS, but not as a div element)
        assert!(
            !html.contains(r#"<div class="md-print-day">"#),
            "Empty diary should have no day divs"
        );
    }

    #[test]
    fn test_format_date_malformed_falls_back_to_raw_string() {
        // format_date returns the raw string when the date isn't YYYY-MM-DD
        // "invalid" has no '-', so split('-') produces 1 part — triggers the early return
        let entries = vec![make_entry(1, "invalid", "Title", "<p>c</p>")];
        let html = generate_print_html(entries, &HashMap::new(), "2024-03-01", &make_labels());
        assert!(
            html.contains("invalid"),
            "Malformed date should appear verbatim in output"
        );
    }

    #[test]
    fn test_two_entries_same_date_generate_one_day_div() {
        let entries = vec![
            make_entry(1, "2024-01-15", "Entry A", "<p>Content A</p>"),
            make_entry(2, "2024-01-15", "Entry B", "<p>Content B</p>"),
        ];
        let html = generate_print_html(entries, &HashMap::new(), "2024-03-01", &make_labels());
        let count = html.matches(r#"<div class="md-print-day">"#).count();
        assert_eq!(
            count, 1,
            "Two entries on the same date should produce exactly 1 day div, got {}",
            count
        );
    }

    #[test]
    fn test_day_divs_are_ordered_chronologically() {
        let entries = vec![
            make_entry(1, "2024-03-10", "Later", "<p>Later content</p>"),
            make_entry(2, "2024-01-05", "Earlier", "<p>Earlier content</p>"),
        ];
        let html = generate_print_html(entries, &HashMap::new(), "2024-03-01", &make_labels());
        let pos_earlier = html
            .find("January 5, 2024")
            .expect("Earlier date not found");
        let pos_later = html.find("March 10, 2024").expect("Later date not found");
        assert!(
            pos_earlier < pos_later,
            "Earlier date should appear before later date in output"
        );
    }

    #[test]
    fn test_tags_sorted_alphabetically() {
        let entries = vec![make_entry(1, "2024-01-15", "T", "<p>c</p>")];
        let mut tags = HashMap::new();
        tags.insert(1i64, vec!["zebra".to_string(), "apple".to_string()]);
        let html = generate_print_html(entries, &tags, "2024-03-01", &make_labels());
        assert!(
            html.contains("apple, zebra"),
            "Tags should be sorted alphabetically: expected 'apple, zebra'"
        );
    }

    #[test]
    fn test_empty_title_omits_title_div() {
        let entries = vec![make_entry(1, "2024-01-15", "", "<p>Content</p>")];
        let html = generate_print_html(entries, &HashMap::new(), "2024-03-01", &make_labels());
        assert!(
            !html.contains(r#"<div class="md-print-entry-title">"#),
            "Empty title should not emit a title div"
        );
    }
}
