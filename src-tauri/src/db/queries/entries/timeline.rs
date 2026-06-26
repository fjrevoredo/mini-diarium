use crate::db::schema::DatabaseConnection;

/// Maximum number of characters kept in a timeline preview.
pub(crate) const TIMELINE_PREVIEW_CHARS: usize = 200;

/// Builds a short plaintext preview from an entry's stored HTML text.
///
/// Strips HTML tags, decodes common entities the editor emits,
/// collapses whitespace, and truncates to `TIMELINE_PREVIEW_CHARS`.
pub(crate) fn preview_from_html(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                // Treat block boundaries as spaces so words don't run together.
                out.push(' ');
            }
            _ if in_tag => {}
            _ => out.push(ch),
        }
    }

    // Decode `&amp;` LAST so a literally-typed entity (stored as e.g. "&amp;lt;") is not
    // double-decoded into "<" — it must round-trip back to "&lt;".
    let decoded = out
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&");

    // Collapse runs of whitespace into single spaces and trim.
    let collapsed = decoded.split_whitespace().collect::<Vec<_>>().join(" ");

    if collapsed.chars().count() > TIMELINE_PREVIEW_CHARS {
        let truncated: String = collapsed.chars().take(TIMELINE_PREVIEW_CHARS).collect();
        format!("{}…", truncated.trim_end())
    } else {
        collapsed
    }
}

/// Lightweight DB row returned by the timeline query.
/// Decrypts only title and preview — never the full entry text.
pub struct TimelineRow {
    pub id: i64,
    pub date: String,
    pub title: String,
    pub preview: String,
}

