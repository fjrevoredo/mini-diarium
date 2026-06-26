//! Shared test fixtures for the `entries` submodules. Compiled only under `cfg(test)`.

use super::DiaryEntry;
use base64::{engine::general_purpose, Engine as _};
use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
use std::io::Cursor;

/// A canonical text-only entry used across the entry query tests.
pub fn create_test_entry(date: &str) -> DiaryEntry {
    let now = "2024-01-01T12:00:00Z".to_string();
    DiaryEntry {
        id: 0,
        date: date.to_string(),
        title: "Test Title".to_string(),
        text: "This is a test entry with some words.".to_string(),
        word_count: 8,
        date_created: now.clone(),
        date_updated: now,
        metadata: None,
    }
}

/// A 1×1 PNG encoded as base64 (deterministic pixel → stable fingerprint).
pub fn tiny_png_base64() -> String {
    let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(1, 1, Rgba([16, 32, 64, 255])));
    let mut cursor = Cursor::new(Vec::new());
    image.write_to(&mut cursor, ImageFormat::Png).unwrap();
    general_purpose::STANDARD.encode(cursor.into_inner())
}

/// HTML body embedding [`tiny_png_base64`] as a data URL.
pub fn tiny_png_html() -> String {
    format!(
        r#"<p>Hi</p><img src="data:image/png;base64,{}" alt="">"#,
        tiny_png_base64()
    )
}

/// A second, distinctly-colored PNG → different fingerprint → different image id.
pub fn tiny_png_base64_other() -> String {
    let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(2, 2, Rgba([128, 64, 32, 255])));
    let mut cursor = Cursor::new(Vec::new());
    image.write_to(&mut cursor, ImageFormat::Png).unwrap();
    general_purpose::STANDARD.encode(cursor.into_inner())
}
