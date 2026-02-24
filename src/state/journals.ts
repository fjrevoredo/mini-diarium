import { createSignal } from 'solid-js';
import * as tauri from '../lib/tauri';

const [journals, setJournals] = createSignal<tauri.JournalConfig[]>([]);
const [activeJournalId, setActiveJournalId] = createSignal<string | null>(null);
const [isSwitching, setIsSwitching] = createSignal(false);

export async function loadJournals(): Promise<void> {
  const [list, activeId] = await Promise.all([tauri.listJournals(), tauri.getActiveJournalId()]);
  setJournals(list);
  setActiveJournalId(activeId);
}

export async function switchJournal(id: string): Promise<void> {
  if (isSwitching()) return;
  setIsSwitching(true);
  try {
    await tauri.switchJournal(id);
    setActiveJournalId(id);
  } finally {
    setIsSwitching(false);
  }
}

export async function addJournal(name: string, path: string): Promise<tauri.JournalConfig> {
  const journal = await tauri.addJournal(name, path);
  await loadJournals();
  return journal;
}

export async function removeJournal(id: string): Promise<void> {
  await tauri.removeJournal(id);
  await loadJournals();
}

export async function renameJournal(id: string, name: string): Promise<void> {
  await tauri.renameJournal(id, name);
  await loadJournals();
}

export { journals, activeJournalId, isSwitching };
