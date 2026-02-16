use crate::db::queries::DiaryEntry;

/// Exports diary entries to a Markdown-formatted string
///
/// Format:
/// ```markdown
/// # Mini Diarium
///
/// ## 2024-01-15
/// **My Title**
/// Entry content here...
///
/// ## 2024-01-16
/// **Another Title**
/// More content...
/// ```
///
/// HTML content from TipTap is converted to Markdown.
pub fn export_entries_to_markdown(entries: Vec<DiaryEntry>) -> String {
    let mut output = String::from("# Mini Diarium\n");

    for entry in &entries {
        output.push_str(&format!("\n## {}\n", entry.date));

        if !entry.title.is_empty() {
            output.push_str(&format!("**{}**\n", entry.title));
        }

        let text = html_to_markdown(&entry.text);
        if !text.is_empty() {
            output.push_str(&text);
            if !text.ends_with('\n') {
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
fn html_to_markdown(html: &str) -> String {
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

    // Handle ordered lists - we need to number them
    // Simple approach: convert to bullet list (numbering would need state tracking)
    result = result.replace("<ol>", "\n");
    result = result.replace("</ol>", "\n");

    // Handle list items
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
}
