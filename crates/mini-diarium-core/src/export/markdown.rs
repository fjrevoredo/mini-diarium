use crate::db::queries::DiaryEntry;
use base64::{engine::general_purpose, Engine as _};
use std::collections::HashMap;

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
///
/// Image-free plain-Markdown export. Production paths use
/// [`export_entries_to_markdown_with_assets`] / [`export_entries_to_markdown_inline`]
/// (which handle embedded images); this simpler form is retained as a unit-test entry
/// point for the shared `html_to_markdown` conversion, hence `#[cfg(test)]`.
#[cfg(test)]
fn export_entries_to_markdown(
    entries: Vec<DiaryEntry>,
    tags: &HashMap<i64, Vec<String>>,
) -> String {
    walk_date_groups(&entries, tags, |entry| html_to_markdown(&entry.text))
}

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
const HTML_ENTITIES: &[(&str, &str)] = &[
    ("&amp;", "&"),
    ("&lt;", "<"),
    ("&gt;", ">"),
    ("&quot;", "\""),
    ("&#39;", "'"),
    ("&nbsp;", " "),
];

fn apply_replacements(mut s: String, table: &[(&str, &str)]) -> String {
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
fn process_links(input: &str) -> String {
    let mut result = String::new();
    let mut remaining = input;

    while let Some(a_start) = remaining.find("<a ") {
        result.push_str(&remaining[..a_start]);
        remaining = &remaining[a_start..];

        // Find the end of the opening tag, respecting quoted attribute values.
        let Some(open_end) = find_attr_aware_tag_end(remaining) else {
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

/// Returns the index one past the closing `>` of an HTML tag starting at `s`,
/// respecting quoted attribute values. Shared helper for `<a ...>` open tags
/// (and any other tag whose attribute values may legitimately contain `>`).
fn find_attr_aware_tag_end(s: &str) -> Option<usize> {
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

// --- Shared walker ---

fn group_entries_by_date(entries: &[DiaryEntry]) -> Vec<(&str, Vec<&DiaryEntry>)> {
    let mut date_groups: Vec<(&str, Vec<&DiaryEntry>)> = Vec::new();
    for entry in entries {
        if let Some((last_date, group)) = date_groups.last_mut() {
            if *last_date == entry.date.as_str() {
                group.push(entry);
                continue;
            }
        }
        date_groups.push((entry.date.as_str(), vec![entry]));
    }
    date_groups
}

fn walk_date_groups<F>(
    entries: &[DiaryEntry],
    tags: &HashMap<i64, Vec<String>>,
    mut render_entry_text: F,
) -> String
where
    F: FnMut(&DiaryEntry) -> String,
{
    let mut output = String::from("# Mini Diarium\n");
    for (date, group) in group_entries_by_date(entries) {
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
            let entry_tags = tags.get(&entry.id).map(|t| t.as_slice()).unwrap_or(&[]);
            if !entry_tags.is_empty() {
                output.push_str(&format!("*Tags: {}*\n", entry_tags.join(", ")));
            }
            let text = render_entry_text(entry);
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

// --- Image-aware export variants ---

/// Exports diary entries to Markdown, extracting embedded base64 images to
/// separate asset files.
///
/// Returns `(markdown_string, assets)` where `assets` is a list of
/// `(filename, bytes)` pairs to be written to a sibling `assets/` directory.
/// Image references in the markdown use `![Image N](assets/image-N.ext)`.
pub fn export_entries_to_markdown_with_assets(
    entries: Vec<DiaryEntry>,
    tags: &HashMap<i64, Vec<String>>,
) -> (String, Vec<(String, Vec<u8>)>) {
    let mut all_assets: Vec<(String, Vec<u8>)> = Vec::new();
    let mut image_counter: usize = 0;
    let markdown = walk_date_groups(&entries, tags, |entry| {
        let (processed_html, entry_assets) =
            extract_and_replace_with_assets(&entry.text, &mut image_counter);
        all_assets.extend(entry_assets);
        html_to_markdown(&processed_html)
    });
    (markdown, all_assets)
}

/// Exports diary entries to Markdown, embedding base64 images as inline data URIs.
///
/// Each `<img src="data:image/TYPE;base64,DATA">` becomes
/// `![Image N](data:image/TYPE;base64,DATA)` — readable by editors that support
/// embedded data URIs (e.g. Obsidian, VS Code preview). Produces a single file
/// with no external assets.
pub fn export_entries_to_markdown_inline(
    entries: Vec<DiaryEntry>,
    tags: &HashMap<i64, Vec<String>>,
) -> String {
    let mut image_counter: usize = 0;
    walk_date_groups(&entries, tags, |entry| {
        let processed_html = inline_replace_images(&entry.text, &mut image_counter);
        html_to_markdown(&processed_html)
    })
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
            metadata: None,
            locked: false,
        }
    }

    fn entry_with_id(id: i64, date: &str, title: &str, text: &str) -> DiaryEntry {
        DiaryEntry {
            id,
            ..create_test_entry(date, title, text)
        }
    }

    fn empty_tags() -> HashMap<i64, Vec<String>> {
        HashMap::new()
    }

    #[test]
    fn test_export_empty_list() {
        let result = export_entries_to_markdown(vec![], &empty_tags());
        assert_eq!(result, "# Mini Diarium\n");
    }

    #[test]
    fn test_export_single_entry_plaintext() {
        let entries = vec![create_test_entry("2024-01-15", "My Entry", "Hello world")];

        let result = export_entries_to_markdown(entries, &empty_tags());
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

        let result = export_entries_to_markdown(entries, &empty_tags());
        let first_pos = result.find("## 2024-01-01").unwrap();
        let second_pos = result.find("## 2024-01-02").unwrap();
        let third_pos = result.find("## 2024-01-03").unwrap();

        assert!(first_pos < second_pos);
        assert!(second_pos < third_pos);
    }

    #[test]
    fn test_export_entry_without_title() {
        let entries = vec![create_test_entry("2024-01-15", "", "Just text")];

        let result = export_entries_to_markdown(entries, &empty_tags());
        assert!(result.contains("## 2024-01-15"));
        assert!(!result.contains("****")); // No empty bold
        assert!(result.contains("Just text"));
    }

    #[test]
    fn test_export_markdown_entry_with_tags_shows_tags_line() {
        let entries = vec![entry_with_id(1, "2024-01-15", "My Entry", "<p>Content</p>")];
        let tags = HashMap::from([(1i64, vec!["travel".to_string(), "work".to_string()])]);
        let result = export_entries_to_markdown(entries, &tags);
        assert!(result.contains("*Tags: travel, work*"), "got: {}", result);
    }

    #[test]
    fn test_export_markdown_entry_without_tags_no_tags_line() {
        let entries = vec![entry_with_id(1, "2024-01-15", "My Entry", "<p>Content</p>")];
        let result = export_entries_to_markdown(entries, &empty_tags());
        assert!(!result.contains("*Tags:"), "got: {}", result);
    }

    #[test]
    fn test_export_markdown_with_assets_includes_tags() {
        let entries = vec![entry_with_id(2, "2024-01-15", "Title", "<p>Hi</p>")];
        let tags = HashMap::from([(2i64, vec!["journal".to_string()])]);
        let (markdown, _) = export_entries_to_markdown_with_assets(entries, &tags);
        assert!(markdown.contains("*Tags: journal*"), "got: {}", markdown);
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

    // --- Named link tests ---

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

    #[test]
    fn test_export_entries_markdown_with_link_round_trip() {
        let entries = vec![create_test_entry(
            "2024-01-15",
            "Title",
            r#"<p>See <a href="https://example.com">Visit site</a> please</p>"#,
        )];
        let result = export_entries_to_markdown(entries, &empty_tags());
        assert!(
            result.contains("[Visit site](https://example.com)"),
            "expected link in exported markdown: {}",
            result
        );
        assert!(result.contains("**Title**"), "expected entry title");
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
        let (markdown, assets) = export_entries_to_markdown_with_assets(entries, &empty_tags());

        assert!(markdown.contains("## 2024-01-15"));
        assert!(markdown.contains("![Image 1](assets/image-1.png)"));
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].0, "image-1.png");
    }

    #[test]
    fn test_export_entries_with_assets_no_images() {
        let entries = vec![create_test_entry("2024-01-15", "Entry", "<p>Text only</p>")];
        let (markdown, assets) = export_entries_to_markdown_with_assets(entries, &empty_tags());

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
        let markdown = export_entries_to_markdown_inline(entries, &empty_tags());

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
        let markdown = export_entries_to_markdown_inline(entries, &empty_tags());
        assert!(markdown.contains("Text"));
        // no data: URI in output
        assert!(!markdown.contains("data:"));
    }
}
