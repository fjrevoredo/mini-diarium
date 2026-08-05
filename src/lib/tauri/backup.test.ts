import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  listBackups,
  listBackupsUnauthenticated,
  getBackupHealth,
  createBackupNow,
  verifyBackup,
  deleteBackup,
  revealBackupsFolder,
  type BackupHealth,
  type SnapshotMeta,
} from './backup';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

const snapshot: SnapshotMeta = {
  file_name: 'backup-2026-08-06-09h30m00.db',
  created_at: '2026-08-06T09:30:00Z',
  trigger: 'manual',
  byte_size: 4096,
  sqlite_change_counter: 21,
  db_schema_version: 13,
  app_version: '0.6.6',
  entry_count: 3,
  entry_date_range: ['2024-01-15', '2024-03-20'],
  auth_slot_types: ['password'],
  verified: true,
};

const health: BackupHealth = {
  snapshot_count: 1,
  verified_count: 1,
  total_bytes: 4096,
  budget_bytes: 2147483648,
  budget_exceeded: false,
  newest_created_at: '2026-08-06T09:30:00Z',
  oldest_created_at: '2026-08-06T09:30:00Z',
  last_failure: null,
  directory_accessible: true,
  recent: 10,
  daily_days: 14,
  weekly_weeks: 8,
  monthly_months: 12,
};

describe('backup command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listBackups → list_backups with no arguments', async () => {
    mockInvoke.mockResolvedValue([snapshot]);
    await expect(listBackups()).resolves.toEqual([snapshot]);
    expect(mockInvoke).toHaveBeenCalledWith('list_backups');
  });

  it('listBackupsUnauthenticated → list_backups_unauthenticated returning snapshots + health', async () => {
    mockInvoke.mockResolvedValue({ snapshots: [snapshot], health });
    await expect(listBackupsUnauthenticated()).resolves.toEqual({
      snapshots: [snapshot],
      health,
    });
    expect(mockInvoke).toHaveBeenCalledWith('list_backups_unauthenticated');
  });

  it('getBackupHealth → get_backup_health', async () => {
    mockInvoke.mockResolvedValue(health);
    await expect(getBackupHealth()).resolves.toEqual(health);
    expect(mockInvoke).toHaveBeenCalledWith('get_backup_health');
  });

  it('createBackupNow → create_backup_now returning the new record', async () => {
    mockInvoke.mockResolvedValue(snapshot);
    await expect(createBackupNow()).resolves.toEqual(snapshot);
    expect(mockInvoke).toHaveBeenCalledWith('create_backup_now');
  });

  it('verifyBackup → verify_backup { fileName } (camelCase)', async () => {
    mockInvoke.mockResolvedValue(snapshot);
    await expect(verifyBackup(snapshot.file_name)).resolves.toEqual(snapshot);
    expect(mockInvoke).toHaveBeenCalledWith('verify_backup', {
      fileName: snapshot.file_name,
    });
  });

  it('deleteBackup → delete_backup { fileName } (camelCase)', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await expect(deleteBackup(snapshot.file_name)).resolves.toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledWith('delete_backup', {
      fileName: snapshot.file_name,
    });
  });

  it('revealBackupsFolder → reveal_backups_folder with no path argument', async () => {
    // The backups path stays in Rust; sending it to the WebView just to send it back would
    // put a filesystem path on the IPC boundary for nothing.
    mockInvoke.mockResolvedValue(undefined);
    await expect(revealBackupsFolder()).resolves.toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledWith('reveal_backups_folder');
  });

  it('propagates backend errors instead of swallowing them', async () => {
    mockInvoke.mockRejectedValue('Journal must be unlocked');
    await expect(createBackupNow()).rejects.toBe('Journal must be unlocked');
  });
});
