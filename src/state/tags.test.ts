import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadAllTags,
  setTagFilter,
  activeTagFilter,
  resetTagsState,
  refreshTagFilter,
  tagFilteredDates,
} from './tags';
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

describe('tags state — refreshTagFilter', () => {
  const TRAVEL_TAG: Tag = { id: 2, name: 'Travel', created_at: '2026-01-01T00:00:00Z' };

  beforeEach(() => {
    vi.clearAllMocks();
    resetTagsState();
  });

  it('re-fetches the dates of the active filter', async () => {
    mocks.getEntryDatesByTag.mockResolvedValue(['2026-01-01']);
    await setTagFilter(WORK_TAG);

    mocks.getEntryDatesByTag.mockResolvedValue(['2026-01-01', '2026-02-01']);
    await refreshTagFilter();

    expect(mocks.getEntryDatesByTag).toHaveBeenLastCalledWith(WORK_TAG.id);
    expect(tagFilteredDates()).toEqual(['2026-01-01', '2026-02-01']);
  });

  it('does nothing when no filter is active', async () => {
    await refreshTagFilter();

    expect(mocks.getEntryDatesByTag).not.toHaveBeenCalled();
    expect(tagFilteredDates()).toBeNull();
  });

  it('drops the response when the filter changed while it was in flight', async () => {
    mocks.getEntryDatesByTag.mockResolvedValue(['2026-01-01']);
    await setTagFilter(WORK_TAG);

    let resolveStale: (dates: string[]) => void = () => {};
    mocks.getEntryDatesByTag.mockReturnValueOnce(
      new Promise<string[]>((resolve) => {
        resolveStale = resolve;
      }),
    );
    const pending = refreshTagFilter();

    mocks.getEntryDatesByTag.mockResolvedValue(['2026-03-01']);
    await setTagFilter(TRAVEL_TAG);
    resolveStale(['2026-01-01', '2026-02-01']);
    await pending;

    expect(activeTagFilter()?.id).toBe(TRAVEL_TAG.id);
    expect(tagFilteredDates()).toEqual(['2026-03-01']);
  });

  it('keeps the current dates when the re-fetch fails', async () => {
    mocks.getEntryDatesByTag.mockResolvedValue(['2026-01-01']);
    await setTagFilter(WORK_TAG);

    mocks.getEntryDatesByTag.mockRejectedValue(new Error('boom'));
    await refreshTagFilter();

    expect(activeTagFilter()?.id).toBe(WORK_TAG.id);
    expect(tagFilteredDates()).toEqual(['2026-01-01']);
  });
});
