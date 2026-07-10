import { createSignal } from 'solid-js';
import { getLockedEntryDates } from '../lib/tauri';

// List of all entry dates
const [entryDates, setEntryDates] = createSignal<string[]>([]);

// Dates (YYYY-MM-DD) that have at least one locked entry — feeds calendar/timeline indicators.
const [lockedDates, setLockedDates] = createSignal<string[]>([]);

// Monotonic counter bumped on every lock toggle so resources keyed on it refetch.
const [lockVersion, setLockVersion] = createSignal(0);

// Save state
const [isSaving, setIsSaving] = createSignal(false);

/** Refreshes the set of dates that have locked entries and bumps the lock version. */
export async function refreshLockedDates(): Promise<void> {
  try {
    // `?? []` guards the string[] signal against a null/undefined IPC result.
    setLockedDates((await getLockedEntryDates()) ?? []);
  } catch {
    // Non-fatal: indicators are cosmetic. Leave the previous set in place.
  }
  setLockVersion((v) => v + 1);
}

export function resetEntriesState(): void {
  setEntryDates([]);
  setLockedDates([]);
  setLockVersion(0);
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
  entryDates,
  setEntryDates,
  lockedDates,
  setLockedDates,
  lockVersion,
  isSaving,
  setIsSaving,
};
