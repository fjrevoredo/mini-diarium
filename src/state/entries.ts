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

/**
 * Reload-without-saving callback system.
 *
 * Mirrors the cleanup-callback system above, but for the opposite situation: the journal's
 * content changed out from under the app *without* a lock/unlock cycle (currently only a
 * whole-journal restore, Task 4.2), so the editor's in-memory entry state is stale — and
 * flushing it, the way a cleanup callback would, writes pre-restore content back over the
 * restored entry. A registered callback must discard its held entry state (e.g. via
 * `clearEntryFromEditor`, which nulls `pendingEntryId` and makes any incidental flush that
 * follows a no-op — see `useEntryPersistence`'s hydration-identity guard) before it re-fetches.
 */
const [reloadCallbacks, setReloadCallbacks] = createSignal<(() => void | Promise<void>)[]>([]);

export function registerReloadCallback(callback: () => void | Promise<void>): () => void {
  setReloadCallbacks((prev) => [...prev, callback]);
  return () => setReloadCallbacks((prev) => prev.filter((cb) => cb !== callback));
}

export async function executeReloadCallbacks(): Promise<void> {
  for (const callback of reloadCallbacks()) {
    await callback();
  }
}

/**
 * Navigation-guard registry (TODO-0104). Mirrors the cleanup-/reload-callback systems
 * above, but for a third situation: a navigation-away action wants to ask "may I proceed?"
 * before mutating navigation state, because proceeding would silently erase real content.
 *
 * A registered guard returns `false` to deny the navigation (the caller must abort and
 * leave state untouched) or `true` to allow it. In practice only one guard is ever
 * registered at a time (one live `EditorPanel` instance), but the array-based registry
 * keeps this consistent with `registerCleanupCallback`/`registerReloadCallback` rather
 * than introducing a single-callback special case.
 */
const [navigationGuards, setNavigationGuards] = createSignal<(() => Promise<boolean>)[]>([]);

export function registerNavigationGuard(callback: () => Promise<boolean>): () => void {
  setNavigationGuards((prev) => [...prev, callback]);
  return () => setNavigationGuards((prev) => prev.filter((cb) => cb !== callback));
}

/**
 * Awaits every registered guard in sequence, short-circuiting the instant one denies —
 * subsequent guards are never invoked once a denial is found. Resolves `true` when the
 * registry is empty or every guard approves.
 */
export async function requestNavigationConsent(): Promise<boolean> {
  for (const guard of navigationGuards()) {
    if (!(await guard())) return false;
  }
  return true;
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
