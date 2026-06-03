use crate::crypto::cipher;
use crate::db::schema::DatabaseConnection;
use base64::{engine::general_purpose, Engine as _};
use rusqlite::params;

/// Decrypted image data returned to the frontend.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImageData {
    pub id: i64,
    pub mime_type: String,
    pub data_base64: String,
}

/// Stores a new image (or returns the existing one if an identical image is already stored).
///
/// Computes an HKDF-SHA256 fingerprint of the plaintext bytes, encrypts the bytes,
/// and `INSERT OR IGNORE`s into `images`. Returns the id of the existing or newly inserted row.
pub fn upsert_image(
    db: &DatabaseConnection,
    mime_type: &str,
    plaintext_bytes: &[u8],
) -> Result<i64, String> {
    let fingerprint = cipher::image_fingerprint(db.key(), plaintext_bytes);
    let encrypted = super::encrypt_for_storage(db.key(), plaintext_bytes, "image")?;
    let now = chrono::Utc::now().to_rfc3339();

    db.conn()
        .execute(
            "INSERT OR IGNORE INTO images (fingerprint, mime_type, data, created_at) \
             VALUES (?1, ?2, ?3, ?4)",
            params![&fingerprint, mime_type, &encrypted, &now],
        )
        .map_err(|e| format!("Failed to upsert image: {}", e))?;

    let id: i64 = db
        .conn()
        .query_row(
            "SELECT id FROM images WHERE fingerprint = ?1",
            params![&fingerprint],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to fetch image id: {}", e))?;

    Ok(id)
}

/// Atomically replaces all image associations for an entry.
///
/// Deletes the old `entry_images` rows for `entry_id` and inserts the new set.
/// Called inside the `update_entry_with_images` transaction.
pub fn replace_entry_image_links(
    db: &DatabaseConnection,
    entry_id: i64,
    image_ids: &[i64],
) -> Result<(), String> {
    db.conn()
        .execute(
            "DELETE FROM entry_images WHERE entry_id = ?1",
            params![entry_id],
        )
        .map_err(|e| format!("Failed to clear entry_images: {}", e))?;

    for &image_id in image_ids {
        db.conn()
            .execute(
                "INSERT INTO entry_images (entry_id, image_id) VALUES (?1, ?2)",
                params![entry_id, image_id],
            )
            .map_err(|e| format!("Failed to insert entry_images row: {}", e))?;
    }

    Ok(())
}

/// Returns all decrypted images associated with an entry, in insertion order.
pub fn get_images_for_entry(
    db: &DatabaseConnection,
    entry_id: i64,
) -> Result<Vec<ImageData>, String> {
    let mut stmt = db
        .conn()
        .prepare(
            "SELECT i.id, i.mime_type, i.data \
             FROM images i \
             JOIN entry_images ei ON i.id = ei.image_id \
             WHERE ei.entry_id = ?1",
        )
        .map_err(|e| format!("Failed to prepare get_images_for_entry: {}", e))?;

    let rows: Vec<(i64, String, Vec<u8>)> = stmt
        .query_map(params![entry_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to query images for entry: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read image row: {}", e))?;

    rows.into_iter()
        .map(|(id, mime_type, encrypted)| {
            let plaintext = super::decrypt_bytes(db.key(), &encrypted, "image")?;
            let data_base64 = general_purpose::STANDARD.encode(&plaintext);
            Ok(ImageData {
                id,
                mime_type,
                data_base64,
            })
        })
        .collect()
}

/// Returns all decrypted images in the journal, newest-first.
pub fn list_all_images(db: &DatabaseConnection) -> Result<Vec<ImageData>, String> {
    let mut stmt = db
        .conn()
        .prepare("SELECT id, mime_type, data FROM images ORDER BY created_at DESC")
        .map_err(|e| format!("Failed to prepare list_all_images: {}", e))?;

    let rows: Vec<(i64, String, Vec<u8>)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
            ))
        })
        .map_err(|e| format!("Failed to query all images: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read image row: {}", e))?;

    rows.into_iter()
        .map(|(id, mime_type, encrypted)| {
            let plaintext = super::decrypt_bytes(db.key(), &encrypted, "image")?;
            let data_base64 = general_purpose::STANDARD.encode(&plaintext);
            Ok(ImageData {
                id,
                mime_type,
                data_base64,
            })
        })
        .collect()
}

