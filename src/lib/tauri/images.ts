import { invoke } from '@tauri-apps/api/core';

// Image commands
export interface ImageData {
  id: number;
  mime_type: string;
  data_base64: string;
}

export interface ImageSummary {
  id: number;
  mime_type: string;
  created_at: string;
  thumbnail_mime_type: string | null;
  thumbnail_data_base64: string | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  usage_count: number;
  first_entry_date: string | null;
  latest_entry_date: string | null;
}

export interface ImageSummaryPage {
  items: ImageSummary[];
  has_more: boolean;
}

export type ImageSummarySort = 'newest' | 'oldest' | 'most_used';

export interface ListJournalImageSummariesOptions extends Record<string, unknown> {
  limit?: number;
  offset?: number;
  sort?: ImageSummarySort;
  month?: string | null;
}

export async function getEntryImages(entryId: number): Promise<ImageData[]> {
  return await invoke<ImageData[]>('get_entry_images', { entryId });
}

export async function listJournalImageSummaries(
  options: ListJournalImageSummariesOptions = {},
): Promise<ImageSummaryPage> {
  return await invoke<ImageSummaryPage>('list_journal_image_summaries', options);
}

export async function getImageData(imageId: number): Promise<ImageData> {
  return await invoke<ImageData>('get_image_data', { imageId });
}
