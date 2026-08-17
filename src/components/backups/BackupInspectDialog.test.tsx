import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import BackupInspectDialog from './BackupInspectDialog';
import type { BackupEntryDiff, SnapshotMeta } from '../../lib/tauri';

const {
  mockCheckBackupCredentials,
  mockOpenBackupReadonly,
  mockListBackupEntriesWithStatus,
  mockRestoreEntriesFromBackup,
  mockCloseBackup,
  mockGetAllEntryDates,
} = vi.hoisted(() => ({
  mockCheckBackupCredentials: vi.fn(),
  mockOpenBackupReadonly: vi.fn(),
  mockListBackupEntriesWithStatus: vi.fn(),
  mockRestoreEntriesFromBackup: vi.fn(),
  mockCloseBackup: vi.fn(),
  mockGetAllEntryDates: vi.fn(),
}));

vi.mock('../../lib/tauri', () => ({
  checkBackupCredentials: mockCheckBackupCredentials,
  openBackupReadonly: mockOpenBackupReadonly,
  listBackupEntriesWithStatus: mockListBackupEntriesWithStatus,
  restoreEntriesFromBackup: mockRestoreEntriesFromBackup,
  closeBackup: mockCloseBackup,
  getAllEntryDates: mockGetAllEntryDates,
}));

const { mockSetEntryDates, mockRefreshLockedDates, mockExecuteReloadCallbacks } = vi.hoisted(
  () => ({
    mockSetEntryDates: vi.fn(),
    mockRefreshLockedDates: vi.fn(),
    mockExecuteReloadCallbacks: vi.fn(),
  }),
);

vi.mock('../../state/entries', () => ({
  setEntryDates: mockSetEntryDates,
  refreshLockedDates: mockRefreshLockedDates,
  executeReloadCallbacks: mockExecuteReloadCallbacks,
}));

const { mockLoadAllTags } = vi.hoisted(() => ({ mockLoadAllTags: vi.fn() }));
vi.mock('../../state/tags', () => ({ loadAllTags: mockLoadAllTags }));

const { mockSelectedDate } = vi.hoisted(() => ({ mockSelectedDate: vi.fn(() => '2024-01-15') }));
vi.mock('../../state/ui', () => ({ selectedDate: mockSelectedDate }));

const snapshot: SnapshotMeta = {
  file_name: 'backup-2026-08-06-09h30m00.db',
  created_at: '2026-08-06T09:30:00Z',
  trigger: 'manual',
  byte_size: 4096,
  sqlite_change_counter: 21,
  db_schema_version: 13,
  app_version: '0.6.6',
  entry_count: 2,
  entry_date_range: ['2024-01-15', '2024-03-20'],
  auth_slot_types: ['password'],
  verified: true,
};

const diffs: BackupEntryDiff[] = [
  { id: 1, date: '2024-01-15', title: 'Gone', preview: 'was here', status: 'missing' },
  { id: 2, date: '2024-01-20', title: 'Trimmed', preview: 'less now', status: 'shorter_in_live' },
  { id: 3, date: '2024-02-01', title: 'Safe', preview: 'still there', status: 'present' },
];

