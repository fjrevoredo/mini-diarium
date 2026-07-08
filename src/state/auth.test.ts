import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockTauriBarrel } from '../test/mock-tauri';
import { mapTauriError } from '../lib/errors';

// This suite covers auth flows NOT exercised by auth-session-boundary.test.ts:
// createJournal / unlockJournal / unlockWithKeypair (success + sanitized failure
// with backend-before-state ordering), lockJournal's animation-timed transition
// and error revert, setupAuthEventListeners registration, and the refreshAuthState
// no-journal / unlocked / error branches.

const mocks = vi.hoisted(() => ({
  journalExists: vi.fn(),
  isJournalUnlocked: vi.fn(),
  createJournal: vi.fn(),
  unlockJournal: vi.fn(),
  unlockJournalWithKeypair: vi.fn(),
  lockJournal: vi.fn(),
  getAllEntryDates: vi.fn(),
  getAllTags: vi.fn(),
  loadJournals: vi.fn(),
  listen: vi.fn(),
}));

vi.mock('../lib/tauri', () =>
  mockTauriBarrel({
    journalExists: mocks.journalExists,
    isJournalUnlocked: mocks.isJournalUnlocked,
    createJournal: mocks.createJournal,
    unlockJournal: mocks.unlockJournal,
    unlockJournalWithKeypair: mocks.unlockJournalWithKeypair,
    lockJournal: mocks.lockJournal,
    getAllEntryDates: mocks.getAllEntryDates,
    getAllTags: mocks.getAllTags,
  }),
);

vi.mock('./journals', () => ({
  loadJournals: mocks.loadJournals,
  activeJournalId: () => null,
  journals: () => [],
}));

vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }));

import {
  authState,
  error,
  createJournal,
  unlockJournal,
  unlockWithKeypair,
  lockJournal,
  refreshAuthState,
  setupAuthEventListeners,
  goToJournalPicker,
  resetAuthTransientState,
} from './auth';
import { entryDates, registerCleanupCallback } from './entries';
import { resetSessionState } from './session';

