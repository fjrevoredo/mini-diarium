import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { open as dialogOpen, confirm as dialogConfirm } from '@tauri-apps/plugin-dialog';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import type { SnapshotMeta } from '../../../lib/tauri';
import PreferencesDataTab from './PreferencesDataTab';

const { mockGetJournalPath, mockListBackups, mockChangeJournalDirectory, mockResetJournal } =
  vi.hoisted(() => ({
    mockGetJournalPath: vi.fn(() => Promise.resolve('/journals/mine')),
    mockListBackups: vi.fn(() => Promise.resolve([] as SnapshotMeta[])),
    mockChangeJournalDirectory: vi.fn(() => Promise.resolve()),
    mockResetJournal: vi.fn(() => Promise.resolve()),
  }));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    getJournalPath: mockGetJournalPath,
    listBackups: mockListBackups,
    changeJournalDirectory: mockChangeJournalDirectory,
    resetJournal: mockResetJournal,
  };
});

function makeSnapshot(overrides: Partial<SnapshotMeta> = {}): SnapshotMeta {
  return {
    file_name: 'backup-2024-01-01-00h00m00.db',
    created_at: '2024-01-01T00:00:00Z',
    trigger: 'manual',
    byte_size: 1024,
    sqlite_change_counter: 1,
    db_schema_version: 13,
    app_version: '0.7.0',
    entry_count: 1,
    entry_date_range: ['2024-01-01', '2024-01-01'],
    auth_slot_types: ['password'],
    verified: true,
    ...overrides,
  };
}

function renderTab() {
  const [isOpen] = createSignal(true);
  return renderWithI18n(() => <PreferencesDataTab isOpen={isOpen} onClose={() => {}} />);
}

// jsdom's `window.location.reload` is non-configurable, so neither `vi.spyOn` nor
// `Object.defineProperty` on `location` itself can replace it — the whole `location`
// object has to be swapped out instead.
function stubLocationReload() {
  const reload = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
  return reload;
}

describe('PreferencesDataTab', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('shows the current journal path once loaded', async () => {
    renderTab();
    await vi.waitFor(() => {
      expect(screen.getByText('/journals/mine')).toBeInTheDocument();
    });
  });

  it('does nothing when the directory picker is cancelled', async () => {
    vi.mocked(dialogOpen).mockResolvedValue(null);
    renderTab();
    await vi.waitFor(() => expect(mockGetJournalPath).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Change Location'));
    await vi.waitFor(() => expect(dialogOpen).toHaveBeenCalled());

    expect(mockListBackups).not.toHaveBeenCalled();
    expect(mockChangeJournalDirectory).not.toHaveBeenCalled();
  });

  it('moves the journal with moveBackups=false and shows no dialog when there are no snapshots', async () => {
    vi.mocked(dialogOpen).mockResolvedValue('/new/dir');
    mockListBackups.mockResolvedValue([]);
    stubLocationReload();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderTab();
    await vi.waitFor(() => expect(mockGetJournalPath).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Change Location'));

    await vi.waitFor(() => {
      expect(mockChangeJournalDirectory).toHaveBeenCalledWith('/new/dir', false);
    });
    expect(dialogConfirm).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('asks to move backups when snapshots exist, and moves them on confirm', async () => {
    vi.mocked(dialogOpen).mockResolvedValue('/new/dir');
    mockListBackups.mockResolvedValue([makeSnapshot()]);
    vi.mocked(dialogConfirm).mockResolvedValue(true);
    stubLocationReload();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderTab();
    await vi.waitFor(() => expect(mockGetJournalPath).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Change Location'));

    await vi.waitFor(() => {
      expect(mockChangeJournalDirectory).toHaveBeenCalledWith('/new/dir', true);
    });
    expect(dialogConfirm).toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('leaves backups behind and warns the user when they decline the move', async () => {
    vi.mocked(dialogOpen).mockResolvedValue('/new/dir');
    mockListBackups.mockResolvedValue([makeSnapshot()]);
    vi.mocked(dialogConfirm).mockResolvedValue(false);
    stubLocationReload();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderTab();
    await vi.waitFor(() => expect(mockGetJournalPath).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Change Location'));

    await vi.waitFor(() => {
      expect(mockChangeJournalDirectory).toHaveBeenCalledWith('/new/dir', false);
    });
    await vi.waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('/journals/mine'));
    });
  });

  it('shows an error and does not reload when the move fails', async () => {
    vi.mocked(dialogOpen).mockResolvedValue('/new/dir');
    mockListBackups.mockResolvedValue([]);
    mockChangeJournalDirectory.mockRejectedValueOnce(new Error('disk full'));
    const reloadSpy = stubLocationReload();

    renderTab();
    await vi.waitFor(() => expect(mockGetJournalPath).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Change Location'));

    await vi.waitFor(() => {
      expect(screen.getByText('disk full')).toBeInTheDocument();
    });
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('resets the journal after both confirmations succeed', async () => {
    vi.mocked(dialogConfirm).mockResolvedValue(true);
    stubLocationReload();

    renderTab();
    await vi.waitFor(() => expect(mockGetJournalPath).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Reset Journal'));

    await vi.waitFor(() => {
      expect(mockResetJournal).toHaveBeenCalled();
    });
  });

  it('does not reset the journal when the first confirmation is declined', async () => {
    vi.mocked(dialogConfirm).mockResolvedValue(false);

    renderTab();
    await vi.waitFor(() => expect(mockGetJournalPath).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Reset Journal'));

    await vi.waitFor(() => expect(dialogConfirm).toHaveBeenCalled());
    expect(mockResetJournal).not.toHaveBeenCalled();
  });
});
