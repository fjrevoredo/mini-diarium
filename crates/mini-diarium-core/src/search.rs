//! In-memory full-text search over decrypted entries.
//!
//! Part of the curated `mini-diarium-core` façade (see `API.md`). The Tauri
//! `search_entries` command in the app crate is a thin wrapper around
//! [`search_entries`]. Entries are field-level encrypted at rest; this module
//! decrypts them in memory per query and never persists a plaintext index —
//! honoring the project rule that search must not store plaintext on disk.

use serde::Serialize;

use crate::db::{get_all_entries, DatabaseConnection};
use unicode_normalization::char::is_combining_mark;
use unicode_normalization::UnicodeNormalization;

/// Case- and accent-fold one char: lowercase, NFD-decompose, drop combining marks.
/// Per-char NFD is sufficient for accent stripping — we discard all combining marks,
/// so canonical reordering across chars is irrelevant.
fn fold_char(ch: char) -> impl Iterator<Item = char> {
    ch.to_lowercase().nfd().filter(|c| !is_combining_mark(*c))
}

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
/// Bytes of context shown on each side of a match (snapped to char boundaries).
const SNIPPET_RADIUS: usize = 48;

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

/// AND semantics: every term must appear in the (folded) title or body.
fn matches_all(title_lc: &str, text_lc: &str, terms: &[String]) -> bool {
    terms
        .iter()
        .all(|t| title_lc.contains(t.as_str()) || text_lc.contains(t.as_str()))
}

/// Split a query into deduped, case- and accent-folded terms.
fn normalize_terms(query: &str) -> Vec<String> {
    let mut terms: Vec<String> = Vec::new();
    for raw in query.split_whitespace() {
        let folded: String = raw.chars().flat_map(fold_char).collect();
        if !folded.is_empty() && !terms.contains(&folded) {
            terms.push(folded);
        }
    }
    terms
}

/// Strip HTML tags so matching and snippets run over visible prose rather than TipTap
/// markup. Not a full HTML parser — a lightweight tag remover, sufficient for the editor's
/// own serialized output (no DOM in Rust). Entity decoding is intentionally left out; the
/// few entities the editor emits render as literal text in a snippet, which is acceptable.
fn strip_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out
}

/// Case- and accent-fold a string while recording, for each byte of the folded output,
/// the byte offset of the originating char in the source. A trailing sentinel maps
/// `folded.len()` back to `src.len()` so a match end never indexes out of range.
///
/// This is what makes snippet offsets correct: folding (lowercasing + NFD accent
/// stripping) can change byte length (e.g. 'İ', or 'é' → 'e'), so a `find()` offset in
/// the folded string is not a valid index into the original without this map. Each folded
/// byte still maps to its originating source char's start offset, so `build_snippet` can
/// slice the original (accented) text around a match.
fn lower_with_map(src: &str) -> (String, Vec<usize>) {
    let mut lowered = String::with_capacity(src.len());
    let mut map: Vec<usize> = Vec::with_capacity(src.len() + 1);
    for (idx, ch) in src.char_indices() {
        for lc in fold_char(ch) {
            let mut buf = [0u8; 4];
            let encoded = lc.encode_utf8(&mut buf);
            for _ in 0..encoded.len() {
                map.push(idx);
            }
            lowered.push(lc);
        }
    }
    map.push(src.len()); // sentinel
    (lowered, map)
}

/// Build a `<mark>`-highlighted, HTML-escaped snippet around the earliest term hit.
fn build_snippet(orig: &str, lowered: &str, map: &[usize], terms: &[String]) -> Option<String> {
    let (match_byte, match_len) = terms
        .iter()
        .filter_map(|t| lowered.find(t.as_str()).map(|b| (b, t.len())))
        .min_by_key(|&(b, _)| b)?;

    let m_start = map[match_byte];
    let m_end = map[match_byte + match_len];

    let win_start = snap_floor(orig, m_start.saturating_sub(SNIPPET_RADIUS));
    let win_end = snap_ceil(orig, (m_end + SNIPPET_RADIUS).min(orig.len()));

    let mut out = String::new();
    if win_start > 0 {
        out.push('…');
    }
    out.push_str(&escape_html(&orig[win_start..m_start]));
    out.push_str("<mark>");
    out.push_str(&escape_html(&orig[m_start..m_end]));
    out.push_str("</mark>");
    out.push_str(&escape_html(&orig[m_end..win_end]));
    if win_end < orig.len() {
        out.push('…');
    }
    Some(out)
}