describe('BackupInspectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedDate.mockReturnValue('2024-01-15');
    mockCheckBackupCredentials.mockResolvedValue({
      snapshot_slot_types: ['password'],
      live_slot_types: ['password'],
      differs_from_live: false,
      compared: true,
    });
    mockOpenBackupReadonly.mockResolvedValue({
      file_name: snapshot.file_name,
      credential_differs: false,
    });
    mockListBackupEntriesWithStatus.mockResolvedValue(diffs);
    mockGetAllEntryDates.mockResolvedValue(['2024-01-15', '2024-01-20', '2024-02-01']);
  });

  it('opens the snapshot with the typed password and lists entries with status', async () => {
    renderWithI18n(() => (
      <BackupInspectDialog isOpen={true} snapshot={snapshot} onClose={vi.fn()} />
    ));

    fireEvent.input(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'old-password' },
    });
    fireEvent.click(screen.getByText('View entries'));

    await waitFor(() => {
      expect(mockOpenBackupReadonly).toHaveBeenCalledWith(snapshot.file_name, {
        password: 'old-password',
      });
    });

    await waitFor(() => expect(screen.getByText('Gone')).toBeInTheDocument());
    expect(screen.getByText('Trimmed')).toBeInTheDocument();
    expect(screen.getByText('Safe')).toBeInTheDocument();
    expect(screen.getByText('Missing from your journal')).toBeInTheDocument();
    expect(screen.getByText('Shorter in your journal')).toBeInTheDocument();
    expect(screen.getByText('Already in your journal')).toBeInTheDocument();
  });

  it('shows the credential-differs notice when the snapshot needs a different credential', async () => {
    mockCheckBackupCredentials.mockResolvedValue({
      snapshot_slot_types: ['password'],
      live_slot_types: ['password'],
      differs_from_live: true,
      compared: true,
    });

    renderWithI18n(() => (
      <BackupInspectDialog isOpen={true} snapshot={snapshot} onClose={vi.fn()} />
    ));

    await waitFor(() =>
      expect(screen.getByTestId('backup-inspect-credential-differs')).toBeInTheDocument(),
    );
  });

  it('selectAllMissing selects only missing and shorter entries, not already-present ones', async () => {
    renderWithI18n(() => (
      <BackupInspectDialog isOpen={true} snapshot={snapshot} onClose={vi.fn()} />
    ));

    fireEvent.input(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByText('View entries'));
    await waitFor(() => expect(screen.getByText('Gone')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('backup-inspect-select-all'));

    await waitFor(() => expect(screen.getByText('2 entries selected')).toBeInTheDocument());
  });

  it('restores the selected entries and reports how many were added, without overwriting', async () => {
    mockRestoreEntriesFromBackup.mockResolvedValue({ added_count: 2 });

    renderWithI18n(() => (
      <BackupInspectDialog isOpen={true} snapshot={snapshot} onClose={vi.fn()} />
    ));

    fireEvent.input(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByText('View entries'));
    await waitFor(() => expect(screen.getByText('Gone')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('backup-inspect-select-all'));
    await waitFor(() => expect(screen.getByText('2 entries selected')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('backup-inspect-restore-button'));

    await waitFor(() => {
      expect(mockRestoreEntriesFromBackup).toHaveBeenCalledWith([1, 2]);
    });
    await waitFor(() => {
      expect(screen.getByTestId('backup-inspect-success')).toHaveTextContent(
        '2 entries added. Nothing already in your journal was overwritten.',
      );
    });
    // Re-lists so status badges reflect the just-restored entries.
    expect(mockListBackupEntriesWithStatus).toHaveBeenCalledTimes(2);
    expect(mockSetEntryDates).toHaveBeenCalled();
    // One of the restored entries (id 1, "Gone") landed on 2024-01-15 — the date the mocked
    // editor is currently viewing — so its stale day-entry list needs a nudge to refetch.
    expect(mockExecuteReloadCallbacks).toHaveBeenCalled();
  });

  it('does not discard the open editor when the restore lands on a different date', async () => {
    mockSelectedDate.mockReturnValue('2099-12-31');
    mockRestoreEntriesFromBackup.mockResolvedValue({ added_count: 1 });

    renderWithI18n(() => (
      <BackupInspectDialog isOpen={true} snapshot={snapshot} onClose={vi.fn()} />
    ));

    fireEvent.input(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByText('View entries'));
    await waitFor(() => expect(screen.getByText('Gone')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Gone'));
    fireEvent.click(screen.getByTestId('backup-inspect-restore-button'));

    await waitFor(() => expect(mockRestoreEntriesFromBackup).toHaveBeenCalledWith([1]));
    await waitFor(() => expect(screen.getByTestId('backup-inspect-success')).toBeInTheDocument());
    // Restoring onto 2024-01-15 while the editor is open on 2099-12-31 must not touch the
    // editor at all — reloading would cancel any in-flight save on a completely unrelated
    // entry for no reason.
    expect(mockExecuteReloadCallbacks).not.toHaveBeenCalled();
  });

  it('closes the inspection connection on close', async () => {
    const onClose = vi.fn();
    renderWithI18n(() => (
      <BackupInspectDialog isOpen={true} snapshot={snapshot} onClose={onClose} />
    ));

    fireEvent.input(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByText('View entries'));
    await waitFor(() => expect(screen.getByText('Gone')).toBeInTheDocument());

    // Kobalte's `Dialog.CloseButton` sets its own default `aria-label` ("Dismiss"), which
    // wins over the visually-hidden "Close" span for the accessible name.
    fireEvent.click(screen.getByLabelText('Dismiss'));

    await waitFor(() => expect(mockCloseBackup).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('surfaces a wrong-credential error rather than silently listing nothing', async () => {
    mockOpenBackupReadonly.mockRejectedValue('That password does not open this backup.');

    renderWithI18n(() => (
      <BackupInspectDialog isOpen={true} snapshot={snapshot} onClose={vi.fn()} />
    ));

    fireEvent.input(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByText('View entries'));

    await waitFor(() =>
      expect(screen.getByText('That password does not open this backup.')).toBeInTheDocument(),
    );
    expect(mockListBackupEntriesWithStatus).not.toHaveBeenCalled();
  });

  describe('entry count display (Task D2)', () => {
    it('shows the pluralized entry count for a populated snapshot', async () => {
      renderWithI18n(() => (
        <BackupInspectDialog
          isOpen={true}
          snapshot={{ ...snapshot, entry_count: 5 }}
          onClose={vi.fn()}
        />
      ));

      fireEvent.input(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'pw' },
      });
      fireEvent.click(screen.getByText('View entries'));

      await waitFor(() =>
        expect(screen.getByTestId('backup-inspect-entry-count')).toHaveTextContent('5 entries'),
      );
    });

    it('takes the plural branch for a zero entry count', async () => {
      renderWithI18n(() => (
        <BackupInspectDialog
          isOpen={true}
          snapshot={{ ...snapshot, entry_count: 0 }}
          onClose={vi.fn()}
        />
      ));

      fireEvent.input(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'pw' },
      });
      fireEvent.click(screen.getByText('View entries'));

      await waitFor(() =>
        expect(screen.getByTestId('backup-inspect-entry-count')).toHaveTextContent('0 entries'),
      );
    });

    it('shows the unknown-state fallback when entry_count is null', async () => {
      renderWithI18n(() => (
        <BackupInspectDialog
          isOpen={true}
          snapshot={{ ...snapshot, entry_count: null }}
          onClose={vi.fn()}
        />
      ));

      fireEvent.input(screen.getByPlaceholderText('Enter your password'), {
        target: { value: 'pw' },
      });
      fireEvent.click(screen.getByText('View entries'));

      await waitFor(() =>
        expect(screen.getByTestId('backup-inspect-entry-count')).toHaveTextContent('—'),
      );
    });
  });

  it('opens a local-only journal with no credential form at all', async () => {
    renderWithI18n(() => (
      <BackupInspectDialog
        isOpen={true}
        snapshot={snapshot}
        autoProtected={true}
        onClose={vi.fn()}
      />
    ));

    // No password input and no mode toggle — there is nothing to type for a device-bound key.
    expect(screen.queryByPlaceholderText('Enter your password')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('backup-inspect-open-button'));

    await waitFor(() => {
      // The only way to reach `SnapshotCredential::AutoKey` on the backend: neither argument.
      expect(mockOpenBackupReadonly).toHaveBeenCalledWith(snapshot.file_name, undefined);
    });
    await waitFor(() => expect(screen.getByText('Gone')).toBeInTheDocument());
  });
});
