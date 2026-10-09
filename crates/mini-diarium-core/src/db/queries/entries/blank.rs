//! The "entry is empty" rule: what counts as an entry with no user-visible content.
//!
//! Blank-entry cleanup (`delete_entry_if_empty` in the app) and the content check
//! (`entry_has_content`) both use these predicates, so a second façade consumer gets the same
//! rule. Hard delete (`delete_entry_by_id`) does not consult them: an explicit delete must
//! never become blank-only.

use super::get_entry_by_id;
use crate::db::queries::attachments::entry_has_attachments;
use crate::db::schema::DatabaseConnection;

/// Tag names that may appear inside a document the user considers blank — the structural
/// and inline-formatting wrappers TipTap leaves behind when a paragraph is emptied.
///
/// This is an **allowlist**, keyed on the tag name only, so attribute-bearing shells such
/// as `<p dir="ltr">` (BidiExtension) and `<p style="text-align: center">` (TextAlign)
/// still normalise to blank. Anything not named here — `<img>`, `<hr>`, `<table>`,
/// `<canvas>`, `<object>`, `<embed>`, `<svg>`, a custom element — vetoes the delete.
const BLANK_COMPATIBLE_TAGS: [&str; 27] = [
    "p",
    "br",
    "div",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "strong",
    "b",
    "em",
    "i",
    "s",
    "strike",
    "u",
    "mark",
    "a",
    "sub",
    "sup",
];

/// Returns true when an editor HTML fragment carries no user-visible content.
///
/// The editor persists an "empty" document as an HTML shell (`<p></p>`, `<p><br></p>`,
/// sometimes with `&nbsp;`), so a byte-level `trim().is_empty()` would refuse to
/// auto-delete entries the user considers blank.
///
/// **Conservative by construction**: only the tag names in `BLANK_COMPATIBLE_TAGS` can
/// appear in a fragment this function calls blank. Every unrecognised tag, comment,
/// doctype, or malformed tag returns `false` — blank-entry cleanup accepts an arbitrary IPC
/// string and import paths can introduce foreign markup, and refusing to delete a real
/// entry is the only safe direction to be wrong in. The two parser failure modes fail
/// that way too: a `>` inside a quoted attribute spills the rest of the attribute out as
/// residual text, and an unterminated tag is rejected outright.
fn is_blank_html(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return true;
    }

    let chars: Vec<char> = trimmed.chars().collect();
    let mut stripped = String::with_capacity(trimmed.len());
    let mut i = 0;
    while i < chars.len() {
        if chars[i] != '<' {
            stripped.push(chars[i]);
            i += 1;
            continue;
        }
        i += 1;
        // `<!…` — a comment or doctype. The editor never emits one for a blank document.
        if chars.get(i) == Some(&'!') {
            return false;
        }
        if chars.get(i) == Some(&'/') {
            i += 1;
        }
        let name_start = i;
        while i < chars.len() && !chars[i].is_whitespace() && chars[i] != '/' && chars[i] != '>' {
            i += 1;
        }
        let name = chars[name_start..i]
            .iter()
            .collect::<String>()
            .to_ascii_lowercase();
        if name.is_empty() || !BLANK_COMPATIBLE_TAGS.contains(&name.as_str()) {
            return false;
        }
        // Skip attributes up to the terminator. A tag that never closes is malformed;
        // consuming it silently would drop it from `stripped` and read as blank.
        while i < chars.len() && chars[i] != '>' {
            i += 1;
        }
        if i == chars.len() {
            return false;
        }
        i += 1;
    }

    // Normalise the entities the editor emits for a blank line. Lowercased so the
    // hex-entity spellings (`&#xA0;`) match too.
    stripped
        .to_ascii_lowercase()
        .replace("&nbsp;", " ")
        .replace("&#160;", " ")
        .replace("&#xa0;", " ")
        .replace('\u{a0}', " ")
        .trim()
        .is_empty()
}

/// Returns true when both `title` and `text` carry no user-visible content.
///
/// Checks text only — not attachments, and not a stored row. Blank-entry cleanup uses it
/// on the **incoming** arguments before it reads the row; [`entry_is_empty`] is the
/// on-disk check.
///
/// The title stays a plain-text check: it is not HTML, and running it through the tag
/// stripper would read a literal title like "<3" as blank.
pub fn is_blank_entry_text(title: &str, text: &str) -> bool {
    title.trim().is_empty() && is_blank_html(text)
}

/// Returns whether the stored entry `id` is empty: blank title, blank body, and no
/// attachments.
///
/// `None` when the entry does not exist. An attachment-only entry is not empty: deleting it
/// would also remove its attachment blobs.
pub fn entry_is_empty(db: &DatabaseConnection, id: i64) -> Result<Option<bool>, String> {
    let Some(entry) = get_entry_by_id(db, id)? else {
        return Ok(None);
    };
    if !is_blank_entry_text(&entry.title, &entry.text) {
        return Ok(Some(false));
    }
    Ok(Some(!entry_has_attachments(db, id)?))
}

