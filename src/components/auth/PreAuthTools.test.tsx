import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import PreAuthTools from './PreAuthTools';

const {
  mockListBackups,
  mockListBackupsUnauthenticated,
  mockGetBackupHealth,
  mockCreateBackupNow,
  mockVerifyBackup,
  mockDeleteBackup,
  mockRevealBackupsFolder,
} = vi.hoisted(() => ({
  mockListBackups: vi.fn(),
  mockListBackupsUnauthenticated: vi.fn(),
  mockGetBackupHealth: vi.fn(),
  mockCreateBackupNow: vi.fn(),
  mockVerifyBackup: vi.fn(),
  mockDeleteBackup: vi.fn(),
  mockRevealBackupsFolder: vi.fn(),
}));

vi.mock('../../lib/tauri', () => ({
  listBackups: mockListBackups,
  listBackupsUnauthenticated: mockListBackupsUnauthenticated,
  getBackupHealth: mockGetBackupHealth,
  createBackupNow: mockCreateBackupNow,
  verifyBackup: mockVerifyBackup,
  deleteBackup: mockDeleteBackup,
  revealBackupsFolder: mockRevealBackupsFolder,
}));

vi.mock('../../state/journals', () => ({
  journals: () => [{ id: 'j1', auto_protected: false }],
  activeJournalId: () => 'j1',
}));

describe('PreAuthTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListBackupsUnauthenticated.mockResolvedValue({
      snapshots: [
        {
          file_name: 'backup-2026-08-06-09h30m00.db',
          created_at: '2026-08-06T09:30:00Z',
          trigger: 'unlock',
          byte_size: 4096,
          sqlite_change_counter: null,
          db_schema_version: 13,
          app_version: null,
          entry_count: 2,
          entry_date_range: ['2024-01-15', '2024-03-20'],
          auth_slot_types: ['password'],
          verified: false,
        },
      ],
      health: {
        snapshot_count: 1,
        verified_count: 0,
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
      },
    });
  });

  it('offers a backups entry point with no journal unlocked', () => {
    renderWithI18n(() => <PreAuthTools />);
    expect(screen.getByTestId('pre-auth-backups-button')).toBeInTheDocument();
  });

  it('opens the panel in reduced mode, reading through the key-free command', async () => {
    renderWithI18n(() => <PreAuthTools />);

    fireEvent.click(screen.getByTestId('pre-auth-backups-button'));

    await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());
    expect(mockListBackupsUnauthenticated).toHaveBeenCalled();
    // Nothing that opens the database or needs the master key may run here.
    expect(mockListBackups).not.toHaveBeenCalled();
    expect(mockGetBackupHealth).not.toHaveBeenCalled();
  });

  it('disables the key-requiring actions and says why', async () => {
    renderWithI18n(() => <PreAuthTools />);
    fireEvent.click(screen.getByTestId('pre-auth-backups-button'));

    await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());
    expect(screen.getByTestId('backups-create-button')).toBeDisabled();
    expect(screen.getByTestId('backups-locked-hint')).toHaveTextContent(/Unlock this journal/i);
  });

  it('still describes each snapshot — the metadata needs no key', async () => {
    renderWithI18n(() => <PreAuthTools />);
    fireEvent.click(screen.getByTestId('pre-auth-backups-button'));

    await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());
    expect(screen.getByText(/2 entries/)).toBeInTheDocument();
    expect(screen.getByText(/2024-01-15/)).toBeInTheDocument();
    expect(screen.getByTestId('backups-item-unverified')).toBeInTheDocument();
  });

  it('does not render the panel until the entry point is used', () => {
    renderWithI18n(() => <PreAuthTools />);
    expect(screen.queryByTestId('backups-panel')).not.toBeInTheDocument();
    expect(mockListBackupsUnauthenticated).not.toHaveBeenCalled();
  });
});
