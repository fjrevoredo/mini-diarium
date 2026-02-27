import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const [journals, setJournals] = createSignal<{ id: string; name: string; path: string }[]>([]);
const [activeJournalId] = createSignal<string | null>(null);
const [authError] = createSignal<string | null>(null);

const mocks = vi.hoisted(() => ({
  switchJournal: vi.fn(),
  addJournal: vi.fn(),
  removeJournal: vi.fn(),
  renameJournal: vi.fn(),
  refreshAuthState: vi.fn(),
  checkDiaryPath: vi.fn(),
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
  checkDiaryPath: mocks.checkDiaryPath,
}));

// ──────────────────────────────────────────────────────────────────────────────

import JournalPicker from './JournalPicker';

describe('JournalPicker component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setJournals([]);
    mocks.switchJournal.mockResolvedValue(undefined);
    mocks.addJournal.mockResolvedValue({ id: 'new', name: 'New', path: '/tmp/new' });
    mocks.removeJournal.mockResolvedValue(undefined);
    mocks.renameJournal.mockResolvedValue(undefined);
    mocks.refreshAuthState.mockResolvedValue(undefined);
    mocks.checkDiaryPath.mockResolvedValue(false);
  });

  it('renders empty state when no journals are configured', () => {
    setJournals([]);
    render(() => <JournalPicker />);

    expect(screen.getByTestId('journal-picker')).toBeInTheDocument();
    expect(screen.getByText(/no journals yet/i)).toBeInTheDocument();
    expect(screen.getByText(/create new diary/i)).toBeInTheDocument();
    expect(screen.getByText(/open existing/i)).toBeInTheDocument();
  });

  it('renders journal list when journals are configured', () => {
    setJournals([{ id: 'j1', name: 'My Diary', path: '/home/user/diary' }]);
    render(() => <JournalPicker />);

    expect(screen.getByText('My Diary')).toBeInTheDocument();
    expect(screen.getByText('/home/user/diary')).toBeInTheDocument();
    expect(screen.getByTestId('journal-open-button')).toBeInTheDocument();
  });

  it('calls switchJournal and refreshAuthState when Open is clicked', async () => {
    setJournals([{ id: 'j1', name: 'Work Journal', path: '/tmp/work' }]);
    render(() => <JournalPicker />);

    const openBtn = screen.getByTestId('journal-open-button');
    fireEvent.click(openBtn);

    await vi.waitFor(() => {
      expect(mocks.switchJournal).toHaveBeenCalledWith('j1');
      expect(mocks.refreshAuthState).toHaveBeenCalled();
    });
  });

  it('shows error when Open Existing is clicked and no diary.db is found', async () => {
    mocks.checkDiaryPath.mockResolvedValue(false);

    // Override plugin-dialog mock to return a folder path
    const dialogMock = await import('@tauri-apps/plugin-dialog');
    vi.mocked(dialogMock.open).mockResolvedValueOnce('/some/folder');

    render(() => <JournalPicker />);

    const openExistingBtn = screen.getByText(/open existing/i);
    fireEvent.click(openExistingBtn);

    await vi.waitFor(() => {
      expect(mocks.checkDiaryPath).toHaveBeenCalledWith('/some/folder');
    });

    // After failed check, addMode becomes 'open' with an error shown
    await vi.waitFor(() => {
      expect(screen.getByText(/no diary found/i)).toBeInTheDocument();
    });
  });
});
