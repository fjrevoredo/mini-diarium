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
  restoreBackup,
  checkBackupCredentials,
  openBackupReadonly,
  listBackupEntries,
  listBackupEntriesWithStatus,
  restoreEntriesFromBackup,
  closeBackup,
  type BackupCredentialReport,
  type BackupEntry,
  type BackupEntryDiff,
  type BackupHealth,
  type RestoreEntriesSummary,
  type RestoreSummary,
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

  it('restoreBackup → restore_backup { fileName } (camelCase)', async () => {
    const summary: RestoreSummary = {
      restored: true,
      safety_snapshot: 'backup-2026-08-11-14h30m00.db',
      safety_snapshot_created_at: '2026-08-11T14:30:00Z',
    };
    mockInvoke.mockResolvedValue(summary);
    await expect(restoreBackup(snapshot.file_name)).resolves.toEqual(summary);
    expect(mockInvoke).toHaveBeenCalledWith('restore_backup', {
      fileName: snapshot.file_name,
    });
  });

  it('restoreBackup rejects rather than resolving when the restore is aborted or rolled back', async () => {
    mockInvoke.mockRejectedValue('This backup could not be restored: wrong key.');
    await expect(restoreBackup(snapshot.file_name)).rejects.toBe(
      'This backup could not be restored: wrong key.',
    );
  });
});

describe('backup inspection wrappers (IPC contract)', () => {
  const report: BackupCredentialReport = {
    snapshot_slot_types: ['password'],
    live_slot_types: ['password'],
    differs_from_live: true,
    compared: true,
  };

  const entry: BackupEntry = {
    id: 7,
    date: '2024-01-15',
    title: 'Inspected',
    preview: 'body text',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checkBackupCredentials → check_backup_credentials { fileName }', async () => {
    mockInvoke.mockResolvedValue(report);
    await expect(checkBackupCredentials(snapshot.file_name)).resolves.toEqual(report);
    expect(mockInvoke).toHaveBeenCalledWith('check_backup_credentials', {
      fileName: snapshot.file_name,
    });
  });

  it('openBackupReadonly sends a password and a null key path', async () => {
    mockInvoke.mockResolvedValue({ file_name: snapshot.file_name, credential_differs: false });
    await openBackupReadonly(snapshot.file_name, { password: 'old-password' });
    expect(mockInvoke).toHaveBeenCalledWith('open_backup_readonly', {
      fileName: snapshot.file_name,
      password: 'old-password',
      keyPath: null,
    });
  });

  it('openBackupReadonly sends both credentials as null when none is given', async () => {
    // The local-only case: the backend falls back to this device's key. Sending `undefined`
    // would drop the argument entirely and the Rust `Option` would still be `None`, but an
    // explicit null keeps the wire shape identical across the three cases.
    mockInvoke.mockResolvedValue({ file_name: snapshot.file_name, credential_differs: false });
    await openBackupReadonly(snapshot.file_name);
    expect(mockInvoke).toHaveBeenCalledWith('open_backup_readonly', {
      fileName: snapshot.file_name,
      password: null,
      keyPath: null,
    });
  });

  it('listBackupEntries → list_backup_entries with no arguments', async () => {
    mockInvoke.mockResolvedValue([entry]);
    await expect(listBackupEntries()).resolves.toEqual([entry]);
    expect(mockInvoke).toHaveBeenCalledWith('list_backup_entries');
  });

  it('listBackupEntriesWithStatus → list_backup_entries_with_status with no arguments', async () => {
    const diff: BackupEntryDiff = { ...entry, status: 'shorter_in_live' };
    mockInvoke.mockResolvedValue([diff]);
    await expect(listBackupEntriesWithStatus()).resolves.toEqual([diff]);
    expect(mockInvoke).toHaveBeenCalledWith('list_backup_entries_with_status');
  });

  it('restoreEntriesFromBackup → restore_entries_from_backup { entryIds } (camelCase)', async () => {
    const summary: RestoreEntriesSummary = { added_count: 2 };
    mockInvoke.mockResolvedValue(summary);
    await expect(restoreEntriesFromBackup([7, 9])).resolves.toEqual(summary);
    expect(mockInvoke).toHaveBeenCalledWith('restore_entries_from_backup', {
      entryIds: [7, 9],
    });
  });

  it('restoreEntriesFromBackup rejects rather than resolving empty when the backend refuses', async () => {
    mockInvoke.mockRejectedValue('Select at least one entry to restore.');
    await expect(restoreEntriesFromBackup([])).rejects.toBe(
      'Select at least one entry to restore.',
    );
  });

  it('closeBackup → close_backup', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await expect(closeBackup()).resolves.toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledWith('close_backup');
  });

  it('surfaces a wrong-credential failure rather than resolving empty', async () => {
    mockInvoke.mockRejectedValue('That password does not open this backup.');
    await expect(openBackupReadonly(snapshot.file_name, { password: 'wrong' })).rejects.toBe(
      'That password does not open this backup.',
    );
  });
});
