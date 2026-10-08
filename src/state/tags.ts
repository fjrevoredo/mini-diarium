import { createSignal } from 'solid-js';
import { type Tag, getAllTags, getEntryDatesByTag } from '../lib/tauri';

const [allTags, setAllTags] = createSignal<Tag[]>([]);
const [activeTagFilter, setActiveTagFilterSignal] = createSignal<Tag | null>(null);
const [tagFilteredDates, setTagFilteredDates] = createSignal<string[] | null>(null);

export function resetTagsState(): void {
  setAllTags([]);
  setActiveTagFilterSignal(null);
  setTagFilteredDates(null);
}

export async function loadAllTags(): Promise<void> {
  const tags = await getAllTags();
  setAllTags(tags);
  const filter = activeTagFilter();
  if (filter) {
    const fresh = tags.find((t) => t.id === filter.id);
    setActiveTagFilterSignal(fresh ?? null);
  }
}

export async function setTagFilter(tag: Tag): Promise<void> {
  setActiveTagFilterSignal(tag);
  setTagFilteredDates(null);
  try {
    const dates = await getEntryDatesByTag(tag.id);
    setTagFilteredDates(dates);
  } catch {
    setActiveTagFilterSignal(null);
  }
}

/**
 * Re-fetches the dates of the active tag filter, for example after a tag was added to
 * or removed from an entry. No-op when no filter is active. The response is dropped if
 * the user changed or cleared the filter while it was in flight; on error the current
 * dates stay.
 */
export async function refreshTagFilter(): Promise<void> {
  const filter = activeTagFilter();
  if (!filter) return;
  try {
    const dates = await getEntryDatesByTag(filter.id);
    if (activeTagFilter()?.id === filter.id) setTagFilteredDates(dates);
  } catch {
    // Keep the current dates: a stale filter is better than a cleared one.
  }
}

export function clearTagFilter(): void {
  setActiveTagFilterSignal(null);
  setTagFilteredDates(null);
}

export { allTags, activeTagFilter, tagFilteredDates };
