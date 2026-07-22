//! Locked-journal metadata peek.
//!
//! The only `db` operation that needs **no** `DatabaseConnection` and no master key: it
//! answers "which credentials does this journal ask for?" before the user has supplied any.
//! Lives in the core so the desktop app (and any future consumer) reads locked-journal
//! metadata through the curated façade instead of opening its own `rusqlite::Connection`
//! (open-core M2 / TODO-0077 — see `crates/mini-diarium-core/API.md`).

use std::path::Path;

use super::queries::db_settings::get_db_setting_conn;
use super::schema::open_connection;

/// Auth-slot metadata visible without unlocking the journal.
///
/// Serde field names are frozen — the frontend's `AuthSlotPeek` interface
/// (`src/lib/tauri/auth.ts`) depends on them verbatim.
#[derive(Debug, serde::Serialize)]
pub struct AuthSlotPeek {
    pub id: i64,
    pub slot_type: String,
    pub label: String,
}

/// What an unlock screen needs to know about a locked journal.
///
/// Serde field names are frozen — see [`AuthSlotPeek`].
#[derive(Debug, serde::Serialize)]
pub struct JournalPeek {
    pub slots: Vec<AuthSlotPeek>,
    pub require_all_auth: bool,
}

/// Reads auth-slot types/labels and the `require_all_auth` flag from a locked journal.
///
/// The SQLite container itself is not encrypted — only entry content is AES-256-GCM
/// encrypted at the application layer — so this metadata is readable without a key.
/// `auto` slots (device-bound keys that never require user input) are excluded. Wrapped
/// keys and public keys are never returned.
///
/// Returns an empty peek when `db_path` does not exist yet: the caller may point at a
/// journal directory before the journal is created, and `Connection::open` would otherwise
/// *create* an empty `diary.db` as a side effect of peeking.
///
/// # Why an unauthenticated `require_all_auth` read is safe
///
/// There is no key here, so this cannot apply the HKDF-SHA256 MAC check that
/// [`crate::db::verify_require_all_auth`] performs on the unlocked path. That is not a
/// bypass: the value returned here only decides which credentials the UI *asks* for.
/// Enforcement happens after unlock, where the fail-safe MAC-verified read is authoritative
/// — flipping this row to `false` on disk still leaves the unlock path demanding every
/// registered method.
pub fn peek_auth_slot_types<P: AsRef<Path>>(db_path: P) -> Result<JournalPeek, String> {
    let db_path = db_path.as_ref();

    if !db_path.exists() {
        return Ok(JournalPeek {
            slots: vec![],
            require_all_auth: false,
        });
    }

    let conn = open_connection(db_path).map_err(|e| format!("Failed to open journal: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, type, label FROM auth_slots WHERE type != 'auto' ORDER BY id ASC")
        .map_err(|e| format!("Failed to prepare: {}", e))?;

    let slots = stmt
        .query_map([], |row| {
            Ok(AuthSlotPeek {
                id: row.get(0)?,
                slot_type: row.get(1)?,
                label: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect: {}", e))?;

    // `get_db_setting_conn` swallows errors with `.ok()`, which maps a missing `db_settings`
    // table (pre-v6 journals) to "not set" — the same semantics the unlocked path has.
    let require_all_auth =
        get_db_setting_conn(&conn, "require_all_auth").is_some_and(|v| v == "true");

    Ok(JournalPeek {
        slots,
        require_all_auth,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::{create_database, create_database_auto};
    use crate::db::set_db_setting;

    /// Returns a path inside a temp dir for a journal that does not exist yet.
    fn temp_db_path(name: &str) -> (tempfile::TempDir, std::path::PathBuf) {
        let dir = tempfile::Builder::new()
            .prefix(&format!("mini-diarium-peek-{name}-"))
            .tempdir()
            .unwrap();
        let path = dir.path().join("diary.db");
        (dir, path)
    }

    #[test]
    fn test_peek_missing_file_returns_empty_and_does_not_create_it() {
        let (_dir, db_path) = temp_db_path("missing");

        let peek = peek_auth_slot_types(&db_path).unwrap();

        assert!(peek.slots.is_empty());
        assert!(!peek.require_all_auth);
        assert!(
            !db_path.exists(),
            "peeking a missing journal must not create the file"
        );
    }

    #[test]
    fn test_peek_password_journal_reports_password_slot() {
        let (_dir, db_path) = temp_db_path("password");
        create_database(&db_path, "test_password".to_string()).unwrap();

        let peek = peek_auth_slot_types(&db_path).unwrap();

        assert_eq!(peek.slots.len(), 1);
        assert_eq!(peek.slots[0].slot_type, "password");
        assert_eq!(peek.slots[0].label, "Password");
        assert!(!peek.require_all_auth);
    }

    #[test]
    fn test_peek_excludes_auto_slots() {
        let (_dir, db_path) = temp_db_path("auto");
        create_database_auto(&db_path, &[7u8; 32]).unwrap();

        let peek = peek_auth_slot_types(&db_path).unwrap();

        assert!(
            peek.slots.is_empty(),
            "device-bound `auto` slots never require user input and must be hidden"
        );
    }

    #[test]
    fn test_peek_lists_keypair_slot_ordered_by_id() {
        let (_dir, db_path) = temp_db_path("keypair");
        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        crate::db::insert_auth_slot(&db, "keypair", "My Key", Some(&[3u8; 32]), &[0u8; 92], &now)
            .unwrap();
        drop(db);

        let peek = peek_auth_slot_types(&db_path).unwrap();

        assert_eq!(peek.slots.len(), 2);
        assert_eq!(peek.slots[0].slot_type, "password");
        assert_eq!(peek.slots[1].slot_type, "keypair");
        assert_eq!(peek.slots[1].label, "My Key");
        assert!(peek.slots[0].id < peek.slots[1].id);
    }

    #[test]
    fn test_peek_reports_require_all_auth() {
        let (_dir, db_path) = temp_db_path("require_all");
        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        set_db_setting(&db, "require_all_auth", "true").unwrap();
        drop(db);

        assert!(peek_auth_slot_types(&db_path).unwrap().require_all_auth);
    }

    #[test]
    fn test_peek_pre_v6_journal_without_db_settings_table() {
        let (_dir, db_path) = temp_db_path("pre_v6");
        let db = create_database(&db_path, "test_password".to_string()).unwrap();
        // Simulate a pre-v6 journal: `db_settings` did not exist before schema v6.
        // Reaching for `conn()` is legal in-crate and keeps the test free of raw SQL setup.
        db.conn().execute("DROP TABLE db_settings", []).unwrap();
        drop(db);

        let peek = peek_auth_slot_types(&db_path).unwrap();

        assert!(!peek.require_all_auth, "missing table means 'not set'");
        assert_eq!(peek.slots.len(), 1, "slots still readable");
    }
}
