//! HTML → Markdown conversion pipeline.
//!
//! Owns the stage tables and the top-level [`html_to_markdown`] driver, plus the
//! two low-level scanners (`strip_remaining_tags`, `find_tag_end`) shared with
//! the sibling `blocks`, `links`, and `assets` modules.

use super::blocks::{number_ordered_lists, process_blockquotes, process_code_blocks};
use super::links::process_links;

// Replacement tables for `html_to_markdown`.
//
// Each table runs at a specific point in the conversion pipeline; the order of
// the stages matters (see `html_to_markdown`), but within a stage the individual
// tag → markdown mappings are independent and their listing order does not
// affect the output. Extending a table with a new synonym (e.g. `<mark>`) is a
// one-line change with no copy-paste risk of getting the replacement wrong.

/// Stage 1: line breaks. Runs before heading processing so `<br>` inside a
/// heading becomes a real newline.
const BR_REPLACEMENTS: &[(&str, &str)] = &[("<br>", "\n"), ("<br/>", "\n"), ("<br />", "\n")];

/// Stage 3: inline formatting (bold, italic, strikethrough). Runs after
/// heading processing and before `process_code_blocks`, which protects
/// `<code>` inside `<pre>` from being consumed here.
const INLINE_FORMATTING: &[(&str, &str)] = &[
    ("<strong>", "**"),
    ("</strong>", "**"),
    ("<b>", "**"),
    ("</b>", "**"),
    ("<em>", "*"),
    ("</em>", "*"),
    ("<i>", "*"),
    ("</i>", "*"),
    ("<s>", "~~"),
    ("</s>", "~~"),
    ("<del>", "~~"),
    ("</del>", "~~"),
    ("<strike>", "~~"),
    ("</strike>", "~~"),
];

/// Stage 5: inline code. Runs after `process_code_blocks` so any `<code>`
/// inside `<pre>` has already been stripped.
const INLINE_CODE: &[(&str, &str)] = &[("<code>", "`"), ("</code>", "`")];

/// Stage 7: horizontal rules. Ordering relative to ordered/unordered lists
/// does not matter; placed here to mirror the pipeline the tests expect.
const HR_REPLACEMENTS: &[(&str, &str)] = &[
    ("<hr>", "\n---\n"),
    ("<hr/>", "\n---\n"),
    ("<hr />", "\n---\n"),
];

/// Stage 9: residual block tags (unordered list wrappers, unordered list
/// items, paragraphs). Runs after `number_ordered_lists` so `<li>` items
/// inside `<ol>` have already been converted to numbered markdown.
const BLOCK_TAGS: &[(&str, &str)] = &[
    ("<ul>", "\n"),
    ("</ul>", "\n"),
    ("<li>", "- "),
    ("</li>", "\n"),
    ("<p>", ""),
    ("</p>", "\n\n"),
];

/// Stage 11: HTML entity decoding. Runs after `strip_remaining_tags` so tags
/// containing `&` attributes have already been removed.
pub(super) const HTML_ENTITIES: &[(&str, &str)] = &[
    ("&amp;", "&"),
    ("&lt;", "<"),
    ("&gt;", ">"),
    ("&quot;", "\""),
    ("&#39;", "'"),
    ("&nbsp;", " "),
];

pub(super) fn apply_replacements(mut s: String, table: &[(&str, &str)]) -> String {
    for &(pat, rep) in table {
        s = s.replace(pat, rep);
    }
    s
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

    // 1. Line breaks — must run before heading processing
    result = apply_replacements(result, BR_REPLACEMENTS);

    // 2. Headings (offset by 2 to avoid clashing with # and ## used for doc/entry).
    // Level-dependent formatting keeps this as a loop rather than a static table.
    for level in 1..=6 {
        let hashes = "#".repeat((level + 2).min(6));
        let open = format!("<h{}>", level);
        let close = format!("</h{}>", level);
        result = result.replace(&open, &format!("\n{} ", hashes));
        result = result.replace(&close, "\n");
    }

    // 3. Inline formatting: bold, italic, strikethrough
    result = apply_replacements(result, INLINE_FORMATTING);

    // 4. Fenced code blocks — must run before inline `<code>` replacement
    result = process_code_blocks(&result);

    // 5. Inline code
    result = apply_replacements(result, INLINE_CODE);

    // 6. Blockquotes — must run before `<p>` replacement
    result = process_blockquotes(&result);

    // 7. Horizontal rules
    result = apply_replacements(result, HR_REPLACEMENTS);

    // 8. Ordered lists with proper numbering — must run before `<li>` replacement
    result = number_ordered_lists(&result);

    // 9. Unordered list wrappers, list items, paragraphs
    result = apply_replacements(result, BLOCK_TAGS);

    // 9.5. Links — emit `[label](url)` for `<a href="...">label</a>`.
    // Must run after stages 1-9 so inline formatting inside the label is already
    // converted (e.g. `<strong>` → `**`) and `<p>` wrappers around the link are
    // stripped. Must run BEFORE strip_remaining_tags so the `<a>` tag is still
    // parseable. Entity decoding is applied inside process_links itself rather
    // than relying on stage 11.
    result = process_links(&result);

    // 10. Strip any remaining HTML tags (handles <u>, <a>, etc.)
    result = strip_remaining_tags(&result);

    // 11. Decode common HTML entities
    result = apply_replacements(result, HTML_ENTITIES);

    // 12. Clean up excessive blank lines (3+ newlines → 2)
    while result.contains("\n\n\n") {
        result = result.replace("\n\n\n", "\n\n");
    }

    // 13. Trim trailing whitespace
    result.trim().to_string()
}

