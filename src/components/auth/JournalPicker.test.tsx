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
      path: '/tmp/new',
      auto_protected: false,
      require_all_auth: false,
      db_filename: 'diary.db',
    });
    mocks.removeJournal.mockResolvedValue(undefined);
    mocks.renameJournal.mockResolvedValue(undefined);
    mocks.refreshAuthState.mockResolvedValue(undefined);
    mocks.checkJournalPath.mockResolvedValue(false);
  });

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
        path: '/tmp/work',
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

  it('applies scroll constraint to journal list when more than 5 journals exist', () => {
    const manyJournals: JournalConfig[] = Array.from({ length: 6 }, (_, i) => ({
      id: `j${i}`,
      name: `Journal ${i}`,
      path: `/tmp/journal-${i}`,
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
      path: `/tmp/journal-${i}`,
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
