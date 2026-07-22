//! In-memory full-text search over decrypted entries.
//!
//! Part of the curated `mini-diarium-core` façade (see `API.md`). The Tauri
//! `search_entries` command in the app crate is a thin wrapper around
//! [`search_entries`]. Entries are field-level encrypted at rest; this module
//! decrypts them in memory per query and never persists a plaintext index —
//! honoring the project rule that search must not store plaintext on disk.
//!
//! The DB-free matching and snippet helpers live in [`text`].

use serde::Serialize;

use crate::db::{get_all_entries, DatabaseConnection};

mod text;

use text::{build_snippet, lower_with_map, matches_all, normalize_terms, strip_html};

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub id: i64,
    pub date: String,
    pub title: String,
    pub snippet: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    /// Count of matching entries BEFORE truncation to MAX_RESULTS.
    pub total_matches: usize,
}

/// Max matches returned to the UI; newest-first.
pub const MAX_RESULTS: usize = 200;

/// Full-text search across decrypted entries.
///
/// # Security
/// Entries are field-level encrypted (`title_encrypted` / `text_encrypted`) while the
/// SQLite file itself is plaintext at rest. We therefore decrypt in memory and never
/// persist a plaintext index — honoring the project rule that search must not store
/// plaintext on disk. This reuses `db::get_all_entries` (the same decrypt path
/// used by export/stats) rather than touching the crypto layer directly.
///
/// This is an in-memory linear scan (no FTS/index), which is acceptable for the
/// personal-journal scale this app targets: the cost is paid per query, debounced on
/// the client, and nothing sensitive is written to disk.
pub fn search_entries(db: &DatabaseConnection, query: &str) -> Result<SearchResponse, String> {
    let terms = normalize_terms(query);
    if terms.is_empty() {
        return Ok(SearchResponse {
            results: vec![],
            total_matches: 0,
        });
    }

    let entries = get_all_entries(db)?;

    let mut results: Vec<SearchResult> = Vec::new();
    for entry in &entries {
        // `entry.text` is raw TipTap HTML (`editor.getHTML()`). Match and snippet over the
        // visible prose, not the markup, so terms like "p"/"strong"/"em" don't hit tag
        // names in every entry. Titles are plain text and need no stripping.
        let text_plain = strip_html(&entry.text);
        let (title_lc, title_map) = lower_with_map(&entry.title);
        let (text_lc, text_map) = lower_with_map(&text_plain);

        if !matches_all(&title_lc, &text_lc, &terms) {
            continue;
        }

        // Prefer a body snippet; fall back to the title.
        let snippet = build_snippet(&text_plain, &text_lc, &text_map, &terms)
            .or_else(|| build_snippet(&entry.title, &title_lc, &title_map, &terms))
            .unwrap_or_default();

        results.push(SearchResult {
            id: entry.id,
            date: entry.date.clone(),
            title: entry.title.clone(),
            snippet,
        });
    }

    // ISO dates → lexicographic == chronological; newest first.
    results.sort_by(|a, b| b.date.cmp(&a.date));
    let total_matches = results.len();
    results.truncate(MAX_RESULTS);
    Ok(SearchResponse {
        results,
        total_matches,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_result_serialization() {
        let result = SearchResult {
            id: 1,
            date: "2024-01-01".to_string(),
            title: "Test Entry".to_string(),
            snippet: "This is a <mark>test</mark> snippet".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"id\":1"));
        assert!(json.contains("2024-01-01"));
        assert!(json.contains("Test Entry"));
        assert!(json.contains("<mark>test</mark>"));
    }
}

/// Integration tests: call `search_entries` with a real (temp-file) database so the
/// full scan path — get_all_entries decryption, snippet building, sort, truncation — is
/// exercised under coverage.
#[cfg(test)]
mod db_tests {
    use super::*;
    use crate::db::{create_database, insert_entry, DiaryEntry};

    fn make_entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        let ts = "2024-01-01T00:00:00Z".to_string();
        DiaryEntry {
            id: 0,
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: 1,
            date_created: ts.clone(),
            date_updated: ts,
            metadata: None,
            locked: false,
        }
    }

    #[test]
    fn empty_query_returns_empty_results() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let resp = search_entries(&db, "").unwrap();
        assert!(resp.results.is_empty());
        assert_eq!(resp.total_matches, 0);
    }

    #[test]
    fn whitespace_only_query_returns_empty_results() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let resp = search_entries(&db, "   ").unwrap();
        assert!(resp.results.is_empty());
        assert_eq!(resp.total_matches, 0);
    }

    #[test]
    fn returns_matching_entries_with_correct_total_and_snippet() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        insert_entry(
            &db,
            &make_entry(
                "2024-01-01",
                "Rust notes",
                "<p>Rust is fast and memory safe.</p>",
            ),
        )
        .unwrap();
        insert_entry(
            &db,
            &make_entry(
                "2024-01-02",
                "Python notes",
                "<p>Python is easy to learn.</p>",
            ),
        )
        .unwrap();

        let resp = search_entries(&db, "rust").unwrap();

        assert_eq!(resp.total_matches, 1);
        assert_eq!(resp.results.len(), 1);
        assert_eq!(resp.results[0].title, "Rust notes");
        assert!(resp.results[0].snippet.contains("<mark>"));
    }

    #[test]
    fn results_are_sorted_newest_first() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        insert_entry(&db, &make_entry("2024-01-01", "Old", "<p>needle</p>")).unwrap();
        insert_entry(&db, &make_entry("2024-12-31", "New", "<p>needle</p>")).unwrap();

        let resp = search_entries(&db, "needle").unwrap();

        assert_eq!(resp.results.len(), 2);
        assert_eq!(resp.results[0].date, "2024-12-31");
        assert_eq!(resp.results[1].date, "2024-01-01");
    }

    #[test]
    fn total_matches_counts_before_truncation() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "pass".to_string()).unwrap();
        let count = MAX_RESULTS + 5;
        for i in 0..count {
            let date = format!("2024-{:02}-{:02}", (i % 12) + 1, (i % 28) + 1);
            insert_entry(&db, &make_entry(&date, "Entry", "<p>needle</p>")).unwrap();
        }

        let resp = search_entries(&db, "needle").unwrap();

        assert_eq!(resp.total_matches, count);
        assert_eq!(resp.results.len(), MAX_RESULTS);
    }
}
