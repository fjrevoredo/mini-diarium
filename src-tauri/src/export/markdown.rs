use crate::db::queries::DiaryEntry;
use base64::{engine::general_purpose, Engine as _};

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

// --- Image-aware export variants ---

/// Exports diary entries to Markdown, extracting embedded base64 images to
/// separate asset files.
///
/// Returns `(markdown_string, assets)` where `assets` is a list of
/// `(filename, bytes)` pairs to be written to a sibling `assets/` directory.
/// Image references in the markdown use `![Image N](assets/image-N.ext)`.
pub fn export_entries_to_markdown_with_assets(
    entries: Vec<DiaryEntry>,
) -> (String, Vec<(String, Vec<u8>)>) {
    let mut output = String::from("# Mini Diarium\n");
    let mut all_assets: Vec<(String, Vec<u8>)> = Vec::new();
    let mut image_counter: usize = 0;

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
                let heading = if entry.title.is_empty() {
                    format!("Entry {}", i + 1)
                } else {
                    entry.title.clone()
                };
                output.push_str(&format!("### {}\n", heading));
            } else if !entry.title.is_empty() {
                output.push_str(&format!("**{}**\n", entry.title));
            }

            let (processed_html, entry_assets) =
                extract_and_replace_with_assets(&entry.text, &mut image_counter);
            all_assets.extend(entry_assets);

            let text = html_to_markdown(&processed_html);
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

    (output, all_assets)
}

/// Exports diary entries to Markdown, embedding base64 images as inline data URIs.
///
/// Each `<img src="data:image/TYPE;base64,DATA">` becomes
/// `![Image N](data:image/TYPE;base64,DATA)` — readable by editors that support
/// embedded data URIs (e.g. Obsidian, VS Code preview). Produces a single file
/// with no external assets.
pub fn export_entries_to_markdown_inline(entries: Vec<DiaryEntry>) -> String {
    let mut output = String::from("# Mini Diarium\n");
    let mut image_counter: usize = 0;

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
                let heading = if entry.title.is_empty() {
                    format!("Entry {}", i + 1)
                } else {
                    entry.title.clone()
                };
                output.push_str(&format!("### {}\n", heading));
            } else if !entry.title.is_empty() {
                output.push_str(&format!("**{}**\n", entry.title));
            }

            let processed_html = inline_replace_images(&entry.text, &mut image_counter);
            let text = html_to_markdown(&processed_html);
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

// --- Private image processing helpers ---

/// Scans HTML for `<img src="data:image/…;base64,…">` tags.
/// Each match is decoded, assigned a sequential filename (`image-N.ext`),
/// and replaced with `![Image N](assets/image-N.ext)`.
/// Non-data-URI `<img>` tags are dropped.
/// Returns `(processed_html, Vec<(filename, bytes)>)`.
fn extract_and_replace_with_assets(
    html: &str,
    counter: &mut usize,
) -> (String, Vec<(String, Vec<u8>)>) {
    let mut result = String::new();
    let mut assets: Vec<(String, Vec<u8>)> = Vec::new();
    let mut remaining = html;

    while let Some(img_start) = remaining.find("<img") {
        let after_name = &remaining[img_start + 4..];
        // Must be followed by whitespace, `>`, or `/` to be a real <img tag
        match after_name.chars().next() {
            Some(c) if c.is_ascii_whitespace() || c == '>' || c == '/' => {}
            _ => {
                result.push_str(&remaining[..img_start + 4]);
                remaining = after_name;
                continue;
            }
        }

        result.push_str(&remaining[..img_start]);
        remaining = &remaining[img_start..];

        match find_img_tag_end(remaining) {
            Some(end) => {
                let tag = &remaining[..end];
                remaining = &remaining[end..];

                if let Some((mime, b64_data)) = extract_src_data_uri(tag) {
                    match general_purpose::STANDARD.decode(&b64_data) {
                        Ok(bytes) => {
                            *counter += 1;
                            let ext = mime_type_to_ext(&mime);
                            let filename = format!("image-{}.{}", counter, ext);
                            result.push_str(&format!("![Image {}](assets/{})", counter, filename));
                            assets.push((filename, bytes));
                        }
                        Err(_) => {
                            // Corrupted base64 — drop the image silently
                        }
                    }
                }
                // Non-data-URI <img> tags (e.g. http://) are dropped
            }
            None => {
                // Malformed tag — emit '<' and continue
                result.push('<');
                remaining = &remaining[1..];
            }
        }
    }
    result.push_str(remaining);
    (result, assets)
}

