//! Image validation and row-level CRUD against the `images` / `entry_images` tables.

use super::thumbnail::{persist_image_storage_metadata, prepare_image_storage_metadata};
use super::ImageData;
use crate::crypto::cipher;
use crate::db::schema::DatabaseConnection;
use base64::{engine::general_purpose, Engine as _};
use rusqlite::params;

const MAX_STORED_IMAGE_BYTES: usize = 20 * 1024 * 1024;

fn validate_image_for_storage(mime_type: &str, plaintext_bytes: &[u8]) -> Result<(), String> {
    if plaintext_bytes.is_empty() {
        return Err("Image data is empty".to_string());
    }

    if plaintext_bytes.len() > MAX_STORED_IMAGE_BYTES {
        return Err(format!(
            "Image is too large. Maximum supported size is {} MB.",
            MAX_STORED_IMAGE_BYTES / 1_048_576
        ));
    }

    let detected_mime = detect_image_mime_type(plaintext_bytes).ok_or_else(|| {
        "Image data is not a valid supported PNG, JPEG, GIF, WebP, or BMP file".to_string()
    })?;

    if !matches!(
        mime_type,
        "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/bmp"
    ) {
        return Err(
            "Unsupported image MIME type. Supported formats are PNG, JPEG, GIF, WebP, and BMP."
                .to_string(),
        );
    }

    if mime_type != detected_mime {
        return Err("Image data does not match its declared MIME type".to_string());
    }

    Ok(())
}

fn detect_image_mime_type(plaintext_bytes: &[u8]) -> Option<&'static str> {
    if plaintext_bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some("image/png");
    }

    if plaintext_bytes.len() >= 3
        && plaintext_bytes[0] == 0xFF
        && plaintext_bytes[1] == 0xD8
        && plaintext_bytes[2] == 0xFF
    {
        return Some("image/jpeg");
    }

    if plaintext_bytes.starts_with(b"GIF87a") || plaintext_bytes.starts_with(b"GIF89a") {
        return Some("image/gif");
    }

    if plaintext_bytes.len() >= 12
        && &plaintext_bytes[0..4] == b"RIFF"
        && &plaintext_bytes[8..12] == b"WEBP"
    {
        return Some("image/webp");
    }

    if plaintext_bytes.starts_with(b"BM") {
        return Some("image/bmp");
    }

    None
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
    validate_image_for_storage(mime_type, plaintext_bytes)?;
    let metadata = prepare_image_storage_metadata(db, plaintext_bytes)?;

    let fingerprint = cipher::image_fingerprint(db.key(), plaintext_bytes);
    let encrypted = super::super::encrypt_for_storage(db.key(), plaintext_bytes, "image")?;
    let now = chrono::Utc::now().to_rfc3339();

    db.conn()
        .execute(
            "INSERT OR IGNORE INTO images (
                 fingerprint,
                 mime_type,
                 data,
                 created_at,
                 thumbnail_data,
                 thumbnail_mime_type,
                 width,
                 height,
                 byte_size,
                 thumbnail_version
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                &fingerprint,
                mime_type,
                &encrypted,
                &now,
                &metadata.thumbnail_encrypted,
                &metadata.thumbnail_mime_type,
                metadata.width,
                metadata.height,
                metadata.byte_size,
                metadata.thumbnail_version,
            ],
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

    persist_image_storage_metadata(db, id, &metadata)?;

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
            let plaintext = super::super::decrypt_bytes(db.key(), &encrypted, "image")?;
            let data_base64 = general_purpose::STANDARD.encode(&plaintext);
            Ok(ImageData {
                id,
                mime_type,
                data_base64,
            })
        })
        .collect()
}

/// Returns one decrypted image by id.
pub fn get_image_by_id(
    db: &DatabaseConnection,
    image_id: i64,
) -> Result<Option<ImageData>, String> {
    let result = db.conn().query_row(
        "SELECT id, mime_type, data FROM images WHERE id = ?1",
        params![image_id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Vec<u8>>(2)?,
            ))
        },
    );

    match result {
        Ok((id, mime_type, encrypted)) => {
            let plaintext = super::super::decrypt_bytes(db.key(), &encrypted, "image")?;
            let data_base64 = general_purpose::STANDARD.encode(&plaintext);
            Ok(Some(ImageData {
                id,
                mime_type,
                data_base64,
            }))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to fetch image by id: {}", e)),
    }
}

