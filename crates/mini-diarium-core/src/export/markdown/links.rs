//! `<a href="...">` → `[label](url)` conversion.

use super::convert::{apply_replacements, find_tag_end, HTML_ENTITIES};

/// Converts `<a href="URL">LABEL</a>` regions to `[LABEL](URL)` Markdown.
///
/// Runs after stages 1-9 in `html_to_markdown` so the LABEL has already had
/// inline formatting converted to Markdown syntax (`**bold**`, `*italic*`,
/// `` `code` `` etc.). Runs before `strip_remaining_tags` so the `<a>` tag is
/// still present.
///
/// Behavior:
/// - `<a href="https://example.com">Visit</a>` -> `[Visit](https://example.com)`
/// - Empty label: the entire link is dropped.
/// - Missing href: the label is kept as plain text.
/// - Characters that CommonMark cannot place inside the bare `(url)` form
///   (space, `(`, `)`, `<`, `>`) are percent-encoded so the output is valid
///   markdown without using the angle-bracket wrap form (which would collide
///   with `strip_remaining_tags`).
/// - HTML entities in URL and LABEL are decoded via the same table used by
///   stage 11 so entity decoding is consistent.
pub(super) fn process_links(input: &str) -> String {
    let mut result = String::new();
    let mut remaining = input;

    while let Some(a_start) = remaining.find("<a ") {
        result.push_str(&remaining[..a_start]);
        remaining = &remaining[a_start..];

        // Find the end of the opening tag, respecting quoted attribute values.
        let Some(open_end) = find_tag_end(remaining) else {
            // Malformed open tag — emit '<' and continue past it.
            result.push('<');
            remaining = &remaining[1..];
            continue;
        };

        let open_tag = &remaining[..open_end];
        let href = extract_href_attr(open_tag);
        let after_open = &remaining[open_end..];

        // Find the matching </a>. If absent, drop the tag and continue.
        let Some(close_rel) = after_open.find("</a>") else {
            // No closing tag — drop the open tag and continue past it.
            remaining = after_open;
            continue;
        };

        let label = &after_open[..close_rel];
        remaining = &after_open[close_rel + 4..]; // skip "</a>"

        let trimmed_label = label.trim_end();
        let decoded_label = apply_replacements(trimmed_label.to_string(), HTML_ENTITIES);

        match href {
            Some(raw_href) if !raw_href.is_empty() => {
                let decoded_href = apply_replacements(raw_href, HTML_ENTITIES);
                if decoded_label.is_empty() {
                    // No label → drop the link entirely; emit nothing.
                    continue;
                }
                let escaped_href = encode_url_for_markdown(&decoded_href);
                result.push_str(&format!("[{}]({})", decoded_label, escaped_href));
            }
            _ => {
                // No href or empty href → keep the label as plain text.
                result.push_str(&decoded_label);
            }
        }
    }
    result.push_str(remaining);
    result
}

/// Percent-encodes the characters that cannot appear inside a bare `(url)` form
/// in CommonMark (space, `(`, `)`, `<`, `>`). Already-encoded sequences (`%XX`)
/// are preserved unchanged.
fn encode_url_for_markdown(url: &str) -> String {
    let mut out = String::with_capacity(url.len());
    for ch in url.chars() {
        match ch {
            ' ' => out.push_str("%20"),
            '(' => out.push_str("%28"),
            ')' => out.push_str("%29"),
            '<' => out.push_str("%3C"),
            '>' => out.push_str("%3E"),
            other => out.push(other),
        }
    }
    out
}

