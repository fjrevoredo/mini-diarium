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
/// - `<s>`/`<del>`/`<strike>` → ~~strikethrough~~
/// - `<pre><code>...</code></pre>` → fenced code block
/// - `<code>` → `inline code`
/// - `<blockquote>` → `> ` prefixed lines
/// - `<hr>` → `---`
/// - `<ul>/<li>` → bullet lists
/// - `<ol>/<li>` → numbered lists
/// - `<h1>`-`<h6>` → markdown headings (### to avoid clash with entry headings)
/// - `<u>` → text preserved, tags stripped (no native Markdown underline)
/// - Other tags → stripped
pub fn html_to_markdown(html: &str) -> String {
    if html.is_empty() {
        return String::new();
    }

    let mut result = html.to_string();

    // 1. Handle line breaks before block elements are processed
    result = result.replace("<br>", "\n");
    result = result.replace("<br/>", "\n");
    result = result.replace("<br />", "\n");

    // 2. Handle headings (offset by 2 to avoid clashing with # and ## used for doc/entry)
    for level in 1..=6 {
        let hashes = "#".repeat((level + 2).min(6));
        let open = format!("<h{}>", level);
        let close = format!("</h{}>", level);
        result = result.replace(&open, &format!("\n{} ", hashes));
        result = result.replace(&close, "\n");
    }

    // 3. Handle bold
    result = result.replace("<strong>", "**");
    result = result.replace("</strong>", "**");
    result = result.replace("<b>", "**");
    result = result.replace("</b>", "**");

    // 4. Handle italic
    result = result.replace("<em>", "*");
    result = result.replace("</em>", "*");
    result = result.replace("<i>", "*");
    result = result.replace("</i>", "*");

    // 5. Handle strikethrough
    result = result.replace("<s>", "~~");
    result = result.replace("</s>", "~~");
    result = result.replace("<del>", "~~");
    result = result.replace("</del>", "~~");
    result = result.replace("<strike>", "~~");
    result = result.replace("</strike>", "~~");

    // 6. Handle fenced code blocks (<pre>...<code>...</code>...</pre>) — must run before inline code
    result = process_code_blocks(&result);

    // 7. Handle inline code
    result = result.replace("<code>", "`");
    result = result.replace("</code>", "`");

    // 8. Handle blockquotes — must run before <p> replacement
    result = process_blockquotes(&result);

    // 9. Handle horizontal rules
    result = result.replace("<hr>", "\n---\n");
    result = result.replace("<hr/>", "\n---\n");
    result = result.replace("<hr />", "\n---\n");

    // 10. Handle ordered lists with proper numbering (must be before <li> replacement)
    result = number_ordered_lists(&result);

    // 11. Handle unordered lists
    result = result.replace("<ul>", "\n");
    result = result.replace("</ul>", "\n");

    // 12. Handle list items (for unordered lists only — ordered list items already processed)
    result = result.replace("<li>", "- ");
    result = result.replace("</li>", "\n");

    // 13. Handle paragraphs
    result = result.replace("<p>", "");
    result = result.replace("</p>", "\n\n");

    // 14. Strip any remaining HTML tags (handles <u>, <a>, etc.)
    result = strip_remaining_tags(&result);

    // 15. Decode common HTML entities
    result = result.replace("&amp;", "&");
    result = result.replace("&lt;", "<");
    result = result.replace("&gt;", ">");
    result = result.replace("&quot;", "\"");
    result = result.replace("&#39;", "'");
    result = result.replace("&nbsp;", " ");

    // 16. Clean up excessive blank lines (3+ newlines → 2)
    while result.contains("\n\n\n") {
        result = result.replace("\n\n\n", "\n\n");
    }

    // 17. Trim trailing whitespace
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

/// Converts `<pre>...<code>...</code>...</pre>` regions to fenced Markdown code blocks.
///
/// Must be called before the inline `<code>` → backtick replacement so that the
/// `<code>` tags inside `<pre>` are consumed here and not turned into inline code.
fn process_code_blocks(input: &str) -> String {
    let mut result = String::new();
    let mut remaining = input;

    while let Some(pre_start) = remaining.find("<pre>") {
        result.push_str(&remaining[..pre_start]);
        remaining = &remaining[pre_start + 5..]; // skip "<pre>"

        if let Some(pre_end) = remaining.find("</pre>") {
            let inner = &remaining[..pre_end];
            remaining = &remaining[pre_end + 6..]; // skip "</pre>"

            // Strip inner <code ...> / </code> tags to get the raw text
            let code_content = strip_remaining_tags(inner);
            result.push_str("\n```\n");
            result.push_str(&code_content);
            if !code_content.ends_with('\n') {
                result.push('\n');
            }
            result.push_str("```\n");
        }
    }
    result.push_str(remaining);
    result
}

/// Converts `<blockquote>...<p>...</p>...</blockquote>` regions to `> ` prefixed Markdown lines.
///
/// Must be called after inline formats (bold, italic, etc.) are applied but before the
/// `<p>` → newline replacement so the paragraphs inside the blockquote are handled here.
fn process_blockquotes(input: &str) -> String {
    let mut result = String::new();
    let mut remaining = input;

    while let Some(bq_start) = remaining.find("<blockquote>") {
        result.push_str(&remaining[..bq_start]);
        remaining = &remaining[bq_start + 12..]; // skip "<blockquote>"

        if let Some(bq_end) = remaining.find("</blockquote>") {
            let inner = &remaining[..bq_end];
            remaining = &remaining[bq_end + 13..]; // skip "</blockquote>"

            result.push('\n');
            // Split on </p> to get individual paragraph segments
            for segment in inner.split("</p>") {
                // Strip <p> and any remaining tags, then trim
                let text = strip_remaining_tags(&segment.replace("<p>", ""));
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    result.push_str("> ");
                    result.push_str(trimmed);
                    result.push('\n');
                }
            }
        }
    }
    result.push_str(remaining);
    result
}