#[cfg(test)]
mod tests {
    use super::super::test_support::*;
    use super::super::*;
    use super::*;
    use crate::db::queries::attachments::add_attachment_to_entry;
    use crate::db::schema::create_database;

    #[test]
    fn test_is_blank_html_recognises_editor_empty_shells() {
        for blank in [
            "",
            "   ",
            "<p></p>",
            "<p><br></p>",
            "<p>&nbsp;</p>",
            "<p>\u{a0}</p>",
            "<p></p><p></p>",
        ] {
            assert!(is_blank_html(blank), "expected blank: {:?}", blank);
        }
        for content in ["<p>a</p>", "<p><img src=\"x\"></p>", "<hr>", "text"] {
            assert!(!is_blank_html(content), "expected non-blank: {:?}", content);
        }
    }

    /// The allowlist must stay attribute-tolerant: TextAlign and BidiExtension both leave
    /// attributes on an otherwise-empty paragraph, and TipTap marks its trailing break.
    /// Keying on the tag name (not the exact shell) is what keeps these auto-deletable —
    /// an exact-string allowlist would let genuinely blank entries accumulate forever.
    #[test]
    fn test_is_blank_html_tolerates_attributes_on_empty_shells() {
        for blank in [
            "<p dir=\"ltr\"></p>",
            "<p style=\"text-align:center\"></p>",
            "<p><br class=\"ProseMirror-trailingBreak\"></p>",
            "<P></P>",
            "<div><p><span></span></p></div>",
            // An empty bullet carries no user-visible content, same as an empty paragraph.
            "<ul><li><p></p></li></ul>",
        ] {
            assert!(is_blank_html(blank), "expected blank: {:?}", blank);
        }
    }

    /// The classifier is an allowlist, so a node it does not know vetoes the auto-delete
    /// rather than being stripped away as if it were formatting. Blank-entry cleanup takes
    /// an arbitrary IPC string and import paths can carry foreign markup, so "unrecognised"
    /// must mean "keep the entry", never "safe to delete".
    #[test]
    fn test_is_blank_html_refuses_unrecognised_markup() {
        for content in [
            "<canvas></canvas>",
            "<object data=\"x\"></object>",
            "<embed src=\"x\">",
            "<svg><circle r=\"1\"/></svg>",
            "<my-widget></my-widget>",
            "<!-- just a comment -->",
            "<!DOCTYPE html>",
            "<video></video>",
            "<audio></audio>",
            "<iframe src=\"x\"></iframe>",
            "<table><tr><td></td></tr></table>",
            // An image-only entry — the shape the editor actually produces.
            "<figure class=\"image-container\"><img src=\"data:image/png;base64,AAAA\"></figure>",
            // Malformed: no terminator, so nothing can be verified about it.
            "<p",
            "<p></p><span",
            // A `>` inside a quoted attribute desynchronises the scan; the spill-over
            // text is what makes the result "not blank".
            "<p title=\"a>b\"></p>",
            // An empty tag name is not a tag we can classify.
            "< p></p>",
        ] {
            assert!(!is_blank_html(content), "expected non-blank: {:?}", content);
        }
    }

    #[test]
    fn test_is_blank_entry_text_needs_blank_title_and_body() {
        assert!(is_blank_entry_text("", ""));
        assert!(is_blank_entry_text("  ", "<p><br></p>"));
        assert!(!is_blank_entry_text("Titled", "<p></p>"));
        assert!(!is_blank_entry_text("", "<p>Real content</p>"));
        // The title is plain text, not HTML: "<3" is content.
        assert!(!is_blank_entry_text("<3", ""));
    }

    fn blank_entry(date: &str) -> DiaryEntry {
        DiaryEntry {
            title: String::new(),
            text: "<p></p>".to_string(),
            word_count: 0,
            ..create_test_entry(date)
        }
    }

    #[test]
    fn test_entry_is_empty_for_missing_blank_and_content_entries() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        assert_eq!(entry_is_empty(&db, 9999).unwrap(), None);

        let blank_id = insert_entry(&db, &blank_entry("2024-08-01")).unwrap();
        assert_eq!(entry_is_empty(&db, blank_id).unwrap(), Some(true));

        let content_id = insert_entry(&db, &create_test_entry("2024-08-02")).unwrap();
        assert_eq!(entry_is_empty(&db, content_id).unwrap(), Some(false));

        let titled_id = insert_entry(
            &db,
            &DiaryEntry {
                title: "Only a title".to_string(),
                ..blank_entry("2024-08-03")
            },
        )
        .unwrap();
        assert_eq!(entry_is_empty(&db, titled_id).unwrap(), Some(false));
    }

    /// An attachment-only entry is not empty: blank-entry cleanup would otherwise delete it
    /// together with its attachment blobs.
    #[test]
    fn test_entry_is_empty_false_for_attachment_only_entry() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let id = insert_entry(&db, &blank_entry("2024-08-04")).unwrap();
        add_attachment_to_entry(&db, id, "doc.pdf", b"%PDF").unwrap();

        assert_eq!(entry_is_empty(&db, id).unwrap(), Some(false));
    }
}
