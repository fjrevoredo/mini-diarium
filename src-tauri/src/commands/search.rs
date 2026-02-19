use crate::commands::auth::DiaryState;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub date: String,
    pub title: String,
    pub snippet: String,
}

/// Search diary entries.
///
/// # Note
/// Full-text search is not yet implemented. This stub preserves the command interface so
/// that a future search module can be added here without frontend changes.
/// To implement: add a secure search index in `db/` and call it from this function.
#[tauri::command]
pub fn search_entries(
    _query: String,
    _state: State<DiaryState>,
) -> Result<Vec<SearchResult>, String> {
    Ok(vec![])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_result_serialization() {
        // Test that SearchResult can be serialized
        let result = SearchResult {
            date: "2024-01-01".to_string(),
            title: "Test Entry".to_string(),
            snippet: "This is a <mark>test</mark> snippet".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("2024-01-01"));
        assert!(json.contains("Test Entry"));
        assert!(json.contains("<mark>test</mark>"));
    }
}
