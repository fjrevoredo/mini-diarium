import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadAllTags, setTagFilter, activeTagFilter, resetTagsState } from './tags';
import type { Tag } from '../lib/tauri';

const mocks = vi.hoisted(() => ({
  getAllTags: vi.fn(),
  getEntryDatesByTag: vi.fn(),
}));

vi.mock('../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../lib/tauri')>('../lib/tauri');
  return {
    ...actual,
    getAllTags: mocks.getAllTags,
    getEntryDatesByTag: mocks.getEntryDatesByTag,
  };
});

const WORK_TAG: Tag = { id: 1, name: 'Work', created_at: '2026-01-01T00:00:00Z' };
const CAREER_TAG: Tag = { id: 1, name: 'Career', created_at: '2026-01-01T00:00:00Z' };

describe('tags state — loadAllTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTagsState();
  });

  it('refreshes activeTagFilter name after a tag is renamed', async () => {
    mocks.getAllTags.mockResolvedValue([WORK_TAG]);
    mocks.getEntryDatesByTag.mockResolvedValue([]);

    await setTagFilter(WORK_TAG);
    expect(activeTagFilter()?.name).toBe('Work');

    // Simulate rename: getAllTags now returns the new name
    mocks.getAllTags.mockResolvedValue([CAREER_TAG]);
    await loadAllTags();

    // RED before fix: still 'Work'. GREEN after fix: 'Career'.
    expect(activeTagFilter()?.name).toBe('Career');
  });

  it('clears activeTagFilter when the filtered tag is deleted', async () => {
    mocks.getAllTags.mockResolvedValue([WORK_TAG]);
    mocks.getEntryDatesByTag.mockResolvedValue([]);

    await setTagFilter(WORK_TAG);
    expect(activeTagFilter()).not.toBeNull();

    // Simulate delete: getAllTags returns empty list
    mocks.getAllTags.mockResolvedValue([]);
    await loadAllTags();

    // RED before fix: still holds old tag. GREEN after fix: null.
    expect(activeTagFilter()).toBeNull();
  });
});
