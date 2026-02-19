use chrono::Local;
use log::debug;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_BACKUPS: usize = 50;

/// Creates a backup of the diary file
/// Returns the path of the created backup file
pub fn create_backup(diary_path: &Path, backups_dir: &Path) -> Result<PathBuf, String> {
    // Ensure backups directory exists
    fs::create_dir_all(backups_dir)
        .map_err(|e| format!("Failed to create backups directory: {}", e))?;

    // Generate backup filename with current timestamp
    let timestamp = Local::now().format("%Y-%m-%d-%Hh%M");
    let backup_filename = format!("backup-{}.db", timestamp);
    let backup_path = backups_dir.join(&backup_filename);

    // Copy diary file to backup location
    fs::copy(diary_path, &backup_path).map_err(|e| format!("Failed to create backup: {}", e))?;

    debug!("Backup created: {:?}", backup_path);
    Ok(backup_path)
}

/// Rotates backups, keeping only the MAX_BACKUPS most recent files
pub fn rotate_backups(backups_dir: &Path) -> Result<(), String> {
    if !backups_dir.exists() {
        return Ok(());
    }

    // Read all backup files
    let mut backup_files: Vec<PathBuf> = fs::read_dir(backups_dir)
        .map_err(|e| format!("Failed to read backups directory: {}", e))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.starts_with("backup-") && name.ends_with(".db"))
                    .unwrap_or(false)
        })
        .collect();

    // If we have fewer than MAX_BACKUPS, nothing to rotate
    if backup_files.len() <= MAX_BACKUPS {
        return Ok(());
    }

    // Sort by filename (which includes timestamp, so this sorts chronologically)
    backup_files.sort();

    // Calculate how many to delete
    let to_delete = backup_files.len() - MAX_BACKUPS;

    // Delete the oldest backups
    for backup_file in backup_files.iter().take(to_delete) {
        fs::remove_file(backup_file).map_err(|e| format!("Failed to delete old backup: {}", e))?;
    }

    debug!("Rotated backups: deleted {} old backups", to_delete);
    Ok(())
}