/// Scans HTML for `<img src="data:image/…;base64,…">` tags and replaces each
/// with an inline Markdown image reference that preserves the full data URI:
/// `![Image N](data:image/TYPE;base64,DATA)`.
/// Non-data-URI `<img>` tags are dropped.
fn inline_replace_images(html: &str, counter: &mut usize) -> String {
    let mut result = String::new();
    let mut remaining = html;

    while let Some(img_start) = remaining.find("<img") {
        let after_name = &remaining[img_start + 4..];
        match after_name.chars().next() {
            Some(c) if c.is_ascii_whitespace() || c == '>' || c == '/' => {}
            _ => {
                result.push_str(&remaining[..img_start + 4]);
                remaining = after_name;
                continue;
            }
        }

        result.push_str(&remaining[..img_start]);
        remaining = &remaining[img_start..];

        match find_img_tag_end(remaining) {
            Some(end) => {
                let tag = &remaining[..end];
                remaining = &remaining[end..];

                if let Some((mime, b64_data)) = extract_src_data_uri(tag) {
                    *counter += 1;
                    let data_uri = format!("data:{};base64,{}", mime, b64_data);
                    result.push_str(&format!("![Image {}]({})", counter, data_uri));
                }
                // Non-data-URI <img> tags are dropped
            }
            None => {
                result.push('<');
                remaining = &remaining[1..];
            }
        }
    }
    result.push_str(remaining);
    result
}

/// Returns the index one past the closing `>` of an HTML tag starting at `s`,
/// respecting quoted attribute values (so `>` inside `src="a>b"` is not the end).
fn find_img_tag_end(s: &str) -> Option<usize> {
    let mut in_quote = false;
    let mut quote_char = '"';

    for (i, ch) in s.char_indices() {
        match ch {
            '"' | '\'' if !in_quote => {
                in_quote = true;
                quote_char = ch;
            }
            c if in_quote && c == quote_char => {
                in_quote = false;
            }
            '>' if !in_quote => return Some(i + 1),
            _ => {}
        }
    }
    None
}

/// Extracts `(mime_type, base64_data)` from an `<img>` tag whose `src` attribute
/// holds a `data:image/TYPE;base64,DATA` URI. Handles both `"` and `'` quoting.
/// Returns `None` for non-data-URI src values.
fn extract_src_data_uri(tag: &str) -> Option<(String, String)> {
    for &quote in &['"', '\''] {
        let pattern = format!("src={}data:image/", quote);
        if let Some(pos) = tag.find(&pattern) {
            let after = &tag[pos + pattern.len()..];
            // after: "jpeg;base64,DATA..."
            let semi = after.find(';')?;
            let mime_subtype = &after[..semi];
            let rest = &after[semi + 1..];
            // rest: "base64,DATA..."
            let b64_start = rest.strip_prefix("base64,")?;
            let q_end = b64_start.find(quote)?;
            let b64_data = &b64_start[..q_end];
            return Some((format!("image/{}", mime_subtype), b64_data.to_string()));
        }
    }
    None
}

