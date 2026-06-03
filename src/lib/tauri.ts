import { invoke } from '@tauri-apps/api/core';

// Authentication commands
export async function createJournal(password: string): Promise<void> {
  await invoke('create_diary', { password });
}

export async function unlockJournal(password: string): Promise<void> {
  await invoke('unlock_diary', { password });
}

export async function lockJournal(): Promise<void> {
  await invoke('lock_diary');
}

export async function journalExists(): Promise<boolean> {
  return await invoke('diary_exists');
}

export async function checkJournalPath(path: string): Promise<boolean> {
  return invoke<boolean>('check_diary_path', { path });
}

export async function isJournalUnlocked(): Promise<boolean> {
  return await invoke('is_diary_unlocked');
}

export async function getJournalPath(): Promise<string> {
  return await invoke('get_diary_path');
}

export async function changeJournalDirectory(newDir: string): Promise<void> {
  await invoke('change_diary_directory', { newDir });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await invoke('change_password', { oldPassword, newPassword });
}

export async function resetJournal(): Promise<void> {
  await invoke('reset_diary');
}

export async function unlockJournalWithKeypair(keyPath: string): Promise<void> {
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

export interface AuthSlotPeek {
  id: number;
  slot_type: string;
  label: string;
}

export interface JournalPeek {
  slots: AuthSlotPeek[];
  require_all_auth: boolean;
}

export async function peekAuthSlotTypes(): Promise<JournalPeek> {
  return await invoke('peek_auth_slot_types');
}

export interface KeypairFiles {
  public_key_hex: string;
  private_key_hex: string;
}

export type MultiAuthCredential =
  | { type: 'password'; value: string }
  | { type: 'keypair'; key_path: string };

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
  currentPassword: string | null,
  publicKeyHex: string,
  label: string,
): Promise<void> {
  await invoke('register_keypair', { currentPassword, publicKeyHex, label });
}

export async function registerPassword(newPassword: string): Promise<void> {
  await invoke('register_password', { newPassword });
}

export async function removeAuthMethod(
  slotId: number,
  currentPassword: string | null,
): Promise<void> {
  await invoke('remove_auth_method', { slotId, currentPassword });
}

export async function unlockJournalAllMethods(credentials: MultiAuthCredential[]): Promise<void> {
  await invoke('unlock_diary_all_methods', { credentials });
}

export async function setRequireAllAuth(enabled: boolean): Promise<void> {
  await invoke('set_require_all_auth', { enabled });
}

export async function createJournalAuto(): Promise<void> {
  await invoke('create_diary_auto');
}

export async function unlockJournalAuto(): Promise<void> {
  await invoke('unlock_diary_auto');
}

// Journal commands
export interface JournalConfig {
  id: string;
  name: string;
  path: string;
  auto_protected: boolean; // true if journal uses local key (no password)
  require_all_auth: boolean;
  db_filename: string; // e.g. "diary.db"; always populated
}

export async function listJournals(): Promise<JournalConfig[]> {
  return await invoke('list_journals');
}

export async function getActiveJournalId(): Promise<string | null> {
  return await invoke('get_active_journal_id');
}

export async function addJournal(
  name: string,
  path: string,
  dbFilename?: string,
): Promise<JournalConfig> {
  return await invoke('add_journal', { name, path, dbFilename });
}

export async function removeJournal(id: string): Promise<void> {
  await invoke('remove_journal', { id });
}

export async function renameJournal(id: string, name: string): Promise<void> {
  await invoke('rename_journal', { id, name });
}

export async function switchJournal(id: string): Promise<void> {
  await invoke('switch_journal', { id });
}

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
  entries_skipped: number;
}

// Export commands
export interface ExportResult {
  entries_exported: number;
  file_path: string;
}

export interface ExportOptions {
  dateFrom?: string;
  dateTo?: string;
}

export async function exportJson(filePath: string, options?: ExportOptions): Promise<ExportResult> {
  return await invoke('export_json', { filePath, ...options });
}

export async function exportMarkdown(
  filePath: string,
  options?: ExportOptions,
): Promise<ExportResult> {
  return await invoke('export_markdown', { filePath, ...options });
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

export async function runExportPlugin(
  pluginId: string,
  filePath: string,
  options?: ExportOptions,
): Promise<ExportResult> {
  return await invoke('run_export_plugin', { pluginId, filePath, ...options });
}

// File utility commands
export async function readFileBytes(path: string): Promise<number[]> {
  return await invoke('read_file_bytes', { path });
}

export async function readTextFile(path: string): Promise<string> {
  return await invoke('read_text_file', { path });
}

// Debug commands
export interface DebugDumpResult {
  file_path: string;
  generated_at: string;
}

export async function generateDebugDump(
  filePath: string,
  preferencesJson: string,
): Promise<DebugDumpResult> {
  return await invoke<DebugDumpResult>('generate_debug_dump', { filePath, preferencesJson });
}

// Menu commands
export async function updateMenuLocale(locale: string): Promise<void> {
  await invoke('update_menu_locale', { locale });
}

// Font commands
export async function listBundledFonts(): Promise<string[]> {
  return await invoke('list_bundled_fonts');
}

export interface FontFaceData {
  family: string;
  regular: string;
  bold: string;
  bold_synthesized: boolean;
}

export interface CustomFontSummary {
  family: string;
  has_regular: boolean;
  has_bold: boolean;
}

export async function getFontData(family: string): Promise<FontFaceData> {
  return await invoke('get_font_data', { family });
}

export async function listCustomFonts(): Promise<CustomFontSummary[]> {
  return await invoke('list_custom_fonts');
}

export async function importCustomFont(
  family: string,
  weight: string,
  path: string,
): Promise<void> {
  await invoke('import_custom_font', { family, weight, path });
}

export async function deleteCustomFontFamily(family: string): Promise<void> {
  await invoke('delete_custom_font_family', { family });
}

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

export interface ImageData {
  id: number;
  mime_type: string;
  data_base64: string;
}

export async function getEntryImages(entryId: number): Promise<ImageData[]> {
  return await invoke<ImageData[]>('get_entry_images', { entryId });
}

export async function listJournalImages(): Promise<ImageData[]> {
  return await invoke<ImageData[]>('list_journal_images');
}
