import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { searchEntries, type SearchResponse } from './search';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('search command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searchEntries → search_entries { query } and passes the response through', async () => {
    const response: SearchResponse = {
      results: [{ id: 1, date: '2024-01-01', title: 'T', snippet: 'S' }],
      totalMatches: 1,
    };
    mockInvoke.mockResolvedValue(response);
    await expect(searchEntries('hello')).resolves.toEqual(response);
    expect(mockInvoke).toHaveBeenCalledWith('search_entries', { query: 'hello' });
  });
});
