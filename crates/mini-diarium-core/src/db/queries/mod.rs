pub mod attachments;
pub mod auth_slots;
pub mod db_settings;
pub mod entries;
pub mod fonts;
pub mod images;
pub mod meta;
pub mod tags;

pub use attachments::*;
pub use auth_slots::*;
pub use db_settings::*;
pub use entries::*;
pub use fonts::*;
pub use images::*;
pub use meta::*;
pub use tags::*;

/// Largest plaintext blob (image or attachment) the journal stores: 20 MB.
///
/// Shared by images and attachments so both enforce one limit. Public so the app crate can
/// reject an oversized file from its metadata **before** reading it into memory.
pub const MAX_STORED_BLOB_BYTES: usize = 20 * 1024 * 1024;

// The encrypted-row field codec now lives in the rusqlite-free kernel (open-core M3b /
// TODO-0083). Re-export under the historical names so db::queries call sites are unchanged.
pub(crate) use crate::format::{decrypt_bytes, decrypt_utf8, encrypt_for_storage};
