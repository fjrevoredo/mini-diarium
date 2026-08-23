import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSignal } from 'solid-js';
import { screen, waitFor, fireEvent, within } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import BackupsPanel, {
  formatBytes,
  describeTrigger,
  describeRequiredCredential,
} from './BackupsPanel';
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
  mockRestoreBackup,
} = vi.hoisted(() => ({
  mockListBackups: vi.fn(),
  mockListBackupsUnauthenticated: vi.fn(),
  mockGetBackupHealth: vi.fn(),
  mockCreateBackupNow: vi.fn(),
  mockVerifyBackup: vi.fn(),
  mockDeleteBackup: vi.fn(),
  mockRevealBackupsFolder: vi.fn(),
  mockRestoreBackup: vi.fn(),
}));

vi.mock('../../lib/tauri', () => ({
  listBackups: mockListBackups,
  listBackupsUnauthenticated: mockListBackupsUnauthenticated,
  getBackupHealth: mockGetBackupHealth,
  createBackupNow: mockCreateBackupNow,
  verifyBackup: mockVerifyBackup,
  deleteBackup: mockDeleteBackup,
  revealBackupsFolder: mockRevealBackupsFolder,
  restoreBackup: mockRestoreBackup,
}));

const { mockJournals, mockActiveJournalId } = vi.hoisted(() => ({
  mockJournals: vi.fn(() => [] as { id: string; auto_protected: boolean }[]),
  mockActiveJournalId: vi.fn(() => 'j1'),
}));

vi.mock('../../state/journals', () => ({
  journals: mockJournals,
  activeJournalId: mockActiveJournalId,
}));

// The restore flow flushes pending edits before the swap and rehydrates entry/tag/search
// state after it (Task 4.2) — mocked here so this file tests only that BackupsPanel calls
// them at the right times, not their own (separately tested) internals.
const { mockExecuteCleanupCallbacks, mockRefreshAfterRestore } = vi.hoisted(() => ({
  mockExecuteCleanupCallbacks: vi.fn(),
  mockRefreshAfterRestore: vi.fn(),
}));

vi.mock('../../state/entries', () => ({
  executeCleanupCallbacks: mockExecuteCleanupCallbacks,
}));

vi.mock('../../state/session', () => ({
  refreshAfterRestore: mockRefreshAfterRestore,
}));

