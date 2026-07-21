//! Thin Tauri wrapper around the core search scan.
//!
//! The in-memory scan logic (decrypt entries, fold terms, build `<mark>` snippets) lives
//! in `mini_diarium_core::search`. This command layer only bridges IPC to it.
//!
//! The search interface contract (see root CLAUDE.md Gotcha #1) requires `SearchResult`,
//! `SearchResponse`, and `search_entries` to stay intact — they are re-exported here so
//! existing `commands::search::…` paths and the serde field names the frontend depends on
//! are unchanged.

use crate::commands::auth::{with_unlocked_db, DiaryState};
use tauri::State;

pub use mini_diarium_core::search::{SearchResponse, SearchResult};

/// Full-text search across decrypted entries.
///
/// # Security
/// Entries are field-level encrypted at rest; the core scan decrypts them in memory per
/// query and never persists a plaintext index. See `mini_diarium_core::search`.
#[tauri::command]
pub fn search_entries(query: String, state: State<DiaryState>) -> Result<SearchResponse, String> {
    with_unlocked_db(&state, |db| {
        mini_diarium_core::search::search_entries(db, &query)
    })
}
