# Plan: HMAC Integrity Protection for `require_all_auth`

## Context

`require_all_auth` is now stored in `db_settings` inside `diary.db`, preventing config.json stripping. However, `db_settings` rows are plaintext SQLite and can be modified with a one-liner (`sqlite3 diary.db "DELETE FROM db_settings WHERE key='require_all_auth'"`). This plan adds a cryptographic MAC that binds the flag's value to the master key, making tampering detectable post-unlock. An attacker who modifies or deletes the row will find their single-credential unlock still rejected by a fail-safe on the backend.

## Design

**MAC primitive:** HKDF-SHA256 with the master key as IKM and a fixed domain info string. No new crates — `hkdf` (0.13) and `sha2` (0.11) are already direct dependencies.

**MAC value:** `HKDF-SHA256(IKM=master_key, salt=None, info=b"mini-diarium:require_all_auth:v1")` → 32 bytes, hex-encoded, stored in `db_settings` under key `require_all_auth_mac`.

**Canonical disabled state:** both `require_all_auth` and `require_all_auth_mac` rows are **deleted** when disabling — absence means off. This avoids needing a MAC for the "false" case.

**Fail-safe verification (applied after `open_database` when master key is available):**
1. `require_all_auth` absent or `"false"` → disabled, skip guard
2. `require_all_auth = "true"` and MAC absent → **fail-safe: enforce guard**
3. `require_all_auth = "true"` and MAC present but invalid → **fail-safe: enforce guard**
4. `require_all_auth = "true"` and MAC valid → enforce guard

**Self-healing:** after a successful `unlock_diary_all_methods`, if `require_all_auth = "true"` but MAC is absent (existing v6 journal upgrading), write the MAC. Subsequent unlocks then have a valid MAC.

---

## Files to Modify

| File | Change |
|------|--------|
| `src-tauri/src/db/queries.rs` | Add `delete_db_setting`, `compute_settings_mac` (private), `verify_require_all_auth`, `write_require_all_auth_mac` |
| `src-tauri/src/commands/auth/auth_methods.rs` | `set_require_all_auth(true)` writes MAC; `(false)` deletes both rows |
| `src-tauri/src/commands/auth/auth_core.rs` | Replace value-only guards with `verify_require_all_auth`; self-heal MAC in `unlock_diary_all_methods` |

No `Cargo.toml` changes. No schema migration.

---

## Implementation Steps

### 1. `src-tauri/src/db/queries.rs`

Add after `set_db_setting`:

```rust
pub fn delete_db_setting(conn: &rusqlite::Connection, key: &str) -> Result<(), String> {
    conn.execute("DELETE FROM db_settings WHERE key = ?1", rusqlite::params![key])
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
/// Fail-safe: if the flag is "true" but MAC is absent or invalid, returns true.
pub fn verify_require_all_auth(conn: &rusqlite::Connection, master_key: &[u8; 32]) -> bool {
    match get_db_setting(conn, "require_all_auth").as_deref() {
        None | Some("false") => return false,
        _ => {}
    }
    // Value is "true" — verify MAC
    let stored_hex = match get_db_setting(conn, "require_all_auth_mac") {
        None => return true, // fail-safe: MAC absent
        Some(h) => h,
    };
    let stored: [u8; 32] = match hex::decode(&stored_hex).ok().and_then(|b| b.try_into().ok()) {
        Some(arr) => arr,
        None => return true, // fail-safe: malformed MAC
    };
    compute_settings_mac(master_key) == stored
}

pub fn write_require_all_auth_mac(conn: &rusqlite::Connection, master_key: &[u8; 32]) -> Result<(), String> {
    let mac = compute_settings_mac(master_key);
    set_db_setting(conn, "require_all_auth_mac", &hex::encode(mac))
}
```

---

### 2. `src-tauri/src/commands/auth/auth_methods.rs` — `set_require_all_auth`

Replace the current write block:

```rust
// Old:
let value = if enabled { "true" } else { "false" };
crate::db::queries::set_db_setting(db.conn(), "require_all_auth", value)?;

// New:
if enabled {
    crate::db::queries::set_db_setting(db.conn(), "require_all_auth", "true")?;
    crate::db::queries::write_require_all_auth_mac(db.conn(), db.key().as_bytes())?;
} else {
    crate::db::queries::delete_db_setting(db.conn(), "require_all_auth")?;
    crate::db::queries::delete_db_setting(db.conn(), "require_all_auth_mac")?;
}
```

Also remove the best-effort config.json cleanup block (it still calls `set_journal_require_all_auth` which is fine to keep).

---

### 3. `src-tauri/src/commands/auth/auth_core.rs` — unlock guards

**`unlock_diary` and `unlock_diary_with_keypair`** — replace the `get_db_setting` guard with:

```rust
if crate::db::queries::verify_require_all_auth(db_conn.conn(), db_conn.key().as_bytes()) {
    return Err(
        "This journal requires all authentication methods. Use the combined unlock.".to_string(),
    );
}
```

**`unlock_diary_all_methods`** — replace credential-count guard `get_db_setting` call with `verify_require_all_auth`, then add self-heal block after credentials loop (before committing to `db_state`):

```rust
// Self-heal: write MAC for existing v6 journals that predate MAC support
if crate::db::queries::get_db_setting(db_conn.conn(), "require_all_auth")
    .map(|v| v == "true")
    .unwrap_or(false)
    && crate::db::queries::get_db_setting(db_conn.conn(), "require_all_auth_mac").is_none()
{
    if let Err(e) = crate::db::queries::write_require_all_auth_mac(
        db_conn.conn(),
        db_conn.key().as_bytes(),
    ) {
        warn!("Failed to write require_all_auth MAC: {}", e);
    }
}
```

---

### 4. Tests

**`queries.rs` test module:**
- `test_verify_require_all_auth_no_flag_returns_false` — fresh DB
- `test_verify_require_all_auth_with_valid_mac` — write flag + MAC, verify returns true
- `test_verify_require_all_auth_missing_mac_fail_safe` — write "true" without MAC → true (fail-safe)
- `test_verify_require_all_auth_tampered_mac_fail_safe` — write valid MAC, then overwrite with garbage → true (fail-safe); also test changing value to "false" with original MAC → false (value takes precedence)
- `test_verify_require_all_auth_after_delete` — delete both rows → false

**`auth_methods.rs` test module:**
- `test_set_require_all_auth_true_writes_valid_mac`
- `test_set_require_all_auth_false_deletes_both_rows`

---

## Verification

```bash
cd src-tauri && cargo test
bun run test:run
bun run type-check
```

**Attack scenario:** use `sqlite3 diary.db` to corrupt `require_all_auth_mac`. Single-credential unlock must be blocked even though the plaintext flag says "true". Deleting both rows must allow normal unlock (canonical disabled state).