/// Substitutes `image-id://N` references with data URLs in a batch of entries.
///
/// Entries without `image-id://` refs are returned unchanged (no DB query for them).
/// Used by all export paths to ensure exported content never contains `image-id://` refs.
pub fn resolve_image_refs_in_entries(
    db: &DatabaseConnection,
    entries: Vec<crate::db::queries::DiaryEntry>,
) -> Result<Vec<crate::db::queries::DiaryEntry>, String> {
    entries
        .into_iter()
        .map(|mut entry| {
            if entry.text.contains("image-id://") {
                let images = get_images_for_entry(db, entry.id)?;
                for img in &images {
                    let pattern = format!(r#"image-id://{}""#, img.id);
                    let replacement = format!(r#"data:{};base64,{}""#, img.mime_type, img.data_base64);
                    entry.text = entry.text.replace(&pattern, &replacement);
                }
            }
            Ok(entry)
        })
        .collect()
}

/// Scans HTML for data-URL `<img>` tags and `image-id://` refs.
///
/// For each `data:image/TYPE;base64,DATA` src found:
/// - decodes the base64 bytes
/// - calls `upsert_image` to store/deduplicate
/// - replaces the src with `image-id://ID`
///
/// Existing `image-id://N` refs (from prior saves) are preserved and collected.
/// Returns `(rewritten_html, all_image_ids)`.
pub fn extract_and_replace_image_refs(
    html: &str,
    db: &DatabaseConnection,
) -> Result<(String, Vec<i64>), String> {
    use base64::{engine::general_purpose, Engine as _};

    let mut result = String::new();
    let mut image_ids: Vec<i64> = Vec::new();
    let mut remaining = html;

    // First collect existing image-id:// refs so they survive re-save unchanged.
    let mut existing_ids: Vec<i64> = Vec::new();
    {
        let mut scan = html;
        while let Some(pos) = scan.find("image-id://") {
            let after = &scan[pos + 11..];
            let id_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(id) = id_str.parse::<i64>() {
                if !existing_ids.contains(&id) {
                    existing_ids.push(id);
                }
            }
            scan = &scan[pos + 11..];
        }
    }
    image_ids.extend_from_slice(&existing_ids);

    // Now process the HTML, replacing data-URL srcs with image-id:// refs.
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
                    match general_purpose::STANDARD.decode(&b64_data) {
                        Ok(bytes) => {
                            let image_id = upsert_image(db, &mime, &bytes)?;
                            if !image_ids.contains(&image_id) {
                                image_ids.push(image_id);
                            }
                            // Replace the entire src="data:..." attribute with image-id ref.
                            let new_tag = replace_data_src(tag, image_id);
                            result.push_str(&new_tag);
                        }
                        Err(_) => {
                            // Corrupted base64 — keep the tag as-is, don't break the entry.
                            result.push_str(tag);
                        }
                    }
                } else {
                    // Non-data-URI or already image-id:// src — keep tag as-is.
                    result.push_str(tag);
                }
            }
            None => {
                result.push('<');
                remaining = &remaining[1..];
            }
        }
    }
    result.push_str(remaining);

    Ok((result, image_ids))
}

/// Replaces `src="data:image/..."` with `src="image-id://ID"` inside an `<img>` tag.
fn replace_data_src(tag: &str, image_id: i64) -> String {
    for &quote in &['"', '\''] {
        let data_pattern = format!("src={}data:", quote);
        if let Some(pos) = tag.find(&data_pattern) {
            let before = &tag[..pos];
            let after_prefix = &tag[pos + data_pattern.len()..];
            // find closing quote
            if let Some(end) = after_prefix.find(quote) {
                let after_src = &after_prefix[end + 1..];
                return format!("{}src={}image-id://{}{}{}", before, quote, image_id, quote, after_src);
            }
        }
    }
    // Fallback: can't replace, return tag unchanged.
    tag.to_string()
}

/// Returns the index one past the closing `>` of an img tag, respecting quoted attributes.
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

/// Extracts `(mime_type, base64_data)` from an `<img>` tag with a data-URI src.
fn extract_src_data_uri(tag: &str) -> Option<(String, String)> {
    for &quote in &['"', '\''] {
        let pattern = format!("src={}data:image/", quote);
        if let Some(pos) = tag.find(&pattern) {
            let after = &tag[pos + pattern.len()..];
            let semi = after.find(';')?;
            let mime_subtype = &after[..semi];
            let rest = &after[semi + 1..];
            let b64_start = rest.strip_prefix("base64,")?;
            let q_end = b64_start.find(quote)?;
            let b64_data = &b64_start[..q_end];
            return Some((format!("image/{}", mime_subtype), b64_data.to_string()));
        }
    }
    None
}

