import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  deleteEntry,
  getAllEntryDates,
  getTimelineEntries,
  setEntryLocked,
  getLockedEntryDates,
  recalculateWordCounts,
} from './entries';
import { makeTimelineEntry } from '../../test/fixtures';

// NOTE: createEntry / saveEntry / getEntriesForDate / deleteEntryIfEmpty are
// covered by tauri-params.test.ts. This suite covers the remaining wrappers.

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('entries command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('deleteEntry → delete_entry { id }', async () => {
    await deleteEntry(42);
    expect(mockInvoke).toHaveBeenCalledWith('delete_entry', { id: 42 });
  });

  it('getAllEntryDates → get_all_entry_dates and passes the array through', async () => {
    mockInvoke.mockResolvedValue(['2024-01-01', '2024-01-02']);
    await expect(getAllEntryDates()).resolves.toEqual(['2024-01-01', '2024-01-02']);
    expect(mockInvoke).toHaveBeenCalledWith('get_all_entry_dates');
  });

  it('getTimelineEntries → get_timeline_entries and passes the entries through', async () => {
    const entries = [makeTimelineEntry()];
    mockInvoke.mockResolvedValue(entries);
    await expect(getTimelineEntries()).resolves.toEqual(entries);
    expect(mockInvoke).toHaveBeenCalledWith('get_timeline_entries');
  });

  it('setEntryLocked → set_entry_locked { id, locked }', async () => {
    await setEntryLocked(7, true);
    expect(mockInvoke).toHaveBeenCalledWith('set_entry_locked', { id: 7, locked: true });
  });

  it('getLockedEntryDates → get_locked_entry_dates and passes the array through', async () => {
    mockInvoke.mockResolvedValue(['2024-01-01']);
    await expect(getLockedEntryDates()).resolves.toEqual(['2024-01-01']);
    expect(mockInvoke).toHaveBeenCalledWith('get_locked_entry_dates');
  });

  it('recalculateWordCounts → recalculate_word_counts with no args, passes result through', async () => {
    const result = { scanned: 10, updated: 3, skipped_locked: 1 };
    mockInvoke.mockResolvedValue(result);
    await expect(recalculateWordCounts()).resolves.toEqual(result);
    expect(mockInvoke).toHaveBeenCalledWith('recalculate_word_counts');
  });
});
