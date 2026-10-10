import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadAllTags,
  setTagFilter,
  activeTagFilter,
  resetTagsState,
  refreshTagFilter,
  tagFilteredDates,
  clearTagFilter,
  allTags,
} from './tags';
import type { Tag } from '../lib/tauri';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

describe('tags state — setTagFilter while the lookup is pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTagsState();
  });

  // Ctrl+[ / Ctrl+] read tagFilteredDates directly (day-navigation.ts), so a late reply
  // with no active filter would make day navigation skip real entry days.
  it('leaves the dates at null when the filter is cleared before the lookup resolves', async () => {
    const lookup = deferred<string[]>();
    mocks.getEntryDatesByTag.mockReturnValueOnce(lookup.promise);
    const pending = setTagFilter(WORK_TAG);

    clearTagFilter();
    lookup.resolve(['2026-01-01']);
    await pending;

    expect(activeTagFilter()).toBeNull();
    expect(tagFilteredDates()).toBeNull();
  });

  it('leaves the dates at null when the session resets before the lookup resolves', async () => {
    const lookup = deferred<string[]>();
    mocks.getEntryDatesByTag.mockReturnValueOnce(lookup.promise);
    const pending = setTagFilter(WORK_TAG);

    resetTagsState();
    lookup.resolve(['2026-01-01']);
    await pending;

    expect(activeTagFilter()).toBeNull();
    expect(tagFilteredDates()).toBeNull();
  });

  it('keeps the newer filter when an older lookup fails late', async () => {
    const TRAVEL_TAG: Tag = { id: 2, name: 'Travel', created_at: '2026-01-01T00:00:00Z' };
    const older = deferred<string[]>();
    mocks.getEntryDatesByTag.mockReturnValueOnce(older.promise);
    const pending = setTagFilter(WORK_TAG);

    mocks.getEntryDatesByTag.mockResolvedValueOnce(['2026-03-01']);
    await setTagFilter(TRAVEL_TAG);
    older.reject(new Error('boom'));
    await pending;

    expect(activeTagFilter()?.id).toBe(TRAVEL_TAG.id);
    expect(tagFilteredDates()).toEqual(['2026-03-01']);
  });

  it('clears the filter when a refresh that replaced the first lookup fails', async () => {
    const lookup = deferred<string[]>();
    const refresh = deferred<string[]>();
    mocks.getEntryDatesByTag
      .mockReturnValueOnce(lookup.promise)
      .mockReturnValueOnce(refresh.promise);
    const pendingSet = setTagFilter(WORK_TAG);
    const pendingRefresh = refreshTagFilter();

    refresh.reject(new Error('boom'));
    await pendingRefresh;
    expect(activeTagFilter()).toBeNull();
    expect(tagFilteredDates()).toBeNull();

    lookup.resolve(['2026-01-01']); // the old reply must not revive the cleared filter
    await pendingSet;
    expect(activeTagFilter()).toBeNull();
    expect(tagFilteredDates()).toBeNull();
  });

  it('cancels a pending lookup when a tag-list reload finds the filtered tag deleted', async () => {
    const lookup = deferred<string[]>();
    mocks.getEntryDatesByTag.mockReturnValueOnce(lookup.promise);
    const pending = setTagFilter(WORK_TAG);

    mocks.getAllTags.mockResolvedValueOnce([]);
    await loadAllTags();
    lookup.resolve(['2026-01-01']);
    await pending;

    expect(activeTagFilter()).toBeNull();
    expect(tagFilteredDates()).toBeNull();
  });

  it('keeps a pending lookup valid when a tag-list reload only renames the filtered tag', async () => {
    const lookup = deferred<string[]>();
    mocks.getEntryDatesByTag.mockReturnValueOnce(lookup.promise);
    const pending = setTagFilter(WORK_TAG);

    mocks.getAllTags.mockResolvedValueOnce([CAREER_TAG]);
    await loadAllTags();
    lookup.resolve(['2026-01-01']);
    await pending;

    expect(activeTagFilter()?.name).toBe('Career');
    expect(tagFilteredDates()).toEqual(['2026-01-01']);
  });
});

describe('tags state — loadAllTags across a session reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTagsState();
  });

  it('drops a tag list that arrives after a session reset', async () => {
    const list = deferred<Tag[]>();
    mocks.getAllTags.mockReturnValueOnce(list.promise);
    const pending = loadAllTags();

    resetTagsState();
    list.resolve([WORK_TAG]);
    await pending;

    expect(allTags()).toEqual([]);
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

  it('drops an older re-fetch that resolves after a newer one', async () => {
    mocks.getEntryDatesByTag.mockResolvedValue(['2026-01-01']);
    await setTagFilter(WORK_TAG);

    const older = deferred<string[]>();
    mocks.getEntryDatesByTag.mockReturnValueOnce(older.promise);
    const pending = refreshTagFilter();

    mocks.getEntryDatesByTag.mockResolvedValueOnce(['2026-01-01', '2026-02-01']);
    await refreshTagFilter();
    older.resolve(['2026-01-01']);
    await pending;

    expect(tagFilteredDates()).toEqual(['2026-01-01', '2026-02-01']);
  });

  it('drops a re-fetch that outlives a session reset, even for the same tag id', async () => {
    mocks.getEntryDatesByTag.mockResolvedValue(['2026-01-01']);
    await setTagFilter(WORK_TAG);

    const stale = deferred<string[]>();
    mocks.getEntryDatesByTag.mockReturnValueOnce(stale.promise);
    const pending = refreshTagFilter();

    resetTagsState(); // lock + journal switch; the new journal also has a tag with id 1
    mocks.getEntryDatesByTag.mockResolvedValueOnce(['2027-05-05']);
    await setTagFilter(WORK_TAG);
    stale.resolve(['2026-01-01']);
    await pending;

    expect(tagFilteredDates()).toEqual(['2027-05-05']);
  });

  it('ignores a late refresh failure after a newer filter succeeded', async () => {
    mocks.getEntryDatesByTag.mockResolvedValue(['2026-01-01']);
    await setTagFilter(WORK_TAG);

    const stale = deferred<string[]>();
    mocks.getEntryDatesByTag.mockReturnValueOnce(stale.promise);
    const pending = refreshTagFilter();

    mocks.getEntryDatesByTag.mockResolvedValueOnce(['2026-03-01']);
    await setTagFilter(TRAVEL_TAG);
    stale.reject(new Error('boom'));
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
