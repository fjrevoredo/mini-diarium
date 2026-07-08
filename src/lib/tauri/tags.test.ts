import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  createTag,
  getAllTags,
  renameTag,
  deleteTag,
  addTagToEntry,
  removeTagFromEntry,
  getTagsForEntry,
  getEntryDatesByTag,
} from './tags';
import { makeTag } from '../../test/fixtures';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

const TAG = makeTag();

describe('tags command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('createTag → create_tag { name } and passes the tag through', async () => {
    mockInvoke.mockResolvedValue(TAG);
    await expect(createTag('work')).resolves.toEqual(TAG);
    expect(mockInvoke).toHaveBeenCalledWith('create_tag', { name: 'work' });
  });

  it('getAllTags → get_all_tags and passes the array through', async () => {
    mockInvoke.mockResolvedValue([TAG]);
    await expect(getAllTags()).resolves.toEqual([TAG]);
    expect(mockInvoke).toHaveBeenCalledWith('get_all_tags');
  });

  it('renameTag → rename_tag { id, name }', async () => {
    await renameTag(1, 'personal');
    expect(mockInvoke).toHaveBeenCalledWith('rename_tag', { id: 1, name: 'personal' });
  });

  it('deleteTag → delete_tag { id }', async () => {
    await deleteTag(1);
    expect(mockInvoke).toHaveBeenCalledWith('delete_tag', { id: 1 });
  });

  it('addTagToEntry → add_tag_to_entry { entryId, tagId } (camelCase)', async () => {
    await addTagToEntry(5, 9);
    expect(mockInvoke).toHaveBeenCalledWith('add_tag_to_entry', { entryId: 5, tagId: 9 });
  });

  it('removeTagFromEntry → remove_tag_from_entry { entryId, tagId } (camelCase)', async () => {
    await removeTagFromEntry(5, 9);
    expect(mockInvoke).toHaveBeenCalledWith('remove_tag_from_entry', { entryId: 5, tagId: 9 });
  });

  it('getTagsForEntry → get_tags_for_entry { entryId } and passes tags through', async () => {
    mockInvoke.mockResolvedValue([TAG]);
    await expect(getTagsForEntry(5)).resolves.toEqual([TAG]);
    expect(mockInvoke).toHaveBeenCalledWith('get_tags_for_entry', { entryId: 5 });
  });

  it('getEntryDatesByTag → get_entry_dates_by_tag { tagId } and passes dates through', async () => {
    mockInvoke.mockResolvedValue(['2024-01-01']);
    await expect(getEntryDatesByTag(9)).resolves.toEqual(['2024-01-01']);
    expect(mockInvoke).toHaveBeenCalledWith('get_entry_dates_by_tag', { tagId: 9 });
  });
});