/// Removes images that are not referenced by any entry_images row.
///
/// Safe to call after deleting entries or updating entry image links.
pub fn cleanup_orphaned_images(db: &DatabaseConnection) -> Result<(), String> {
    db.conn()
        .execute(
            "DELETE FROM images WHERE id NOT IN \
             (SELECT DISTINCT image_id FROM entry_images)",
            [],
        )
        .map_err(|e| format!("Failed to cleanup orphaned images: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_database;

    fn make_db() -> crate::db::schema::DatabaseConnection {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap()
    }

    fn insert_blank_entry(db: &DatabaseConnection) -> i64 {
        let now = chrono::Utc::now().to_rfc3339();
        db.conn()
            .execute(
                "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, \
                 date_created, date_updated) VALUES ('2024-01-01', x'', x'', 0, ?1, ?1)",
                params![now],
            )
            .unwrap();
        db.conn().last_insert_rowid()
    }

    #[test]
    fn test_upsert_image_returns_same_id_for_same_bytes() {
        let db = make_db();
        let bytes = b"fake-png-data";
        let id1 = upsert_image(&db, "image/png", bytes).unwrap();
        let id2 = upsert_image(&db, "image/png", bytes).unwrap();
        assert_eq!(id1, id2, "identical bytes must return the same image id");

        let count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "only one physical row for identical bytes");
    }

    #[test]
    fn test_upsert_image_different_bytes_different_ids() {
        let db = make_db();
        let id1 = upsert_image(&db, "image/png", b"bytes-A").unwrap();
        let id2 = upsert_image(&db, "image/png", b"bytes-B").unwrap();
        assert_ne!(id1, id2, "different bytes must produce different ids");
    }

    #[test]
    fn test_replace_entry_image_links_replaces_set() {
        let db = make_db();
        let entry_id = insert_blank_entry(&db);
        let id_a = upsert_image(&db, "image/png", b"A").unwrap();
        let id_b = upsert_image(&db, "image/png", b"B").unwrap();
        let id_c = upsert_image(&db, "image/png", b"C").unwrap();

        replace_entry_image_links(&db, entry_id, &[id_a, id_b]).unwrap();
        replace_entry_image_links(&db, entry_id, &[id_b, id_c]).unwrap();

        let linked: Vec<i64> = {
            let mut stmt = db
                .conn()
                .prepare("SELECT image_id FROM entry_images WHERE entry_id = ?1 ORDER BY image_id")
                .unwrap();
            stmt.query_map(params![entry_id], |r| r.get(0))
                .unwrap()
                .map(|r| r.unwrap())
                .collect()
        };
        assert_eq!(linked, vec![id_b, id_c], "final set must be {{B, C}}");
    }

    #[test]
    fn test_get_images_for_entry_returns_decrypted_data() {
        let db = make_db();
        let entry_id = insert_blank_entry(&db);
        let plaintext = b"hello-image-bytes";
        let img_id = upsert_image(&db, "image/jpeg", plaintext).unwrap();
        replace_entry_image_links(&db, entry_id, &[img_id]).unwrap();

        let images = get_images_for_entry(&db, entry_id).unwrap();
        assert_eq!(images.len(), 1);
        assert_eq!(images[0].mime_type, "image/jpeg");
        let decoded = general_purpose::STANDARD.decode(&images[0].data_base64).unwrap();
        assert_eq!(decoded, plaintext);
    }

    #[test]
    fn test_list_all_images_returns_all() {
        let db = make_db();
        upsert_image(&db, "image/png", b"img-1").unwrap();
        upsert_image(&db, "image/jpeg", b"img-2").unwrap();

        let images = list_all_images(&db).unwrap();
        assert_eq!(images.len(), 2);
    }

    #[test]
    fn test_cleanup_orphaned_images_removes_unreferenced() {
        let db = make_db();
        upsert_image(&db, "image/png", b"orphan").unwrap();

        let count_before: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count_before, 1);

        cleanup_orphaned_images(&db).unwrap();

        let count_after: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count_after, 0, "unreferenced image must be removed");
    }

    #[test]
    fn test_cleanup_orphaned_images_keeps_referenced() {
        let db = make_db();
        let entry_id = insert_blank_entry(&db);
        let img_id = upsert_image(&db, "image/png", b"referenced").unwrap();
        replace_entry_image_links(&db, entry_id, &[img_id]).unwrap();

        cleanup_orphaned_images(&db).unwrap();

        let count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "referenced image must be kept");
    }
}
