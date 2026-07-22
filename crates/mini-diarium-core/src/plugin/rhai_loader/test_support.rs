//! Shared test fixtures for the `rhai_loader` submodules. Compiled only under `cfg(test)`.

use crate::db::queries::DiaryEntry;

/// The shipped example export plugin, used as an end-to-end loader fixture.
pub const PLAIN_TEXT_TIMELINE_FIXTURE: &str =
    include_str!("../../../../../docs/user-plugins/plain-text-timeline.rhai");

/// Two entries spanning two dates, one untitled — exercises the fixture's
/// `(untitled)` fallback and its `---` separator.
pub fn sample_entries() -> Vec<DiaryEntry> {
    vec![
        DiaryEntry {
            id: 1,
            date: "2024-01-01".into(),
            title: "".into(),
            text: "<p>First body</p>".into(),
            word_count: 2,
            date_created: "2024-01-01T00:00:00Z".into(),
            date_updated: "2024-01-01T00:00:00Z".into(),
            metadata: None,
            locked: false,
        },
        DiaryEntry {
            id: 2,
            date: "2024-01-02".into(),
            title: "Second".into(),
            text: "<p>Second body</p>".into(),
            word_count: 2,
            date_created: "2024-01-02T00:00:00Z".into(),
            date_updated: "2024-01-02T00:00:00Z".into(),
            metadata: None,
            locked: false,
        },
    ]
}
