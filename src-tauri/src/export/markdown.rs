use crate::db::queries::DiaryEntry;

/// Exports diary entries to a Markdown-formatted string
///
/// Entries are grouped by date. If a date has multiple entries, each entry
/// gets a `### Title` (or `### Entry N` if title is empty) sub-heading.
///
/// Format (single entry per day):
/// ```markdown
/// # Mini Diarium
///
/// ## 2024-01-15
/// **My Title**
/// Entry content here...
/// ```
///
/// Format (multiple entries per day):
/// ```markdown
/// # Mini Diarium
///
/// ## 2024-01-15
/// ### Morning Entry
/// Content...
///
/// ### Entry 2
/// More content...
/// ```
///
/// HTML content from TipTap is converted to Markdown.
pub fn export_entries_to_markdown(entries: Vec<DiaryEntry>) -> String {
    let mut output = String::from("# Mini Diarium\n");

    // Group entries by date preserving order (entries should be ordered date ASC, id ASC)
    // First, collect entries grouped by date to know how many per date
    let mut date_groups: Vec<(&str, Vec<&DiaryEntry>)> = Vec::new();
    for entry in &entries {
        if let Some((last_date, group)) = date_groups.last_mut() {
            if *last_date == entry.date.as_str() {
                group.push(entry);
                continue;
            }
        }
        date_groups.push((entry.date.as_str(), vec![entry]));
    }

    for (date, group) in &date_groups {
        output.push_str(&format!("\n## {}\n", date));
        let multi = group.len() > 1;

        for (i, entry) in group.iter().enumerate() {
            if multi {
                // Use title as sub-heading, or "Entry N" if title is empty
                let heading = if entry.title.is_empty() {
                    format!("Entry {}", i + 1)
                } else {
                    entry.title.clone()
                };
                output.push_str(&format!("### {}\n", heading));
            } else if !entry.title.is_empty() {
                output.push_str(&format!("**{}**\n", entry.title));
            }

            let text = html_to_markdown(&entry.text);
            if !text.is_empty() {
                output.push_str(&text);
                if !text.ends_with('\n') {
                    output.push('\n');
                }
            }

            if multi && i + 1 < group.len() {
                output.push('\n');
            }
        }
    }

    output
}

/// Converts TipTap HTML to Markdown
///
/// Handles the common elements TipTap generates:
/// - `<p>` → paragraphs separated by blank lines
/// - `<br>` → line breaks
/// - `<strong>`/`<b>` → **bold**
/// - `<em>`/`<i>` → *italic*
/// - `<ul>/<li>` → bullet lists
/// - `<ol>/<li>` → numbered lists
/// - `<h1>`-`<h6>` → markdown headings (### to avoid clash with entry headings)
/// - Other tags → stripped
pub fn html_to_markdown(html: &str) -> String {
    if html.is_empty() {
        return String::new();
    }

    let mut result = html.to_string();

    // Handle line breaks before block elements are processed
    result = result.replace("<br>", "\n");
    result = result.replace("<br/>", "\n");
    result = result.replace("<br />", "\n");

    // Handle headings (offset by 2 to avoid clashing with # and ## used for doc/entry)
    for level in 1..=6 {
        let hashes = "#".repeat((level + 2).min(6));
        let open = format!("<h{}>", level);
        let close = format!("</h{}>", level);
        // Replace each occurrence
        result = result.replace(&open, &format!("\n{} ", hashes));
        result = result.replace(&close, "\n");
    }

    // Handle bold
    result = result.replace("<strong>", "**");
    result = result.replace("</strong>", "**");
    result = result.replace("<b>", "**");
    result = result.replace("</b>", "**");

    // Handle italic
    result = result.replace("<em>", "*");
    result = result.replace("</em>", "*");
    result = result.replace("<i>", "*");
    result = result.replace("</i>", "*");

    // Handle unordered lists
    result = result.replace("<ul>", "\n");
    result = result.replace("</ul>", "\n");

    // Handle ordered lists with proper numbering (must be before <li> replacement)
    result = number_ordered_lists(&result);

    // Handle list items (for unordered lists only — ordered list items already processed)
    result = result.replace("<li>", "- ");
    result = result.replace("</li>", "\n");

    // Handle paragraphs
    result = result.replace("<p>", "");
    result = result.replace("</p>", "\n\n");

    // Strip any remaining HTML tags
    result = strip_remaining_tags(&result);

    // Decode common HTML entities
    result = result.replace("&amp;", "&");
    result = result.replace("&lt;", "<");
    result = result.replace("&gt;", ">");
    result = result.replace("&quot;", "\"");
    result = result.replace("&#39;", "'");
    result = result.replace("&nbsp;", " ");

    // Clean up excessive blank lines (3+ newlines → 2)
    while result.contains("\n\n\n") {
        result = result.replace("\n\n\n", "\n\n");
    }

    // Trim trailing whitespace
    result.trim().to_string()
}

