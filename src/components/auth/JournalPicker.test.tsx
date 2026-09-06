import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { createSignal } from 'solid-js';
import type { JournalConfig } from '../../lib/tauri';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const [journals, setJournals] = createSignal<JournalConfig[]>([]);
const [activeJournalId] = createSignal<string | null>(null);
const [authError] = createSignal<string | null>(null);
const [isFlatpak, setIsFlatpak] = createSignal(false);

const mocks = vi.hoisted(() => ({
  switchJournal: vi.fn(),
  addJournal: vi.fn(),
  removeJournal: vi.fn(),
  renameJournal: vi.fn(),
  refreshAuthState: vi.fn(),
  checkJournalPath: vi.fn(),
  getDefaultJournalDir: vi.fn(),
  loadPlatformInfo: vi.fn(),
}));

vi.mock('../../state/journals', () => ({
  get journals() {
    return journals;
  },
  get activeJournalId() {
    return activeJournalId;
  },
  switchJournal: mocks.switchJournal,
  addJournal: mocks.addJournal,
  removeJournal: mocks.removeJournal,
  renameJournal: mocks.renameJournal,
}));

vi.mock('../../state/auth', () => ({
  get error() {
    return authError;
  },
  refreshAuthState: mocks.refreshAuthState,
}));

vi.mock('../../state/platform', () => ({
  get isFlatpak() {
    return isFlatpak;
  },
  loadPlatformInfo: mocks.loadPlatformInfo,
}));

vi.mock('../../lib/tauri', () => ({
  checkJournalPath: mocks.checkJournalPath,
  getDefaultJournalDir: mocks.getDefaultJournalDir,
}));

// ──────────────────────────────────────────────────────────────────────────────

import JournalPicker from './JournalPicker';

