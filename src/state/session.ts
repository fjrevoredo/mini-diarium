import { createSignal } from 'solid-js';
import { getAllEntryDates } from '../lib/tauri';
import {
  resetEntriesState,
  setEntryDates,
  executeReloadCallbacks,
  refreshLockedDates,
} from './entries';
import { resetSearchState } from './search';
import { resetUiState } from './ui';
import { resetTagsState, loadAllTags } from './tags';

const [hasFocusedEditorOnUnlock, setHasFocusedEditorOnUnlock] = createSignal(false);

export function resetSessionState(): void {
  resetEntriesState();
  resetSearchState();
  resetUiState();
  resetTagsState();
  setHasFocusedEditorOnUnlock(false);
}

/**
 * Rehydrates entry-derived state after the live journal's content changed underneath the
 * app without a lock/unlock cycle — currently only a whole-journal restore (Task 4.2).
 *
 * Deliberately **not** `resetSessionState()`: that also calls `resetUiState()`, which sets
 * `setIsPreferencesOpen(false)` — closing the very Backups panel that is about to show the
 * restore's success message naming the safety snapshot. UI state (open overlays, the
 * selected date) is left alone; only entry-, search-, and tag-derived state is cleared and
 * refetched. The editor itself is not touched directly — `executeReloadCallbacks()` tells it
 * to discard its held entry and re-fetch, never to flush, since flushing here would write
 * pre-restore content back over the restored entry.
 */
export async function refreshAfterRestore(): Promise<void> {
  resetEntriesState();
  resetSearchState();
  resetTagsState();
  await executeReloadCallbacks();
  const dates = await getAllEntryDates();
  setEntryDates(dates);
  await Promise.all([refreshLockedDates(), loadAllTags()]);
}

export { hasFocusedEditorOnUnlock, setHasFocusedEditorOnUnlock };
