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
    use crate::db::queries::{self, DiaryEntry};
    use crate::db::schema::create_database;
    use rusqlite::params;
    use std::fs;
    use std::path::PathBuf;

    fn temp_db_path(name: &str) -> PathBuf {
        PathBuf::from(format!("test_search_{}.db", name))
    }

    fn cleanup_db(path: &PathBuf) {
        let _ = fs::remove_file(path);
    }

    /// Helper function to perform FTS search directly on the database
    fn search_fts(
        db: &crate::db::schema::DatabaseConnection,
        query: &str,
    ) -> Result<Vec<SearchResult>, String> {
        let conn = db.conn();

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

    #[test]
    fn test_fts_table_contents() {
        // Debug test to see what's actually in the FTS table
        let db_path = temp_db_path("fts_debug");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        // Insert an entry
        let entry = DiaryEntry {
            date: "2024-01-01".to_string(),
            title: "My First Entry".to_string(),
            text: "Today I went to the park and saw beautiful flowers.".to_string(),
            word_count: 10,
            date_created: chrono::Utc::now().to_rfc3339(),
            date_updated: chrono::Utc::now().to_rfc3339(),
        };
        queries::insert_entry(&db, &entry).unwrap();

        // Check what's in the FTS table
        let conn = db.conn();
        let result: Result<(i64, String, String, String), _> = conn.query_row(
            "SELECT rowid, date, title, text FROM entries_fts LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        );

        match result {
            Ok((rowid, date, title, text)) => {
                println!("FTS rowid: {}", rowid);
                println!("FTS date: {}", date);
                println!("FTS title: '{}'", title);
                println!("FTS text: '{}'", text);

                // These should NOT be empty!
                assert_eq!(date, "2024-01-01");
                assert_eq!(title, "My First Entry", "Title should be populated in FTS");
                assert!(text.contains("flowers"), "Text should be populated in FTS");
            }
            Err(e) => {
                panic!("Failed to query FTS table: {}", e);
            }
        }

        cleanup_db(&db_path);
    }

    #[test]
    fn test_search_finds_entry_by_text() {
        let db_path = temp_db_path("find_by_text");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        // Insert an entry with searchable content
        let entry = DiaryEntry {
            date: "2024-01-01".to_string(),
            title: "My First Entry".to_string(),
            text: "Today I went to the park and saw beautiful flowers.".to_string(),
            word_count: 10,
            date_created: chrono::Utc::now().to_rfc3339(),
            date_updated: chrono::Utc::now().to_rfc3339(),
        };
        queries::insert_entry(&db, &entry).unwrap();

        // Search for "flowers" - should find the entry
        let results = search_fts(&db, "flowers").unwrap();
        assert_eq!(results.len(), 1, "Should find 1 entry with 'flowers'");
        assert_eq!(results[0].date, "2024-01-01");
        assert_eq!(results[0].title, "My First Entry");
        assert!(
            results[0].snippet.contains("flowers"),
            "Snippet should contain 'flowers'"
        );

        cleanup_db(&db_path);
    }

    #[test]
    fn test_search_finds_entry_by_title() {
        let db_path = temp_db_path("find_by_title");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        // Insert an entry with searchable title
        let entry = DiaryEntry {
            date: "2024-01-15".to_string(),
            title: "Vacation Plans".to_string(),
            text: "Need to book hotels and flights.".to_string(),
            word_count: 6,
            date_created: chrono::Utc::now().to_rfc3339(),
            date_updated: chrono::Utc::now().to_rfc3339(),
        };
        queries::insert_entry(&db, &entry).unwrap();

        // Search for "vacation" - should find the entry by title
        let results = search_fts(&db, "vacation").unwrap();
        assert_eq!(results.len(), 1, "Should find 1 entry with 'vacation'");
        assert_eq!(results[0].date, "2024-01-15");
        assert_eq!(results[0].title, "Vacation Plans");

        cleanup_db(&db_path);
    }

    #[test]
    fn test_search_no_results() {
        let db_path = temp_db_path("no_results");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        // Insert an entry
        let entry = DiaryEntry {
            date: "2024-01-01".to_string(),
            title: "Test Entry".to_string(),
            text: "Some content here.".to_string(),
            word_count: 3,
            date_created: chrono::Utc::now().to_rfc3339(),
            date_updated: chrono::Utc::now().to_rfc3339(),
        };
        queries::insert_entry(&db, &entry).unwrap();

        // Search for something that doesn't exist
        let results = search_fts(&db, "nonexistent").unwrap();
        assert_eq!(results.len(), 0, "Should find no results for 'nonexistent'");

        cleanup_db(&db_path);
    }

    #[test]
    fn test_search_multiple_entries() {
        let db_path = temp_db_path("multiple");
        cleanup_db(&db_path);

        let db = create_database(&db_path, "test".to_string()).unwrap();

        // Insert multiple entries with "coffee"
        let entries = vec![
            DiaryEntry {
                date: "2024-01-01".to_string(),
                title: "Morning Coffee".to_string(),
                text: "Had a great cup of coffee today.".to_string(),
                word_count: 7,
                date_created: chrono::Utc::now().to_rfc3339(),
                date_updated: chrono::Utc::now().to_rfc3339(),
            },
            DiaryEntry {
                date: "2024-01-05".to_string(),
                title: "Cafe Visit".to_string(),
                text: "Tried a new coffee shop downtown.".to_string(),
                word_count: 6,
                date_created: chrono::Utc::now().to_rfc3339(),
                date_updated: chrono::Utc::now().to_rfc3339(),
            },
            DiaryEntry {
                date: "2024-01-03".to_string(),
                title: "Work Day".to_string(),
                text: "Busy day at the office, no coffee breaks.".to_string(),
                word_count: 8,
                date_created: chrono::Utc::now().to_rfc3339(),
                date_updated: chrono::Utc::now().to_rfc3339(),
            },
        ];

        for entry in &entries {
            queries::insert_entry(&db, entry).unwrap();
        }

        // Search for "coffee" - should find all 3 entries
        let results = search_fts(&db, "coffee").unwrap();
        assert_eq!(results.len(), 3, "Should find 3 entries with 'coffee'");

        // Results should be sorted by date DESC
        assert_eq!(results[0].date, "2024-01-05");
        assert_eq!(results[1].date, "2024-01-03");
        assert_eq!(results[2].date, "2024-01-01");

        cleanup_db(&db_path);
    }
}