describe('JournalPicker component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setJournals([]);
    setIsFlatpak(false);
    mocks.switchJournal.mockResolvedValue(undefined);
    mocks.addJournal.mockResolvedValue({
      id: 'new',
      name: 'New',
      path: '/home/testuser/journals/new',
      auto_protected: false,
      require_all_auth: false,
      db_filename: 'diary.db',
    });
    mocks.removeJournal.mockResolvedValue(undefined);
    mocks.renameJournal.mockResolvedValue(undefined);
    mocks.refreshAuthState.mockResolvedValue(undefined);
    mocks.checkJournalPath.mockResolvedValue(false);
    mocks.getDefaultJournalDir.mockResolvedValue('/home/testuser/Documents/Mini Diarium');
    mocks.loadPlatformInfo.mockResolvedValue(undefined);
  });

  /** Fills in and submits the non-Flatpak create form after the save dialog resolves. */
  const createJournalNamed = async (name: string) => {
    const dialogMock = await import('@tauri-apps/plugin-dialog');
    vi.mocked(dialogMock.save).mockResolvedValueOnce(
      '/home/testuser/Documents/Mini Diarium/diary.db',
    );
    fireEvent.click(screen.getByText(/create new journal/i));
    await vi.waitFor(() => expect(dialogMock.save).toHaveBeenCalled());

    const nameInput = screen.getByPlaceholderText(/e\.g\. my journal/i);
    fireEvent.input(nameInput, { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
  };

  it('renders empty state when no journals are configured', () => {
    setJournals([]);
    renderWithI18n(() => <JournalPicker />);

    expect(screen.getByTestId('journal-picker')).toBeInTheDocument();
    expect(screen.getByText(/no journals yet/i)).toBeInTheDocument();
    expect(screen.getByText(/create new journal/i)).toBeInTheDocument();
    expect(screen.getByText(/open existing/i)).toBeInTheDocument();
  });

  it('renders journal list when journals are configured', () => {
    setJournals([
      {
        id: 'j1',
        name: 'My Diary',
        path: '/home/user/diary',
        auto_protected: false,
        require_all_auth: false,
        db_filename: 'diary.db',
      },
    ]);
    renderWithI18n(() => <JournalPicker />);

    expect(screen.getByText('My Diary')).toBeInTheDocument();
    expect(screen.getByText('/home/user/diary')).toBeInTheDocument();
    expect(screen.getByTestId('journal-open-button')).toBeInTheDocument();
  });

  it('calls switchJournal and refreshAuthState when Open is clicked', async () => {
    setJournals([
      {
        id: 'j1',
        name: 'Work Journal',
        path: '/home/testuser/journals/work',
        auto_protected: false,
        require_all_auth: false,
        db_filename: 'diary.db',
      },
    ]);
    renderWithI18n(() => <JournalPicker />);

    const openBtn = screen.getByTestId('journal-open-button');
    fireEvent.click(openBtn);

    await vi.waitFor(() => {
      expect(mocks.switchJournal).toHaveBeenCalledWith('j1');
      expect(mocks.refreshAuthState).toHaveBeenCalled();
    });
  });

  it('shows error when Open Existing is clicked and the selected file is not valid', async () => {
    mocks.checkJournalPath.mockResolvedValue(false);

    // Override plugin-dialog mock to return a file path
    const dialogMock = await import('@tauri-apps/plugin-dialog');
    vi.mocked(dialogMock.open).mockResolvedValueOnce('/some/folder/myjournal.db');

    renderWithI18n(() => <JournalPicker />);

    const openExistingBtn = screen.getByText(/open existing/i);
    fireEvent.click(openExistingBtn);

    await vi.waitFor(() => {
      expect(mocks.checkJournalPath).toHaveBeenCalledWith('/some/folder/myjournal.db');
    });

    // After failed check, addMode becomes 'open' with an error shown
    await vi.waitFor(() => {
      expect(screen.getByText(/not a valid diary database/i)).toBeInTheDocument();
    });
  });

  describe('Create New Journal — non-Flatpak', () => {
    it('opens a native save dialog pre-filled with the default location', async () => {
      const dialogMock = await import('@tauri-apps/plugin-dialog');
      renderWithI18n(() => <JournalPicker />);

      fireEvent.click(screen.getByText(/create new journal/i));

      await vi.waitFor(() => expect(dialogMock.save).toHaveBeenCalled());
      expect(mocks.getDefaultJournalDir).toHaveBeenCalled();
      expect(dialogMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultPath: '/home/testuser/Documents/Mini Diarium/diary.db',
        }),
      );
    });

    it('returns to the initial screen when the save dialog is cancelled', async () => {
      const dialogMock = await import('@tauri-apps/plugin-dialog');
      vi.mocked(dialogMock.save).mockResolvedValueOnce(null);

      renderWithI18n(() => <JournalPicker />);
      fireEvent.click(screen.getByText(/create new journal/i));

      await vi.waitFor(() => expect(dialogMock.save).toHaveBeenCalled());
      expect(screen.getByText(/create new journal/i)).toBeInTheDocument();
      expect(screen.getByText(/open existing/i)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/e\.g\. my journal/i)).not.toBeInTheDocument();
    });

    it('derives the name and shows a read-only path hint after confirming the save dialog', async () => {
      const dialogMock = await import('@tauri-apps/plugin-dialog');
      vi.mocked(dialogMock.save).mockResolvedValueOnce('/home/testuser/elsewhere/work.db');

      renderWithI18n(() => <JournalPicker />);
      fireEvent.click(screen.getByText(/create new journal/i));

      await vi.waitFor(() => {
        expect(screen.getByPlaceholderText(/e\.g\. my journal/i)).toHaveValue('work');
      });
      const hint = screen.getByText('/home/testuser/elsewhere');
      expect(hint).not.toHaveAttribute('title');

      fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

      await vi.waitFor(() => {
        expect(mocks.checkJournalPath).toHaveBeenCalledWith('/home/testuser/elsewhere/work.db');
        expect(mocks.addJournal).toHaveBeenCalledWith(
          'work',
          '/home/testuser/elsewhere',
          'work.db',
        );
      });
    });

    it('shows a friendly error and does not create the journal when a file already exists there', async () => {
      const dialogMock = await import('@tauri-apps/plugin-dialog');
      vi.mocked(dialogMock.save).mockResolvedValueOnce('/home/testuser/elsewhere/work.db');
      mocks.checkJournalPath.mockResolvedValue(true);

      renderWithI18n(() => <JournalPicker />);
      fireEvent.click(screen.getByText(/create new journal/i));
      await vi.waitFor(() => expect(dialogMock.save).toHaveBeenCalled());

      fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

      await vi.waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i);
      });
      expect(mocks.addJournal).not.toHaveBeenCalled();

      // Non-Flatpak has no inline field to change the filename — "Choose a different
      // location…" must re-open the save dialog rather than leaving the user stuck.
      vi.mocked(dialogMock.save).mockResolvedValueOnce('/home/testuser/elsewhere/other.db');
      fireEvent.click(screen.getByText(/choose a different location/i));

      await vi.waitFor(() => {
        expect(dialogMock.save).toHaveBeenCalledTimes(2);
        expect(screen.getByPlaceholderText(/e\.g\. my journal/i)).toHaveValue('other');
      });
    });

    it('Cancel clears a pending path conflict so it does not leak into the next attempt', async () => {
      const dialogMock = await import('@tauri-apps/plugin-dialog');
      vi.mocked(dialogMock.save).mockResolvedValueOnce('/home/testuser/elsewhere/work.db');
      mocks.checkJournalPath.mockResolvedValue(true);

      renderWithI18n(() => <JournalPicker />);
      fireEvent.click(screen.getByText(/create new journal/i));
      await vi.waitFor(() => expect(dialogMock.save).toHaveBeenCalled());
      fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
      await vi.waitFor(() => {
        expect(screen.getByText(/choose a different location/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(screen.getByText(/create new journal/i)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      mocks.checkJournalPath.mockResolvedValue(false);
      vi.mocked(dialogMock.save).mockResolvedValueOnce('/home/testuser/elsewhere/fresh.db');
      fireEvent.click(screen.getByText(/create new journal/i));
      await vi.waitFor(() => {
        expect(screen.getByPlaceholderText(/e\.g\. my journal/i)).toHaveValue('fresh');
      });
      expect(screen.queryByText(/choose a different location/i)).not.toBeInTheDocument();
    });

    it('shows a sanitized error when the default location cannot be resolved', async () => {
      const dialogMock = await import('@tauri-apps/plugin-dialog');
      mocks.getDefaultJournalDir.mockRejectedValue(
        new Error('Could not prepare the default journal folder: Access is denied. (os error 5)'),
      );

      renderWithI18n(() => <JournalPicker />);
      fireEvent.click(screen.getByText(/create new journal/i));

      await vi.waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      // The raw OS detail must not reach the user.
      expect(screen.getByRole('alert')).not.toHaveTextContent(/os error/i);
      // The dialog must never open when the default location itself could not be resolved.
      expect(dialogMock.save).not.toHaveBeenCalled();
    });
  });

  describe('Create New Journal — Flatpak', () => {
    beforeEach(() => {
      setIsFlatpak(true);
    });

    it('shows the dialog-free form with a Filename field instead of opening a dialog', async () => {
      const dialogMock = await import('@tauri-apps/plugin-dialog');
      renderWithI18n(() => <JournalPicker />);

      fireEvent.click(screen.getByText(/create new journal/i));

      await vi.waitFor(() => {
        expect(screen.getByText('/home/testuser/Documents/Mini Diarium')).toBeInTheDocument();
      });
      expect(mocks.getDefaultJournalDir).toHaveBeenCalled();
      expect(dialogMock.save).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue('diary.db')).toBeInTheDocument();
    });

    it('lets Browse… override the pre-filled default location', async () => {
      const dialogMock = await import('@tauri-apps/plugin-dialog');
      vi.mocked(dialogMock.open).mockResolvedValueOnce('/home/testuser/elsewhere');

      renderWithI18n(() => <JournalPicker />);
      fireEvent.click(screen.getByText(/create new journal/i));

      await vi.waitFor(() => {
        expect(screen.getByText('/home/testuser/Documents/Mini Diarium')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /^browse/i }));

      await vi.waitFor(() => {
        expect(screen.getByText('/home/testuser/elsewhere')).toBeInTheDocument();
      });
      expect(screen.queryByText('/home/testuser/Documents/Mini Diarium')).not.toBeInTheDocument();
    });

    it('creates the journal with the typed name and filename', async () => {
      renderWithI18n(() => <JournalPicker />);
      fireEvent.click(screen.getByText(/create new journal/i));
      await vi.waitFor(() => expect(mocks.getDefaultJournalDir).toHaveBeenCalled());

      fireEvent.input(screen.getByPlaceholderText(/e\.g\. my journal/i), {
        target: { value: 'Work' },
      });
      fireEvent.input(screen.getByDisplayValue('diary.db'), {
        target: { value: 'work.db' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

      await vi.waitFor(() => {
        expect(mocks.checkJournalPath).toHaveBeenCalledWith(
          '/home/testuser/Documents/Mini Diarium/work.db',
        );
        expect(mocks.addJournal).toHaveBeenCalledWith(
          'Work',
          '/home/testuser/Documents/Mini Diarium',
          'work.db',
        );
      });
    });

    it('shows a friendly error and does not create the journal when a file already exists there', async () => {
      mocks.checkJournalPath.mockResolvedValue(true);

      renderWithI18n(() => <JournalPicker />);
      fireEvent.click(screen.getByText(/create new journal/i));
      await vi.waitFor(() => expect(mocks.getDefaultJournalDir).toHaveBeenCalled());

      fireEvent.input(screen.getByPlaceholderText(/e\.g\. my journal/i), {
        target: { value: 'Work' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

      await vi.waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i);
      });
      expect(mocks.addJournal).not.toHaveBeenCalled();
    });
  });

  it('shows a friendly error when the journal is already in the list', async () => {
    mocks.addJournal.mockRejectedValue(new Error('Journal is already in your list'));

    renderWithI18n(() => <JournalPicker />);
    await createJournalNamed('Work');

    await vi.waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/already in your list/i);
    });
  });

  it('applies scroll constraint to journal list when more than 5 journals exist', () => {
    const manyJournals: JournalConfig[] = Array.from({ length: 6 }, (_, i) => ({
      id: `j${i}`,
      name: `Journal ${i}`,
      path: `/home/testuser/journals/journal-${i}`,
      auto_protected: false,
      require_all_auth: false,
      db_filename: 'diary.db',
    }));
    setJournals(manyJournals);
    renderWithI18n(() => <JournalPicker />);

    const list = screen.getByRole('list');
    expect(list).toHaveClass('max-h-96');
    expect(list).toHaveClass('overflow-y-auto');
  });

  it('applies scroll constraint to journal list even with 5 or fewer journals', () => {
    const fewJournals: JournalConfig[] = Array.from({ length: 3 }, (_, i) => ({
      id: `j${i}`,
      name: `Journal ${i}`,
      path: `/home/testuser/journals/journal-${i}`,
      auto_protected: false,
      require_all_auth: false,
      db_filename: 'diary.db',
    }));
    setJournals(fewJournals);
    renderWithI18n(() => <JournalPicker />);

    const list = screen.getByRole('list');
    expect(list).toHaveClass('max-h-96');
    expect(list).toHaveClass('overflow-y-auto');
  });
});