/// Checks whether a row with the given `id` exists in the `images` table.
pub(super) fn image_exists(db: &DatabaseConnection, id: i64) -> Result<bool, String> {
    let count: i64 = db
        .conn()
        .query_row(
            "SELECT COUNT(*) FROM images WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check image existence: {}", e))?;
    Ok(count > 0)
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
    use super::super::test_support::{
        insert_blank_entry, make_db, valid_bmp_bytes, valid_gif_bytes, valid_jpeg_bytes,
        valid_png_bytes, valid_webp_bytes,
    };
    use super::super::thumbnail::{THUMBNAIL_GENERATION_VERSION, THUMBNAIL_MIME_TYPE};
    use super::*;
    use image::GenericImageView;

    #[test]
    fn test_upsert_image_returns_same_id_for_same_bytes() {
        let (_tmp, db) = make_db();
        let bytes = valid_png_bytes();
        let id1 = upsert_image(&db, "image/png", &bytes).unwrap();
        let id2 = upsert_image(&db, "image/png", &bytes).unwrap();
        assert_eq!(id1, id2, "identical bytes must return the same image id");

        let count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "only one physical row for identical bytes");
    }

    #[test]
    fn test_upsert_image_different_bytes_different_ids() {
        let (_tmp, db) = make_db();
        let bytes_a = valid_png_bytes();
        let mut bytes_b = valid_png_bytes();
        bytes_b.push(0x01);
        let id1 = upsert_image(&db, "image/png", &bytes_a).unwrap();
        let id2 = upsert_image(&db, "image/png", &bytes_b).unwrap();
        assert_ne!(id1, id2, "different bytes must produce different ids");
    }

    #[test]
    fn test_upsert_image_accepts_supported_formats() {
        let (_tmp, db) = make_db();

        let cases = [
            ("image/png", valid_png_bytes()),
            ("image/jpeg", valid_jpeg_bytes()),
            ("image/gif", valid_gif_bytes()),
            ("image/webp", valid_webp_bytes()),
            ("image/bmp", valid_bmp_bytes()),
        ];

        for (mime, bytes) in cases {
            let id = upsert_image(&db, mime, &bytes).unwrap();
            assert!(id > 0, "expected a stored image id for {}", mime);
        }
    }

    #[test]
    fn test_upsert_image_stores_dimensions_and_encrypted_thumbnail() {
        let (_tmp, db) = make_db();
        let bytes = valid_png_bytes();
        let image_id = upsert_image(&db, "image/png", &bytes).unwrap();

        let (
            thumbnail_encrypted,
            thumbnail_mime_type,
            width,
            height,
            byte_size,
            thumbnail_version,
        ): (Vec<u8>, String, i64, i64, i64, i32) = db
            .conn()
            .query_row(
                "SELECT thumbnail_data, thumbnail_mime_type, width, height, byte_size, thumbnail_version
                 FROM images WHERE id = ?1",
                params![image_id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                },
            )
            .unwrap();

        assert_eq!(thumbnail_mime_type, THUMBNAIL_MIME_TYPE);
        assert_eq!(width, 1);
        assert_eq!(height, 1);
        assert_eq!(byte_size, bytes.len() as i64);
        assert_eq!(thumbnail_version, THUMBNAIL_GENERATION_VERSION);

        let thumbnail_plaintext =
            crate::db::queries::decrypt_bytes(db.key(), &thumbnail_encrypted, "image thumbnail")
                .unwrap();
        assert_ne!(thumbnail_plaintext, thumbnail_encrypted);
        let thumbnail = image::load_from_memory(&thumbnail_plaintext).unwrap();
        assert_eq!(thumbnail.dimensions(), (1, 1));
    }

    #[test]
    fn test_upsert_image_rejects_svg_mime() {
        let (_tmp, db) = make_db();
        let err = upsert_image(&db, "image/svg+xml", &valid_png_bytes()).unwrap_err();
        assert!(err.contains("Unsupported image MIME type"), "got: {}", err);
    }

    #[test]
    fn test_upsert_image_rejects_mime_mismatch() {
        let (_tmp, db) = make_db();
        let err = upsert_image(&db, "image/png", &valid_jpeg_bytes()).unwrap_err();
        assert!(err.contains("does not match"), "got: {}", err);
    }

    #[test]
    fn test_upsert_image_rejects_oversized_bytes() {
        let (_tmp, db) = make_db();
        let mut bytes = valid_png_bytes();
        bytes.resize(MAX_STORED_IMAGE_BYTES + 1, 0);
        let err = upsert_image(&db, "image/png", &bytes).unwrap_err();
        assert!(err.contains("too large"), "got: {}", err);
    }

    #[test]
    fn test_replace_entry_image_links_replaces_set() {
        let (_tmp, db) = make_db();
        let entry_id = insert_blank_entry(&db);
        let id_a = upsert_image(&db, "image/png", &valid_png_bytes()).unwrap();
        let id_b = upsert_image(&db, "image/jpeg", &valid_jpeg_bytes()).unwrap();
        let id_c = upsert_image(&db, "image/gif", &valid_gif_bytes()).unwrap();

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
        let (_tmp, db) = make_db();
        let entry_id = insert_blank_entry(&db);
        let plaintext = valid_jpeg_bytes();
        let img_id = upsert_image(&db, "image/jpeg", &plaintext).unwrap();
        replace_entry_image_links(&db, entry_id, &[img_id]).unwrap();

        let images = get_images_for_entry(&db, entry_id).unwrap();
        assert_eq!(images.len(), 1);
        assert_eq!(images[0].mime_type, "image/jpeg");
        let decoded = general_purpose::STANDARD
            .decode(&images[0].data_base64)
            .unwrap();
        assert_eq!(decoded, plaintext);
    }

    #[test]
    fn test_get_image_by_id_returns_decrypted_image() {
        let (_tmp, db) = make_db();
        let bytes = valid_png_bytes();
        let image_id = upsert_image(&db, "image/png", &bytes).unwrap();

        let image = get_image_by_id(&db, image_id).unwrap().unwrap();
        assert_eq!(image.id, image_id);
        assert_eq!(image.mime_type, "image/png");
    }

    #[test]
    fn test_cleanup_orphaned_images_removes_unreferenced() {
        let (_tmp, db) = make_db();
        upsert_image(&db, "image/png", &valid_png_bytes()).unwrap();

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
        let (_tmp, db) = make_db();
        let entry_id = insert_blank_entry(&db);
        let img_id = upsert_image(&db, "image/png", &valid_png_bytes()).unwrap();
        replace_entry_image_links(&db, entry_id, &[img_id]).unwrap();

        cleanup_orphaned_images(&db).unwrap();

        let count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "referenced image must be kept");
    }
}
