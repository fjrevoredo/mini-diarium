//! Derived thumbnail and dimension metadata for stored images.
//!
//! The thumbnail is encrypted with the same master key as the full image, so a
//! picker listing never touches plaintext on disk.

use crate::db::schema::DatabaseConnection;
use image::codecs::png::PngEncoder;
use image::{GenericImageView, ImageEncoder};
use rusqlite::params;

pub(super) const THUMBNAIL_MAX_EDGE: u32 = 224;
pub(super) const THUMBNAIL_MIME_TYPE: &str = "image/png";
pub(super) const THUMBNAIL_GENERATION_VERSION: i32 = 1;

pub(super) struct ImageStorageMetadata {
    pub(super) thumbnail_plaintext: Vec<u8>,
    pub(super) thumbnail_encrypted: Vec<u8>,
    pub(super) thumbnail_mime_type: String,
    pub(super) width: i64,
    pub(super) height: i64,
    pub(super) byte_size: i64,
    pub(super) thumbnail_version: i32,
}

pub(super) fn prepare_image_storage_metadata(
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
        super::super::encrypt_for_storage(db.key(), &thumbnail_plaintext, "image thumbnail")?;

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

pub(super) fn persist_image_storage_metadata(
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
