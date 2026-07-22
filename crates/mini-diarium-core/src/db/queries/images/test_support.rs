//! Shared test fixtures for the `images` submodules. Compiled only under `cfg(test)`.

use crate::db::schema::{create_database, DatabaseConnection};
use base64::{engine::general_purpose, Engine as _};
use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
use rusqlite::params;
use std::io::Cursor;

/// A 1×1 white PNG encoded as base64.
pub const TINY_PNG_B64: &str =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// Returns the NamedTempFile alongside the connection so the caller can keep it alive.
// On Linux the tempfile is unlinked when dropped, which makes SQLite return
// SQLITE_READONLY_DBMOVED on subsequent writes. Bind the returned value to `_tmp`
// in each test so the file persists for the test's lifetime.
pub fn make_db() -> (tempfile::NamedTempFile, DatabaseConnection) {
    let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
    let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
    (tmp, db)
}

pub fn insert_blank_entry(db: &DatabaseConnection) -> i64 {
    insert_entry_for_date(db, "2024-01-01")
}

pub fn insert_entry_for_date(db: &DatabaseConnection, date: &str) -> i64 {
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

pub fn valid_png_bytes() -> Vec<u8> {
    general_purpose::STANDARD.decode(TINY_PNG_B64).unwrap()
}

pub fn encode_test_image(format: ImageFormat) -> Vec<u8> {
    let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(2, 1, Rgba([32, 64, 128, 255])));
    let mut cursor = Cursor::new(Vec::new());
    image.write_to(&mut cursor, format).unwrap();
    cursor.into_inner()
}

pub fn valid_jpeg_bytes() -> Vec<u8> {
    encode_test_image(ImageFormat::Jpeg)
}

pub fn valid_gif_bytes() -> Vec<u8> {
    encode_test_image(ImageFormat::Gif)
}

pub fn valid_webp_bytes() -> Vec<u8> {
    encode_test_image(ImageFormat::WebP)
}

pub fn valid_bmp_bytes() -> Vec<u8> {
    encode_test_image(ImageFormat::Bmp)
}
