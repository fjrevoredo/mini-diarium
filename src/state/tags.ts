import { createSignal } from 'solid-js';
import { type Tag, getAllTags } from '../lib/tauri';

const [allTags, setAllTags] = createSignal<Tag[]>([]);

export function resetTagsState(): void {
  setAllTags([]);
}

export async function loadAllTags(): Promise<void> {
  const tags = await getAllTags();
  setAllTags(tags);
}

export { allTags };