/// Creates a backup and rotates old backups
pub fn backup_and_rotate(diary_path: &Path, backups_dir: &Path) -> Result<PathBuf, String> {
    let backup_path = create_backup(diary_path, backups_dir)?;
    rotate_backups(backups_dir)?;
    Ok(backup_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    fn create_test_file(path: &Path, content: &str) -> Result<(), std::io::Error> {
        let mut file = File::create(path)?;
        file.write_all(content.as_bytes())?;
        Ok(())
    }

    #[test]
    fn test_create_backup() {
        let temp_dir = std::env::temp_dir();
        let diary_path = temp_dir.join("test_diary_backup.db");
        let backups_dir = temp_dir.join("test_backups_create");

        // Clean up any existing files
        let _ = fs::remove_file(&diary_path);
        let _ = fs::remove_dir_all(&backups_dir);

        // Create a test diary file
        create_test_file(&diary_path, "encrypted diary content").unwrap();

        // Create backup
        let backup_path = create_backup(&diary_path, &backups_dir).unwrap();

        // Verify backup exists
        assert!(backup_path.exists());
        assert!(backup_path
            .file_name()
            .unwrap()
            .to_str()
            .unwrap()
            .starts_with("backup-"));
        assert!(backup_path
            .file_name()
            .unwrap()
            .to_str()
            .unwrap()
            .ends_with(".db"));

        // Verify content
        let backup_content = fs::read_to_string(&backup_path).unwrap();
        assert_eq!(backup_content, "encrypted diary content");

        // Clean up
        let _ = fs::remove_file(&diary_path);
        let _ = fs::remove_dir_all(&backups_dir);
    }

    #[test]
    fn test_rotate_backups_under_limit() {
        let temp_dir = std::env::temp_dir();
        let backups_dir = temp_dir.join("test_backups_under");

        // Clean up
        let _ = fs::remove_dir_all(&backups_dir);
        fs::create_dir_all(&backups_dir).unwrap();

        // Create 30 backup files (under limit)
        for i in 0..30 {
            let filename = format!("backup-2024-01-{:02}-12h00.db", i + 1);
            create_test_file(&backups_dir.join(filename), "test").unwrap();
        }

        // Rotate
        rotate_backups(&backups_dir).unwrap();

        // Verify all files still exist
        let files: Vec<_> = fs::read_dir(&backups_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(files.len(), 30);

        // Clean up
        let _ = fs::remove_dir_all(&backups_dir);
    }

    #[test]
    fn test_rotate_backups_over_limit() {
        let temp_dir = std::env::temp_dir();
        let backups_dir = temp_dir.join("test_backups_over");

        // Clean up
        let _ = fs::remove_dir_all(&backups_dir);
        fs::create_dir_all(&backups_dir).unwrap();

        // Create 60 backup files (over limit of 50)
        for i in 0..60 {
            let filename = format!("backup-2024-01-{:02}-12h00.db", i + 1);
            create_test_file(&backups_dir.join(filename), "test").unwrap();
        }

        // Rotate
        rotate_backups(&backups_dir).unwrap();

        // Verify only 50 files remain
        let files: Vec<_> = fs::read_dir(&backups_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(files.len(), 50);

        // Verify the oldest files were deleted (backup-2024-01-01 through backup-2024-01-10)
        assert!(!backups_dir.join("backup-2024-01-01-12h00.db").exists());
        assert!(!backups_dir.join("backup-2024-01-10-12h00.db").exists());

        // Verify newer files still exist
        assert!(backups_dir.join("backup-2024-01-11-12h00.db").exists());
        assert!(backups_dir.join("backup-2024-01-60-12h00.db").exists());

        // Clean up
        let _ = fs::remove_dir_all(&backups_dir);
    }

    #[test]
    fn test_backup_and_rotate() {
        let temp_dir = std::env::temp_dir();
        let diary_path = temp_dir.join("test_diary_rotate.db");
        let backups_dir = temp_dir.join("test_backups_full");

        // Clean up
        let _ = fs::remove_file(&diary_path);
        let _ = fs::remove_dir_all(&backups_dir);

        // Create diary
        create_test_file(&diary_path, "test diary").unwrap();

        // Create 50 existing backups
        fs::create_dir_all(&backups_dir).unwrap();
        for i in 0..50 {
            let filename = format!("backup-2024-01-{:02}-12h00.db", i + 1);
            create_test_file(&backups_dir.join(filename), "old").unwrap();
        }

        // Create new backup and rotate
        let backup_path = backup_and_rotate(&diary_path, &backups_dir).unwrap();

        // Verify backup was created
        assert!(backup_path.exists());

        // Verify rotation occurred (should still be 50 files)
        let files: Vec<_> = fs::read_dir(&backups_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(files.len(), 50);

        // Verify oldest was deleted
        assert!(!backups_dir.join("backup-2024-01-01-12h00.db").exists());

        // Clean up
        let _ = fs::remove_file(&diary_path);
        let _ = fs::remove_dir_all(&backups_dir);
    }

    #[test]
    fn test_rotate_ignores_non_backup_files() {
        let temp_dir = std::env::temp_dir();
        let backups_dir = temp_dir.join("test_backups_ignore");

        // Clean up
        let _ = fs::remove_dir_all(&backups_dir);
        fs::create_dir_all(&backups_dir).unwrap();

        // Create backup files
        for i in 0..55 {
            let filename = format!("backup-2024-01-{:02}-12h00.db", i + 1);
            create_test_file(&backups_dir.join(filename), "test").unwrap();
        }

        // Create non-backup files that should be ignored
        create_test_file(&backups_dir.join("readme.txt"), "test").unwrap();
        create_test_file(&backups_dir.join("other-file.txt"), "test").unwrap();

        // Rotate
        rotate_backups(&backups_dir).unwrap();

        // Verify 50 backup files + 2 other files = 52 total
        let all_files: Vec<_> = fs::read_dir(&backups_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(all_files.len(), 52);

        // Verify non-backup files still exist
        assert!(backups_dir.join("readme.txt").exists());
        assert!(backups_dir.join("other-file.txt").exists());

        // Clean up
        let _ = fs::remove_dir_all(&backups_dir);
    }
}
