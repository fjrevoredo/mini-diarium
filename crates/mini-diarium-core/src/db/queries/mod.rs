pub mod auth_slots;
pub mod db_settings;
pub mod entries;
pub mod fonts;
pub mod images;
pub mod meta;
pub mod tags;

pub use auth_slots::*;
pub use db_settings::*;
pub use entries::*;
pub use fonts::*;
pub use images::*;
pub use meta::*;
pub use tags::*;

// The encrypted-row field codec now lives in the rusqlite-free kernel (open-core M3b /
// TODO-0083). Re-export under the historical names so db::queries call sites are unchanged.
pub(crate) use crate::format::{decrypt_bytes, decrypt_utf8, encrypt_for_storage};