/// Converts `<ol>...</ol>` regions to numbered markdown list items.
///
/// Each `<li>content</li>` within an ordered list becomes `\n{n}. content`
/// where n is a per-list counter starting at 1.  Unordered `<ul>` items are
/// left for the existing `<li>` → `- ` replacement to handle.
fn number_ordered_lists(input: &str) -> String {
    let mut result = String::new();
    let mut remaining = input;

    while let Some(ol_start) = remaining.find("<ol>") {
        result.push_str(&remaining[..ol_start]);
        remaining = &remaining[ol_start + 4..]; // skip "<ol>"

        if let Some(ol_end) = remaining.find("</ol>") {
            let ol_content = &remaining[..ol_end];
            remaining = &remaining[ol_end + 5..]; // skip "</ol>"

            let mut counter = 1;
            let mut ol_remaining = ol_content;
            while let Some(li_start) = ol_remaining.find("<li>") {
                result.push_str(&ol_remaining[..li_start]);
                ol_remaining = &ol_remaining[li_start + 4..];
                if let Some(li_end) = ol_remaining.find("</li>") {
                    let li_content = &ol_remaining[..li_end];
                    ol_remaining = &ol_remaining[li_end + 5..];
                    result.push_str(&format!("\n{}. {}", counter, li_content));
                    counter += 1;
                }
            }
            result.push_str(ol_remaining);
        }
    }
    result.push_str(remaining);
    result
}

/// Strips any remaining HTML tags from the string
fn strip_remaining_tags(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut in_tag = false;

    for ch in input.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(ch);
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        DiaryEntry {
            id: 1,
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
        let result = export_entries_to_markdown(vec![]);
        assert_eq!(result, "# Mini Diarium\n");
    }

    #[test]
    fn test_export_single_entry_plaintext() {
        let entries = vec![create_test_entry("2024-01-15", "My Entry", "Hello world")];

        let result = export_entries_to_markdown(entries);
        assert!(result.contains("# Mini Diarium"));
        assert!(result.contains("## 2024-01-15"));
        assert!(result.contains("**My Entry**"));
        assert!(result.contains("Hello world"));
    }

    #[test]
    fn test_export_multiple_entries_sorted() {
        let entries = vec![
            create_test_entry("2024-01-01", "First", "Content one"),
            create_test_entry("2024-01-02", "Second", "Content two"),
            create_test_entry("2024-01-03", "Third", "Content three"),
        ];

        let result = export_entries_to_markdown(entries);
        let first_pos = result.find("## 2024-01-01").unwrap();
        let second_pos = result.find("## 2024-01-02").unwrap();
        let third_pos = result.find("## 2024-01-03").unwrap();

        assert!(first_pos < second_pos);
        assert!(second_pos < third_pos);
    }

    #[test]
    fn test_export_entry_without_title() {
        let entries = vec![create_test_entry("2024-01-15", "", "Just text")];

        let result = export_entries_to_markdown(entries);
        assert!(result.contains("## 2024-01-15"));
        assert!(!result.contains("****")); // No empty bold
        assert!(result.contains("Just text"));
    }

    #[test]
    fn test_html_to_markdown_paragraphs() {
        let html = "<p>First paragraph</p><p>Second paragraph</p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "First paragraph\n\nSecond paragraph");
    }

    #[test]
    fn test_html_to_markdown_bold_italic() {
        let html = "<p>This is <strong>bold</strong> and <em>italic</em></p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "This is **bold** and *italic*");
    }

    #[test]
    fn test_html_to_markdown_list() {
        let html = "<ul><li>Item one</li><li>Item two</li></ul>";
        let result = html_to_markdown(html);
        assert!(result.contains("- Item one"));
        assert!(result.contains("- Item two"));
    }

    #[test]
    fn test_html_to_markdown_entities() {
        let html = "<p>A &amp; B &lt; C &gt; D</p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "A & B < C > D");
    }

    #[test]
    fn test_html_to_markdown_strips_unknown_tags() {
        let html = "<p>Text with <span class=\"custom\">span</span> inside</p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "Text with span inside");
    }

    #[test]
    fn test_html_to_markdown_empty() {
        assert_eq!(html_to_markdown(""), "");
    }

    #[test]
    fn test_html_to_markdown_plain_text() {
        // Non-HTML text should pass through
        assert_eq!(html_to_markdown("Just plain text"), "Just plain text");
    }

    #[test]
    fn test_html_to_markdown_br_tags() {
        let html = "<p>Line one<br>Line two</p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "Line one\nLine two");
    }

    #[test]
    fn test_html_to_markdown_ordered_list() {
        let html = "<ol><li>First</li><li>Second</li><li>Third</li></ol>";
        let result = html_to_markdown(html);
        assert!(
            result.contains("1. First"),
            "expected '1. First' in: {}",
            result
        );
        assert!(
            result.contains("2. Second"),
            "expected '2. Second' in: {}",
            result
        );
        assert!(
            result.contains("3. Third"),
            "expected '3. Third' in: {}",
            result
        );
    }
}
