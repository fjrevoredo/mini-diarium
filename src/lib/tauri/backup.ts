import { invoke } from '@tauri-apps/api/core';

/**
 * A snapshot's manifest record.
 *
 * Field names are snake_case because these come straight off the Rust `SnapshotMeta`, which
 * is also the on-disk `manifest.json` record — renaming here would put the wire format and
 * the file format out of step for no gain.
 *
 * Everything here is readable without a key. `verified: false` means "the live master key
 * has not been confirmed against this snapshot", not "we do not know what is inside" — the
 * counts and dates are read from plaintext columns either way.
 */
export interface SnapshotMeta {
  /** Generated file name inside the backups directory. Never a path. */
  file_name: string;
  /** RFC 3339 UTC instant. */
  created_at: string;
  trigger: SnapshotTrigger;
  byte_size: number;
  sqlite_change_counter: number | null;
  db_schema_version: number | null;
  app_version: string | null;
  entry_count: number | null;
  /** `[earliest, latest]` `YYYY-MM-DD` entry dates present in the snapshot. */
  entry_date_range: [string, string] | null;
  /** Auth-slot *types* only (`password` / `keypair` / `auto`) — never user-chosen labels. */
  auth_slot_types: string[];
  verified: boolean;
}

/**
 * Why a snapshot was taken. `destructive` carries the operation name; the rest are unit
 * variants, which is how serde renders a Rust enum with one newtype variant.
 */
export type SnapshotTrigger =
  'unlock' | 'lock' | 'migration' | 'manual' | 'pre_restore' | 'adopted' | { destructive: string };

/** A snapshot attempt that failed. Carries no message by design — see the Rust doc comment. */
export interface BackupFailure {
  at: string;
  trigger: SnapshotTrigger;
}

/** Aggregate state of one journal's backups directory. */
export interface BackupHealth {
  snapshot_count: number;
  verified_count: number;
  total_bytes: number;
  budget_bytes: number;
  budget_exceeded: boolean;
  newest_created_at: string | null;
  oldest_created_at: string | null;
  last_failure: BackupFailure | null;
  directory_accessible: boolean;
  recent: number;
  daily_days: number;
  weekly_weeks: number;
  monthly_months: number;
}

/** Snapshots plus health in one read, for the pre-auth view. */
export interface BackupOverview {
  snapshots: SnapshotMeta[];
  health: BackupHealth;
}

/** Lists the active journal's snapshots, newest first. */
export async function listBackups(): Promise<SnapshotMeta[]> {
  return await invoke<SnapshotMeta[]>('list_backups');
}

/**
 * Snapshots plus health, readable while the journal is locked.
 *
 * This is what the unlock screen calls. It opens no database and needs no key, so it still
 * answers when the journal itself will not — which is the case it exists for.
 */
export async function listBackupsUnauthenticated(): Promise<BackupOverview> {
  return await invoke<BackupOverview>('list_backups_unauthenticated');
}

/** Aggregate state of the active journal's backups directory. */
export async function getBackupHealth(): Promise<BackupHealth> {
  return await invoke<BackupHealth>('get_backup_health');
}

/** Takes a snapshot on demand. Always writes one — manual snapshots skip the rate limits. */
export async function createBackupNow(): Promise<SnapshotMeta> {
  return await invoke<SnapshotMeta>('create_backup_now');
}

/**
 * Re-checks one snapshot against the live master key, returning the updated record.
 *
 * A snapshot that fails is reported, not deleted: it may still be readable with the
 * credential it was taken with.
 */
export async function verifyBackup(fileName: string): Promise<SnapshotMeta> {
  return await invoke<SnapshotMeta>('verify_backup', { fileName });
}

/** Deletes one snapshot. Requires an unlocked journal. */
export async function deleteBackup(fileName: string): Promise<void> {
  await invoke('delete_backup', { fileName });
}

/**
 * Opens the backups folder in the OS file manager.
 *
 * The path is resolved in Rust and never crosses the IPC boundary.
 */
export async function revealBackupsFolder(): Promise<void> {
  await invoke('reveal_backups_folder');
}
