//! Inline attachment references in entry HTML.
//!
//! The editor's `attachmentRef` node serializes as `<span data-attachment-ref="N"></span>`:
//! an id-only pointer to an attachment linked to the same entry. Exporters replace these
//! spans with something readable (the HTML→Markdown converter would otherwise drop them),
//! and per-entry restore rewrites their ids from snapshot ids to live ids.

const ATTR: &str = "data-attachment-ref=\"";

/// Parses the attachment id out of one `<span …>` opening tag, if it is a ref span.
fn ref_id_in_tag(tag: &str) -> Option<i64> {
    let start = tag.find(ATTR)? + ATTR.len();
    let end = tag[start..].find('"')? + start;
    tag[start..end].trim().parse().ok()
}

/// Replaces every attachment-ref span in `html` with `replace(id)`.
///
/// A ref span is `<span … data-attachment-ref="N" …>` up to and including its closing
/// `</span>` (the node is an atom, so it has no nested spans). Other spans are left alone.
pub(crate) fn rewrite_attachment_refs<F>(html: &str, mut replace: F) -> String
where
    F: FnMut(i64) -> String,
{
    if !html.contains(ATTR) {
        return html.to_string();
    }

    let mut out = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(pos) = rest.find("<span") {
        out.push_str(&rest[..pos]);
        let candidate = &rest[pos..];
        let Some(tag_end) = candidate.find('>') else {
            break;
        };
        let tag = &candidate[..=tag_end];
        match ref_id_in_tag(tag) {
            Some(id) => {
                let after_tag = &candidate[tag_end + 1..];
                let close = after_tag.find("</span>").map(|i| i + "</span>".len());
                out.push_str(&replace(id));
                rest = match close {
                    Some(len) => &after_tag[len..],
                    None => after_tag,
                };
            }
            None => {
                out.push_str(tag);
                rest = &candidate[tag_end + 1..];
            }
        }
    }
    out.push_str(rest);
    out
}

/// Serializes one ref span exactly as the editor does.
pub(crate) fn attachment_ref_span(id: i64) -> String {
    format!("<span data-attachment-ref=\"{}\"></span>", id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rewrite_replaces_ref_spans_and_keeps_other_spans() {
        let html = r#"<p>See <span data-attachment-ref="7"></span> and <span class="timestamp">10:30</span><span data-attachment-ref="9"></span>.</p>"#;
        let out = rewrite_attachment_refs(html, |id| format!("[{}]", id));
        assert_eq!(
            out,
            r#"<p>See [7] and <span class="timestamp">10:30</span>[9].</p>"#
        );
    }

    #[test]
    fn test_rewrite_handles_extra_attributes_and_no_refs() {
        let html = r#"<p><span class="attachment-ref" data-attachment-ref="3" contenteditable="false"></span></p>"#;
        assert_eq!(rewrite_attachment_refs(html, |_| "X".into()), "<p>X</p>");
        assert_eq!(
            rewrite_attachment_refs("<p>plain</p>", |_| "X".into()),
            "<p>plain</p>"
        );
    }

    #[test]
    fn test_rewrite_can_remap_ids() {
        let html = format!("<p>{}</p>", attachment_ref_span(1));
        let out = rewrite_attachment_refs(&html, |id| attachment_ref_span(id + 10));
        assert_eq!(out, format!("<p>{}</p>", attachment_ref_span(11)));
    }

    #[test]
    fn test_rewrite_leaves_malformed_ref_untouched() {
        let html = r#"<p><span data-attachment-ref="abc"></span></p>"#;
        assert_eq!(rewrite_attachment_refs(html, |_| "X".into()), html);
    }
}
