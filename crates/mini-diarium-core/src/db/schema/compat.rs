//! Forward-compatibility guard: refuse journals and backups written by a newer app.
//!
//! Every migration step is gated on `version < N`, so without this guard an older app
//! silently opens — and writes to — a journal whose schema it does not understand. The
//! realistic trigger is two machines sharing one synced folder while running different app
//! versions. See `docs/decisions/2026-09-schema-forward-compatibility.md`.
//!
//! # The `min_reader_version` marker contract
//!
//! - **Absent** (the default, and the state at `SCHEMA_VERSION` 14): the oldest app that may
//!   open the file is the one whose `SCHEMA_VERSION` equals the stored `schema_version`.
//! - **Present and `<= SCHEMA_VERSION`** of the reading app: that app opens (and writes) the
//!   file normally, without migrating it or lowering its version.
//! - **Present and higher, or unparsable**: refused (fail safe).
//!
//! # Checklist for every `SCHEMA_VERSION` bump
//!
//! 1. **Decide the marker.** A migration is *additive-compatible* only when an older app
//!    that ignores the new table/column cannot lose data or break an invariant by writing
//!    to the journal (for example: a new nullable column no query of the older app needs to
//!    keep consistent). Then the oldest safe `SCHEMA_VERSION` may be written as the marker.
//!    Anything else — new FK/cascade relationships, a column an older writer must update, a
//!    changed encoding, re-encryption — is not, and the marker must be removed. When in
//!    doubt, remove it. The v14 attachments migration would **not** have qualified: an older
//!    writer deletes an attachment-only entry as empty (see TODO-0123).
//! 2. **Write it explicitly in the migration step**, inside its transaction: either
//!    `INSERT OR REPLACE INTO db_settings (key, value) VALUES ('min_reader_version', 'N')` or
//!    `DELETE FROM db_settings WHERE key = 'min_reader_version'`. Never rely on the value a
//!    previous migration left behind.
//! 3. **Write the same state in `create_schema`.** Fresh journals never run migrations, so a
//!    marker written only by the migration step would differ between new and upgraded
//!    journals. `tests::test_fresh_and_migrated_journals_agree_on_the_marker` catches this.
//! 4. **Update the tripwire** in this module's tests (`MARKER_DECIDED_FOR_SCHEMA_VERSION` and
//!    `EXPECTED_MARKER`); it fails on every bump until the decision is recorded.
//! 5. A value below 14 is meaningless: apps before 0.7.4 (`SCHEMA_VERSION` 14) have no guard
//!    and open every journal regardless.
//!
//! Snapshots are `VACUUM INTO` copies, so they carry the marker automatically and the same
//! rule decides whether an older app may inspect or restore them.
//!
//! # Where the guard runs
//!
//! The guard is read-only. Every open path calls it directly after opening the SQLite file,
//! before any write and before any credential work, so a refused file is byte-for-byte
//! unchanged: `open_database*`, `peek_auth_slot_types`, `backup::inspect`,
//! `backup::restore` (on the staged copy), and — as a backstop —
//! `migrate_with_pre_migration_snapshot`. A new open path must do the same.

use super::SCHEMA_VERSION;
use crate::db::queries::db_settings::get_db_setting_conn;
use rusqlite::Connection;

/// Returned when a live journal was written by a newer app. Matched by `mapTauriError`.
pub(crate) const JOURNAL_TOO_NEW: &str =
    "This journal requires a newer version of the app. Update the app to open it.";

/// Returned when a backup snapshot was written by a newer app. Matched by `mapTauriError`.
pub(crate) const BACKUP_TOO_NEW: &str =
    "This backup requires a newer version of the app. Update the app to inspect or restore it.";

/// The `db_settings` key a future additive migration may write to opt older readers in.
pub(crate) const MIN_READER_VERSION_KEY: &str = "min_reader_version";

/// Whether this app may read (and write) the database behind `conn`. Never writes.
///
/// An unreadable or missing `schema_version` counts as readable: the existing open path then
/// produces its own, more specific error (legacy and malformed journals keep their behavior).
pub(crate) fn schema_is_readable(conn: &Connection) -> bool {
    let stored: i32 = match conn.query_row("SELECT MAX(version) FROM schema_version", [], |row| {
        row.get::<_, Option<i32>>(0)
    }) {
        Ok(Some(v)) => v,
        _ => return true,
    };

    if stored <= SCHEMA_VERSION {
        return true;
    }

    match get_db_setting_conn(conn, MIN_READER_VERSION_KEY) {
        Some(value) => value
            .trim()
            .parse::<i32>()
            .is_ok_and(|min| min <= SCHEMA_VERSION),
        None => false,
    }
}

/// Refuses a live journal whose schema is newer than this app understands.
pub(crate) fn ensure_journal_readable(conn: &Connection) -> Result<(), String> {
    if schema_is_readable(conn) {
        Ok(())
    } else {
        Err(JOURNAL_TOO_NEW.to_string())
    }
}

