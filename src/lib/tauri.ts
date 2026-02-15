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

// Navigation commands
export async function navigatePreviousDay(currentDate: string): Promise<string> {
  return await invoke('navigate_previous_day', { current_date: currentDate });
}

export async function navigateNextDay(currentDate: string): Promise<string> {
  return await invoke('navigate_next_day', { current_date: currentDate });
}

export async function navigateToToday(): Promise<string> {
  return await invoke('navigate_to_today');
}

export async function navigatePreviousMonth(currentDate: string): Promise<string> {
  return await invoke('navigate_previous_month', { current_date: currentDate });
}

export async function navigateNextMonth(currentDate: string): Promise<string> {
  return await invoke('navigate_next_month', { current_date: currentDate });
}

// Statistics commands
export interface Statistics {
  total_entries: number;
  entries_per_week: number;
  best_streak: number;
  current_streak: number;
  total_words: number;
  avg_words_per_entry: number;
}

export async function getStatistics(): Promise<Statistics> {
  return await invoke('get_statistics');
}

// Import commands
export interface ImportResult {
  entries_imported: number;
  entries_merged: number;
  entries_skipped: number;
}

export async function importMiniDiaryJson(filePath: string): Promise<ImportResult> {
  return await invoke('import_minidiary_json', { filePath });
}

export async function importDayOneJson(filePath: string): Promise<ImportResult> {
  return await invoke('import_dayone_json', { filePath });
}

export async function importDayOneTxt(filePath: string): Promise<ImportResult> {
  return await invoke('import_dayone_txt', { filePath });
}

export async function importJrnlJson(filePath: string): Promise<ImportResult> {
  return await invoke('import_jrnl_json', { filePath });
}

// Export commands
export interface ExportResult {
  entries_exported: number;
  file_path: string;
}

export async function exportJson(filePath: string): Promise<ExportResult> {
  return await invoke('export_json', { filePath });
}
