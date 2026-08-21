import { describe, it, expect, beforeEach, vi } from 'vitest';

const journalState = vi.hoisted(() => ({ activeId: null as string | null }));
vi.mock('./journals', () => ({
  activeJournalId: () => journalState.activeId,
}));

const statsMock = vi.hoisted(() => ({ getStatistics: vi.fn() }));
vi.mock('../lib/tauri/statistics', () => ({
  getStatistics: statsMock.getStatistics,
}));

import {
  recordFirstSeenIfAbsent,
  computePendingMilestone,
  checkSupportMilestone,
  dismissSupportMilestone,
  resetSupportMilestoneState,
  pendingRung,
} from './support-milestone';

const DAY_MS = 86_400_000;

function makeStats(bestStreak: number) {
  return {
    total_entries: 10,
    entries_per_week: 7,
    best_streak: bestStreak,
    current_streak: bestStreak,
    total_words: 1000,
    avg_words_per_entry: 100,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('state/support-milestone', () => {
  beforeEach(() => {
    localStorage.clear();
    journalState.activeId = null;
    statsMock.getStatistics.mockReset();
    resetSupportMilestoneState();
  });

  describe('recordFirstSeenIfAbsent', () => {
    it('writes a timestamp on first call for a given journal id', () => {
      const before = Date.now();
      recordFirstSeenIfAbsent('journal-1');
      const stored = Number(localStorage.getItem('first-seen-journal-1'));
      expect(stored).toBeGreaterThanOrEqual(before);
    });

    it('does not overwrite an existing value on a second call for the same id', () => {
      localStorage.setItem('first-seen-journal-1', '12345');
      recordFirstSeenIfAbsent('journal-1');
      expect(localStorage.getItem('first-seen-journal-1')).toBe('12345');
    });
  });

  describe('computePendingMilestone', () => {
    it('returns null below rung 1', () => {
      expect(computePendingMilestone(3, 0, 10 * DAY_MS, 0)).toBeNull();
    });

    it('returns rung 1 exactly at the boundary (streak and age)', () => {
      expect(computePendingMilestone(7, 0, 7 * DAY_MS, 0)).toBe(7);
    });

    it('gates on journal age even when best_streak is sufficient (import-gaming case)', () => {
      expect(computePendingMilestone(7, 0, 1 * DAY_MS, 0)).toBeNull();
    });

    it('gates on best_streak even when the journal is old enough', () => {
      expect(computePendingMilestone(3, 0, 100 * DAY_MS, 0)).toBeNull();
    });

    it('returns rung 2 when rung 1 was never shown', () => {
      expect(computePendingMilestone(66, 0, 66 * DAY_MS, 0)).toBe(66);
    });

    it('suppresses a rung already recorded as shown', () => {
      expect(computePendingMilestone(7, 0, 7 * DAY_MS, 7)).toBeNull();
    });

    it('returns rung 3 at the boundary', () => {
      expect(computePendingMilestone(365, 0, 365 * DAY_MS, 66)).toBe(365);
    });
  });

  describe('checkSupportMilestone / dismissSupportMilestone', () => {
    it('sets pendingRung to the expected value for a seeded combination', async () => {
      journalState.activeId = 'journal-1';
      const firstSeen = Date.now() - 10 * DAY_MS;
      localStorage.setItem('first-seen-journal-1', firstSeen.toString());
      statsMock.getStatistics.mockResolvedValue(makeStats(7));

      await checkSupportMilestone();
      expect(pendingRung()).toBe(7);
    });

    it('dismissSupportMilestone persists the shown rung and resets pendingRung', async () => {
      journalState.activeId = 'journal-1';
      const firstSeen = Date.now() - 10 * DAY_MS;
      localStorage.setItem('first-seen-journal-1', firstSeen.toString());
      statsMock.getStatistics.mockResolvedValue(makeStats(7));

      await checkSupportMilestone();
      dismissSupportMilestone();

      expect(pendingRung()).toBeNull();
      expect(localStorage.getItem('support-milestone-shown-journal-1')).toBe('7');
    });
  });

  describe('resetSupportMilestoneState', () => {
    it('clears a pending rung without writing to localStorage (session-boundary reset, not dismissal)', async () => {
      journalState.activeId = 'journal-1';
      const firstSeen = Date.now() - 10 * DAY_MS;
      localStorage.setItem('first-seen-journal-1', firstSeen.toString());
      statsMock.getStatistics.mockResolvedValue(makeStats(7));

      await checkSupportMilestone();
      expect(pendingRung()).toBe(7);

      resetSupportMilestoneState();

      expect(pendingRung()).toBeNull();
      expect(localStorage.getItem('support-milestone-shown-journal-1')).toBeNull();
    });

    it('ignores a late lookup after the session resets and the active journal changes', async () => {
      journalState.activeId = 'journal-a';
      localStorage.setItem('first-seen-journal-a', (Date.now() - 10 * DAY_MS).toString());
      const statistics = deferred<ReturnType<typeof makeStats>>();
      statsMock.getStatistics.mockReturnValue(statistics.promise);

      const check = checkSupportMilestone();
      resetSupportMilestoneState();
      journalState.activeId = 'journal-b';
      statistics.resolve(makeStats(7));

      await check;
      expect(pendingRung()).toBeNull();

      dismissSupportMilestone();
      expect(localStorage.getItem('support-milestone-shown-journal-b')).toBeNull();
    });

    it('lets only the newest overlapping lookup publish its rung', async () => {
      journalState.activeId = 'journal-1';
      localStorage.setItem('first-seen-journal-1', (Date.now() - 400 * DAY_MS).toString());
      const older = deferred<ReturnType<typeof makeStats>>();
      const newer = deferred<ReturnType<typeof makeStats>>();
      statsMock.getStatistics.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

      const olderCheck = checkSupportMilestone();
      const newerCheck = checkSupportMilestone();
      newer.resolve(makeStats(66));
      await newerCheck;
      expect(pendingRung()).toBe(66);

      older.resolve(makeStats(7));
      await olderCheck;
      expect(pendingRung()).toBe(66);
    });

    it('contains statistics failures without leaving a pending prompt', async () => {
      journalState.activeId = 'journal-1';
      statsMock.getStatistics.mockRejectedValue(new Error('statistics unavailable'));

      await expect(checkSupportMilestone()).resolves.toBeUndefined();

      expect(pendingRung()).toBeNull();
      expect(localStorage.getItem('support-milestone-shown-journal-1')).toBeNull();
    });
  });
});