describe('state/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllEntryDates.mockResolvedValue([]);
    mocks.getAllTags.mockResolvedValue([]);
    mocks.loadJournals.mockResolvedValue(undefined);
    resetSessionState();
    resetAuthTransientState();
    goToJournalPicker(); // known baseline: 'journal-select'
  });

  it('createJournal unlocks the session and hydrates dates AFTER the backend call', async () => {
    const order: string[] = [];
    mocks.createJournal.mockImplementation(async () => {
      order.push('backend');
    });
    mocks.getAllEntryDates.mockImplementation(async () => {
      order.push('dates');
      return ['2024-01-15'];
    });

    await createJournal('pw');

    expect(mocks.createJournal).toHaveBeenCalledWith('pw');
    expect(authState()).toBe('unlocked');
    expect(entryDates()).toEqual(['2024-01-15']);
    expect(order).toEqual(['backend', 'dates']);
  });

  it('createJournal surfaces a sanitized error and does not unlock on failure', async () => {
    const raw = 'failed to write /secret/path/diary.db';
    mocks.createJournal.mockRejectedValue(raw);

    await expect(createJournal('pw')).rejects.toThrow();

    expect(authState()).not.toBe('unlocked');
    expect(mocks.getAllEntryDates).not.toHaveBeenCalled();
    expect(error()).toBe(mapTauriError(raw));
    expect(error()).not.toContain('/secret/path');
  });

  it('unlockJournal unlocks and hydrates dates AFTER the backend call', async () => {
    const order: string[] = [];
    mocks.unlockJournal.mockImplementation(async () => {
      order.push('backend');
    });
    mocks.getAllEntryDates.mockImplementation(async () => {
      order.push('dates');
      return ['2024-02-02'];
    });

    await unlockJournal('pw');

    expect(mocks.unlockJournal).toHaveBeenCalledWith('pw');
    expect(authState()).toBe('unlocked');
    expect(entryDates()).toEqual(['2024-02-02']);
    expect(order).toEqual(['backend', 'dates']);
  });

  it('unlockJournal gates state changes behind a successful backend unlock', async () => {
    mocks.unlockJournal.mockRejectedValue('wrong password');

    await expect(unlockJournal('bad')).rejects.toThrow();

    expect(authState()).toBe('journal-select');
    expect(mocks.getAllEntryDates).not.toHaveBeenCalled();
    expect(error()).toBe(mapTauriError('wrong password'));
  });

  it('unlockWithKeypair unlocks with the key path', async () => {
    mocks.unlockJournalWithKeypair.mockResolvedValue(undefined);
    mocks.getAllEntryDates.mockResolvedValue(['2024-03-03']);

    await unlockWithKeypair('/key');

    expect(mocks.unlockJournalWithKeypair).toHaveBeenCalledWith('/key');
    expect(authState()).toBe('unlocked');
    expect(entryDates()).toEqual(['2024-03-03']);
  });

  it('unlockWithKeypair surfaces a sanitized error and does not unlock on failure', async () => {
    mocks.unlockJournalWithKeypair.mockRejectedValue('failed to read key file');

    await expect(unlockWithKeypair('/bad')).rejects.toThrow();

    expect(authState()).toBe('journal-select');
    expect(error()).toBe(mapTauriError('failed to read key file'));
  });

  describe('lockJournal', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('transitions unlocked → locking → locked across the animation delay', async () => {
      mocks.unlockJournal.mockResolvedValue(undefined);
      await unlockJournal('pw');
      expect(authState()).toBe('unlocked');

      vi.useFakeTimers();
      mocks.lockJournal.mockResolvedValue(undefined);

      const pending = lockJournal();
      expect(authState()).toBe('locking');

      await vi.advanceTimersByTimeAsync(700);
      await pending;

      expect(authState()).toBe('locked');
      expect(mocks.lockJournal).toHaveBeenCalled();
    });

    it('reverts to unlocked and surfaces a sanitized error when the backend lock fails', async () => {
      mocks.unlockJournal.mockResolvedValue(undefined);
      await unlockJournal('pw');

      mocks.lockJournal.mockRejectedValue('rusqlite failure');

      await expect(lockJournal()).rejects.toThrow();

      expect(authState()).toBe('unlocked');
      expect(error()).toBe(mapTauriError('rusqlite failure'));
    });
  });

  it('setupAuthEventListeners registers both backend lock listeners and runs cleanup on journal-locking', async () => {
    const handlers = new Map<string, (event: unknown) => void | Promise<void>>();
    mocks.listen.mockImplementation(
      async (event: string, cb: (event: unknown) => void | Promise<void>) => {
        handlers.set(event, cb);
        return () => handlers.delete(event);
      },
    );
    const order: string[] = [];
    const unregister = registerCleanupCallback(() => {
      order.push('cleanup');
    });

    const cleanup = await setupAuthEventListeners();

    expect(mocks.listen).toHaveBeenCalledWith('journal-locking', expect.any(Function));
    expect(mocks.listen).toHaveBeenCalledWith('journal-locked', expect.any(Function));

    await handlers.get('journal-locking')!({ payload: 'os-lock' });
    expect(order).toEqual(['cleanup']);

    cleanup();
    unregister();
  });

  it('refreshAuthState → no-journal when the journal no longer exists', async () => {
    mocks.journalExists.mockResolvedValue(false);
    await refreshAuthState();
    expect(authState()).toBe('no-journal');
  });

  it('refreshAuthState → unlocked when the backend reports it unlocked', async () => {
    mocks.journalExists.mockResolvedValue(true);
    mocks.isJournalUnlocked.mockResolvedValue(true);
    await refreshAuthState();
    expect(authState()).toBe('unlocked');
  });

  it('refreshAuthState → journal-select with an error when the check throws', async () => {
    mocks.journalExists.mockRejectedValue('boom');
    await refreshAuthState();
    expect(authState()).toBe('journal-select');
    expect(error()).toBe('Failed to check journal status');
  });
});
