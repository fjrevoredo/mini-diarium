//! Paginated image summaries for media-picker UIs, including lazy backfill of
//! thumbnail metadata for rows written before schema v11.

use super::thumbnail::{
    persist_image_storage_metadata, prepare_image_storage_metadata, ImageStorageMetadata,
    THUMBNAIL_GENERATION_VERSION,
};
use super::{ImageSummary, ImageSummaryPage, ImageSummarySort};
use crate::db::schema::DatabaseConnection;
use base64::{engine::general_purpose, Engine as _};
use rusqlite::params;

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
    let plaintext = super::super::decrypt_bytes(db.key(), &row.encrypted_data, "image")?;
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
        match super::super::decrypt_bytes(db.key(), encrypted_thumbnail, "image thumbnail") {
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

#[cfg(test)]
mod tests {
    use super::super::storage::{replace_entry_image_links, upsert_image};
    use super::super::test_support::{
        insert_entry_for_date, make_db, valid_gif_bytes, valid_jpeg_bytes, valid_png_bytes,
    };
    use super::super::thumbnail::THUMBNAIL_MIME_TYPE;
    use super::*;

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
            crate::db::queries::encrypt_for_storage(db.key(), b"not-an-image", "image").unwrap();
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
}