// BackupInspectDialog (Task 4.3) is a heavy component with its own IPC effects, tested on its
// own in BackupInspectDialog.test.tsx. Stubbed here so this file tests only that BackupsPanel
// opens it with the right snapshot and `autoProtected` prop — not its internal behavior.
vi.mock('./BackupInspectDialog', () => ({
  default: (props: {
    isOpen: boolean;
    snapshot: SnapshotMeta;
    autoProtected?: boolean;
    onClose: () => void;
  }) => (
    <div data-testid="mock-inspect-dialog">
      <span data-testid="mock-inspect-file">{props.snapshot.file_name}</span>
      <span data-testid="mock-inspect-auto">{String(props.autoProtected)}</span>
      <button type="button" onClick={() => props.onClose()}>
        mock-close
      </button>
    </div>
  ),
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

// A deferred promise lets a test hold an in-flight call and observe the panel's state before
// deciding whether to let it resolve (or reject).
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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
    mockExecuteCleanupCallbacks.mockResolvedValue(undefined);
    mockRefreshAfterRestore.mockResolvedValue(undefined);
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
    expect(screen.queryByTestId('backups-health-ok')).not.toBeInTheDocument();
    expect(screen.getByTestId('backups-health-pending')).toBeInTheDocument();
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

  describe('restoring a snapshot (Task 4.2)', () => {
    it('confirms before restoring, naming the snapshot, and does nothing if cancelled', async () => {
      mockListBackups.mockResolvedValue([snapshot()]);
      mockGetBackupHealth.mockResolvedValue(health());
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getByTestId('backups-restore-button')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('backups-restore-button'));

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Restore the journal'));
      expect(mockRestoreBackup).not.toHaveBeenCalled();
      expect(mockExecuteCleanupCallbacks).not.toHaveBeenCalled();
      expect(mockRefreshAfterRestore).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('restores the confirmed snapshot and shows a success message naming the safety snapshot', async () => {
      mockListBackups.mockResolvedValueOnce([snapshot()]);
      mockGetBackupHealth.mockResolvedValue(health());
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockRestoreBackup.mockResolvedValue({
        restored: true,
        safety_snapshot: 'backup-2026-08-11-14h30m00.db',
        safety_snapshot_created_at: '2026-08-11T14:30:00Z',
      });

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getByTestId('backups-restore-button')).toBeInTheDocument());

      // The reload after a successful restore lists the safety snapshot the backend just took.
      mockListBackups.mockResolvedValue([
        snapshot({
          file_name: 'backup-2026-08-11-14h30m00.db',
          created_at: '2026-08-11T14:30:00Z',
        }),
        snapshot(),
      ]);

      fireEvent.click(screen.getByTestId('backups-restore-button'));

      await waitFor(() => expect(mockRestoreBackup).toHaveBeenCalledWith(snapshot().file_name));
      await waitFor(() =>
        expect(screen.getByTestId('backups-restore-success')).toHaveTextContent(
          /restored to the backup from/i,
        ),
      );
      expect(screen.getByTestId('backups-restore-success')).toHaveTextContent(
        /saved as a new backup/i,
      );

      // Pending edits are flushed into the live journal *before* the swap (so they land in
      // the safety snapshot), and stale in-memory entry/editor state is discarded and
      // refetched *after* a successful restore — never the other way around.
      expect(mockExecuteCleanupCallbacks).toHaveBeenCalledTimes(1);
      expect(mockRefreshAfterRestore).toHaveBeenCalledTimes(1);
      const cleanupOrder = mockExecuteCleanupCallbacks.mock.invocationCallOrder[0];
      const restoreOrder = mockRestoreBackup.mock.invocationCallOrder[0];
      const refreshOrder = mockRefreshAfterRestore.mock.invocationCallOrder[0];
      expect(cleanupOrder).toBeLessThan(restoreOrder);
      expect(restoreOrder).toBeLessThan(refreshOrder);

      vi.restoreAllMocks();
    });

    it('still reports success when post-restore rehydration fails, never the alert slot', async () => {
      // The restore itself is committed and irreversible by the time rehydration runs. A
      // failure here (state refetch, list reload) must not be reported through the same
      // role="alert" slot as a failed restore — that would tell the user a successful,
      // irreversible restore had failed, and invite them to "undo" something that already
      // happened by restoring the safety snapshot on top of it.
      mockListBackups.mockResolvedValueOnce([snapshot()]);
      mockGetBackupHealth.mockResolvedValue(health());
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockRestoreBackup.mockResolvedValue({
        restored: true,
        safety_snapshot: 'backup-2026-08-11-14h30m00.db',
        safety_snapshot_created_at: '2026-08-11T14:30:00Z',
      });
      mockRefreshAfterRestore.mockRejectedValue(new Error('stale in-memory state'));

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getByTestId('backups-restore-button')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('backups-restore-button'));

      await waitFor(() =>
        expect(screen.getByTestId('backups-restore-success')).toHaveTextContent(
          /restored to the backup from/i,
        ),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      vi.restoreAllMocks();
    });

    it('names the safety snapshot in the success message even when the post-restore list refresh fails (Task A4)', async () => {
      // The success message is built directly from restoreBackup's own result
      // (safety_snapshot_created_at), not by searching the just-reloaded snapshots() list —
      // so it must still name the safety snapshot's timestamp even when load() (the
      // subsequent listBackups/getBackupHealth call) fails outright.
      mockListBackups.mockResolvedValueOnce([snapshot()]);
      mockGetBackupHealth.mockResolvedValue(health());
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockRestoreBackup.mockResolvedValue({
        restored: true,
        safety_snapshot: 'backup-2026-08-11-14h30m00.db',
        safety_snapshot_created_at: '2026-08-11T14:30:00Z',
      });

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getByTestId('backups-restore-button')).toBeInTheDocument());

      // The post-restore reload (load()) fails outright — it catches and reports its own
      // error, but must not degrade the restore's own success message.
      mockListBackups.mockRejectedValue(new Error('directory temporarily unreachable'));
      mockGetBackupHealth.mockRejectedValue(new Error('directory temporarily unreachable'));

      fireEvent.click(screen.getByTestId('backups-restore-button'));

      await waitFor(() =>
        expect(screen.getByTestId('backups-restore-success')).toHaveTextContent(
          /restored to the backup from/i,
        ),
      );
      expect(screen.getByTestId('backups-restore-success')).toHaveTextContent(
        /saved as a new backup/i,
      );

      vi.restoreAllMocks();
    });

    it('shows a sanitized error, and no success message, when the restore fails', async () => {
      mockListBackups.mockResolvedValue([snapshot()]);
      mockGetBackupHealth.mockResolvedValue(health());
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockRestoreBackup.mockRejectedValue('This backup could not be restored: wrong key.');

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getByTestId('backups-restore-button')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('backups-restore-button'));

      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(/could not be restored/i),
      );
      expect(screen.queryByTestId('backups-restore-success')).not.toBeInTheDocument();
      // Nothing to rehydrate: the backend never touched a connection the app is holding
      // state for, whether it aborted outright or rolled back to the safety snapshot.
      expect(mockRefreshAfterRestore).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('panel-wide mutation lock (Task A3)', () => {
    function twoRows() {
      return [
        snapshot({ file_name: 'backup-row-a.db', created_at: '2026-08-06T09:30:00Z' }),
        snapshot({ file_name: 'backup-row-b.db', created_at: '2026-08-07T09:30:00Z' }),
      ];
    }

    it('blocks delete on a different row while a restore is in flight', async () => {
      const [rowA, rowB] = twoRows();
      mockListBackups.mockResolvedValue([rowA, rowB]);
      mockGetBackupHealth.mockResolvedValue(health());
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const restorePromise = deferred<{ restored: boolean; safety_snapshot: string | null }>();
      mockRestoreBackup.mockReturnValue(restorePromise.promise);

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2));
      const rows = screen.getAllByTestId('backups-list-item');

      fireEvent.click(within(rows[0]).getByTestId('backups-restore-button'));
      await waitFor(() => expect(mockRestoreBackup).toHaveBeenCalledWith(rowA.file_name));

      const deleteOnOtherRow = within(rows[1]).getByRole('button', { name: 'Delete' });
      expect(deleteOnOtherRow).toBeDisabled();
      fireEvent.click(deleteOnOtherRow);
      expect(mockDeleteBackup).not.toHaveBeenCalled();

      restorePromise.resolve({ restored: true, safety_snapshot: null });
      await waitFor(() =>
        expect(screen.getByTestId('backups-restore-success')).toBeInTheDocument(),
      );
      vi.restoreAllMocks();
    });

    it('blocks "back up now" while a restore is in flight', async () => {
      const [rowA] = twoRows();
      mockListBackups.mockResolvedValue([rowA]);
      mockGetBackupHealth.mockResolvedValue(health());
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const restorePromise = deferred<{ restored: boolean; safety_snapshot: string | null }>();
      mockRestoreBackup.mockReturnValue(restorePromise.promise);

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('backups-restore-button'));
      await waitFor(() => expect(mockRestoreBackup).toHaveBeenCalled());

      const createButton = screen.getByTestId('backups-create-button');
      expect(createButton).toBeDisabled();
      fireEvent.click(createButton);
      expect(mockCreateBackupNow).not.toHaveBeenCalled();

      restorePromise.resolve({ restored: true, safety_snapshot: null });
      await waitFor(() =>
        expect(screen.getByTestId('backups-restore-success')).toBeInTheDocument(),
      );
      vi.restoreAllMocks();
    });

    it('blocks verify on a different row while a restore is in flight', async () => {
      const [rowA, rowB] = twoRows();
      mockListBackups.mockResolvedValue([rowA, rowB]);
      mockGetBackupHealth.mockResolvedValue(health());
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const restorePromise = deferred<{ restored: boolean; safety_snapshot: string | null }>();
      mockRestoreBackup.mockReturnValue(restorePromise.promise);

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2));
      const rows = screen.getAllByTestId('backups-list-item');

      fireEvent.click(within(rows[0]).getByTestId('backups-restore-button'));
      await waitFor(() => expect(mockRestoreBackup).toHaveBeenCalledWith(rowA.file_name));

      const verifyOnOtherRow = within(rows[1]).getByRole('button', { name: /Check|Verify/ });
      expect(verifyOnOtherRow).toBeDisabled();
      fireEvent.click(verifyOnOtherRow);
      expect(mockVerifyBackup).not.toHaveBeenCalled();

      restorePromise.resolve({ restored: true, safety_snapshot: null });
      await waitFor(() =>
        expect(screen.getByTestId('backups-restore-success')).toBeInTheDocument(),
      );
      vi.restoreAllMocks();
    });

    it('blocks the inspect-open button while a mutation is in flight', async () => {
      const [rowA] = twoRows();
      mockListBackups.mockResolvedValue([rowA]);
      mockGetBackupHealth.mockResolvedValue(health());
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const restorePromise = deferred<{ restored: boolean; safety_snapshot: string | null }>();
      mockRestoreBackup.mockReturnValue(restorePromise.promise);

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('backups-restore-button'));
      await waitFor(() => expect(mockRestoreBackup).toHaveBeenCalled());

      const inspectButton = screen.getByTestId('backups-restore-entries-button');
      expect(inspectButton).toBeDisabled();
      fireEvent.click(inspectButton);
      expect(screen.queryByTestId('mock-inspect-dialog')).not.toBeInTheDocument();

      restorePromise.resolve({ restored: true, safety_snapshot: null });
      await waitFor(() =>
        expect(screen.getByTestId('backups-restore-success')).toBeInTheDocument(),
      );
      vi.restoreAllMocks();
    });

    it('leaves "reveal folder" enabled during a mutation — a read-only action', async () => {
      const [rowA] = twoRows();
      mockListBackups.mockResolvedValue([rowA]);
      mockGetBackupHealth.mockResolvedValue(health());
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const restorePromise = deferred<{ restored: boolean; safety_snapshot: string | null }>();
      mockRestoreBackup.mockReturnValue(restorePromise.promise);

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('backups-restore-button'));
      await waitFor(() => expect(mockRestoreBackup).toHaveBeenCalled());

      expect(screen.getByTestId('backups-reveal-button')).not.toBeDisabled();

      restorePromise.resolve({ restored: true, safety_snapshot: null });
      await waitFor(() =>
        expect(screen.getByTestId('backups-restore-success')).toBeInTheDocument(),
      );
      vi.restoreAllMocks();
    });

    it('re-enables actions once delete completes, even though handleDelete had no busy state before this task', async () => {
      const [rowA, rowB] = twoRows();
      mockListBackups.mockResolvedValue([rowA, rowB]);
      mockGetBackupHealth.mockResolvedValue(health());
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const deletePromise = deferred<void>();
      mockDeleteBackup.mockReturnValue(deletePromise.promise);

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2));
      const rows = screen.getAllByTestId('backups-list-item');

      fireEvent.click(within(rows[0]).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(mockDeleteBackup).toHaveBeenCalledWith(rowA.file_name));

      const createButton = screen.getByTestId('backups-create-button');
      expect(createButton).toBeDisabled();

      mockListBackups.mockResolvedValue([rowB]);
      deletePromise.resolve();
      await waitFor(() => expect(createButton).not.toBeDisabled());
      vi.restoreAllMocks();
    });
  });

  describe('latest-wins loading (Task D1)', () => {
    it('keeps the fresher load result even when a stale load resolves later with different data', async () => {
      const staleListD = deferred<SnapshotMeta[]>();
      const staleHealthD = deferred<BackupHealth>();
      const freshListD = deferred<SnapshotMeta[]>();
      const freshHealthD = deferred<BackupHealth>();

      mockListBackups
        .mockReturnValueOnce(staleListD.promise)
        .mockReturnValueOnce(freshListD.promise);
      mockGetBackupHealth
        .mockReturnValueOnce(staleHealthD.promise)
        .mockReturnValueOnce(freshHealthD.promise);
      mockCreateBackupNow.mockResolvedValue(undefined);

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      // The visibility effect's load() (generation 1, "stale") is now in flight.
      await waitFor(() => expect(mockListBackups).toHaveBeenCalledTimes(1));

      // handleBackUpNow's own load() (generation 2, "fresh") starts once createBackupNow
      // resolves — unguarded by isLoading(), only by actionsDisabled()/panelBusy().
      fireEvent.click(screen.getByTestId('backups-create-button'));
      await waitFor(() => expect(mockListBackups).toHaveBeenCalledTimes(2));

      const freshSnapshots = [
        snapshot({ file_name: 'fresh-a.db' }),
        snapshot({ file_name: 'fresh-b.db' }),
      ];
      freshListD.resolve(freshSnapshots);
      freshHealthD.resolve(health({ snapshot_count: 2 }));
      await freshListD.promise;
      await freshHealthD.promise;
      await waitFor(() => expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2));
      expect(screen.queryByText(/Loading backups/)).not.toBeInTheDocument();

      // The stale (generation 1) response now resolves with different data. Without the
      // per-branch guard this would overwrite the fresh render with a single stale row.
      const staleSnapshots = [snapshot({ file_name: 'stale.db' })];
      staleListD.resolve(staleSnapshots);
      staleHealthD.resolve(health({ snapshot_count: 1 }));
      await staleListD.promise;
      await staleHealthD.promise;
      // Resolving a promise does not synchronously run its `.then()` — without this settle
      // tick, asserting an absence below would pass vacuously even with the guard removed.
      await Promise.resolve();

      expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2);
    });

    it('does not clear isLoading when a stale load resolves while a fresher one is still in flight', async () => {
      const staleListD = deferred<SnapshotMeta[]>();
      const staleHealthD = deferred<BackupHealth>();
      const freshListD = deferred<SnapshotMeta[]>();
      const freshHealthD = deferred<BackupHealth>();

      mockListBackups
        .mockReturnValueOnce(staleListD.promise)
        .mockReturnValueOnce(freshListD.promise);
      mockGetBackupHealth
        .mockReturnValueOnce(staleHealthD.promise)
        .mockReturnValueOnce(freshHealthD.promise);
      mockCreateBackupNow.mockResolvedValue(undefined);

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(mockListBackups).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByTestId('backups-create-button'));
      await waitFor(() => expect(mockListBackups).toHaveBeenCalledTimes(2));

      // The stale (generation 1) call resolves first, while generation 2 is still pending.
      // Without an independent `finally` guard, generation 1's setIsLoading(false) would
      // prematurely clear the loading state even though generation 2 is still in flight.
      staleListD.resolve([snapshot({ file_name: 'stale.db' })]);
      staleHealthD.resolve(health({ snapshot_count: 1 }));
      await staleListD.promise;
      await staleHealthD.promise;
      await Promise.resolve();

      expect(screen.getByText('Loading backups…')).toBeInTheDocument();
      expect(screen.queryByTestId('backups-list-item')).not.toBeInTheDocument();

      const freshSnapshots = [
        snapshot({ file_name: 'fresh-a.db' }),
        snapshot({ file_name: 'fresh-b.db' }),
      ];
      freshListD.resolve(freshSnapshots);
      freshHealthD.resolve(health({ snapshot_count: 2 }));

      await waitFor(() => expect(screen.queryByText('Loading backups…')).not.toBeInTheDocument());
      expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2);
    });

    it('does not surface a stale rejection once a fresher load has already succeeded', async () => {
      const staleListD = deferred<SnapshotMeta[]>();
      const staleHealthD = deferred<BackupHealth>();
      const freshListD = deferred<SnapshotMeta[]>();
      const freshHealthD = deferred<BackupHealth>();

      mockListBackups
        .mockReturnValueOnce(staleListD.promise)
        .mockReturnValueOnce(freshListD.promise);
      mockGetBackupHealth
        .mockReturnValueOnce(staleHealthD.promise)
        .mockReturnValueOnce(freshHealthD.promise);
      mockCreateBackupNow.mockResolvedValue(undefined);

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() => expect(mockListBackups).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByTestId('backups-create-button'));
      await waitFor(() => expect(mockListBackups).toHaveBeenCalledTimes(2));

      // The fresher (generation 2) call succeeds first.
      const freshSnapshots = [
        snapshot({ file_name: 'fresh-a.db' }),
        snapshot({ file_name: 'fresh-b.db' }),
      ];
      freshListD.resolve(freshSnapshots);
      freshHealthD.resolve(health({ snapshot_count: 2 }));
      await waitFor(() => expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2));

      // The stale (generation 1) call now rejects. Without the `catch` block's own guard, this
      // would paint an error banner over the already-correct, more recent render.
      staleListD.reject(new Error('stale request aborted'));
      staleHealthD.resolve(health({ snapshot_count: 1 }));
      await staleListD.promise.catch(() => undefined);
      await Promise.resolve();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2);
    });

    it('applies latest-wins in reduced (pre-auth) mode too, via the unauthenticated branch', async () => {
      // Reduced mode disables every mutation button, so the only way to trigger a second
      // load() here is a second visibility transition — not a button click as in the tests
      // above. This exercises the `props.reduced` branch's own guard, not the non-reduced one.
      const staleD = deferred<{ snapshots: SnapshotMeta[]; health: BackupHealth }>();
      const freshD = deferred<{ snapshots: SnapshotMeta[]; health: BackupHealth }>();
      mockListBackupsUnauthenticated
        .mockReturnValueOnce(staleD.promise)
        .mockReturnValueOnce(freshD.promise);

      const [isVisible, setIsVisible] = createSignal(true);
      renderWithI18n(() => <BackupsPanel isVisible={isVisible} reduced />);
      await waitFor(() => expect(mockListBackupsUnauthenticated).toHaveBeenCalledTimes(1));

      // A visibility drop-then-return re-fires the effect's `if (props.isVisible()) void load()`
      // guard, starting a second (fresher) load without ever going through a mutation handler.
      setIsVisible(false);
      setIsVisible(true);
      await waitFor(() => expect(mockListBackupsUnauthenticated).toHaveBeenCalledTimes(2));

      const freshSnapshots = [
        snapshot({ file_name: 'fresh-a.db' }),
        snapshot({ file_name: 'fresh-b.db' }),
      ];
      freshD.resolve({ snapshots: freshSnapshots, health: health({ snapshot_count: 2 }) });
      await waitFor(() => expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2));

      // The stale (generation 1) response now resolves with different data.
      staleD.resolve({
        snapshots: [snapshot({ file_name: 'stale.db' })],
        health: health({ snapshot_count: 1 }),
      });
      await staleD.promise;
      await Promise.resolve();

      expect(screen.getAllByTestId('backups-list-item')).toHaveLength(2);
    });
  });

  describe('per-entry restore entry point (Task 4.3)', () => {
    it('opens BackupInspectDialog for the clicked snapshot, passing autoProtected through', async () => {
      mockJournals.mockReturnValue([{ id: 'j1', auto_protected: true }]);
      mockListBackups.mockResolvedValue([snapshot()]);
      mockGetBackupHealth.mockResolvedValue(health());

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() =>
        expect(screen.getByTestId('backups-restore-entries-button')).toBeInTheDocument(),
      );
      expect(screen.queryByTestId('mock-inspect-dialog')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('backups-restore-entries-button'));

      expect(screen.getByTestId('mock-inspect-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('mock-inspect-file')).toHaveTextContent(snapshot().file_name);
      // isAutoProtected() reads the active journal's own flag, not a hardcoded default —
      // this is the one prop wiring nothing else in this file exercises.
      expect(screen.getByTestId('mock-inspect-auto')).toHaveTextContent('true');
    });

    it('closes the dialog when it reports back via onClose', async () => {
      mockListBackups.mockResolvedValue([snapshot()]);
      mockGetBackupHealth.mockResolvedValue(health());

      renderWithI18n(() => <BackupsPanel isVisible={visible} />);
      await waitFor(() =>
        expect(screen.getByTestId('backups-restore-entries-button')).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('backups-restore-entries-button'));
      expect(screen.getByTestId('mock-inspect-dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByText('mock-close'));

      expect(screen.queryByTestId('mock-inspect-dialog')).not.toBeInTheDocument();
    });

    it('hides the entry point in reduced (pre-auth) mode — inspection needs an unlocked journal', async () => {
      mockListBackupsUnauthenticated.mockResolvedValue({
        snapshots: [snapshot()],
        health: health(),
      });

      renderWithI18n(() => <BackupsPanel isVisible={visible} reduced />);

      await waitFor(() => expect(screen.getByTestId('backups-list-item')).toBeInTheDocument());
      expect(screen.queryByTestId('backups-restore-entries-button')).not.toBeInTheDocument();
    });
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
      expect(screen.getByTestId('backups-restore-button')).toBeDisabled();
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
      // Task 5.2's required-credential hint follows the same contract: it is one step closer
      // to auth-history disclosure than plain metadata, so it is withheld here too.
      expect(screen.queryByTestId('backups-required-credential')).not.toBeInTheDocument();
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

describe('describeRequiredCredential', () => {
  it('returns null when the only slot type is auto — already covered by the local-only notice', () => {
    expect(describeRequiredCredential(['auto'], defaultT)).toBeNull();
  });

  it('returns null for an empty slot-type list (pre-auth-slot v1/v2 snapshots)', () => {
    expect(describeRequiredCredential([], defaultT)).toBeNull();
  });

  it('names a single required credential type', () => {
    expect(describeRequiredCredential(['password'], defaultT)).toBe('Requires: Password');
    expect(describeRequiredCredential(['keypair'], defaultT)).toBe('Requires: Key File');
  });

  it('joins multiple required credential types with "or"', () => {
    expect(describeRequiredCredential(['password', 'keypair'], defaultT)).toBe(
      'Requires: Password or Key File',
    );
  });

  it('drops auto from a mixed list and de-dupes repeated types', () => {
    expect(describeRequiredCredential(['auto', 'keypair', 'keypair'], defaultT)).toBe(
      'Requires: Key File',
    );
  });
});
