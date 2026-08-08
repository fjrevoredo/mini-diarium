import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';
import { createSignal } from 'solid-js';
import type { JournalConfig } from '../../lib/tauri';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const [journals, setJournals] = createSignal<JournalConfig[]>([]);
const [activeJournalId] = createSignal<string | null>(null);
const [authError] = createSignal<string | null>(null);

const mocks = vi.hoisted(() => ({
  switchJournal: vi.fn(),
  addJournal: vi.fn(),
  removeJournal: vi.fn(),
  renameJournal: vi.fn(),
  refreshAuthState: vi.fn(),
  checkJournalPath: vi.fn(),
  getDefaultJournalDir: vi.fn(),
  prepareJournalDir: vi.fn(),
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

vi.mock('../../lib/tauri', () => ({
  checkJournalPath: mocks.checkJournalPath,
  getDefaultJournalDir: mocks.getDefaultJournalDir,
  prepareJournalDir: mocks.prepareJournalDir,
}));

// ──────────────────────────────────────────────────────────────────────────────

import JournalPicker from './JournalPicker';

describe('JournalPicker component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setJournals([]);
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
    mocks.prepareJournalDir.mockImplementation(async (base: string, name: string) =>
      Promise.resolve(`${base}/${name}`),
    );
  });

  /** Fills in the create form and submits it. */
  const createJournalNamed = async (name: string) => {
    fireEvent.click(screen.getByText(/create new journal/i));
    await vi.waitFor(() => expect(mocks.getDefaultJournalDir).toHaveBeenCalled());

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

  // Creating a journal used to open the folder chooser unconditionally, which under Flatpak
  // is what handed back an unusable document-portal path. The chooser must now be optional.
  it('pre-fills the default location when Create New Journal is clicked, without a dialog', async () => {
    const dialogMock = await import('@tauri-apps/plugin-dialog');
    renderWithI18n(() => <JournalPicker />);

    fireEvent.click(screen.getByText(/create new journal/i));

    await vi.waitFor(() => {
      expect(screen.getByTitle('/home/testuser/Documents/Mini Diarium')).toBeInTheDocument();
    });
    expect(mocks.getDefaultJournalDir).toHaveBeenCalled();
    expect(dialogMock.open).not.toHaveBeenCalled();
  });

  it('shows a sanitized error when the default location cannot be prepared', async () => {
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
  });

  it('lets Browse… override the pre-filled default location', async () => {
    const dialogMock = await import('@tauri-apps/plugin-dialog');
    vi.mocked(dialogMock.open).mockResolvedValueOnce('/home/testuser/elsewhere');

    renderWithI18n(() => <JournalPicker />);
    fireEvent.click(screen.getByText(/create new journal/i));

    await vi.waitFor(() => {
      expect(screen.getByTitle('/home/testuser/Documents/Mini Diarium')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^browse/i }));

    await vi.waitFor(() => {
      expect(screen.getByTitle('/home/testuser/elsewhere')).toBeInTheDocument();
    });
    expect(screen.queryByTitle('/home/testuser/Documents/Mini Diarium')).not.toBeInTheDocument();
  });

  // P1 regression: every default-location create used to receive the *same* directory, so a
  // second journal was registered against the first one's diary.db — and unlocking it asked
  // for the first journal's password under the second journal's name.
  it('gives each journal created at the default location a folder of its own', async () => {
    mocks.prepareJournalDir
      .mockResolvedValueOnce('/home/testuser/Documents/Mini Diarium/Work')
      .mockResolvedValueOnce('/home/testuser/Documents/Mini Diarium/Personal');

    const first = renderWithI18n(() => <JournalPicker />);
    await createJournalNamed('Work');
    await vi.waitFor(() => expect(mocks.addJournal).toHaveBeenCalledTimes(1));
    first.unmount();

    renderWithI18n(() => <JournalPicker />);
    await createJournalNamed('Personal');
    await vi.waitFor(() => expect(mocks.addJournal).toHaveBeenCalledTimes(2));

    expect(mocks.prepareJournalDir).toHaveBeenNthCalledWith(
      1,
      '/home/testuser/Documents/Mini Diarium',
      'Work',
    );
    const [firstPath, secondPath] = mocks.addJournal.mock.calls.map((call) => call[1]);
    expect(firstPath).toBe('/home/testuser/Documents/Mini Diarium/Work');
    expect(secondPath).toBe('/home/testuser/Documents/Mini Diarium/Personal');
    expect(firstPath).not.toBe(secondPath);
  });

  it('creates the journal directly in a browsed folder, allocating nothing', async () => {
    const dialogMock = await import('@tauri-apps/plugin-dialog');
    vi.mocked(dialogMock.open).mockResolvedValueOnce('/home/testuser/elsewhere');

    renderWithI18n(() => <JournalPicker />);
    fireEvent.click(screen.getByText(/create new journal/i));
    await vi.waitFor(() => expect(mocks.getDefaultJournalDir).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /^browse/i }));
    await vi.waitFor(() => {
      expect(screen.getByTitle('/home/testuser/elsewhere')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await vi.waitFor(() => {
      expect(mocks.addJournal).toHaveBeenCalledWith('elsewhere', '/home/testuser/elsewhere');
    });
    // Browsing means "put it here", so the chosen folder is used verbatim.
    expect(mocks.prepareJournalDir).not.toHaveBeenCalled();
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
