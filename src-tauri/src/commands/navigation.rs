use chrono::{Duration, Months, NaiveDate};

/// Navigate to the previous day
#[tauri::command]
pub fn navigate_previous_day(current_date: String) -> Result<String, String> {
    let date = NaiveDate::parse_from_str(&current_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    let previous = date - Duration::days(1);
    Ok(previous.format("%Y-%m-%d").to_string())
}

/// Navigate to the next day
#[tauri::command]
pub fn navigate_next_day(current_date: String) -> Result<String, String> {
    let date = NaiveDate::parse_from_str(&current_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    let next = date + Duration::days(1);
    Ok(next.format("%Y-%m-%d").to_string())
}

/// Navigate to today
#[tauri::command]
pub fn navigate_to_today() -> Result<String, String> {
    let today = chrono::Local::now().date_naive();
    Ok(today.format("%Y-%m-%d").to_string())
}

/// Navigate to the previous month (same day if possible)
#[tauri::command]
pub fn navigate_previous_month(current_date: String) -> Result<String, String> {
    let date = NaiveDate::parse_from_str(&current_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    // Subtract one month
    let previous = date
        .checked_sub_months(Months::new(1))
        .ok_or_else(|| "Cannot navigate to previous month".to_string())?;

    Ok(previous.format("%Y-%m-%d").to_string())
}

/// Navigate to the next month (same day if possible)
#[tauri::command]
pub fn navigate_next_month(current_date: String) -> Result<String, String> {
    let date = NaiveDate::parse_from_str(&current_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    // Add one month
    let next = date
        .checked_add_months(Months::new(1))
        .ok_or_else(|| "Cannot navigate to next month".to_string())?;

    Ok(next.format("%Y-%m-%d").to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_navigate_previous_day() {
        assert_eq!(
            navigate_previous_day("2024-01-15".to_string()).unwrap(),
            "2024-01-14"
        );
        assert_eq!(
            navigate_previous_day("2024-01-01".to_string()).unwrap(),
            "2023-12-31"
        );
    }

    #[test]
    fn test_navigate_next_day() {
        assert_eq!(
            navigate_next_day("2024-01-15".to_string()).unwrap(),
            "2024-01-16"
        );
        assert_eq!(
            navigate_next_day("2024-12-31".to_string()).unwrap(),
            "2025-01-01"
        );
    }

    #[test]
    fn test_navigate_previous_month() {
        assert_eq!(
            navigate_previous_month("2024-02-15".to_string()).unwrap(),
            "2024-01-15"
        );
        assert_eq!(
            navigate_previous_month("2024-01-31".to_string()).unwrap(),
            "2023-12-31"
        );
    }

    #[test]
    fn test_navigate_next_month() {
        assert_eq!(
            navigate_next_month("2024-01-15".to_string()).unwrap(),
            "2024-02-15"
        );
        assert_eq!(
            navigate_next_month("2024-01-31".to_string()).unwrap(),
            "2024-02-29"
        ); // Leap year
    }

    #[test]
    fn test_invalid_date() {
        assert!(navigate_previous_day("invalid".to_string()).is_err());
        assert!(navigate_next_day("2024-13-01".to_string()).is_err());
    }
}