/// Extracts the `href` attribute value from an `<a ...>` open tag. Supports
/// both `"` and `'` quoting. Returns `None` if the attribute is missing.
fn extract_href_attr(open_tag: &str) -> Option<String> {
    for &quote in &['"', '\''] {
        let pattern = format!("href={}", quote);
        if let Some(pos) = open_tag.find(&pattern) {
            let after = &open_tag[pos + pattern.len()..];
            let end = after.find(quote)?;
            return Some(after[..end].to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use crate::export::markdown::html_to_markdown;

    #[test]
    fn test_html_to_markdown_link_basic() {
        let html = r#"<p>See <a href="https://example.com">Visit site</a> please</p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "See [Visit site](https://example.com) please");
    }

    #[test]
    fn test_html_to_markdown_link_with_formatting() {
        let html = r#"<p><a href="https://example.com"><strong>bold</strong> label</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[**bold** label](https://example.com)");
    }

    #[test]
    fn test_html_to_markdown_link_with_fully_bold_label() {
        // Whole-label bold (distinct from a partially-bold label, already
        // covered by test_html_to_markdown_link_with_formatting): the <a> tag
        // must still be parsed correctly with no stray characters from the
        // nested <strong>.
        let html = r#"<p><a href="https://example.com"><strong>Label</strong></a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[**Label**](https://example.com)");
    }

    #[test]
    fn test_html_to_markdown_link_with_italic_in_label() {
        let html = r#"<p><a href="https://example.com">a <em>fancy</em> link</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[a *fancy* link](https://example.com)");
    }

    #[test]
    fn test_html_to_markdown_link_with_inline_code_in_label() {
        let html = r#"<p><a href="https://example.com">use <code>println!</code></a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[use `println!`](https://example.com)");
    }

    #[test]
    fn test_html_to_markdown_link_in_heading() {
        let html = r#"<h2>See <a href="https://example.com">docs</a> here</h2>"#;
        let result = html_to_markdown(html);
        assert!(
            result.contains("[docs](https://example.com)"),
            "expected link in heading: {}",
            result
        );
        assert!(
            result.contains("#### "),
            "expected heading prefix in: {}",
            result
        );
    }

    #[test]
    fn test_html_to_markdown_link_in_list() {
        let html = r#"<ul><li>See <a href="https://example.com">docs</a></li><li>And <a href="https://other.com">more</a></li></ul>"#;
        let result = html_to_markdown(html);
        assert!(
            result.contains("- See [docs](https://example.com)"),
            "expected first link in list: {}",
            result
        );
        assert!(
            result.contains("- And [more](https://other.com)"),
            "expected second link in list: {}",
            result
        );
    }

    #[test]
    fn test_html_to_markdown_link_in_blockquote() {
        let html =
            r#"<blockquote><p>See <a href="https://example.com">docs</a> please</p></blockquote>"#;
        let result = html_to_markdown(html);
        assert!(
            result.contains("> See [docs](https://example.com) please"),
            "expected link inside blockquote prefix: {}",
            result
        );
    }

    #[test]
    fn test_html_to_markdown_link_with_special_chars_in_url() {
        // Pre-encoded query string survives unchanged
        let html = r#"<p><a href="https://example.com/?q=hello%20world">search</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[search](https://example.com/?q=hello%20world)");
    }

    #[test]
    fn test_html_to_markdown_link_with_space_in_url_percent_encodes() {
        // CommonMark cannot place a literal space inside (...), so we percent-encode it.
        let html = r#"<p><a href="https://example.com/a b">spaced</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[spaced](https://example.com/a%20b)");
    }

    #[test]
    fn test_html_to_markdown_link_without_href() {
        // Missing href -> the link is dropped, label text is kept
        let html = r#"<p><a>some text</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "some text");
    }

    #[test]
    fn test_html_to_markdown_link_with_empty_label() {
        // Empty label -> the link is dropped entirely
        let html = r#"<p>Before <a href="https://example.com"></a> after</p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "Before  after");
    }

    #[test]
    fn test_html_to_markdown_link_with_attributes() {
        // TipTap typically emits rel/target/class — must not break parsing
        let html = r#"<p><a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">label</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[label](https://example.com)");
    }

    #[test]
    fn test_html_to_markdown_link_single_quoted_href() {
        let html = r#"<p><a href='https://example.com'>label</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[label](https://example.com)");
    }

    #[test]
    fn test_html_to_markdown_link_mailto() {
        let html = r#"<p>Email <a href="mailto:user@example.com">me</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "Email [me](mailto:user@example.com)");
    }

    #[test]
    fn test_html_to_markdown_link_with_entity_in_url() {
        // `&amp;` inside the href is decoded to `&`
        let html = r#"<p><a href="https://example.com/?a=1&amp;b=2">link</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[link](https://example.com/?a=1&b=2)");
    }

    #[test]
    fn test_html_to_markdown_link_with_cjk_label() {
        // Non-ASCII label (CJK) — per the project's durability rule
        let html = r#"<p><a href="https://example.com">中文链接</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[中文链接](https://example.com)");
    }

    #[test]
    fn test_html_to_markdown_link_with_rtl_label() {
        // Non-ASCII label (Arabic, RTL) — per the project's durability rule
        let html = r#"<p><a href="https://example.com">رابط</a></p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "[رابط](https://example.com)");
    }

    #[test]
    fn test_html_to_markdown_multiple_links_in_paragraph() {
        let html = r#"<p>See <a href="https://a.com">A</a> and <a href="https://b.com">B</a>.</p>"#;
        let result = html_to_markdown(html);
        assert_eq!(result, "See [A](https://a.com) and [B](https://b.com).");
    }

    #[test]
    fn test_html_to_markdown_link_does_not_match_aside() {
        // <aside> starts with "<a" but our parser requires "<a " (space) so it
        // must not be mis-parsed as a link.
        let html = r#"<p>Hello</p><aside>note</aside>"#;
        let result = html_to_markdown(html);
        assert!(result.contains("Hello"), "expected paragraph text");
        assert!(
            result.contains("note"),
            "expected aside text to survive strip"
        );
    }
}
