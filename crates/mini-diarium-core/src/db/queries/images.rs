use crate::crypto::cipher;
use crate::db::schema::DatabaseConnection;
use base64::{engine::general_purpose, Engine as _};
use image::codecs::png::PngEncoder;
use image::{GenericImageView, ImageEncoder};
use rusqlite::params;

/// Decrypted image data returned to the frontend.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImageData {
    pub id: i64,
    pub mime_type: String,
    pub data_base64: String,
}

/// Metadata-only image summary for picker/list UIs.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImageSummary {
    pub id: i64,
    pub mime_type: String,
    pub created_at: String,
    pub thumbnail_mime_type: Option<String>,
    pub thumbnail_data_base64: Option<String>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub byte_size: Option<i64>,
    pub usage_count: i64,
    pub first_entry_date: Option<String>,
    pub latest_entry_date: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImageSummaryPage {
    pub items: Vec<ImageSummary>,
    pub has_more: bool,
}

#[derive(Default, Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImageSummarySort {
    #[default]
    Newest,
    Oldest,
    MostUsed,
}

const MAX_STORED_IMAGE_BYTES: usize = 20 * 1024 * 1024;
const THUMBNAIL_MAX_EDGE: u32 = 224;
const THUMBNAIL_MIME_TYPE: &str = "image/png";
const THUMBNAIL_GENERATION_VERSION: i32 = 1;

struct ImageStorageMetadata {
    thumbnail_plaintext: Vec<u8>,
    thumbnail_encrypted: Vec<u8>,
    thumbnail_mime_type: String,
    width: i64,
    height: i64,
    byte_size: i64,
    thumbnail_version: i32,
}

struct RawImageSummaryRow {
    id: i64,
    mime_type: String,
    created_at: String,
    encrypted_data: Vec<u8>,
    thumbnail_encrypted: Option<Vec<u8>>,
    thumbnail_mime_type: Option<String>,
    width: Option<i64>,
    height: Option<i64>,
    byte_size: Option<i64>,
    thumbnail_version: Option<i32>,
    usage_count: i64,
    first_entry_date: Option<String>,
    latest_entry_date: Option<String>,
}

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

