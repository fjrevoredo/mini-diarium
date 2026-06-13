use crate::commands::auth::{with_unlocked_db, DiaryState};
use crate::db::queries;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub date: String,
    pub title: String,
    pub snippet: String,
}

/// Max matches returned to the UI; newest-first.
const MAX_RESULTS: usize = 200;
/// Bytes of context shown on each side of a match (snapped to char boundaries).
const SNIPPET_RADIUS: usize = 48;

/// Full-text search across decrypted entries.
///
/// # Security
/// Entries are field-level encrypted (`title_encrypted` / `text_encrypted`) while the
/// SQLite file itself is plaintext at rest. We therefore decrypt in memory and never
/// persist a plaintext index — honoring the project rule that search must not store
/// plaintext on disk. This reuses `queries::get_all_entries` (the same decrypt path
/// used by export/stats) rather than touching the crypto layer directly.
#[tauri::command]
pub fn search_entries(
    query: String,
    state: State<DiaryState>,
) -> Result<Vec<SearchResult>, String> {
    let terms = normalize_terms(&query);
    if terms.is_empty() {
        return Ok(vec![]);
    }

    with_unlocked_db(&state, |db| {
        let entries = queries::get_all_entries(db)?;

        let mut results: Vec<SearchResult> = Vec::new();
        for entry in &entries {
            let (title_lc, title_map) = lower_with_map(&entry.title);
            let (text_lc, text_map) = lower_with_map(&entry.text);

            if !matches_all(&title_lc, &text_lc, &terms) {
                continue;
            }

            // Prefer a body snippet; fall back to the title.
            let snippet = build_snippet(&entry.text, &text_lc, &text_map, &terms)
                .or_else(|| build_snippet(&entry.title, &title_lc, &title_map, &terms))
                .unwrap_or_default();

            results.push(SearchResult {
                date: entry.date.clone(),
                title: entry.title.clone(),
                snippet,
            });
        }

        // ISO dates → lexicographic == chronological; newest first.
        results.sort_by(|a, b| b.date.cmp(&a.date));
        results.truncate(MAX_RESULTS);
        Ok(results)
    })
}

/// AND semantics: every term must appear in the (folded) title or body.
fn matches_all(title_lc: &str, text_lc: &str, terms: &[String]) -> bool {
    terms
        .iter()
        .all(|t| title_lc.contains(t.as_str()) || text_lc.contains(t.as_str()))
}

/// Split a query into deduped, case-folded terms.
fn normalize_terms(query: &str) -> Vec<String> {
    let mut terms: Vec<String> = Vec::new();
    for raw in query.split_whitespace() {
        let folded: String = raw.chars().flat_map(|c| c.to_lowercase()).collect();
        if !folded.is_empty() && !terms.contains(&folded) {
            terms.push(folded);
        }
    }
    terms
}

/// Lowercase a string while recording, for each byte of the lowered output, the byte
/// offset of the originating char in the source. A trailing sentinel maps `lowered.len()`
/// back to `src.len()` so a match end never indexes out of range.
///
/// This is what makes snippet offsets correct: `char::to_lowercase()` can change byte
/// length (e.g. 'İ'), so a `find()` offset in the lowered string is not a valid index
/// into the original without this map.
fn lower_with_map(src: &str) -> (String, Vec<usize>) {
    let mut lowered = String::with_capacity(src.len());
    let mut map: Vec<usize> = Vec::with_capacity(src.len() + 1);
    for (idx, ch) in src.char_indices() {
        for lc in ch.to_lowercase() {
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

/// Build an HTML-escaped snippet around the earliest term hit, wrapping that match in
/// `<mark>`. With multiple (AND-matched) terms only the earliest occurrence is
/// highlighted; the other terms are still present in the surrounding text.
fn build_snippet(
    orig: &str,
    lowered: &str,
    map: &[usize],
    terms: &[String],
) -> Option<String> {
    let (match_byte, match_len) = terms
        .iter()
        .filter_map(|t| lowered.find(t.as_str()).map(|b| (b, t.len())))
        .min_by_key(|&(b, _)| b)?;

    let m_start = map[match_byte];
    // End of the *source* char containing the last matched lowered byte. Reading
    // `map[match_byte + match_len]` can land mid-expansion when a char's lowercase is
    // longer than the char (e.g. 'İ' → "i" + combining dot), collapsing the highlight
    // to an empty `<mark></mark>`; advancing one full source char avoids that.
    let m_end = {
        let last = match_byte + match_len - 1;
        let src_start = map[last];
        orig[src_start..]
            .char_indices()
            .nth(1)
            .map(|(off, _)| src_start + off)
            .unwrap_or(orig.len())
    };

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
    fn snippet_highlights_when_lowercase_expands() {
        // 'İ' (U+0130) lowercases to "i" + combining dot — longer than the source char.
        // The highlight must still wrap a non-empty region, not emit <mark></mark>.
        let (lc, map) = lower_with_map("İstanbul trip");
        let terms = normalize_terms("i");
        let snip = build_snippet("İstanbul trip", &lc, &map, &terms).unwrap();
        assert!(snip.contains("<mark>İ</mark>"));
        assert!(!snip.contains("<mark></mark>"));
    }

    #[test]
    fn no_match_returns_none_snippet() {
        let (lc, map) = lower_with_map("nothing here");
        let terms = normalize_terms("rust");
        assert!(build_snippet("nothing here", &lc, &map, &terms).is_none());
    }
}
