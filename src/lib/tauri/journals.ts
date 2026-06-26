import { invoke } from '@tauri-apps/api/core';

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
