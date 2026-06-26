import { invoke } from '@tauri-apps/api/core';

// Tag commands
export interface Tag {
  id: number;
  name: string;
  created_at: string;
}

export async function createTag(name: string): Promise<Tag> {
  return await invoke('create_tag', { name });
}

export async function getAllTags(): Promise<Tag[]> {
  return await invoke('get_all_tags');
}

export async function renameTag(id: number, name: string): Promise<void> {
  await invoke('rename_tag', { id, name });
}

export async function deleteTag(id: number): Promise<void> {
  await invoke('delete_tag', { id });
}

export async function addTagToEntry(entryId: number, tagId: number): Promise<void> {
  await invoke('add_tag_to_entry', { entryId, tagId });
}

export async function removeTagFromEntry(entryId: number, tagId: number): Promise<void> {
  await invoke('remove_tag_from_entry', { entryId, tagId });
}

export async function getTagsForEntry(entryId: number): Promise<Tag[]> {
  return await invoke('get_tags_for_entry', { entryId });
}

export async function getEntryDatesByTag(tagId: number): Promise<string[]> {
  return await invoke('get_entry_dates_by_tag', { tagId });
}
