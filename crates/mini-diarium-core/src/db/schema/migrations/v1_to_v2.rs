use crate::db::schema::DatabaseConnection;
use log::{debug, error, info, warn};
use std::path::Path;

/// Migration v1 → v2: Replace external-content FTS with standalone FTS table.
///
/// Does NOT change the encryption key or re-encrypt entries.
pub(crate) fn migrate_v1_to_v2(db: &DatabaseConnection, backups_dir: &Path) -> Result<(), String> {
    info!("Migration v1→v2: starting");

    // v1 journals predate the auth-slot model, so this takes the atomic `VACUUM INTO`
    // write without the master-key verification the modern engine applies.
    let backup_name = crate::backup::create_pre_v3_snapshot(db, backups_dir)
        .map_err(|e| format!("Failed to create pre-migration backup: {}", e))?;
    let backup_path = backups_dir.join(&backup_name);
    info!("Migration v1→v2: backup created at {:?}", backup_path);

    let conn = db.conn();
    conn.execute_batch("BEGIN IMMEDIATE TRANSACTION")
        .map_err(|e| format!("Failed to begin migration transaction: {}", e))?;

    let migration_result = (|| -> Result<(), String> {
        debug!("Migration v1→v2: removing v1 FTS triggers and external-content table");

        conn.execute_batch(
            r#"
            DROP TRIGGER IF EXISTS entries_ai;
            DROP TRIGGER IF EXISTS entries_ad;
            DROP TRIGGER IF EXISTS entries_au;
            DROP TABLE IF EXISTS entries_fts;
            "#,
        )
        .map_err(|e| format!("Failed to drop old FTS table: {}", e))?;

        conn.execute("DELETE FROM schema_version", [])
            .map_err(|e| format!("Failed to clear schema version: {}", e))?;
        conn.execute("INSERT INTO schema_version (version) VALUES (2)", [])
            .map_err(|e| format!("Failed to update schema version: {}", e))?;

        Ok(())
    })();

    match migration_result {
        Ok(()) => {
            conn.execute_batch("COMMIT")
                .map_err(|e| format!("Failed to commit migration: {}", e))?;
            info!("Migration v1→v2: complete (backup at {:?})", backup_path);
            Ok(())
        }
        Err(e) => {
            error!("Migration v1→v2: failed - {}", e);
            match conn.execute_batch("ROLLBACK") {
                Ok(_) => {
                    warn!("Migration v1→v2: rollback successful");
                    Err(format!(
                        "Migration v1→v2 failed (database unchanged, backup at {:?}): {}\n\
                         \n\
                         RECOVERY: Your database is intact. The migration will retry next time you open the app.\n\
                         Backup available at: {:?}",
                        backup_path, e, backup_path
                    ))
                }
                Err(rollback_err) => Err(format!(
                    "CRITICAL: Migration v1→v2 failed AND rollback failed.\n\
                     Original error: {}\nRollback error: {}\n\
                     RESTORE from backup: {:?}",
                    e, rollback_err, backup_path
                )),
            }
        }
    }
}
