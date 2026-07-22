//! Encrypted image storage.
//!
//! Split by responsibility: [`storage`] (validation + row CRUD), [`thumbnail`]
//! (derived thumbnail/dimension metadata), [`summaries`] (picker listing with
//! backfill), and [`refs`] (`image-id://` ↔ data-URI rewriting).

mod refs;
mod storage;
mod summaries;
mod thumbnail;

pub use refs::*;
pub use storage::*;
pub use summaries::*;

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

#[cfg(test)]
mod test_support;
