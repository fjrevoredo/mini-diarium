// Import parsers + their serde structs are sealed to the crate (open-core M2 / TODO-0077):
// the only public import path is through the plugin registry (`plugin::register_all` wires
// the builtin importers). Nothing beyond that is part of the stable façade.
pub(crate) mod dayone;
pub(crate) mod dayone_txt;
pub(crate) mod jrnl;
pub(crate) mod minidiary;

// Import → image-normalization round-trip tests. These live here (rather than in the app
// crate's `commands/import.rs`) because they reach the image-store internals through
// `insert_entry_with_images` and exercise the `minidiary` parser, which is `pub(crate)`
// after open-core M2 (TODO-0077). See `commands/import.rs` for the note left behind.
#[cfg(test)]
mod roundtrip_tests {
    use crate::db::{
        count_words, create_database, get_all_entries, insert_entry_with_images,
        resolve_image_refs_in_entries, DatabaseConnection, DiaryEntry,
    };

    const TINY_PNG_B64: &str =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    fn entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        let now = "2024-01-01T00:00:00Z".to_string();
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: count_words(text),
            date_created: now.clone(),
            date_updated: now,
            metadata: None,
            locked: false,
        }
    }

    fn tiny_png_html() -> String {
        format!(
            r#"<p>Imported</p><img src="data:image/png;base64,{}" alt="">"#,
            TINY_PNG_B64
        )
    }

    fn image_row_count(db: &DatabaseConnection) -> i64 {
        db.conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap()
    }

    fn entry_image_link_count(db: &DatabaseConnection) -> i64 {
        db.conn()
            .query_row("SELECT COUNT(*) FROM entry_images", [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn import_normalizes_legacy_data_url_images() {
        let db = create_database(":memory:", "test".to_string()).unwrap();
        insert_entry_with_images(&db, &entry("2024-01-03", "Image entry", &tiny_png_html()))
            .unwrap();

        let imported = get_all_entries(&db).unwrap();
        assert_eq!(imported.len(), 1);
        assert!(imported[0].text.contains("image-id://"));
        assert!(!imported[0].text.contains("data:image"));
        assert_eq!(image_row_count(&db), 1);
        assert_eq!(entry_image_link_count(&db), 1);
    }

    #[test]
    fn import_preserves_entries_without_images() {
        let db = create_database(":memory:", "test".to_string()).unwrap();
        let text = "<p>Plain imported text</p>";
        insert_entry_with_images(&db, &entry("2024-01-04", "Text entry", text)).unwrap();

        let imported = get_all_entries(&db).unwrap();
        assert_eq!(imported.len(), 1);
        assert_eq!(imported[0].text, text);
        assert_eq!(image_row_count(&db), 0);
    }

    #[test]
    fn minidiary_json_round_trip_preserves_image_export_behavior() {
        let source_db = create_database(":memory:", "test".to_string()).unwrap();
        insert_entry_with_images(
            &source_db,
            &entry("2024-01-05", "Round trip", &tiny_png_html()),
        )
        .unwrap();

        let exported = get_all_entries(&source_db).unwrap();
        let exported = resolve_image_refs_in_entries(&source_db, exported).unwrap();
        let json =
            crate::export::export_entries_to_json(exported, &std::collections::HashMap::new())
                .unwrap();

        let parsed = super::minidiary::parse_minidiary_json(&json).unwrap();

        let target_db = create_database(":memory:", "test".to_string()).unwrap();
        for e in parsed {
            insert_entry_with_images(&target_db, &e).unwrap();
        }

        let imported = get_all_entries(&target_db).unwrap();
        assert_eq!(imported.len(), 1);
        assert!(imported[0].text.contains("image-id://"));
        assert!(!imported[0].text.contains("data:image"));
        assert_eq!(image_row_count(&target_db), 1);

        let re_exported = resolve_image_refs_in_entries(&target_db, imported).unwrap();
        assert!(re_exported[0].text.contains("data:image/png;base64,"));
    }
}
