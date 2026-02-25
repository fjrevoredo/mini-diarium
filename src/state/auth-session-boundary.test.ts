import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTodayString } from '../lib/dates';

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  loadJournals: vi.fn(),
  tauri: {
    diaryExists: vi.fn(),
    isDiaryUnlocked: vi.fn(),
    createDiary: vi.fn(),
    unlockDiary: vi.fn(),
    unlockDiaryWithKeypair: vi.fn(),
    lockDiary: vi.fn(),
    getAllEntryDates: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mocks.listen,
}));

vi.mock('./journals', () => ({
  loadJournals: mocks.loadJournals,
}));

vi.mock('../lib/tauri', () => mocks.tauri);

import {
  authMethods,
  authState,
  initializeAuth,
  lockDiary,
  refreshAuthState,
  resetAuthTransientState,
  setAuthMethods,
  setupAuthEventListeners,
  unlockDiary,
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
    mocks.tauri.diaryExists.mockResolvedValue(true);
    mocks.tauri.isDiaryUnlocked.mockResolvedValue(true);
    mocks.tauri.createDiary.mockResolvedValue(undefined);
    mocks.tauri.unlockDiary.mockResolvedValue(undefined);
    mocks.tauri.unlockDiaryWithKeypair.mockResolvedValue(undefined);
    mocks.tauri.lockDiary.mockResolvedValue(undefined);
    mocks.tauri.getAllEntryDates.mockResolvedValue([]);

    resetSessionState();
    resetAuthTransientState();
    await initializeAuth();
  });

  it('clears transient state on manual lock', async () => {
    primeTransientState();

    await lockDiary();

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

  it('clears transient state on backend diary-locked event', async () => {
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
      throw new Error('Expected diary-locked event handler to be registered');
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

    await unlockDiary('secret');

    expect(authState()).toBe('unlocked');
    expect(selectedDate()).toBe(getTodayString());
    expect(searchQuery()).toBe('');
    expect(entryDates()).toEqual(['2024-01-15']);
  });

  it('refreshAuthState does not reload journals', async () => {
    mocks.loadJournals.mockClear();
    mocks.tauri.diaryExists.mockResolvedValue(true);
    mocks.tauri.isDiaryUnlocked.mockResolvedValue(false);

    await refreshAuthState();

    expect(mocks.loadJournals).not.toHaveBeenCalled();
    expect(authState()).toBe('locked');
  });
});