/// Refuses a backup snapshot whose schema is newer than this app understands.
pub(crate) fn ensure_backup_readable(conn: &Connection) -> Result<(), String> {
    if schema_is_readable(conn) {
        Ok(())
    } else {
        Err(BACKUP_TOO_NEW.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create::open_connection_in_memory;

    /// The `SCHEMA_VERSION` for which the marker decision below was last made.
    const MARKER_DECIDED_FOR_SCHEMA_VERSION: i32 = 14;
    /// The `min_reader_version` value every journal at the current schema must carry
    /// (`None` = row absent). v14 is not additive-compatible, so it has no marker.
    const EXPECTED_MARKER: Option<&str> = None;

    #[test]
    fn test_marker_decision_is_recorded_for_the_current_schema() {
        assert_eq!(
            SCHEMA_VERSION, MARKER_DECIDED_FOR_SCHEMA_VERSION,
            "SCHEMA_VERSION changed: decide `min_reader_version` for the new schema (see the              checklist in db/schema/compat.rs and docs/decisions/             2026-09-schema-forward-compatibility.md), write it in both the migration step and              create_schema, then update MARKER_DECIDED_FOR_SCHEMA_VERSION and EXPECTED_MARKER"
        );
    }

    #[test]
    fn test_fresh_and_migrated_journals_agree_on_the_marker() {
        let dir = tempfile::tempdir().unwrap();

        let fresh_path = dir.path().join("fresh.db");
        let fresh = crate::db::create_database(&fresh_path, "pw".to_string()).unwrap();
        let fresh_marker = get_db_setting_conn(fresh.conn(), MIN_READER_VERSION_KEY);

        // An upgraded journal: build the current schema, roll it back to v13 (undo the
        // v13→v14 migration), then run every pending migration forward again.
        let migrated_path = dir.path().join("migrated.db");
        let migrated = crate::db::create_database(&migrated_path, "pw".to_string()).unwrap();
        migrated
            .conn()
            .execute_batch(
                "DROP TABLE entry_attachments;
                 DROP TABLE attachments;
                 DELETE FROM db_settings WHERE key = 'min_reader_version';
                 UPDATE schema_version SET version = 13;",
            )
            .unwrap();
        crate::db::schema::migrations::apply_pending(&migrated).unwrap();
        assert_eq!(
            crate::db::read_schema_version(&migrated).unwrap(),
            SCHEMA_VERSION
        );
        let migrated_marker = get_db_setting_conn(migrated.conn(), MIN_READER_VERSION_KEY);

        assert_eq!(
            fresh_marker, migrated_marker,
            "create_schema and the migrations write different min_reader_version states"
        );
        assert_eq!(fresh_marker.as_deref(), EXPECTED_MARKER);
    }

    fn db_at(version: i32, marker: Option<&str>) -> Connection {
        let conn = open_connection_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER NOT NULL);
             CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
        )
        .unwrap();
        conn.execute(
            "INSERT INTO schema_version (version) VALUES (?1)",
            [version],
        )
        .unwrap();
        if let Some(m) = marker {
            conn.execute(
                "INSERT INTO db_settings (key, value) VALUES (?1, ?2)",
                [MIN_READER_VERSION_KEY, m],
            )
            .unwrap();
        }
        conn
    }

    #[test]
    fn test_current_and_older_versions_are_readable() {
        assert!(schema_is_readable(&db_at(SCHEMA_VERSION, None)));
        assert!(schema_is_readable(&db_at(3, None)));
    }

    #[test]
    fn test_newer_version_without_marker_is_refused() {
        let conn = db_at(SCHEMA_VERSION + 1, None);
        assert!(!schema_is_readable(&conn));
        assert_eq!(ensure_journal_readable(&conn).unwrap_err(), JOURNAL_TOO_NEW);
        assert_eq!(ensure_backup_readable(&conn).unwrap_err(), BACKUP_TOO_NEW);
    }

    #[test]
    fn test_marker_decides_newer_versions() {
        let current = SCHEMA_VERSION.to_string();
        let too_high = (SCHEMA_VERSION + 1).to_string();
        assert!(schema_is_readable(&db_at(
            SCHEMA_VERSION + 1,
            Some(&current)
        )));
        assert!(!schema_is_readable(&db_at(
            SCHEMA_VERSION + 1,
            Some(&too_high)
        )));
        assert!(!schema_is_readable(&db_at(
            SCHEMA_VERSION + 1,
            Some("garbage")
        )));
    }

    #[test]
    fn test_missing_or_malformed_schema_version_is_left_to_the_open_path() {
        let no_table = open_connection_in_memory().unwrap();
        assert!(schema_is_readable(&no_table));

        let empty = open_connection_in_memory().unwrap();
        empty
            .execute_batch("CREATE TABLE schema_version (version INTEGER NOT NULL);")
            .unwrap();
        assert!(schema_is_readable(&empty));

        let text = open_connection_in_memory().unwrap();
        text.execute_batch(
            "CREATE TABLE schema_version (version TEXT);
             INSERT INTO schema_version (version) VALUES ('not-a-number');",
        )
        .unwrap();
        assert!(schema_is_readable(&text));
    }
}