fn prepare_image_storage_metadata(
    db: &DatabaseConnection,
    plaintext_bytes: &[u8],
) -> Result<ImageStorageMetadata, String> {
    let decoded = image::load_from_memory(plaintext_bytes)
        .map_err(|e| format!("Failed to decode image for thumbnail generation: {}", e))?;
    let (width, height) = decoded.dimensions();
    let thumbnail = if width > THUMBNAIL_MAX_EDGE || height > THUMBNAIL_MAX_EDGE {
        decoded.thumbnail(THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE)
    } else {
        decoded.clone()
    };
    let thumbnail_rgba = thumbnail.to_rgba8();

    let mut thumbnail_plaintext = Vec::new();
    PngEncoder::new(&mut thumbnail_plaintext)
        .write_image(
            thumbnail_rgba.as_raw(),
            thumbnail_rgba.width(),
            thumbnail_rgba.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    let thumbnail_encrypted =
        super::encrypt_for_storage(db.key(), &thumbnail_plaintext, "image thumbnail")?;

    Ok(ImageStorageMetadata {
        thumbnail_plaintext,
        thumbnail_encrypted,
        thumbnail_mime_type: THUMBNAIL_MIME_TYPE.to_string(),
        width: i64::from(width),
        height: i64::from(height),
        byte_size: plaintext_bytes.len() as i64,
        thumbnail_version: THUMBNAIL_GENERATION_VERSION,
    })
}

fn persist_image_storage_metadata(
    db: &DatabaseConnection,
    image_id: i64,
    metadata: &ImageStorageMetadata,
) -> Result<(), String> {
    db.conn()
        .execute(
            "UPDATE images
             SET thumbnail_data = ?1,
                 thumbnail_mime_type = ?2,
                 width = ?3,
                 height = ?4,
                 byte_size = ?5,
                 thumbnail_version = ?6
             WHERE id = ?7",
            params![
                &metadata.thumbnail_encrypted,
                &metadata.thumbnail_mime_type,
                metadata.width,
                metadata.height,
                metadata.byte_size,
                metadata.thumbnail_version,
                image_id,
            ],
        )
        .map_err(|e| format!("Failed to persist image thumbnail metadata: {}", e))?;
    Ok(())
}

fn summary_backfill_needed(row: &RawImageSummaryRow) -> bool {
    row.thumbnail_encrypted.is_none()
        || row.thumbnail_mime_type.is_none()
        || row.width.is_none()
        || row.height.is_none()
        || row.byte_size.is_none()
        || row.thumbnail_version != Some(THUMBNAIL_GENERATION_VERSION)
}

fn backfill_summary_row(
    db: &DatabaseConnection,
    row: &RawImageSummaryRow,
) -> Result<ImageStorageMetadata, String> {
    let plaintext = super::decrypt_bytes(db.key(), &row.encrypted_data, "image")?;
    let metadata = prepare_image_storage_metadata(db, &plaintext)?;
    persist_image_storage_metadata(db, row.id, &metadata)?;
    Ok(metadata)
}

fn summary_from_row(
    db: &DatabaseConnection,
    row: RawImageSummaryRow,
) -> Result<ImageSummary, String> {
    let mut thumbnail_mime_type = row.thumbnail_mime_type.clone();
    let mut thumbnail_data_base64 = None;
    let mut width = row.width;
    let mut height = row.height;
    let mut byte_size = row.byte_size;

    if summary_backfill_needed(&row) {
        match backfill_summary_row(db, &row) {
            Ok(metadata) => {
                thumbnail_mime_type = Some(metadata.thumbnail_mime_type);
                thumbnail_data_base64 =
                    Some(general_purpose::STANDARD.encode(&metadata.thumbnail_plaintext));
                width = Some(metadata.width);
                height = Some(metadata.height);
                byte_size = Some(metadata.byte_size);
            }
            Err(_) => {
                thumbnail_mime_type = None;
            }
        }
    } else if let Some(encrypted_thumbnail) = row.thumbnail_encrypted.as_ref() {
        match super::decrypt_bytes(db.key(), encrypted_thumbnail, "image thumbnail") {
            Ok(plaintext_thumb) => {
                thumbnail_data_base64 = Some(general_purpose::STANDARD.encode(plaintext_thumb));
            }
            Err(_) => match backfill_summary_row(db, &row) {
                Ok(metadata) => {
                    thumbnail_mime_type = Some(metadata.thumbnail_mime_type);
                    thumbnail_data_base64 =
                        Some(general_purpose::STANDARD.encode(&metadata.thumbnail_plaintext));
                    width = Some(metadata.width);
                    height = Some(metadata.height);
                    byte_size = Some(metadata.byte_size);
                }
                Err(_) => {
                    thumbnail_mime_type = None;
                    thumbnail_data_base64 = None;
                }
            },
        }
    }

    Ok(ImageSummary {
        id: row.id,
        mime_type: row.mime_type,
        created_at: row.created_at,
        thumbnail_mime_type,
        thumbnail_data_base64,
        width,
        height,
        byte_size,
        usage_count: row.usage_count,
        first_entry_date: row.first_entry_date,
        latest_entry_date: row.latest_entry_date,
    })
}

fn validate_month_filter(month: &str) -> Result<(), String> {
    chrono::NaiveDate::parse_from_str(&format!("{}-01", month), "%Y-%m-%d")
        .map_err(|_| "Month filter must use YYYY-MM format".to_string())?;
    Ok(())
}

fn list_order_clause(sort: ImageSummarySort) -> &'static str {
    match sort {
        ImageSummarySort::Newest => "i.created_at DESC, i.id DESC",
        ImageSummarySort::Oldest => "i.created_at ASC, i.id ASC",
        ImageSummarySort::MostUsed => "usage_count DESC, i.created_at DESC, i.id DESC",
    }
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
    let encrypted = super::encrypt_for_storage(db.key(), plaintext_bytes, "image")?;
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
            let plaintext = super::decrypt_bytes(db.key(), &encrypted, "image")?;
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

/// Returns paginated image summaries in the journal for media-picker UIs.
pub fn list_image_summaries_filtered(
    db: &DatabaseConnection,
    limit: Option<i64>,
    offset: Option<i64>,
    sort: Option<ImageSummarySort>,
    month: Option<&str>,
) -> Result<ImageSummaryPage, String> {
    if let Some(limit) = limit {
        if limit <= 0 {
            return Err("Image summary limit must be greater than zero".to_string());
        }
    }
    if let Some(offset) = offset {
        if offset < 0 {
            return Err("Image summary offset must be zero or greater".to_string());
        }
    }
    if let Some(month) = month {
        validate_month_filter(month)?;
    }

    let sort = sort.unwrap_or_default();
    let order_clause = list_order_clause(sort);
    let where_clause = if month.is_some() {
        "WHERE substr(i.created_at, 1, 7) = ?1"
    } else {
        ""
    };
    let limit_clause = if limit.is_some() {
        "LIMIT ? OFFSET ?"
    } else {
        ""
    };
    let sql = format!(
        "SELECT
             i.id,
             i.mime_type,
             i.created_at,
             i.data,
             i.thumbnail_data,
             i.thumbnail_mime_type,
             i.width,
             i.height,
             i.byte_size,
             i.thumbnail_version,
             COUNT(ei.entry_id) AS usage_count,
             MIN(e.date) AS first_entry_date,
             MAX(e.date) AS latest_entry_date
         FROM images i
         LEFT JOIN entry_images ei ON i.id = ei.image_id
         LEFT JOIN entries e ON e.id = ei.entry_id
         {where_clause}
         GROUP BY i.id
         ORDER BY {order_clause}
         {limit_clause}",
    );
    let mut stmt = db
        .conn()
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare list_image_summaries: {}", e))?;

    let page_limit = limit.unwrap_or(i64::MAX);
    let fetch_limit = if limit.is_some() {
        page_limit.saturating_add(1)
    } else {
        page_limit
    };
    let offset = offset.unwrap_or(0);

    let raw_rows: Vec<RawImageSummaryRow> = match (month, limit) {
        (Some(month), Some(_)) => stmt
            .query_map(params![month, fetch_limit, offset], |row| {
                Ok(RawImageSummaryRow {
                    id: row.get(0)?,
                    mime_type: row.get(1)?,
                    created_at: row.get(2)?,
                    encrypted_data: row.get(3)?,
                    thumbnail_encrypted: row.get(4)?,
                    thumbnail_mime_type: row.get(5)?,
                    width: row.get(6)?,
                    height: row.get(7)?,
                    byte_size: row.get(8)?,
                    thumbnail_version: row.get(9)?,
                    usage_count: row.get(10)?,
                    first_entry_date: row.get(11)?,
                    latest_entry_date: row.get(12)?,
                })
            })
            .map_err(|e| format!("Failed to query image summaries: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read image summary row: {}", e))?,
        (Some(month), None) => stmt
            .query_map(params![month], |row| {
                Ok(RawImageSummaryRow {
                    id: row.get(0)?,
                    mime_type: row.get(1)?,
                    created_at: row.get(2)?,
                    encrypted_data: row.get(3)?,
                    thumbnail_encrypted: row.get(4)?,
                    thumbnail_mime_type: row.get(5)?,
                    width: row.get(6)?,
                    height: row.get(7)?,
                    byte_size: row.get(8)?,
                    thumbnail_version: row.get(9)?,
                    usage_count: row.get(10)?,
                    first_entry_date: row.get(11)?,
                    latest_entry_date: row.get(12)?,
                })
            })
            .map_err(|e| format!("Failed to query image summaries: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read image summary row: {}", e))?,
        (None, Some(_)) => stmt
            .query_map(params![fetch_limit, offset], |row| {
                Ok(RawImageSummaryRow {
                    id: row.get(0)?,
                    mime_type: row.get(1)?,
                    created_at: row.get(2)?,
                    encrypted_data: row.get(3)?,
                    thumbnail_encrypted: row.get(4)?,
                    thumbnail_mime_type: row.get(5)?,
                    width: row.get(6)?,
                    height: row.get(7)?,
                    byte_size: row.get(8)?,
                    thumbnail_version: row.get(9)?,
                    usage_count: row.get(10)?,
                    first_entry_date: row.get(11)?,
                    latest_entry_date: row.get(12)?,
                })
            })
            .map_err(|e| format!("Failed to query image summaries: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read image summary row: {}", e))?,
        (None, None) => stmt
            .query_map([], |row| {
                Ok(RawImageSummaryRow {
                    id: row.get(0)?,
                    mime_type: row.get(1)?,
                    created_at: row.get(2)?,
                    encrypted_data: row.get(3)?,
                    thumbnail_encrypted: row.get(4)?,
                    thumbnail_mime_type: row.get(5)?,
                    width: row.get(6)?,
                    height: row.get(7)?,
                    byte_size: row.get(8)?,
                    thumbnail_version: row.get(9)?,
                    usage_count: row.get(10)?,
                    first_entry_date: row.get(11)?,
                    latest_entry_date: row.get(12)?,
                })
            })
            .map_err(|e| format!("Failed to query image summaries: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read image summary row: {}", e))?,
    };

    let has_more = limit.is_some() && raw_rows.len() as i64 > page_limit;
    let rows_for_page = if has_more {
        raw_rows
            .into_iter()
            .take(page_limit as usize)
            .collect::<Vec<_>>()
    } else {
        raw_rows
    };

    let mut items = Vec::with_capacity(rows_for_page.len());
    for row in rows_for_page {
        items.push(summary_from_row(db, row)?);
    }

    Ok(ImageSummaryPage { items, has_more })
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
                    for quote in ['"', '\''] {
                        let pattern = format!("image-id://{}{}", img.id, quote);
                        let replacement =
                            format!("data:{};base64,{}{}", img.mime_type, img.data_base64, quote);
                        entry.text = entry.text.replace(&pattern, &replacement);
                    }
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
/// Existing `image-id://N` refs are collected only from `<img src=...>` attributes,
/// never from arbitrary text. Invalid refs (nonexistent image IDs) are silently dropped
/// rather than passed to `replace_entry_image_links` where they would trigger a FK error.
/// Returns `(rewritten_html, all_image_ids)`.
pub fn extract_and_replace_image_refs(
    html: &str,
    db: &DatabaseConnection,
) -> Result<(String, Vec<i64>), String> {
    use base64::{engine::general_purpose, Engine as _};

    let mut result = String::new();
    let mut image_ids: Vec<i64> = Vec::new();
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
                    let bytes = general_purpose::STANDARD
                        .decode(&b64_data)
                        .map_err(|_| "Invalid embedded image data".to_string())?;

                    let image_id = upsert_image(db, &mime, &bytes)?;
                    if !image_ids.contains(&image_id) {
                        image_ids.push(image_id);
                    }
                    // Replace the entire src="data:..." attribute with image-id ref.
                    let new_tag = replace_data_src(tag, image_id);
                    result.push_str(&new_tag);
                } else {
                    // Non-data-URI src. If it's an image-id:// ref collect it, but only
                    // if the image actually exists (prevents FK failures on invalid refs).
                    if let Some(id) = extract_src_image_ref(tag) {
                        if !image_ids.contains(&id) && image_exists(db, id)? {
                            image_ids.push(id);
                        }
                    }
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

/// Checks whether a row with the given `id` exists in the `images` table.
fn image_exists(db: &DatabaseConnection, id: i64) -> Result<bool, String> {
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

/// Extracts an `image-id://N` image ID from the `src` attribute of an `<img>` tag.
///
/// Returns `None` if the tag has no `src=` matching this pattern (e.g. data-URI or
/// plain URL). Handles both single and double quotes.
fn extract_src_image_ref(tag: &str) -> Option<i64> {
    for quote in ['"', '\''] {
        let pattern = format!("src={}image-id://", quote);
        let Some(pos) = tag.find(&pattern) else {
            continue;
        };
        let after = &tag[pos + pattern.len()..];
        let id_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
        if id_str.is_empty() {
            continue;
        }
        // Ensure the closing character is the same quote (guards against partial matches).
        if !matches!(after[id_str.len()..].chars().next(), Some(q) if q == quote) {
            continue;
        }
        return id_str.parse::<i64>().ok();
    }
    None
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
                return format!(
                    "{}src={}image-id://{}{}{}",
                    before, quote, image_id, quote, after_src
                );
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
    use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
    use std::io::Cursor;

    const TINY_PNG_B64: &str =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    // Returns the NamedTempFile alongside the connection so the caller can keep it alive.
    // On Linux the tempfile is unlinked when dropped, which makes SQLite return
    // SQLITE_READONLY_DBMOVED on subsequent writes. Bind the returned value to `_tmp`
    // in each test so the file persists for the test's lifetime.
    fn make_db() -> (
        tempfile::NamedTempFile,
        crate::db::schema::DatabaseConnection,
    ) {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        (tmp, db)
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

    fn valid_png_bytes() -> Vec<u8> {
        general_purpose::STANDARD.decode(TINY_PNG_B64).unwrap()
    }

    fn encode_test_image(format: ImageFormat) -> Vec<u8> {
        let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(2, 1, Rgba([32, 64, 128, 255])));
        let mut cursor = Cursor::new(Vec::new());
        image.write_to(&mut cursor, format).unwrap();
        cursor.into_inner()
    }

    fn valid_jpeg_bytes() -> Vec<u8> {
        encode_test_image(ImageFormat::Jpeg)
    }

    fn valid_gif_bytes() -> Vec<u8> {
        encode_test_image(ImageFormat::Gif)
    }

    fn valid_webp_bytes() -> Vec<u8> {
        encode_test_image(ImageFormat::WebP)
    }

    fn valid_bmp_bytes() -> Vec<u8> {
        encode_test_image(ImageFormat::Bmp)
    }

    fn insert_entry_for_date(db: &DatabaseConnection, date: &str) -> i64 {
        let now = chrono::Utc::now().to_rfc3339();
        db.conn()
            .execute(
                "INSERT INTO entries (date, title_encrypted, text_encrypted, word_count, \
                 date_created, date_updated) VALUES (?1, x'', x'', 0, ?2, ?2)",
                params![date, now],
            )
            .unwrap();
        db.conn().last_insert_rowid()
    }

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
            super::super::decrypt_bytes(db.key(), &thumbnail_encrypted, "image thumbnail").unwrap();
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
    fn test_list_image_summaries_returns_all() {
        let (_tmp, db) = make_db();
        let png_id = upsert_image(&db, "image/png", &valid_png_bytes()).unwrap();
        let jpg_id = upsert_image(&db, "image/jpeg", &valid_jpeg_bytes()).unwrap();
        let entry_a = insert_entry_for_date(&db, "2024-01-01");
        let entry_b = insert_entry_for_date(&db, "2024-01-05");
        let entry_c = insert_entry_for_date(&db, "2024-01-09");

        replace_entry_image_links(&db, entry_a, &[png_id]).unwrap();
        replace_entry_image_links(&db, entry_b, &[png_id]).unwrap();
        replace_entry_image_links(&db, entry_c, &[jpg_id]).unwrap();

        let images = list_image_summaries_filtered(&db, None, None, None, None).unwrap();
        assert_eq!(images.items.len(), 2);
        assert!(!images.has_more);
        assert!(images.items.iter().all(|img| !img.created_at.is_empty()));

        let png_summary = images.items.iter().find(|img| img.id == png_id).unwrap();
        assert_eq!(png_summary.usage_count, 2);
        assert_eq!(png_summary.first_entry_date.as_deref(), Some("2024-01-01"));
        assert_eq!(png_summary.latest_entry_date.as_deref(), Some("2024-01-05"));
        assert_eq!(png_summary.width, Some(1));
        assert_eq!(png_summary.height, Some(1));
        assert_eq!(
            png_summary.thumbnail_mime_type.as_deref(),
            Some(THUMBNAIL_MIME_TYPE)
        );
        assert!(png_summary.thumbnail_data_base64.is_some());
    }

    #[test]
    fn test_list_image_summaries_paginates_and_sorts_by_usage() {
        let (_tmp, db) = make_db();
        let png_id = upsert_image(&db, "image/png", &valid_png_bytes()).unwrap();
        let jpg_id = upsert_image(&db, "image/jpeg", &valid_jpeg_bytes()).unwrap();
        let gif_id = upsert_image(&db, "image/gif", &valid_gif_bytes()).unwrap();

        let entry_a = insert_entry_for_date(&db, "2024-02-01");
        let entry_b = insert_entry_for_date(&db, "2024-02-02");
        let entry_c = insert_entry_for_date(&db, "2024-02-03");
        replace_entry_image_links(&db, entry_a, &[png_id]).unwrap();
        replace_entry_image_links(&db, entry_b, &[png_id]).unwrap();
        replace_entry_image_links(&db, entry_c, &[jpg_id]).unwrap();

        let page = list_image_summaries_filtered(
            &db,
            Some(2),
            Some(0),
            Some(ImageSummarySort::MostUsed),
            None,
        )
        .unwrap();

        assert_eq!(page.items.len(), 2);
        assert!(page.has_more);
        assert_eq!(page.items[0].id, png_id);
        assert_eq!(page.items[0].usage_count, 2);
        assert!(page.items.iter().any(|item| item.id == jpg_id));
        assert!(!page.items.iter().any(|item| item.id == gif_id));
    }

    #[test]
    fn test_list_image_summaries_filters_by_month() {
        let (_tmp, db) = make_db();
        let june_id = upsert_image(&db, "image/png", &valid_png_bytes()).unwrap();
        let july_id = upsert_image(&db, "image/jpeg", &valid_jpeg_bytes()).unwrap();

        db.conn()
            .execute(
                "UPDATE images SET created_at = '2024-06-15T12:00:00+00:00' WHERE id = ?1",
                params![june_id],
            )
            .unwrap();
        db.conn()
            .execute(
                "UPDATE images SET created_at = '2024-07-03T12:00:00+00:00' WHERE id = ?1",
                params![july_id],
            )
            .unwrap();

        let june_page = list_image_summaries_filtered(
            &db,
            None,
            None,
            Some(ImageSummarySort::Newest),
            Some("2024-06"),
        )
        .unwrap();

        assert_eq!(june_page.items.len(), 1);
        assert_eq!(june_page.items[0].id, june_id);
    }

    #[test]
    fn test_list_image_summaries_backfills_missing_thumbnail_metadata() {
        let (_tmp, db) = make_db();
        let bytes = valid_png_bytes();
        let image_id = upsert_image(&db, "image/png", &bytes).unwrap();

        db.conn()
            .execute(
                "UPDATE images
                 SET thumbnail_data = NULL,
                     thumbnail_mime_type = NULL,
                     width = NULL,
                     height = NULL,
                     byte_size = NULL,
                     thumbnail_version = NULL
                 WHERE id = ?1",
                params![image_id],
            )
            .unwrap();

        let page = list_image_summaries_filtered(&db, Some(10), Some(0), None, None).unwrap();
        let summary = page.items.iter().find(|item| item.id == image_id).unwrap();
        assert!(summary.thumbnail_data_base64.is_some());
        assert_eq!(summary.width, Some(1));

        let stored_width: Option<i64> = db
            .conn()
            .query_row(
                "SELECT width FROM images WHERE id = ?1",
                params![image_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_width, Some(1));
    }

    #[test]
    fn test_list_image_summaries_isolates_corrupt_rows() {
        let (_tmp, db) = make_db();
        let encrypted =
            super::super::encrypt_for_storage(db.key(), b"not-an-image", "image").unwrap();
        db.conn()
            .execute(
                "INSERT INTO images (fingerprint, mime_type, data, created_at)
                 VALUES (?1, ?2, ?3, ?4)",
                params![
                    "corrupt-image-fingerprint",
                    "image/png",
                    encrypted,
                    "2024-06-01T00:00:00+00:00",
                ],
            )
            .unwrap();

        let page = list_image_summaries_filtered(&db, Some(10), Some(0), None, None).unwrap();
        assert_eq!(page.items.len(), 1);
        assert!(page.items[0].thumbnail_data_base64.is_none());
        assert!(page.items[0].thumbnail_mime_type.is_none());
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

    // --- Fix 1: single-quoted image-id:// refs must resolve ---

    #[test]
    fn test_resolve_image_refs_single_quoted() {
        let (_tmp, db) = make_db();
        let plaintext = valid_png_bytes();
        let img_id = upsert_image(&db, "image/png", &plaintext).unwrap();
        let entry_id = insert_blank_entry(&db);
        replace_entry_image_links(&db, entry_id, &[img_id]).unwrap();

        // Simulate HTML stored with single-quoted attribute.
        let raw_text = format!("<img src='image-id://{}' alt=''>", img_id);
        let entry = crate::db::queries::DiaryEntry {
            id: entry_id,
            date: "2024-01-01".to_string(),
            title: String::new(),
            text: raw_text,
            word_count: 0,
            date_created: String::new(),
            date_updated: String::new(),
            metadata: None,
            locked: false,
        };

        let resolved = resolve_image_refs_in_entries(&db, vec![entry]).unwrap();
        assert!(
            resolved[0].text.contains("data:image/png;base64,"),
            "single-quoted ref must resolve to data URL"
        );
        assert!(
            !resolved[0].text.contains("image-id://"),
            "no unresolved image-id:// refs must remain"
        );
    }

    #[test]
    fn test_resolve_image_refs_double_quoted() {
        let (_tmp, db) = make_db();
        let plaintext = valid_png_bytes();
        let img_id = upsert_image(&db, "image/png", &plaintext).unwrap();
        let entry_id = insert_blank_entry(&db);
        replace_entry_image_links(&db, entry_id, &[img_id]).unwrap();

        let raw_text = format!(r#"<img src="image-id://{}" alt="">"#, img_id);
        let entry = crate::db::queries::DiaryEntry {
            id: entry_id,
            date: "2024-01-01".to_string(),
            title: String::new(),
            text: raw_text,
            word_count: 0,
            date_created: String::new(),
            date_updated: String::new(),
            metadata: None,
            locked: false,
        };

        let resolved = resolve_image_refs_in_entries(&db, vec![entry]).unwrap();
        assert!(
            resolved[0].text.contains("data:image/png;base64,"),
            "double-quoted ref must resolve to data URL"
        );
        assert!(!resolved[0].text.contains("image-id://"));
    }

    // --- Fix 2: existing image refs must only be collected from <img src=...> ---

    #[test]
    fn test_plain_text_image_id_ref_does_not_create_entry_images_row() {
        let (_tmp, db) = make_db();
        let img_id = upsert_image(&db, "image/png", &valid_png_bytes()).unwrap();
        let entry_id = insert_blank_entry(&db);

        // Plain text mention of image-id:// — not inside an <img src=...> attribute.
        let html = format!("See image-id://{} for details", img_id);
        let (_, ids) = extract_and_replace_image_refs(&html, &db).unwrap();

        assert!(
            ids.is_empty(),
            "plain-text image-id:// must not be collected as an image reference"
        );
        // Simulate what save_entry does: only the returned ids become entry_images rows.
        replace_entry_image_links(&db, entry_id, &ids).unwrap();
        let count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM entry_images WHERE entry_id = ?1",
                params![entry_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            count, 0,
            "no entry_images row must be created for plain-text ref"
        );
    }

    #[test]
    fn test_invalid_img_src_image_id_ref_is_dropped() {
        let (_tmp, db) = make_db();
        // No images in the database — image ID 99999 does not exist.
        let html = r#"<img src="image-id://99999" alt="">"#;
        let (rewritten, ids) = extract_and_replace_image_refs(html, &db).unwrap();

        assert!(
            ids.is_empty(),
            "nonexistent image ID must be dropped from the id list"
        );
        // The tag must be preserved as-is (not corrupted).
        assert!(
            rewritten.contains("image-id://99999"),
            "tag must pass through unchanged"
        );
    }

    // --- Fix 3: export resolution tests ---

    #[test]
    fn test_resolve_image_refs_in_entries_replaces_stored_ref() {
        let (_tmp, db) = make_db();
        let img_id = upsert_image(&db, "image/png", &valid_png_bytes()).unwrap();
        let entry_id = insert_blank_entry(&db);
        replace_entry_image_links(&db, entry_id, &[img_id]).unwrap();

        let raw_text = format!(r#"<p><img src="image-id://{}" alt=""></p>"#, img_id);
        let entry = crate::db::queries::DiaryEntry {
            id: entry_id,
            date: "2024-01-01".to_string(),
            title: String::new(),
            text: raw_text,
            word_count: 0,
            date_created: String::new(),
            date_updated: String::new(),
            metadata: None,
            locked: false,
        };

        let resolved = resolve_image_refs_in_entries(&db, vec![entry]).unwrap();
        assert!(
            resolved[0].text.contains("data:image/png;base64,"),
            "stored ref must be resolved to a data URL"
        );
        assert!(
            !resolved[0].text.contains("image-id://"),
            "no unresolved refs must remain in exported text"
        );
    }

    #[test]
    fn test_extract_src_image_ref_parses_double_and_single_quotes() {
        assert_eq!(
            extract_src_image_ref(r#"<img src="image-id://42" alt="">"#),
            Some(42)
        );
        assert_eq!(
            extract_src_image_ref("<img src='image-id://7' alt=''>"),
            Some(7)
        );
        assert_eq!(
            extract_src_image_ref(r#"<img src="data:image/png;base64,abc" alt="">"#),
            None
        );
        assert_eq!(
            extract_src_image_ref(r#"<img alt="image-id://5">"#),
            None,
            "must not match image-id:// outside src attribute"
        );
    }
}
