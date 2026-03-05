import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTodayString } from '../lib/dates';

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  loadJournals: vi.fn(),
  tauri: {
    journalExists: vi.fn(),
    isJournalUnlocked: vi.fn(),
    createJournal: vi.fn(),
    unlockJournal: vi.fn(),
    unlockJournalWithKeypair: vi.fn(),
    lockJournal: vi.fn(),
    getAllEntryDates: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mocks.listen,
}));

vi.mock('./journals', () => ({
  loadJournals: mocks.loadJournals,
  activeJournalId: () => null,
}));

vi.mock('../lib/tauri', () => mocks.tauri);

import {
  authMethods,
  authState,
  initializeAuth,
  lockJournal,
  refreshAuthState,
  resetAuthTransientState,
  setAuthMethods,
  setupAuthEventListeners,
  unlockJournal,
} from './auth';
import { entryDates, setCurrentEntry, setEntryDates, setIsLoading, setIsSaving } from './entries';
import { searchQuery, setIsSearching, setSearchQuery, setSearchResults } from './search';
import { resetSessionState } from './session';
import {
  isAboutOpen,
  isExportOpen,
  isGoToDateOpen,
  isImportOpen,
  isPreferencesOpen,
  isSidebarCollapsed,
  isStatsOpen,
  selectedDate,
  setIsAboutOpen,
  setIsExportOpen,
  setIsGoToDateOpen,
  setIsImportOpen,
  setIsPreferencesOpen,
  setIsSidebarCollapsed,
  setIsStatsOpen,
  setSelectedDate,
} from './ui';

function primeTransientState(): void {
  setSelectedDate('2024-01-15');
  setIsSidebarCollapsed(true);
  setIsGoToDateOpen(true);
  setIsPreferencesOpen(true);
  setIsStatsOpen(true);
  setIsImportOpen(true);
  setIsExportOpen(true);
  setIsAboutOpen(true);
  setCurrentEntry({
    id: 1,
    date: '2024-01-15',
    title: 'Title',
    text: '<p>Body</p>',
    word_count: 1,
    date_created: '2024-01-15T00:00:00Z',
    date_updated: '2024-01-15T00:00:00Z',
  });
  setEntryDates(['2024-01-15']);
  setIsLoading(true);
  setIsSaving(true);
  setSearchQuery('query');
  setSearchResults([{ date: '2024-01-15', title: 'Title', snippet: 'Body' }]);
  setIsSearching(true);
  setAuthMethods([
    {
      id: 1,
      slot_type: 'password',
      label: 'Password',
      public_key_hex: null,
      created_at: '2024-01-15T00:00:00Z',
      last_used: null,
    },
  ]);
}

describe('auth session boundary reset', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    mocks.loadJournals.mockResolvedValue(undefined);
    mocks.tauri.journalExists.mockResolvedValue(true);
    mocks.tauri.isJournalUnlocked.mockResolvedValue(true);
    mocks.tauri.createJournal.mockResolvedValue(undefined);
    mocks.tauri.unlockJournal.mockResolvedValue(undefined);
    mocks.tauri.unlockJournalWithKeypair.mockResolvedValue(undefined);
    mocks.tauri.lockJournal.mockResolvedValue(undefined);
    mocks.tauri.getAllEntryDates.mockResolvedValue([]);

    resetSessionState();
    resetAuthTransientState();
    await initializeAuth();
  });

  it('clears transient state on manual lock', async () => {
    primeTransientState();

    await lockJournal();

    expect(authState()).toBe('locked');
    expect(selectedDate()).toBe(getTodayString());
    expect(isSidebarCollapsed()).toBe(true);
    expect(isGoToDateOpen()).toBe(false);
    expect(isPreferencesOpen()).toBe(false);
    expect(isStatsOpen()).toBe(false);
    expect(isImportOpen()).toBe(false);
    expect(isExportOpen()).toBe(false);
    expect(isAboutOpen()).toBe(false);
    expect(entryDates()).toEqual([]);
    expect(searchQuery()).toBe('');
    expect(authMethods()).toEqual([]);
  });

  it('clears transient state on backend journal-locked event', async () => {
    const holder: {
      handler?: (event: { payload?: { reason?: string } }) => void;
    } = {};
    mocks.listen.mockImplementation(
      async (
        _event: string,
        callback: (event: { payload?: { reason?: string } }) => void,
      ): Promise<() => void> => {
        holder.handler = callback;
        return () => {};
      },
    );

    const cleanup = await setupAuthEventListeners();
    primeTransientState();

    if (!holder.handler) {
      throw new Error('Expected journal-locked event handler to be registered');
    }
    holder.handler({ payload: { reason: 'session lock' } });

    expect(authState()).toBe('locked');
    expect(selectedDate()).toBe(getTodayString());
    expect(entryDates()).toEqual([]);
    expect(searchQuery()).toBe('');
    expect(authMethods()).toEqual([]);

    cleanup();
  });

  it('starts unlock sessions from today baseline', async () => {
    setSelectedDate('1999-12-31');
    setSearchQuery('old');
    setSearchResults([{ date: '1999-12-31', title: 'Old', snippet: 'Old' }]);
    mocks.tauri.getAllEntryDates.mockResolvedValue(['2024-01-15']);

    await unlockJournal('secret');

    expect(authState()).toBe('unlocked');
    expect(selectedDate()).toBe(getTodayString());
    expect(searchQuery()).toBe('');
    expect(entryDates()).toEqual(['2024-01-15']);
  });

  it('refreshAuthState does not reload journals', async () => {
    mocks.loadJournals.mockClear();
    mocks.tauri.journalExists.mockResolvedValue(true);
    mocks.tauri.isJournalUnlocked.mockResolvedValue(false);

    await refreshAuthState();

    expect(mocks.loadJournals).not.toHaveBeenCalled();
    expect(authState()).toBe('locked');
  });
});