fn snap_floor(s: &str, mut i: usize) -> usize {
    while i > 0 && !s.is_char_boundary(i) {
        i -= 1;
    }
    i
}

fn snap_ceil(s: &str, mut i: usize) -> usize {
    while i < s.len() && !s.is_char_boundary(i) {
        i += 1;
    }
    i
}

/// Escape text destined for the `<mark>`-bearing snippet so entry content can't inject
/// markup. `&` first so existing characters aren't double-escaped.
fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
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

// The implementation helpers run under the default feature set now that search is part
// of production builds.
#[cfg(test)]
mod impl_tests {
    use super::*;

    #[test]
    fn normalize_terms_folds_dedups_and_splits() {
        assert_eq!(
            normalize_terms("  Hello   WORLD hello "),
            vec!["hello".to_string(), "world".to_string()]
        );
        assert!(normalize_terms("   ").is_empty());
    }

    #[test]
    fn matches_all_is_and_across_title_and_body() {
        let terms = normalize_terms("rust journal");
        assert!(matches_all("my rust notes", "a journal entry", &terms));
        assert!(!matches_all("my rust notes", "no body match", &terms));
    }

    #[test]
    fn strip_html_removes_tags_so_tag_names_are_not_matchable() {
        let html = "<p>Hello <strong>world</strong></p>";
        let plain = strip_html(html);
        assert_eq!(plain, "Hello world");

        // Visible prose still matches; tag names ("p", "strong") no longer do.
        let (lc, _) = lower_with_map(&plain);
        let hit = |q: &str| matches_all("", &lc, &normalize_terms(q));
        assert!(hit("world"));
        assert!(!hit("strong"));
        assert!(!hit("p"));
    }

    #[test]
    fn lower_with_map_sentinel_and_ascii_offsets() {
        let (lc, map) = lower_with_map("AbC");
        assert_eq!(lc, "abc");
        assert_eq!(map, vec![0, 1, 2, 3]); // incl. sentinel == src.len()
    }

    #[test]
    fn snippet_highlights_first_match_case_insensitively() {
        let (lc, map) = lower_with_map("The Rust language");
        let terms = normalize_terms("rust");
        let snip = build_snippet("The Rust language", &lc, &map, &terms).unwrap();
        assert!(snip.contains("<mark>Rust</mark>")); // original casing preserved
    }

    #[test]
    fn snippet_escapes_surrounding_html() {
        let text = "load <script>alert(1)</script> rust";
        let (lc, map) = lower_with_map(text);
        let terms = normalize_terms("rust");
        let snip = build_snippet(text, &lc, &map, &terms).unwrap();
        assert!(!snip.contains("<script>"));
        assert!(snip.contains("&lt;script&gt;"));
        assert!(snip.contains("<mark>rust</mark>"));
    }

    #[test]
    fn snippet_is_char_boundary_safe_on_multibyte() {
        let text = format!("{} rust", "héllo wörld ".repeat(10));
        let (lc, map) = lower_with_map(&text);
        let terms = normalize_terms("rust");
        let snip = build_snippet(&text, &lc, &map, &terms).unwrap(); // must not panic
        assert!(snip.contains("<mark>rust</mark>"));
    }

    #[test]
    fn no_match_returns_none_snippet() {
        let (lc, map) = lower_with_map("nothing here");
        let terms = normalize_terms("rust");
        assert!(build_snippet("nothing here", &lc, &map, &terms).is_none());
    }

    #[test]
    fn normalize_terms_folds_accents() {
        // Case + accent folding collapse all three spellings into one deduped term.
        assert_eq!(normalize_terms("Café CAFÉ cafe"), vec!["cafe".to_string()]);
    }

    #[test]
    fn lower_with_map_strips_accents_and_keeps_map() {
        // 'é' is 2 bytes at source idx 3; it folds to the 1-byte 'e' mapping back to 3.
        // Sentinel == src.len() == 5.
        let (lc, map) = lower_with_map("Café");
        assert_eq!(lc, "cafe");
        assert_eq!(map, vec![0, 1, 2, 3, 5]);
    }

    #[test]
    fn snippet_matches_and_highlights_accented_original() {
        // An unaccented query matches accented text, and the snippet preserves the
        // original accented characters inside the <mark> (must not panic).
        let text = "I love Café au lait";
        let (lc, map) = lower_with_map(text);
        let terms = normalize_terms("cafe");
        let snip = build_snippet(text, &lc, &map, &terms).unwrap();
        assert!(snip.contains("<mark>Café</mark>"));
    }
}