/// Newest-first timeline query. Decrypts only title and preview_enc.
///
/// Falls back to full `text_encrypted` decryption when `preview_enc` IS NULL
/// (legacy entries not yet saved since the v12 migration).
pub fn get_entries_for_timeline(db: &DatabaseConnection) -> Result<Vec<TimelineRow>, String> {
    let mut stmt = db
        .conn()
        .prepare(
            // text_encrypted is only transferred when preview_enc IS NULL (legacy fallback).
            // The CASE expression avoids deserializing large encrypted blobs into memory
            // for entries that have a pre-computed preview.
            "SELECT id, date, title_encrypted, \
                    CASE WHEN preview_enc IS NOT NULL THEN NULL ELSE text_encrypted END, \
                    preview_enc \
             FROM entries ORDER BY date DESC, id DESC",
        )
        .map_err(|e| format!("Failed to prepare timeline query: {}", e))?;

    let rows: Vec<TimelineRow> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
                row.get::<_, Option<Vec<u8>>>(3)?,
                row.get::<_, Option<Vec<u8>>>(4)?,
            ))
        })
        .map_err(|e| format!("Failed to query timeline: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read timeline row: {}", e))?
        .into_iter()
        .map(|(id, date, title_enc, text_enc_opt, preview_enc_opt)| {
            let title = crate::db::queries::decrypt_utf8(db.key(), &title_enc, "title")?;
            let preview = match preview_enc_opt {
                Some(enc) => crate::db::queries::decrypt_utf8(db.key(), &enc, "preview")?,
                None => {
                    let text_enc = text_enc_opt.ok_or_else(|| {
                        "text_encrypted unexpectedly NULL for legacy entry".to_string()
                    })?;
                    preview_from_html(&crate::db::queries::decrypt_utf8(
                        db.key(),
                        &text_enc,
                        "text",
                    )?)
                }
            };
            Ok(TimelineRow {
                id,
                date,
                title,
                preview,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::db::schema::create_database;

    #[test]
    fn test_preview_strips_html_and_collapses_whitespace() {
        let html = "<h1>Title</h1><p>Hello   <strong>world</strong></p>";
        assert_eq!(preview_from_html(html), "Title Hello world");
    }

    #[test]
    fn test_preview_decodes_entities() {
        let html = "<p>Tom &amp; Jerry &lt;3</p>";
        assert_eq!(preview_from_html(html), "Tom & Jerry <3");
    }

    #[test]
    fn test_preview_does_not_double_decode_entities() {
        // A literally-typed "&lt;" is stored as "&amp;lt;"; it must round-trip back to
        // "&lt;", not be decoded twice into "<".
        let html = "<p>a &amp;lt; b</p>";
        assert_eq!(preview_from_html(html), "a &lt; b");
    }

    #[test]
    fn test_preview_truncates_long_text() {
        let long = "word ".repeat(100);
        let html = format!("<p>{}</p>", long);
        let preview = preview_from_html(&html);
        assert!(preview.ends_with('…'));
        // At most TIMELINE_PREVIEW_CHARS content chars plus the ellipsis. A trailing
        // space at the truncation boundary is trimmed, so the result may be shorter.
        assert!(preview.chars().count() <= TIMELINE_PREVIEW_CHARS + 1);
        // It must actually be shorter than the source content.
        assert!(preview.chars().count() < long.chars().count());
    }

    #[test]
    fn test_get_entries_for_timeline_order_and_preview() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let make_entry = |date: &str, title: &str, text: &str| DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: 1,
            date_created: "2024-01-01T00:00:00Z".to_string(),
            date_updated: "2024-01-01T00:00:00Z".to_string(),
            metadata: None,
        };

        insert_entry(&db, &make_entry("2024-01-01", "Alpha", "<p>First</p>")).unwrap();
        insert_entry(&db, &make_entry("2024-03-01", "Gamma", "<p>Third</p>")).unwrap();
        insert_entry(&db, &make_entry("2024-02-01", "Beta", "<p>Second</p>")).unwrap();

        let rows = get_entries_for_timeline(&db).unwrap();
        assert_eq!(rows.len(), 3);
        // newest-first
        assert_eq!(rows[0].date, "2024-03-01");
        assert_eq!(rows[1].date, "2024-02-01");
        assert_eq!(rows[2].date, "2024-01-01");
        assert_eq!(rows[0].title, "Gamma");
        assert_eq!(rows[0].preview, "Third");
    }

    #[test]
    fn test_get_entries_for_timeline_null_preview_enc_fallback() {
        // Simulate a legacy entry (preview_enc IS NULL) — timeline must fall back to
        // full-text decryption so entries saved before v12 still render correctly.
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        insert_entry(
            &db,
            &DiaryEntry {
                id: 0,
                date: "2024-06-01".to_string(),
                title: "Legacy".to_string(),
                text: "<p>Legacy content</p>".to_string(),
                word_count: 2,
                date_created: "2024-06-01T00:00:00Z".to_string(),
                date_updated: "2024-06-01T00:00:00Z".to_string(),
                metadata: None,
            },
        )
        .unwrap();
        let id = db.conn().last_insert_rowid();

        // Manually null out preview_enc to simulate a pre-v12 entry.
        db.conn()
            .execute(
                "UPDATE entries SET preview_enc = NULL WHERE id = ?1",
                rusqlite::params![id],
            )
            .unwrap();

        let rows = get_entries_for_timeline(&db).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].preview, "Legacy content");
    }

    #[test]
    fn test_preview_enc_encrypted_at_rest() {
        // preview_enc must store diary content encrypted — the raw column must never
        // contain the plaintext preview, guarding the "no plaintext on disk" invariant.
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let secret = "DiarySecretPreviewContent";
        insert_entry(
            &db,
            &DiaryEntry {
                id: 0,
                date: "2024-07-01".to_string(),
                title: "Title".to_string(),
                text: format!("<p>{}</p>", secret),
                word_count: 1,
                date_created: "2024-07-01T00:00:00Z".to_string(),
                date_updated: "2024-07-01T00:00:00Z".to_string(),
                metadata: None,
            },
        )
        .unwrap();

        let raw: Vec<u8> = db
            .conn()
            .query_row(
                "SELECT preview_enc FROM entries WHERE date = '2024-07-01'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert!(
            !String::from_utf8_lossy(&raw).contains(secret),
            "raw preview_enc bytes must not contain plaintext preview"
        );

        // Round-trip via timeline query must recover the preview.
        let rows = get_entries_for_timeline(&db).unwrap();
        assert_eq!(rows[0].preview, secret);
    }
}
