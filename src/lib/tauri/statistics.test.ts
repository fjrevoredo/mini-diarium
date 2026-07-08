import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { getStatistics, type Statistics } from './statistics';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('statistics command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getStatistics → get_statistics and passes the stats through', async () => {
    const stats: Statistics = {
      total_entries: 10,
      entries_per_week: 2,
      best_streak: 5,
      current_streak: 3,
      total_words: 1000,
      avg_words_per_entry: 100,
    };
    mockInvoke.mockResolvedValue(stats);
    await expect(getStatistics()).resolves.toEqual(stats);
    expect(mockInvoke).toHaveBeenCalledWith('get_statistics');
  });
});
