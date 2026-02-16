use crate::db::queries::DiaryEntry;

/// Merges an imported entry with an existing entry
///
/// When an imported entry has the same date as an existing entry,
/// this function combines them according to the merge strategy:
/// - Titles: Concatenated with " | " separator
/// - Texts: Concatenated with "\n\n––––––––––\n\n" separator
/// - Word count: Recalculated for the combined text
/// - Timestamps: Keeps the earlier date_created, updates date_updated to now
///
/// # Arguments
/// * `existing` - The entry currently in the database
/// * `imported` - The entry being imported
///
/// # Returns
/// A merged DiaryEntry combining both entries
pub fn merge_entries(existing: DiaryEntry, imported: DiaryEntry) -> DiaryEntry {
    // Merge titles
    let merged_title = if existing.title.is_empty() {
        imported.title
    } else if imported.title.is_empty() {
        existing.title
    } else if existing.title == imported.title {
        // Same title, don't duplicate
        existing.title
    } else {
        // Different titles, concatenate
        format!("{} | {}", existing.title, imported.title)
    };

    // Merge texts
    let merged_text = if existing.text.is_empty() {
        imported.text
    } else if imported.text.is_empty() {
        existing.text
    } else if existing.text == imported.text {
        // Same text, don't duplicate
        existing.text
    } else {
        // Different texts, concatenate with separator
        format!("{}\n\n––––––––––\n\n{}", existing.text, imported.text)
    };

    // Recalculate word count for merged text
    let word_count = crate::db::queries::count_words(&merged_text);

    // Keep earlier creation date
    let date_created = if existing.date_created < imported.date_created {
        existing.date_created
    } else {
        imported.date_created
    };

    // Update timestamp to now
    let date_updated = chrono::Utc::now().to_rfc3339();

    DiaryEntry {
        date: existing.date, // Same date (that's why we're merging)
        title: merged_title,
        text: merged_text,
        word_count,
        date_created,
        date_updated,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_entry(date: &str, title: &str, text: &str) -> DiaryEntry {
        DiaryEntry {
            date: date.to_string(),
            title: title.to_string(),
            text: text.to_string(),
            word_count: crate::db::queries::count_words(text),
            date_created: "2024-01-01T10:00:00Z".to_string(),
            date_updated: "2024-01-01T12:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_merge_different_titles_and_texts() {
        let existing = create_test_entry("2024-01-01", "Morning Entry", "Had breakfast.");
        let imported = create_test_entry("2024-01-01", "Evening Entry", "Had dinner.");

        let merged = merge_entries(existing, imported);

        assert_eq!(merged.date, "2024-01-01");
        assert_eq!(merged.title, "Morning Entry | Evening Entry");
        assert_eq!(merged.text, "Had breakfast.\n\n––––––––––\n\nHad dinner.");
        assert_eq!(merged.word_count, 5); // "Had breakfast." + separator + "Had dinner." = 5 words
    }

    #[test]
    fn test_merge_same_titles() {
        let existing = create_test_entry("2024-01-01", "My Day", "Morning events.");
        let imported = create_test_entry("2024-01-01", "My Day", "Evening events.");

        let merged = merge_entries(existing, imported);

        assert_eq!(merged.title, "My Day"); // Not duplicated
        assert_eq!(
            merged.text,
            "Morning events.\n\n––––––––––\n\nEvening events."
        );
    }

    #[test]
    fn test_merge_same_texts() {
        let existing = create_test_entry("2024-01-01", "Morning", "Same content here.");
        let imported = create_test_entry("2024-01-01", "Evening", "Same content here.");

        let merged = merge_entries(existing, imported);

        assert_eq!(merged.title, "Morning | Evening");
        assert_eq!(merged.text, "Same content here."); // Not duplicated
    }

    #[test]
    fn test_merge_empty_existing_title() {
        let existing = create_test_entry("2024-01-01", "", "Some text.");
        let imported = create_test_entry("2024-01-01", "Imported Title", "More text.");

        let merged = merge_entries(existing, imported);

        assert_eq!(merged.title, "Imported Title");
    }

    #[test]
    fn test_merge_empty_imported_title() {
        let existing = create_test_entry("2024-01-01", "Existing Title", "Some text.");
        let imported = create_test_entry("2024-01-01", "", "More text.");

        let merged = merge_entries(existing, imported);

        assert_eq!(merged.title, "Existing Title");
    }

    #[test]
    fn test_merge_empty_existing_text() {
        let existing = create_test_entry("2024-01-01", "Title", "");
        let imported = create_test_entry("2024-01-01", "Title", "Imported text.");

        let merged = merge_entries(existing, imported);

        assert_eq!(merged.text, "Imported text.");
    }

    #[test]
    fn test_merge_empty_imported_text() {
        let existing = create_test_entry("2024-01-01", "Title", "Existing text.");
        let imported = create_test_entry("2024-01-01", "Title", "");

        let merged = merge_entries(existing, imported);

        assert_eq!(merged.text, "Existing text.");
    }

    #[test]
    fn test_merge_keeps_earlier_creation_date() {
        let mut existing = create_test_entry("2024-01-01", "A", "Text A");
        let mut imported = create_test_entry("2024-01-01", "B", "Text B");

        existing.date_created = "2024-01-01T08:00:00Z".to_string();
        imported.date_created = "2024-01-01T10:00:00Z".to_string();

        let merged = merge_entries(existing, imported);

        assert_eq!(merged.date_created, "2024-01-01T08:00:00Z");
    }

    #[test]
    fn test_merge_updates_timestamp() {
        let existing = create_test_entry("2024-01-01", "A", "Text A");
        let imported = create_test_entry("2024-01-01", "B", "Text B");

        let merged = merge_entries(existing, imported);

        // date_updated should be recent (we can't test exact timestamp)
        assert!(merged.date_updated.starts_with("20")); // Starts with year 20xx
        assert!(merged.date_updated.contains("T")); // ISO 8601 format
    }

    #[test]
    fn test_merge_recalculates_word_count() {
        let existing = create_test_entry("2024-01-01", "A", "One two three.");
        let imported = create_test_entry("2024-01-01", "B", "Four five.");

        let merged = merge_entries(existing, imported);

        // "One two three." + separator "––––––––––" + "Four five." = 6 words total
        assert_eq!(merged.word_count, 6);
    }

    #[test]
    fn test_merge_both_empty_titles() {
        let existing = create_test_entry("2024-01-01", "", "Text A");
        let imported = create_test_entry("2024-01-01", "", "Text B");

        let merged = merge_entries(existing, imported);

        assert_eq!(merged.title, "");
    }

    #[test]
    fn test_merge_both_empty_texts() {
        let existing = create_test_entry("2024-01-01", "Title A", "");
        let imported = create_test_entry("2024-01-01", "Title B", "");

        let merged = merge_entries(existing, imported);

        assert_eq!(merged.text, "");
        assert_eq!(merged.word_count, 0);
    }

    #[test]
    fn test_merge_identical_entries() {
        let existing = create_test_entry("2024-01-01", "Same Title", "Same text content.");
        let imported = create_test_entry("2024-01-01", "Same Title", "Same text content.");

        let merged = merge_entries(existing, imported);

        // Should not duplicate anything
        assert_eq!(merged.title, "Same Title");
        assert_eq!(merged.text, "Same text content.");
        assert_eq!(merged.word_count, 3);
    }
}
