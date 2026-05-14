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

export function clearTagFilter(): void {
  setActiveTagFilterSignal(null);
  setTagFilteredDates(null);
}

export { allTags, activeTagFilter, tagFilteredDates };
