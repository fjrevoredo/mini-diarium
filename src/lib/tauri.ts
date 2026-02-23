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

export async function getDiaryPath(): Promise<string> {
  return await invoke('get_diary_path');
}

export async function changeDiaryDirectory(newDir: string): Promise<void> {
  await invoke('change_diary_directory', { newDir });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await invoke('change_password', { oldPassword, newPassword });
}

export async function resetDiary(): Promise<void> {
  await invoke('reset_diary');
}

export async function unlockDiaryWithKeypair(keyPath: string): Promise<void> {
  await invoke('unlock_diary_with_keypair', { keyPath });
}

export async function verifyPassword(password: string): Promise<void> {
  await invoke('verify_password', { password });
}

// Auth method management
export interface AuthMethodInfo {
  id: number;
  slot_type: string;
  label: string;
  public_key_hex: string | null;
  created_at: string;
  last_used: string | null;
}

export interface KeypairFiles {
  public_key_hex: string;
  private_key_hex: string;
}

export async function listAuthMethods(): Promise<AuthMethodInfo[]> {
  return await invoke('list_auth_methods');
}

export async function generateKeypair(): Promise<KeypairFiles> {
  return await invoke('generate_keypair');
}

export async function writeKeyFile(path: string, privateKeyHex: string): Promise<void> {
  await invoke('write_key_file', { path, privateKeyHex });
}

export async function registerKeypair(
  currentPassword: string,
  publicKeyHex: string,
  label: string,
): Promise<void> {
  await invoke('register_keypair', { currentPassword, publicKeyHex, label });
}

export async function registerPassword(newPassword: string): Promise<void> {
  await invoke('register_password', { newPassword });
}

export async function removeAuthMethod(slotId: number, currentPassword: string): Promise<void> {
  await invoke('remove_auth_method', { slotId, currentPassword });
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
  return await invoke('navigate_previous_day', { currentDate });
}

export async function navigateNextDay(currentDate: string): Promise<string> {
  return await invoke('navigate_next_day', { currentDate });
}

export async function navigateToToday(): Promise<string> {
  return await invoke('navigate_to_today');
}

export async function navigatePreviousMonth(currentDate: string): Promise<string> {
  return await invoke('navigate_previous_month', { currentDate });
}

export async function navigateNextMonth(currentDate: string): Promise<string> {
  return await invoke('navigate_next_month', { currentDate });
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

export async function exportMarkdown(filePath: string): Promise<ExportResult> {
  return await invoke('export_markdown', { filePath });
}

// Plugin commands
export interface PluginInfo {
  id: string;
  name: string;
  file_extensions: string[];
  builtin: boolean;
}

export async function listImportPlugins(): Promise<PluginInfo[]> {
  return await invoke('list_import_plugins');
}

export async function listExportPlugins(): Promise<PluginInfo[]> {
  return await invoke('list_export_plugins');
}

export async function runImportPlugin(pluginId: string, filePath: string): Promise<ImportResult> {
  return await invoke('run_import_plugin', { pluginId, filePath });
}

export async function runExportPlugin(pluginId: string, filePath: string): Promise<ExportResult> {
  return await invoke('run_export_plugin', { pluginId, filePath });
}
