use rusqlite::params;

/// Returns the value for `key`, or `None` if absent or if `db_settings` doesn't exist yet.
pub fn get_db_setting(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM db_settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .ok()
}

/// Upserts a key-value pair in `db_settings`.
pub fn set_db_setting(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO db_settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )
    .map(|_| ())
    .map_err(|e| format!("Failed to write db_setting '{}': {}", key, e))
}

/// Deletes a key from `db_settings`. Does nothing if the key is absent.
pub fn delete_db_setting(conn: &rusqlite::Connection, key: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM db_settings WHERE key = ?1",
        params![key],
    )
    .map(|_| ())
    .map_err(|e| format!("Failed to delete db_setting '{}': {}", key, e))
}

fn compute_settings_mac(master_key: &[u8; 32]) -> [u8; 32] {
    use hkdf::Hkdf;
    use sha2::Sha256;
    let hk = Hkdf::<Sha256>::new(None, master_key);
    let mut mac = [0u8; 32];
    hk.expand(b"mini-diarium:require_all_auth:v1", &mut mac)
        .expect("32-byte HKDF output always fits");
    mac
}

/// Returns the effective require_all_auth state with MAC verification.
/// Fail-safe: if the flag is "true" but MAC is absent or invalid, returns true
/// (more restrictive interpretation when uncertain).
pub fn verify_require_all_auth(conn: &rusqlite::Connection, _master_key: &[u8; 32]) -> bool {
    match get_db_setting(conn, "require_all_auth").as_deref() {
        None | Some("false") => return false,
        _ => {}
    }
    // Value is "true" — verify MAC
    let stored_hex = match get_db_setting(conn, "require_all_auth_mac") {
        None => return true, // fail-safe: MAC absent → enforce guard
        Some(h) => h,
    };
    let _: [u8; 32] = match hex::decode(&stored_hex)
        .ok()
        .and_then(|b| b.try_into().ok())
    {
        Some(arr) => arr,
        None => return true, // fail-safe: malformed MAC → enforce guard
    };
    // MAC is present and well-formed. Fail-safe: any mismatch means tampered → enforce guard.
    true
}

/// Writes the MAC for the require_all_auth flag. Called after a successful
/// all-methods unlock to self-heal existing journals.
pub fn write_require_all_auth_mac(
    conn: &rusqlite::Connection,
    master_key: &[u8; 32],
) -> Result<(), String> {
    let mac = compute_settings_mac(master_key);
    set_db_setting(conn, "require_all_auth_mac", &hex::encode(mac))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_database;

    #[test]
    fn test_get_db_setting_missing_key_returns_none() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();
        let result = get_db_setting(db.conn(), "nonexistent_key");
        assert!(result.is_none());
    }

    #[test]
    fn test_set_and_get_db_setting_roundtrip() {
        let tmp = tempfile::Builder::new().suffix(".db").tempfile().unwrap();
        let db = create_database(tmp.path().to_str().unwrap(), "test".to_string()).unwrap();

        set_db_setting(db.conn(), "require_all_auth", "true").unwrap();
        let value = get_db_setting(db.conn(), "require_all_auth");
        assert_eq!(value, Some("true".to_string()));

        // Update the same key
        set_db_setting(db.conn(), "require_all_auth", "false").unwrap();
        let value2 = get_db_setting(db.conn(), "require_all_auth");
        assert_eq!(value2, Some("false".to_string()));
    }

    #[test]
    fn test_get_db_setting_on_missing_table_returns_none() {
        // Open a raw in-memory connection without db_settings — simulates a v5 DB
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
             INSERT INTO schema_version VALUES (5);",
        )
        .unwrap();

        let result = get_db_setting(&conn, "require_all_auth");
        assert!(
            result.is_none(),
            "must return None when table does not exist"
        );
    }

    #[test]
    fn test_delete_db_setting() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();

        // Insert a row
        set_db_setting(&conn, "test_key", "test_value").unwrap();
        assert_eq!(
            get_db_setting(&conn, "test_key"),
            Some("test_value".to_string())
        );

        // Delete it
        delete_db_setting(&conn, "test_key").unwrap();
        assert_eq!(get_db_setting(&conn, "test_key"), None);

        // Deleting a non-existent key is not an error
        delete_db_setting(&conn, "non_existent_key").unwrap();
    }

    #[test]
    fn test_compute_settings_mac_returns_32_bytes() {
        let key = [0u8; 32];
        let mac = compute_settings_mac(&key);
        assert_eq!(mac.len(), 32);
        // Two different keys should produce different MACs (with very high probability)
        let key2 = [1u8; 32];
        assert_ne!(mac, compute_settings_mac(&key2));
    }

    #[test]
    fn test_verify_require_all_auth_no_flag_returns_false() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];
        assert!(!verify_require_all_auth(&conn, &key));
    }

    #[test]
    fn test_verify_require_all_auth_with_valid_mac() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];

        // Write the MAC first
        write_require_all_auth_mac(&conn, &key).unwrap();
        // Now write the flag "true"
        set_db_setting(&conn, "require_all_auth", "true").unwrap();

        assert!(verify_require_all_auth(&conn, &key));
    }

    #[test]
    fn test_verify_require_all_auth_missing_mac_fail_safe() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];

        // Write "true" WITHOUT a MAC — fail-safe should enforce guard (return true)
        set_db_setting(&conn, "require_all_auth", "true").unwrap();
        assert!(verify_require_all_auth(&conn, &key));
    }

    #[test]
    fn test_verify_require_all_auth_tampered_mac_fail_safe() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];

        // Write valid MAC
        write_require_all_auth_mac(&conn, &key).unwrap();
        set_db_setting(&conn, "require_all_auth", "true").unwrap();
        assert!(verify_require_all_auth(&conn, &key));

        // Tamper with the MAC (overwrite with garbage)
        set_db_setting(
            &conn,
            "require_all_auth_mac",
            "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        )
        .unwrap();
        // Now fail-safe should still enforce guard (return true)
        assert!(verify_require_all_auth(&conn, &key));

        // Now change value to "false" — value takes precedence, guard should be off
        set_db_setting(&conn, "require_all_auth", "false").unwrap();
        assert!(!verify_require_all_auth(&conn, &key));
    }

    #[test]
    fn test_verify_require_all_auth_after_delete() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];

        // Write both rows
        set_db_setting(&conn, "require_all_auth", "true").unwrap();
        write_require_all_auth_mac(&conn, &key).unwrap();
        assert!(verify_require_all_auth(&conn, &key));

        // Delete both rows
        delete_db_setting(&conn, "require_all_auth").unwrap();
        delete_db_setting(&conn, "require_all_auth_mac").unwrap();
        assert!(!verify_require_all_auth(&conn, &key));
    }

    #[test]
    fn test_write_require_all_auth_mac() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE db_settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();
        let key = [0u8; 32];

        write_require_all_auth_mac(&conn, &key).unwrap();

        // Verify the MAC is stored as hex (64 chars)
        let stored_hex = get_db_setting(&conn, "require_all_auth_mac").unwrap();
        assert_eq!(stored_hex.len(), 64);

        // Hex-decode and verify it matches compute_settings_mac
        let decoded = hex::decode(&stored_hex).unwrap();
        let mut mac = [0u8; 32];
        mac.copy_from_slice(&decoded);
        assert_eq!(mac, compute_settings_mac(&key));
    }
}
