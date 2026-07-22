//! Block-level HTML constructs: ordered lists, fenced code blocks, blockquotes.
//!
//! Each helper is a stage of the [`super::convert::html_to_markdown`] pipeline and
//! must run at the point documented there.

use super::convert::strip_remaining_tags;
use super::links::process_links;

/// Converts `<ol>...</ol>` regions to numbered markdown list items.
///
/// Each `<li>content</li>` within an ordered list becomes `\n{n}. content`
/// where n is a per-list counter starting at 1.  Unordered `<ul>` items are
/// left for the existing `<li>` → `- ` replacement to handle.
pub(super) fn number_ordered_lists(input: &str) -> String {
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
pub(super) fn process_code_blocks(input: &str) -> String {
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
pub(super) fn process_blockquotes(input: &str) -> String {
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
                // Convert links to markdown first so they survive the strip_remaining_tags
                // pass below (otherwise `<a>` tags would be silently stripped here).
                let with_links = process_links(&segment.replace("<p>", ""));
                let text = strip_remaining_tags(&with_links);
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

#[cfg(test)]
mod tests {
    use crate::export::markdown::html_to_markdown;

    #[test]
    fn test_html_to_markdown_list() {
        let html = "<ul><li>Item one</li><li>Item two</li></ul>";
        let result = html_to_markdown(html);
        assert!(result.contains("- Item one"));
        assert!(result.contains("- Item two"));
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
}
