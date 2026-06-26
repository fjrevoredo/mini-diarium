import { invoke } from '@tauri-apps/api/core';

// Entry commands
export interface EntryMetadata {
  fontFamily?: string | null;
  fontSize?: number | null;
}

export interface DiaryEntry {
  id: number;
  date: string;
  title: string;
  text: string;
  word_count: number;
  date_created: string;
  date_updated: string;
  metadata?: EntryMetadata | null;
}

export async function createEntry(date: string): Promise<DiaryEntry> {
  return await invoke('create_entry', { date });
}

export async function saveEntry(
  id: number,
  title: string,
  text: string,
  metadata?: EntryMetadata | null,
): Promise<void> {
  await invoke('save_entry', { id, title, text, metadata: metadata ?? null });
}

export async function getEntriesForDate(date: string): Promise<DiaryEntry[]> {
  return await invoke('get_entries_for_date', { date });
}

export async function deleteEntryIfEmpty(
  id: number,
  title: string,
  text: string,
): Promise<boolean> {
  return await invoke('delete_entry_if_empty', { id, title, text });
}

export async function deleteEntry(id: number): Promise<void> {
  return invoke('delete_entry', { id });
}

export async function getAllEntryDates(): Promise<string[]> {
  return await invoke('get_all_entry_dates');
}

// Timeline view — lightweight list of all entries (date, title, short preview).
// The full decrypted text never crosses this boundary; preview is built in Rust.
export interface TimelineEntry {
  id: number;
  date: string;
  title: string;
  preview: string;
}

export async function getTimelineEntries(): Promise<TimelineEntry[]> {
  return await invoke('get_timeline_entries');
}
