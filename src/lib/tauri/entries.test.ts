import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { deleteEntry, getAllEntryDates, getTimelineEntries } from './entries';
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
});
