import { invoke } from '@tauri-apps/api/core';

// Authentication commands
export async function createDiary(password: string): Promise<void> {
  await invoke('create_diary', { password });
}

export async function unlockDiary(password: string): Promise<void> {
  await invoke('unlock_diary', { password });
}

export async function lockDiary(): Promise<void> {
  await invoke('lock_diary');
}

export async function diaryExists(): Promise<boolean> {
  return await invoke('diary_exists');
}

export async function isDiaryUnlocked(): Promise<boolean> {
  return await invoke('is_diary_unlocked');
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await invoke('change_password', { oldPassword, newPassword });
}

export async function resetDiary(): Promise<void> {
  await invoke('reset_diary');
}

// Entry commands
export interface DiaryEntry {
  date: string;
  title: string;
  text: string;
  word_count: number;
  date_created: string;
  date_updated: string;
}

export async function saveEntry(date: string, title: string, text: string): Promise<void> {
  await invoke('save_entry', { date, title, text });
}

export async function getEntry(date: string): Promise<DiaryEntry | null> {
  return await invoke('get_entry', { date });
}

export async function deleteEntryIfEmpty(
  date: string,
  title: string,
  text: string,
): Promise<boolean> {
  return await invoke('delete_entry_if_empty', { date, title, text });
}

export async function getAllEntryDates(): Promise<string[]> {
  return await invoke('get_all_entry_dates');
}

// Search commands
export interface SearchResult {
  date: string;
  title: string;
  snippet: string;
}

export async function searchEntries(query: string): Promise<SearchResult[]> {
  return await invoke('search_entries', { query });
}