/// Returns the index one past the closing `>` of an HTML tag starting at `s`,
/// respecting quoted attribute values (so `>` inside `src="a>b"` is not the end).
///
/// Shared by the `<a ...>` open-tag parser in `links` and the `<img ...>` parser
/// in `assets` — both need the same quote-aware scan.
pub(super) fn find_tag_end(s: &str) -> Option<usize> {
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

/// Strips any remaining HTML tags from the string.
///
/// A `>` character that is NOT closing an open `<` tag (e.g. the Markdown
/// blockquote prefix `> `) is preserved so blockquote lines are not mangled.
pub(super) fn strip_remaining_tags(input: &str) -> String {
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

    // --- Adjacent delimiter tests ---
    //
    // INLINE_FORMATTING/INLINE_CODE replace each tag independently, so two
    // different marks with no whitespace between them (e.g.
    // `<strong>A</strong><em>B</em>`) can produce delimiter runs that look
    // ambiguous to a human (e.g. `**A***B*`, three asterisks in a row). Each
    // case below was verified against `marked` (the project's installed
    // CommonMark/GFM parser, also used elsewhere in the codebase) to confirm
    // the literal output round-trips to the intended two marks with no
    // bleed-through; no code fix was needed.

    #[test]
    fn test_html_to_markdown_adjacent_bold_italic() {
        let html = "<strong>A</strong><em>B</em>";
        let result = html_to_markdown(html);
        assert_eq!(result, "**A***B*");
    }

    #[test]
    fn test_html_to_markdown_adjacent_code_strike() {
        let html = "<code>A</code><s>B</s>";
        let result = html_to_markdown(html);
        assert_eq!(result, "`A`~~B~~");
    }

    #[test]
    fn test_html_to_markdown_adjacent_bold_code() {
        let html = "<strong>A</strong><code>B</code>";
        let result = html_to_markdown(html);
        assert_eq!(result, "**A**`B`");
    }

    #[test]
    fn test_html_to_markdown_adjacent_strike_bold() {
        let html = "<s>A</s><strong>B</strong>";
        let result = html_to_markdown(html);
        assert_eq!(result, "~~A~~**B**");
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
    fn test_html_to_markdown_strips_font_style_spans() {
        // Font-family and font-size inline marks (added by Tiptap FontFamily/FontSize
        // extensions) must be stripped from Markdown output — text is preserved.
        let html = r#"<p><span style="font-family: Merriweather">Hello</span> <span style="font-size: 18px">world</span></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "Hello world");
    }

    #[test]
    fn test_html_to_markdown_mixed_inline_and_font() {
        // Bold marks inside font-styled spans must survive
        let html = r#"<p><span style="font-family: Georgia"><strong>bold text</strong></span></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "**bold text**");
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
    fn test_html_to_markdown_inline_code() {
        let html = "<p>Use <code>println!()</code> to print</p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "Use `println!()` to print");
    }

    #[test]
    fn test_html_to_markdown_highlight_stripped() {
        let html = "<p>This is <mark>highlighted</mark> text.</p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "This is highlighted text.");
    }

    #[test]
    fn test_html_to_markdown_underline_stripped() {
        // No native Markdown underline — tag is dropped, text is kept (see
        // html_to_markdown doc comment).
        let html = "<p>This is <u>underlined</u> text.</p>";
        let result = html_to_markdown(html);
        assert_eq!(result, "This is underlined text.");
    }

    #[test]
    fn test_html_to_markdown_color_span_stripped() {
        // TipTap Color/TextStyle marks render as `<span style="color: ...">` —
        // no Markdown equivalent, tag stripped, text kept.
        let html = r#"<p><span style="color: #ff0000">red text</span></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "red text");
    }

    #[test]
    fn test_html_to_markdown_timestamp_mark_stripped() {
        // Custom TimestampMark renders as `<span class="timestamp">` with no
        // attributes — the display text carries all the information, so the
        // span should strip cleanly with correct surrounding spacing.
        let html = r#"<p>Woke up at <span class="timestamp">10:30 AM</span> today.</p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "Woke up at 10:30 AM today.");
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

    #[test]
    fn test_find_img_tag_end_basic() {
        let s = r#"<img src="x" alt="y">"#;
        assert_eq!(find_tag_end(s), Some(s.len()));
    }

    #[test]
    fn test_find_img_tag_end_quoted_gt() {
        // `>` inside a quoted attribute must not end the tag
        let s = r#"<img src="a>b" alt="">"#;
        assert_eq!(find_tag_end(s), Some(s.len()));
    }
}
