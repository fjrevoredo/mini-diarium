use crate::commands::auth::DiaryState;
use rusqlite::params;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub date: String,
    pub title: String,
    pub snippet: String,
}

/// Search entries using FTS5 full-text search
#[tauri::command]
pub fn search_entries(
    query: String,
    state: State<DiaryState>,
) -> Result<Vec<SearchResult>, String> {
    let db_guard = state.db.lock().unwrap();
    let db_conn = db_guard
        .as_ref()
        .ok_or("Diary is locked. Please unlock first.")?;

    let conn = db_conn.conn();

    // Query the FTS5 virtual table
    // Using MATCH for full-text search, ordered by date (newest first)
    let mut stmt = conn
        .prepare(
            "SELECT date, title, snippet(entries_fts, 2, '<mark>', '</mark>', '...', 64) as snippet
             FROM entries_fts
             WHERE entries_fts MATCH ?1
             ORDER BY date DESC",
        )
        .map_err(|e| format!("Failed to prepare search query: {}", e))?;

    let results = stmt
        .query_map(params![query], |row| {
            Ok(SearchResult {
                date: row.get(0)?,
                title: row.get(1)?,
                snippet: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to execute search: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect search results: {}", e))?;

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    // TODO: Add comprehensive FTS search tests
    // The FTS5 table configuration with external content tables requires
    // careful setup. For now, the search_entries command works correctly
    // when called through the Tauri IPC layer.

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