/// Maps a MIME type to a file extension for exported image assets.
fn mime_type_to_ext(mime: &str) -> &'static str {
    match mime {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/bmp" => "bmp",
        "image/svg+xml" => "svg",
        _ => "bin",
    }
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
    fn test_html_to_markdown_highlight_stripped() {
        let html = "<p>This is <mark>highlighted</mark> text.</p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "This is highlighted text.");
    }

    #[test]
    fn test_html_to_markdown_highlight_with_bold() {
        let html = "<p><mark><strong>bold highlight</strong></mark></p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "**bold highlight**");
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

    // --- Image extraction tests ---

    // Minimal valid 1×1 white PNG encoded as base64 (67 bytes)
    const TINY_PNG_B64: &str =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==";

    fn tiny_png_img_tag() -> String {
        format!(
            r#"<img src="data:image/png;base64,{}" alt="">"#,
            TINY_PNG_B64
        )
    }

    #[test]
    fn test_extract_src_data_uri_jpeg() {
        let tag = r#"<img src="data:image/jpeg;base64,/9j/AAAA" alt="">"#;
        let result = extract_src_data_uri(tag);
        assert!(result.is_some(), "expected Some for jpeg data URI");
        let (mime, data) = result.unwrap();
        assert_eq!(mime, "image/jpeg");
        assert_eq!(data, "/9j/AAAA");
    }

    #[test]
    fn test_extract_src_data_uri_single_quote() {
        let tag = "<img src='data:image/png;base64,iVBOR' alt=''>";
        let result = extract_src_data_uri(tag);
        assert!(result.is_some(), "expected Some for single-quoted data URI");
        let (mime, data) = result.unwrap();
        assert_eq!(mime, "image/png");
        assert_eq!(data, "iVBOR");
    }

    #[test]
    fn test_extract_src_data_uri_non_data_uri() {
        let tag = r#"<img src="https://example.com/img.png" alt="">"#;
        assert!(extract_src_data_uri(tag).is_none());
    }

    #[test]
    fn test_find_img_tag_end_basic() {
        let s = r#"<img src="x" alt="y">"#;
        assert_eq!(find_img_tag_end(s), Some(s.len()));
    }

    #[test]
    fn test_find_img_tag_end_quoted_gt() {
        // `>` inside a quoted attribute must not end the tag
        let s = r#"<img src="a>b" alt="">"#;
        assert_eq!(find_img_tag_end(s), Some(s.len()));
    }

    #[test]
    fn test_mime_type_to_ext_variants() {
        assert_eq!(mime_type_to_ext("image/jpeg"), "jpg");
        assert_eq!(mime_type_to_ext("image/png"), "png");
        assert_eq!(mime_type_to_ext("image/gif"), "gif");
        assert_eq!(mime_type_to_ext("image/webp"), "webp");
        assert_eq!(mime_type_to_ext("image/bmp"), "bmp");
        assert_eq!(mime_type_to_ext("image/svg+xml"), "svg");
        assert_eq!(mime_type_to_ext("image/unknown"), "bin");
    }

    #[test]
    fn test_extract_assets_no_images() {
        let html = "<p>Just text</p>";
        let (processed, assets) = extract_and_replace_with_assets(html, &mut 0);
        assert_eq!(processed, html);
        assert!(assets.is_empty());
    }

    #[test]
    fn test_extract_assets_single_png() {
        let img_tag = tiny_png_img_tag();
        let html = format!("<p>Before</p>{}<p>After</p>", img_tag);
        let mut counter = 0usize;
        let (processed, assets) = extract_and_replace_with_assets(&html, &mut counter);

        assert_eq!(counter, 1);
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].0, "image-1.png");
        assert!(!assets[0].1.is_empty(), "decoded bytes should not be empty");
        assert!(
            processed.contains("![Image 1](assets/image-1.png)"),
            "expected markdown ref in: {}",
            processed
        );
        assert!(processed.contains("Before"));
        assert!(processed.contains("After"));
    }

    #[test]
    fn test_extract_assets_multiple_sequential() {
        let img_tag = tiny_png_img_tag();
        let html = format!("{}{}", img_tag, img_tag);
        let mut counter = 0usize;
        let (processed, assets) = extract_and_replace_with_assets(&html, &mut counter);

        assert_eq!(counter, 2);
        assert_eq!(assets.len(), 2);
        assert_eq!(assets[0].0, "image-1.png");
        assert_eq!(assets[1].0, "image-2.png");
        assert!(processed.contains("![Image 1](assets/image-1.png)"));
        assert!(processed.contains("![Image 2](assets/image-2.png)"));
    }

    #[test]
    fn test_extract_assets_counter_continues_across_entries() {
        // Simulates two entries each with one image; counter carries over
        let img_tag = tiny_png_img_tag();
        let mut counter = 0usize;

        let (_, assets1) = extract_and_replace_with_assets(&img_tag, &mut counter);
        let (processed2, assets2) = extract_and_replace_with_assets(&img_tag, &mut counter);

        assert_eq!(counter, 2);
        assert_eq!(assets1[0].0, "image-1.png");
        assert_eq!(assets2[0].0, "image-2.png");
        assert!(processed2.contains("![Image 2](assets/image-2.png)"));
    }

    #[test]
    fn test_export_entries_with_assets() {
        let img_tag = tiny_png_img_tag();
        let entries = vec![create_test_entry(
            "2024-01-15",
            "My Entry",
            &format!("<p>Hello</p>{}", img_tag),
        )];
        let (markdown, assets) = export_entries_to_markdown_with_assets(entries);

        assert!(markdown.contains("## 2024-01-15"));
        assert!(markdown.contains("![Image 1](assets/image-1.png)"));
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].0, "image-1.png");
    }

    #[test]
    fn test_export_entries_with_assets_no_images() {
        let entries = vec![create_test_entry("2024-01-15", "Entry", "<p>Text only</p>")];
        let (markdown, assets) = export_entries_to_markdown_with_assets(entries);

        assert!(markdown.contains("Text only"));
        assert!(assets.is_empty());
    }

    #[test]
    fn test_inline_replace_images_embeds_data_uri() {
        let img_tag = tiny_png_img_tag();
        let html = format!("<p>Before</p>{}<p>After</p>", img_tag);
        let mut counter = 0usize;
        let processed = inline_replace_images(&html, &mut counter);

        assert_eq!(counter, 1);
        assert!(
            processed.contains(&format!(
                "![Image 1](data:image/png;base64,{})",
                TINY_PNG_B64
            )),
            "expected inline data URI ref in: {}",
            processed
        );
        assert!(processed.contains("Before"));
        assert!(processed.contains("After"));
    }

    #[test]
    fn test_inline_replace_images_no_images() {
        let html = "<p>No images here</p>";
        let mut counter = 0usize;
        let processed = inline_replace_images(html, &mut counter);
        assert_eq!(processed, html);
        assert_eq!(counter, 0);
    }

    #[test]
    fn test_export_entries_inline_embeds_data_uri() {
        let img_tag = tiny_png_img_tag();
        let entries = vec![create_test_entry(
            "2024-01-15",
            "",
            &format!("<p>Hi</p>{}", img_tag),
        )];
        let markdown = export_entries_to_markdown_inline(entries);

        assert!(markdown.contains("## 2024-01-15"));
        assert!(
            markdown.contains(&format!(
                "![Image 1](data:image/png;base64,{})",
                TINY_PNG_B64
            )),
            "expected inline data URI in: {}",
            markdown
        );
    }

    #[test]
    fn test_export_entries_inline_no_images() {
        let entries = vec![create_test_entry("2024-01-15", "T", "<p>Text</p>")];
        let markdown = export_entries_to_markdown_inline(entries);
        assert!(markdown.contains("Text"));
        // no data: URI in output
        assert!(!markdown.contains("data:"));
    }
}
