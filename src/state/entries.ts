import { createSignal } from 'solid-js';

// List of all entry dates
const [entryDates, setEntryDates] = createSignal<string[]>([]);

// Save state
const [isSaving, setIsSaving] = createSignal(false);

export function resetEntriesState(): void {
  setEntryDates([]);
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

export { entryDates, setEntryDates, isSaving, setIsSaving };
