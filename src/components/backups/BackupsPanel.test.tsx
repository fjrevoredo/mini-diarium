import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import BackupsPanel, { formatBytes, describeTrigger } from './BackupsPanel';
import { defaultT } from '../../i18n';
import type { BackupHealth, SnapshotMeta } from '../../lib/tauri';

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

const { mockJournals, mockActiveJournalId } = vi.hoisted(() => ({
  mockJournals: vi.fn(() => [] as { id: string; auto_protected: boolean }[]),
  mockActiveJournalId: vi.fn(() => 'j1'),
}));

vi.mock('../../state/journals', () => ({
  journals: mockJournals,
  activeJournalId: mockActiveJournalId,
}));

function snapshot(overrides: Partial<SnapshotMeta> = {}): SnapshotMeta {
  return {
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
    ...overrides,
  };
}

function health(overrides: Partial<BackupHealth> = {}): BackupHealth {
  return {
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
    ...overrides,
  };
}

const visible = () => true;

describe('BackupsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJournals.mockReturnValue([{ id: 'j1', auto_protected: false }]);
    mockActiveJournalId.mockReturnValue('j1');
    mockListBackups.mockResolvedValue([]);
    mockGetBackupHealth.mockResolvedValue(health({ snapshot_count: 0, total_bytes: 0 }));
    mockListBackupsUnauthenticated.mockResolvedValue({
      snapshots: [],
      health: health({ snapshot_count: 0, total_bytes: 0 }),
    });
  });

  it('shows the empty state when the journal has no snapshots yet', async () => {
    renderWithI18n(() => <BackupsPanel isVisible={visible} />);

    await waitFor(() => expect(screen.getByTestId('backups-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('backups-list-item')).not.toBeInTheDocument();
  });

  it('lists snapshots with their trigger, entry count, size, and checked state', async () => {
    mockListBackups.mockResolvedValue([
      snapshot(),
      snapshot({
        file_name: 'backup-2026-08-01-08h00m00.db',
        created_at: '2026-08-01T08:00:00Z',
        trigger: 'migration',
        entry_count: 1,
        verified: false,
      }),
    ]);
    mockGetBackupHealth.mockResolvedValue(health({ snapshot_count: 2, verified_count: 1 }));

    renderWithI18n(() => <BackupsPanel isVisible={visible} />);

    await waitFor(() => expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2));
    expect(screen.getByText(/Manual/)).toBeInTheDocument();
    expect(screen.getByText(/Before a database upgrade/)).toBeInTheDocument();
    expect(screen.getByText(/3 entries/)).toBeInTheDocument();
    // Both fixtures carry the same range, so both rows must show it — the other side of the
    // gate the reduced-mode test pins.
    expect(screen.getAllByText(/2024-01-15 to 2024-03-20/)).toHaveLength(2);
    expect(screen.getByTestId('backups-item-verified')).toBeInTheDocument();
    expect(screen.getByTestId('backups-item-unverified')).toBeInTheDocument();
  });

  it('reports a healthy directory', async () => {
    mockListBackups.mockResolvedValue([snapshot()]);
    mockGetBackupHealth.mockResolvedValue(health());

    renderWithI18n(() => <BackupsPanel isVisible={visible} />);

    await waitFor(() => expect(screen.getByTestId('backups-health-ok')).toBeInTheDocument());
    expect(screen.queryByTestId('backups-health-problem')).not.toBeInTheDocument();
  });

  it('surfaces the last failed attempt over a healthy-looking list', async () => {
    // The failure that matters happens on a background thread with no UI attached, so a
    // directory that still holds snapshots can nonetheless be broken.
    mockListBackups.mockResolvedValue([snapshot()]);
    mockGetBackupHealth.mockResolvedValue(
      health({ last_failure: { at: '2026-08-06T10:00:00Z', trigger: 'lock' } }),
    );

    renderWithI18n(() => <BackupsPanel isVisible={visible} />);

    await waitFor(() =>
      expect(screen.getByTestId('backups-health-problem')).toHaveTextContent(
        /last backup attempt failed/i,
      ),
    );
    expect(screen.queryByTestId('backups-health-ok')).not.toBeInTheDocument();
  });

  it('reports an unreachable backups folder', async () => {
    mockListBackups.mockResolvedValue([]);
    mockGetBackupHealth.mockResolvedValue(
      health({ snapshot_count: 0, total_bytes: 0, directory_accessible: false }),
    );

    renderWithI18n(() => <BackupsPanel isVisible={visible} />);

    await waitFor(() =>
      expect(screen.getByTestId('backups-health-problem')).toHaveTextContent(/cannot be used/i),
    );
  });

  it('does not cry wolf on a journal that has simply never been backed up', async () => {
    // The backups directory is created by the first snapshot, so "no folder yet" is the
    // normal first-run state. The backend reports it as usable; the panel must agree.
    mockListBackups.mockResolvedValue([]);
    mockGetBackupHealth.mockResolvedValue(
      health({
        snapshot_count: 0,
        verified_count: 0,
        total_bytes: 0,
        newest_created_at: null,
        oldest_created_at: null,
        directory_accessible: true,
      }),
    );

    renderWithI18n(() => <BackupsPanel isVisible={visible} />);

    await waitFor(() => expect(screen.getByTestId('backups-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('backups-health-problem')).not.toBeInTheDocument();
    expect(screen.getByTestId('backups-health-ok')).toBeInTheDocument();
  });

  it('reports an exceeded storage budget', async () => {
    mockListBackups.mockResolvedValue([snapshot()]);
    mockGetBackupHealth.mockResolvedValue(health({ budget_exceeded: true }));

    renderWithI18n(() => <BackupsPanel isVisible={visible} />);

    await waitFor(() =>
      expect(screen.getByTestId('backups-health-problem')).toHaveTextContent(
        /over their storage limit/i,
      ),
    );
  });

  it('shows the local-only notice for a passwordless journal (UX-7)', async () => {
    mockJournals.mockReturnValue([{ id: 'j1', auto_protected: true }]);

    renderWithI18n(() => <BackupsPanel isVisible={visible} />);

    await waitFor(() =>
      expect(screen.getByTestId('backups-local-only-notice')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('backups-local-only-notice')).toHaveTextContent(
      /not enough to open them there/i,
    );
  });

  it('hides the local-only notice for a password-protected journal', async () => {
    renderWithI18n(() => <BackupsPanel isVisible={visible} />);

    await waitFor(() => expect(screen.getByTestId('backups-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('backups-local-only-notice')).not.toBeInTheDocument();
  });

  it('takes a snapshot on demand and reloads the list', async () => {
    mockCreateBackupNow.mockResolvedValue(snapshot());
    renderWithI18n(() => <BackupsPanel isVisible={visible} />);
    await waitFor(() => expect(screen.getByTestId('backups-empty')).toBeInTheDocument());

    mockListBackups.mockResolvedValue([snapshot()]);
    mockGetBackupHealth.mockResolvedValue(health());
    fireEvent.click(screen.getByTestId('backups-create-button'));

    await waitFor(() => expect(mockCreateBackupNow).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());
  });

  it('shows a sanitized error when the backend refuses', async () => {
    mockListBackups.mockRejectedValue('Journal must be unlocked');

    renderWithI18n(() => <BackupsPanel isVisible={visible} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  describe('reduced (pre-auth) mode', () => {
    it('reads through the unauthenticated command, never the unlocked one', async () => {
      mockListBackupsUnauthenticated.mockResolvedValue({
        snapshots: [snapshot()],
        health: health(),
      });

      renderWithI18n(() => <BackupsPanel isVisible={visible} reduced />);

      await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());
      expect(mockListBackupsUnauthenticated).toHaveBeenCalled();
      expect(mockListBackups).not.toHaveBeenCalled();
      expect(mockGetBackupHealth).not.toHaveBeenCalled();
    });

    it('disables every action that needs the master key, with a reason', async () => {
      mockListBackupsUnauthenticated.mockResolvedValue({
        snapshots: [snapshot()],
        health: health(),
      });

      renderWithI18n(() => <BackupsPanel isVisible={visible} reduced />);

      await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());
      expect(screen.getByTestId('backups-create-button')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
      expect(screen.getByTestId('backups-locked-hint')).toBeInTheDocument();
    });

    it('shows dates, triggers, sizes and health only — no entry counts or date ranges', async () => {
      // Task 3.3's disclosure contract. Not a plaintext leak either way (the manifest privacy
      // decision permits this metadata), but the locked screen should not tell a passer-by
      // how much has been written and over what span.
      mockListBackupsUnauthenticated.mockResolvedValue({
        snapshots: [snapshot()],
        health: health(),
      });

      renderWithI18n(() => <BackupsPanel isVisible={visible} reduced />);

      await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());
      const row = within(screen.getByTestId('backups-list-item'));
      expect(row.getByText(/Manual/)).toBeInTheDocument();
      expect(row.getByText(/4\.0 KB/)).toBeInTheDocument();
      expect(screen.getByTestId('backups-item-verified')).toBeInTheDocument();
      expect(screen.getByTestId('backups-health-ok')).toBeInTheDocument();

      expect(screen.queryByText(/3 entries/)).not.toBeInTheDocument();
      expect(screen.queryByText(/2024-01-15 to 2024-03-20/)).not.toBeInTheDocument();
    });

    it('still allows opening the backups folder — the one useful action with no key', async () => {
      mockListBackupsUnauthenticated.mockResolvedValue({ snapshots: [], health: health() });

      renderWithI18n(() => <BackupsPanel isVisible={visible} reduced />);
      await waitFor(() => expect(screen.getByTestId('backups-empty')).toBeInTheDocument());

      const reveal = screen.getByTestId('backups-reveal-button');
      expect(reveal).not.toBeDisabled();
      fireEvent.click(reveal);
      await waitFor(() => expect(mockRevealBackupsFolder).toHaveBeenCalled());
    });
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1.0 MB'],
    [15 * 1024 * 1024, '15 MB'],
    [2 * 1024 * 1024 * 1024, '2.0 GB'],
  ])('formats %i as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('describeTrigger', () => {
  it('names each automatic trigger', () => {
    expect(describeTrigger('unlock', defaultT)).toBe('After unlocking');
    expect(describeTrigger('lock', defaultT)).toBe('On locking');
    expect(describeTrigger('migration', defaultT)).toBe('Before a database upgrade');
    expect(describeTrigger('manual', defaultT)).toBe('Manual');
    expect(describeTrigger('pre_restore', defaultT)).toBe('Before a restore');
    expect(describeTrigger('adopted', defaultT)).toBe('Made by an earlier version');
  });

  it('inlines the operation name for a destructive trigger', () => {
    expect(describeTrigger({ destructive: 'reset_diary' }, defaultT)).toBe('Before reset_diary');
  });
});
