use crate::commands::auth::DiaryState;
use crate::db::schema::DatabaseConnection;
use tauri::State;

/// Statistics about diary entries
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Statistics {
    pub total_entries: i32,
    pub entries_per_week: f64,
    pub best_streak: i32,
    pub current_streak: i32,
    pub total_words: i32,
    pub avg_words_per_entry: f64,
}

/// Gets diary statistics
#[tauri::command]
pub fn get_statistics(state: State<DiaryState>) -> Result<Statistics, String> {
    let db_state = state.db.lock().unwrap();
    let db = db_state
        .as_ref()
        .ok_or("Diary must be unlocked to view statistics")?;

    calculate_statistics(db)
}

/// Calculates statistics from the database
fn calculate_statistics(db: &DatabaseConnection) -> Result<Statistics, String> {
    // Get all entry dates and word counts
    let mut stmt = db
        .conn()
        .prepare("SELECT date, word_count FROM entries ORDER BY date ASC")
        .map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let entries: Vec<(String, i32)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query entries: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect entries: {}", e))?;

    // Total entries
    let total_entries = entries.len() as i32;

    // Total words
    let total_words: i32 = entries.iter().map(|(_, word_count)| word_count).sum();

    // Average words per entry
    let avg_words_per_entry = if total_entries > 0 {
        total_words as f64 / total_entries as f64
    } else {
        0.0
    };

    // Entries per week
    let entries_per_week = if entries.len() >= 2 {
        let first_date = &entries[0].0;
        let last_date = &entries[entries.len() - 1].0;

        let days_span = days_between(first_date, last_date)?;
        let weeks_span = (days_span as f64 / 7.0).max(1.0); // At least 1 week

        total_entries as f64 / weeks_span
    } else {
        total_entries as f64 // Less than 2 entries, just return count
    };

    // Calculate streaks
    let dates: Vec<String> = entries.iter().map(|(date, _)| date.clone()).collect();
    let best_streak = calculate_best_streak(&dates)?;
    let current_streak = calculate_current_streak(&dates)?;

    Ok(Statistics {
        total_entries,
        entries_per_week,
        best_streak,
        current_streak,
        total_words,
        avg_words_per_entry,
    })
}

/// Calculates the best (longest) streak of consecutive days with entries
fn calculate_best_streak(dates: &[String]) -> Result<i32, String> {
    if dates.is_empty() {
        return Ok(0);
    }

    let mut max_streak = 1;
    let mut current_streak = 1;

    for i in 1..dates.len() {
        let prev_date = &dates[i - 1];
        let curr_date = &dates[i];

        let days_diff = days_between(prev_date, curr_date)?;

        if days_diff == 1 {
            // Consecutive day
            current_streak += 1;
            max_streak = max_streak.max(current_streak);
        } else {
            // Streak broken
            current_streak = 1;
        }
    }

    Ok(max_streak)
}

/// Calculates the current streak (consecutive days from today backwards)
fn calculate_current_streak(dates: &[String]) -> Result<i32, String> {
    if dates.is_empty() {
        return Ok(0);
    }

    // Get today's date in YYYY-MM-DD format
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Check if there's an entry for today or yesterday
    let last_date = &dates[dates.len() - 1];
    let days_from_today = days_between(last_date, &today)?;

    // If last entry is more than 1 day ago, streak is broken
    if days_from_today > 1 {
        return Ok(0);
    }

    // Count consecutive days backwards from the last entry
    let mut streak = 1;

    for i in (0..dates.len() - 1).rev() {
        let curr_date = &dates[i];
        let next_date = &dates[i + 1];

        let days_diff = days_between(curr_date, next_date)?;

        if days_diff == 1 {
            streak += 1;
        } else {
            break;
        }
    }

    Ok(streak)
}

