import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  getEntryImages,
  listJournalImageSummaries,
  getImageData,
  type ImageData,
  type ImageSummaryPage,
} from './images';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('images command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getEntryImages → get_entry_images { entryId } (camelCase) and passes images through', async () => {
    const images: ImageData[] = [{ id: 1, mime_type: 'image/png', data_base64: 'AAA' }];
    mockInvoke.mockResolvedValue(images);
    await expect(getEntryImages(7)).resolves.toEqual(images);
    expect(mockInvoke).toHaveBeenCalledWith('get_entry_images', { entryId: 7 });
  });

  it('listJournalImageSummaries → list_journal_image_summaries with the options object', async () => {
    const page: ImageSummaryPage = { items: [], has_more: false };
    mockInvoke.mockResolvedValue(page);
    await expect(
      listJournalImageSummaries({ limit: 10, offset: 20, sort: 'newest', month: '2024-01' }),
    ).resolves.toEqual(page);
    expect(mockInvoke).toHaveBeenCalledWith('list_journal_image_summaries', {
      limit: 10,
      offset: 20,
      sort: 'newest',
      month: '2024-01',
    });
  });

  it('listJournalImageSummaries defaults to an empty options object', async () => {
    mockInvoke.mockResolvedValue({ items: [], has_more: false });
    await listJournalImageSummaries();
    expect(mockInvoke).toHaveBeenCalledWith('list_journal_image_summaries', {});
  });

  it('getImageData → get_image_data { imageId } (camelCase) and passes the image through', async () => {
    const image: ImageData = { id: 3, mime_type: 'image/jpeg', data_base64: 'BBB' };
    mockInvoke.mockResolvedValue(image);
    await expect(getImageData(3)).resolves.toEqual(image);
    expect(mockInvoke).toHaveBeenCalledWith('get_image_data', { imageId: 3 });
  });
});
