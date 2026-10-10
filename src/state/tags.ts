import { createSignal } from 'solid-js';
import { type Tag, getAllTags, getEntryDatesByTag } from '../lib/tauri';

const [allTags, setAllTags] = createSignal<Tag[]>([]);
const [activeTagFilter, setActiveTagFilterSignal] = createSignal<Tag | null>(null);
const [tagFilteredDates, setTagFilteredDates] = createSignal<string[] | null>(null);

// Bumped by every filter request, by clearTagFilter(), and by a session reset. A dates
// lookup writes its reply only while the token it took is still the current one, so a
// cleared filter stays cleared and an older request never overwrites a newer one.
let filterToken = 0;
// Bumped by a session reset only, so a tag-list reply from the previous session is dropped.
let sessionToken = 0;

export function resetTagsState(): void {
  sessionToken++;
  filterToken++;
  setAllTags([]);
  setActiveTagFilterSignal(null);
  setTagFilteredDates(null);
}

/**
 * Reloads the tag list. A rename of the filtered tag updates the filter in place; a
 * deleted filtered tag clears the filter, which also cancels its pending dates lookup.
 */
export async function loadAllTags(): Promise<void> {
  const session = sessionToken;
  const tags = await getAllTags();
  if (session !== sessionToken) return;
  setAllTags(tags);
  const filter = activeTagFilter();
  if (filter) {
    const fresh = tags.find((t) => t.id === filter.id);
    if (fresh) setActiveTagFilterSignal(fresh);
    else clearTagFilter();
  }
}

export async function setTagFilter(tag: Tag): Promise<void> {
  const token = ++filterToken;
  setActiveTagFilterSignal(tag);
  setTagFilteredDates(null);
  try {
    const dates = await getEntryDatesByTag(tag.id);
    if (token !== filterToken) return;
    setTagFilteredDates(dates);
  } catch {
    if (token === filterToken) clearTagFilter();
  }
}

/**
 * Re-fetches the dates of the active tag filter, for example after a tag was added to
 * or removed from an entry. No-op when no filter is active. The response is dropped if
 * the filter was changed, cleared, reset, or re-fetched again while it was in flight.
 *
 * On error the current dates stay. If there are none yet (the refresh replaced the
 * filter's first lookup), the filter is cleared: an active filter without dates would
 * filter the Timeline but not the Calendar or day navigation.
 */
export async function refreshTagFilter(): Promise<void> {
  const filter = activeTagFilter();
  if (!filter) return;
  const token = ++filterToken;
  try {
    const dates = await getEntryDatesByTag(filter.id);
    if (token === filterToken) setTagFilteredDates(dates);
  } catch {
    if (token === filterToken && tagFilteredDates() === null) clearTagFilter();
  }
}

export function clearTagFilter(): void {
  filterToken++;
  setActiveTagFilterSignal(null);
  setTagFilteredDates(null);
}

export { allTags, activeTagFilter, tagFilteredDates };
