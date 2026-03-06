import { createSignal } from 'solid-js';
import type { DiaryEntry } from '../lib/tauri';

// Current entry being edited
const [currentEntry, setCurrentEntry] = createSignal<DiaryEntry | null>(null);

// All entries for the currently selected date
const [dayEntries, setDayEntries] = createSignal<DiaryEntry[]>([]);

// List of all entry dates
const [entryDates, setEntryDates] = createSignal<string[]>([]);

// Loading state
const [isLoading, setIsLoading] = createSignal(false);

// Save state
const [isSaving, setIsSaving] = createSignal(false);

export function resetEntriesState(): void {
  setCurrentEntry(null);
  setDayEntries([]);
  setEntryDates([]);
  setIsLoading(false);
  setIsSaving(false);
}

// Cleanup callback system
const [cleanupCallbacks, setCleanupCallbacks] = createSignal<(() => void | Promise<void>)[]>([]);

export function registerCleanupCallback(callback: () => void | Promise<void>): () => void {
  setCleanupCallbacks((prev) => [...prev, callback]);
  return () => setCleanupCallbacks((prev) => prev.filter((cb) => cb !== callback));
}

export async function executeCleanupCallbacks(): Promise<void> {
  for (const callback of cleanupCallbacks()) {
    await callback();
  }
}

export {
  currentEntry,
  setCurrentEntry,
  dayEntries,
  setDayEntries,
  entryDates,
  setEntryDates,
  isLoading,
  setIsLoading,
  isSaving,
  setIsSaving,
};
