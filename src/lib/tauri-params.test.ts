import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  navigatePreviousDay,
  navigateNextDay,
  navigatePreviousMonth,
  navigateNextMonth,
  createEntry,
  saveEntry,
  getEntriesForDate,
  deleteEntryIfEmpty,
  type DiaryEntry,
} from './tauri';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

/**
 * Tests to verify Tauri command parameter names are correct
 *
 * BUG: Frontend was passing snake_case parameter names (current_date)
 * but Tauri v2 expects camelCase parameter names (currentDate)
 */
describe('Tauri Navigation Parameter Names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigatePreviousDay should pass currentDate parameter (camelCase)', async () => {
    mockInvoke.mockResolvedValue('2024-01-14');

    await navigatePreviousDay('2024-01-15');

    // Should call with camelCase parameter name
    expect(mockInvoke).toHaveBeenCalledWith('navigate_previous_day', {
      currentDate: '2024-01-15',
    });
  });

  it('navigateNextDay should pass currentDate parameter (camelCase)', async () => {
    mockInvoke.mockResolvedValue('2024-01-16');

    await navigateNextDay('2024-01-15');

    expect(mockInvoke).toHaveBeenCalledWith('navigate_next_day', {
      currentDate: '2024-01-15',
    });
  });

  it('navigatePreviousMonth should pass currentDate parameter (camelCase)', async () => {
    mockInvoke.mockResolvedValue('2023-12-15');

    await navigatePreviousMonth('2024-01-15');

    expect(mockInvoke).toHaveBeenCalledWith('navigate_previous_month', {
      currentDate: '2024-01-15',
    });
  });

  it('navigateNextMonth should pass currentDate parameter (camelCase)', async () => {
    mockInvoke.mockResolvedValue('2024-02-15');

    await navigateNextMonth('2024-01-15');

    expect(mockInvoke).toHaveBeenCalledWith('navigate_next_month', {
      currentDate: '2024-01-15',
    });
  });
});

describe('Tauri Entry Command Parameter Names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createEntry should pass date parameter', async () => {
    const mockEntry: DiaryEntry = {
      id: 1,
      date: '2024-01-15',
      title: '',
      text: '',
      word_count: 0,
      date_created: '2024-01-15T00:00:00Z',
      date_updated: '2024-01-15T00:00:00Z',
    };
    mockInvoke.mockResolvedValue(mockEntry);

    await createEntry('2024-01-15');

    expect(mockInvoke).toHaveBeenCalledWith('create_entry', {
      date: '2024-01-15',
    });
  });

  it('saveEntry should pass id, title, text parameters (id-based, not date-based)', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await saveEntry(42, 'My Title', '<p>Content</p>');

    expect(mockInvoke).toHaveBeenCalledWith('save_entry', {
      id: 42,
      title: 'My Title',
      text: '<p>Content</p>',
    });
  });

  it('getEntriesForDate should pass date parameter', async () => {
    mockInvoke.mockResolvedValue([]);

    await getEntriesForDate('2024-01-15');

    expect(mockInvoke).toHaveBeenCalledWith('get_entries_for_date', {
      date: '2024-01-15',
    });
  });

  it('deleteEntryIfEmpty should pass id, title, text parameters (id-based, not date-based)', async () => {
    mockInvoke.mockResolvedValue(false);

    await deleteEntryIfEmpty(7, '', '');

    expect(mockInvoke).toHaveBeenCalledWith('delete_entry_if_empty', {
      id: 7,
      title: '',
      text: '',
    });
  });
});
