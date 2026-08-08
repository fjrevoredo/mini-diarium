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

/**
 * A ready-to-use folder for a new journal, created by the backend if it does not exist yet.
 * Lets the picker pre-fill the location so creating a journal never needs the folder chooser.
 */
export async function getDefaultJournalDir(): Promise<string> {
  return await invoke('get_default_journal_dir');
}

/**
 * Allocates a folder of its own for a new journal under `base`, and creates it.
 *
 * Only the pre-filled default location goes through this. Every journal uses the same
 * `diary.db` filename, so creating two of them in one folder would register two entries
 * pointing at a single database. A folder the user browsed to keeps its existing meaning —
 * the journal is created directly there.
 */
export async function prepareJournalDir(base: string, name: string): Promise<string> {
  return await invoke('prepare_journal_dir', { base, name });
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
