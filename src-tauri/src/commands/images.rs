use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::queries::images::{ImageData, ImageSummaryPage, ImageSummarySort};
use tauri::State;

/// Returns all decrypted images associated with a specific entry.
#[tauri::command]
pub fn get_entry_images(entry_id: i64, state: State<DiaryState>) -> Result<Vec<ImageData>, String> {
    with_unlocked_db(&state, |db| {
        crate::db::queries::images::get_images_for_entry(db, entry_id)
    })
}

/// Returns metadata-only image summaries stored in the journal, newest-first.
#[tauri::command]
pub fn list_journal_image_summaries(
    limit: Option<i64>,
    offset: Option<i64>,
    sort: Option<ImageSummarySort>,
    month: Option<String>,
    state: State<DiaryState>,
) -> Result<ImageSummaryPage, String> {
    with_unlocked_db(&state, |db| {
        crate::db::queries::images::list_image_summaries_filtered(
            db,
            limit,
            offset,
            sort,
            month.as_deref(),
        )
    })
}

/// Returns one decrypted image by id.
#[tauri::command]
pub fn get_image_data(image_id: i64, state: State<DiaryState>) -> Result<ImageData, String> {
    with_unlocked_db(&state, |db| {
        crate::db::queries::images::get_image_by_id(db, image_id)?
            .ok_or_else(|| format!("No image found with id: {}", image_id))
    })
}
