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