/// Calculates the number of days between two dates
fn days_between(date1: &str, date2: &str) -> Result<i64, String> {
    use chrono::NaiveDate;

    let d1 = NaiveDate::parse_from_str(date1, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format '{}': {}", date1, e))?;

    let d2 = NaiveDate::parse_from_str(date2, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format '{}': {}", date2, e))?;

    Ok((d2 - d1).num_days())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::queries::{insert_entry, DiaryEntry};
    use crate::db::schema::create_database;
    use std::fs;

    fn temp_db_path(name: &str) -> String {
        format!("test_stats_{}.db", name)
    }

    fn cleanup_db(path: &str) {
        let _ = fs::remove_file(path);
    }

    fn create_test_entry(date: &str, word_count: i32) -> DiaryEntry {
        let now = chrono::Utc::now().to_rfc3339();
        DiaryEntry {
            date: date.to_string(),
            title: "Test".to_string(),
            text: format!("{} words", "word ".repeat(word_count as usize)),
            word_count,
            date_created: now.clone(),
            date_updated: now,
        }
    }

    #[test]
    fn test_days_between() {
        assert_eq!(days_between("2024-01-01", "2024-01-02").unwrap(), 1);
        assert_eq!(days_between("2024-01-01", "2024-01-01").unwrap(), 0);
        assert_eq!(days_between("2024-01-01", "2024-01-10").unwrap(), 9);
        assert_eq!(days_between("2024-01-31", "2024-02-01").unwrap(), 1);
    }

    #[test]
    fn test_best_streak_empty() {
        assert_eq!(calculate_best_streak(&[]).unwrap(), 0);
    }

    #[test]
    fn test_best_streak_single_entry() {
        let dates = vec!["2024-01-01".to_string()];
        assert_eq!(calculate_best_streak(&dates).unwrap(), 1);
    }

    #[test]
    fn test_best_streak_consecutive() {
        let dates = vec![
            "2024-01-01".to_string(),
            "2024-01-02".to_string(),
            "2024-01-03".to_string(),
            "2024-01-04".to_string(),
        ];
        assert_eq!(calculate_best_streak(&dates).unwrap(), 4);
    }

    #[test]
    fn test_best_streak_with_gaps() {
        let dates = vec![
            "2024-01-01".to_string(),
            "2024-01-02".to_string(),
            "2024-01-03".to_string(),
            "2024-01-10".to_string(), // Gap
            "2024-01-11".to_string(),
            "2024-01-12".to_string(),
            "2024-01-13".to_string(),
            "2024-01-14".to_string(), // Streak of 5
        ];
        assert_eq!(calculate_best_streak(&dates).unwrap(), 5);
    }

    #[test]
    fn test_current_streak_empty() {
        assert_eq!(calculate_current_streak(&[]).unwrap(), 0);
    }

    #[test]
    fn test_statistics_calculation() {
        let db_path = temp_db_path("stats");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        // Insert test entries
        insert_entry(&db, &create_test_entry("2024-01-01", 100)).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-02", 150)).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-03", 200)).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-05", 50)).unwrap(); // Gap breaks streak

        let stats = calculate_statistics(&db).unwrap();

        assert_eq!(stats.total_entries, 4);
        assert_eq!(stats.total_words, 500);
        assert_eq!(stats.avg_words_per_entry, 125.0);
        assert_eq!(stats.best_streak, 3);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_statistics_empty_database() {
        let db_path = temp_db_path("empty");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        let stats = calculate_statistics(&db).unwrap();

        assert_eq!(stats.total_entries, 0);
        assert_eq!(stats.total_words, 0);
        assert_eq!(stats.avg_words_per_entry, 0.0);
        assert_eq!(stats.entries_per_week, 0.0);
        assert_eq!(stats.best_streak, 0);
        assert_eq!(stats.current_streak, 0);

        cleanup_db(&db_path);
    }

    #[test]
    fn test_entries_per_week() {
        let db_path = temp_db_path("per_week");
        cleanup_db(&db_path);

        let password = "test".to_string();
        let db = create_database(&db_path, password).unwrap();

        // 3 entries over 14 days (2 weeks) = 1.5 entries/week
        insert_entry(&db, &create_test_entry("2024-01-01", 100)).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-08", 150)).unwrap();
        insert_entry(&db, &create_test_entry("2024-01-15", 200)).unwrap();

        let stats = calculate_statistics(&db).unwrap();

        assert_eq!(stats.total_entries, 3);
        assert!((stats.entries_per_week - 1.5).abs() < 0.01);

        cleanup_db(&db_path);
    }
}