/// Strips any remaining HTML tags from the string.
///
/// A `>` character that is NOT closing an open `<` tag (e.g. the Markdown
/// blockquote prefix `> `) is preserved so blockquote lines are not mangled.
fn strip_remaining_tags(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut in_tag = false;

    for ch in input.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            if !in_tag {
                // Standalone `>` (e.g. Markdown blockquote marker) — keep it
                result.push(ch);
            }
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

    #[test]
    fn test_html_to_markdown_strikethrough() {
        let html = "<p>This is <s>struck</s> text</p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "This is ~~struck~~ text");
    }

    #[test]
    fn test_html_to_markdown_del_tag() {
        let html = "<p><del>deleted</del></p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "~~deleted~~");
    }

    #[test]
    fn test_html_to_markdown_blockquote() {
        let html = "<blockquote><p>A wise quote</p></blockquote>";
        let result = html_to_markdown(html);
        assert!(
            result.contains("> A wise quote"),
            "expected '> A wise quote' in: {}",
            result
        );
    }

    #[test]
    fn test_html_to_markdown_blockquote_multiline() {
        let html = "<blockquote><p>First line</p><p>Second line</p></blockquote>";
        let result = html_to_markdown(html);
        assert!(
            result.contains("> First line"),
            "expected '> First line' in: {}",
            result
        );
        assert!(
            result.contains("> Second line"),
            "expected '> Second line' in: {}",
            result
        );
    }

    #[test]
    fn test_html_to_markdown_inline_code() {
        let html = "<p>Use <code>println!()</code> to print</p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "Use `println!()` to print");
    }

    #[test]
    fn test_html_to_markdown_code_block() {
        let html = "<pre><code>fn foo() {}</code></pre>";
        let result = html_to_markdown(html);
        assert!(
            result.contains("```"),
            "expected fenced code block in: {}",
            result
        );
        assert!(
            result.contains("fn foo() {}"),
            "expected code content in: {}",
            result
        );
    }

    #[test]
    fn test_html_to_markdown_hr() {
        let html = "<p>Before</p><hr><p>After</p>";
        let result = html_to_markdown(html);
        assert!(result.contains("---"), "expected '---' in: {}", result);
        assert!(
            result.contains("Before"),
            "expected 'Before' in: {}",
            result
        );
        assert!(result.contains("After"), "expected 'After' in: {}", result);
    }
}
