//! Custom-font row storage (unencrypted BLOBs in the `custom_fonts` table, schema v8).
//!
//! These helpers own the raw SQL for the `custom_fonts` table so the app crate's
//! font commands keep only validation, MIME sniffing, and base64/data-URI assembly.

use crate::db::schema::DatabaseConnection;
use rusqlite::{params, OptionalExtension};

/// Returns `(family, weight)` for every stored custom-font row, ordered by family then weight.
pub fn list_custom_font_rows(db: &DatabaseConnection) -> Result<Vec<(String, String)>, String> {
    let mut stmt = db
        .conn()
        .prepare("SELECT family, weight FROM custom_fonts ORDER BY family, weight")
        .map_err(|e| format!("Failed to prepare list_custom_fonts query: {e}"))?;

    let rows = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Failed to query custom_fonts: {e}"))?
        .collect::<Result<_, _>>()
        .map_err(|e| format!("Failed to read custom_fonts row: {e}"))?;

    Ok(rows)
}

/// Returns whether a `(family, weight)` custom-font row exists.
pub fn custom_font_has_weight(
    db: &DatabaseConnection,
    family: &str,
    weight: &str,
) -> Result<bool, String> {
    let found = db
        .conn()
        .query_row(
            "SELECT 1 FROM custom_fonts WHERE family = ?1 AND weight = ?2 LIMIT 1",
            params![family, weight],
            |_row| Ok(()),
        )
        .optional()
        .map_err(|e| format!("Failed to check custom font weight: {e}"))?
        .is_some();
    Ok(found)
}

/// Inserts (or replaces) a custom-font row for `(family, weight)`.
pub fn upsert_custom_font(
    db: &DatabaseConnection,
    family: &str,
    weight: &str,
    bytes: &[u8],
    now: &str,
) -> Result<(), String> {
    db.conn()
        .execute(
            "INSERT OR REPLACE INTO custom_fonts (family, weight, data, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![family, weight, bytes, now],
        )
        .map(|_| ())
        .map_err(|e| format!("Failed to store font: {e}"))
}

/// Deletes every weight for the given custom-font family.
pub fn delete_custom_font_family(db: &DatabaseConnection, family: &str) -> Result<(), String> {
    db.conn()
        .execute(
            "DELETE FROM custom_fonts WHERE family = ?1",
            params![family],
        )
        .map(|_| ())
        .map_err(|e| format!("Failed to delete custom font '{}': {e}", family))
}

/// Returns the raw font bytes for a `(family, weight)` row, or `None` if absent.
pub fn get_custom_font_weight_data(
    db: &DatabaseConnection,
    family: &str,
    weight: &str,
) -> Result<Option<Vec<u8>>, String> {
    db.conn()
        .query_row(
            "SELECT data FROM custom_fonts WHERE family = ?1 AND weight = ?2",
            params![family, weight],
            |row| row.get::<_, Vec<u8>>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to read custom font data: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_database;

    fn ttf() -> Vec<u8> {
        vec![0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
    }
    const NOW: &str = "2026-01-01T00:00:00Z";

    #[test]
    fn test_upsert_list_and_get() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        assert!(list_custom_font_rows(&db).unwrap().is_empty());

        upsert_custom_font(&db, "FontA", "Regular", &ttf(), NOW).unwrap();
        upsert_custom_font(&db, "FontA", "Bold", &ttf(), NOW).unwrap();

        let rows = list_custom_font_rows(&db).unwrap();
        assert_eq!(rows.len(), 2);
        assert!(custom_font_has_weight(&db, "FontA", "Regular").unwrap());
        assert!(!custom_font_has_weight(&db, "FontA", "Light").unwrap());
        assert!(get_custom_font_weight_data(&db, "FontA", "Regular")
            .unwrap()
            .is_some());
        assert!(get_custom_font_weight_data(&db, "FontA", "Missing")
            .unwrap()
            .is_none());
    }

    #[test]
    fn test_upsert_replaces_and_delete_removes_all() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        let orig = vec![0x00, 0x01, 0x00, 0x00, 0xAA];
        let updated = vec![0x00, 0x01, 0x00, 0x00, 0xBB];
        upsert_custom_font(&db, "F", "Regular", &orig, NOW).unwrap();
        upsert_custom_font(&db, "F", "Regular", &updated, NOW).unwrap();
        assert_eq!(
            get_custom_font_weight_data(&db, "F", "Regular").unwrap(),
            Some(updated)
        );

        upsert_custom_font(&db, "F", "Bold", &ttf(), NOW).unwrap();
        delete_custom_font_family(&db, "F").unwrap();
        assert!(list_custom_font_rows(&db).unwrap().is_empty());
    }
}
