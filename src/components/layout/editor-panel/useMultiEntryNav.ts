import { batch, type Accessor, type Setter } from 'solid-js';
import { createEntry, deleteEntry, getEntriesForDate, getAllEntryDates } from '../../../lib/tauri';
import type { DiaryEntry } from '../../../lib/tauri';
import { setEntryDates } from '../../../state/entries';
import { createLogger } from '../../../lib/logger';
import { confirmInApp } from '../../../state/confirm-dialog';
import { useI18n } from '../../../i18n';
import type { EditorEmptyCheckHook } from './useEditorEmptyCheck';
import type { EntryLifecycleHook } from './useEntryLifecycle';
import { clearEntryFromEditor, commitEntryToEditor, resolveEntryHtml } from './entryHydration';

const log = createLogger('Editor');

/**
 * Backend returns entries newest-first; reverse so index 0 = oldest and index N-1 = newest.
 * This makes the counter read "1/N … N/N" in chronological order and puts new entries last.
 */
export async function fetchEntriesOrdered(date: string): Promise<DiaryEntry[]> {
  const entries = await getEntriesForDate(date);
  return entries.slice().reverse();
}

/**
 * Note what is deliberately absent: the title/content/wordCount/pendingEntryId/metadata
 * setters. Navigation changes which entry is displayed, and that transition is only ever
 * valid as one atomic commit — so this hook reaches those setters exclusively through
 * `lifecycle.entryCommitTargets` + `commitEntryToEditor`/`clearEntryFromEditor`. Adding
 * a loose setter back here reopens the body-wipe race. See TODO-0089.
 */
export interface UseMultiEntryNavOptions {
  t: ReturnType<typeof useI18n>;
  selectedDate: Accessor<string>;
  dayEntries: Accessor<DiaryEntry[]>;
  setDayEntries: Setter<DiaryEntry[]>;
  currentIndex: Accessor<number>;
  pendingEntryId: Accessor<number | null>;
  isCreatingEntry: Accessor<boolean>;
  setIsCreatingEntry: Setter<boolean>;
  emptyCheck: EditorEmptyCheckHook;
  lifecycle: EntryLifecycleHook;
}

export interface MultiEntryNavHook {
  navigateToEntry: (newIndex: number) => Promise<void>;
  addEntry: () => Promise<void>;
  handleDeleteEntry: () => Promise<void>;
}

export function useMultiEntryNav(opts: UseMultiEntryNavOptions): MultiEntryNavHook {
  let navToken = 0;

  const navigateToEntry = async (newIndex: number) => {
    const token = ++navToken;
    // Captured before anything below can mutate dayEntries — canLeaveCurrentEntry may
    // delete the *current* entry (never the target), which shifts every later index by
    // one. Re-finding the target by id after the refresh (below) is what keeps the user
    // landing on the entry they actually clicked instead of its new neighbor. See TODO-0104.
    const targetEntryId = opts.dayEntries()[newIndex]?.id ?? null;

    // Flush an in-flight createEntry() first — defensive: pendingEntryId is null while a
    // creation is in flight, so the currentId flush below would otherwise no-op and any
    // typed content would be lost/misattributed. See TODO-0089.
    await opts.lifecycle.flushPendingCreation();
    if (opts.lifecycle.isDisposed() || token !== navToken) return;

    // Ask before silently erasing real content (TODO-0104). flushCurrent still runs
    // after this — canLeaveCurrentEntry only writes on its own delete-and-confirmed branch.
    if (!(await opts.lifecycle.canLeaveCurrentEntry('navigateToEntry'))) return;
    if (opts.lifecycle.isDisposed() || token !== navToken) return;

    // Save current first — snapshot-based, so the id, title, body, and the
    // save-vs-delete decision all come from the same instant.
    await opts.lifecycle.flushCurrent('navigateToEntry');
    if (opts.lifecycle.isDisposed() || token !== navToken) return;

    const entries = opts.dayEntries();
    if (newIndex < 0 || newIndex >= entries.length) return;

    try {
      const refreshed = await fetchEntriesOrdered(opts.selectedDate());
      if (opts.lifecycle.isDisposed() || token !== navToken) return;
      opts.setDayEntries(refreshed);

      // Prefer the target's own id — correct even when canLeaveCurrentEntry deleted the
      // entry that used to sit before it, which the clamp below cannot detect on its own.
      const byId = targetEntryId !== null ? refreshed.findIndex((e) => e.id === targetEntryId) : -1;
      const validIndex = byId >= 0 ? byId : Math.min(newIndex, refreshed.length - 1);
      if (validIndex < 0) {
        clearEntryFromEditor(opts.lifecycle.entryCommitTargets);
        return;
      }

      const entry = refreshed[validIndex];
      // Resolve the body BEFORE committing anything — see commitEntryToEditor.
      const html = await resolveEntryHtml(entry);
      if (opts.lifecycle.isDisposed() || token !== navToken) return;
      commitEntryToEditor(opts.lifecycle.entryCommitTargets, entry, html, validIndex);
    } catch (error) {
      log.error('Failed to navigate to entry:', error);
    }
  };

  const addEntry = async () => {
    if (opts.isCreatingEntry()) return;
    // Only allow adding a second entry when the current one has real content.
    // An empty pendingEntryId means no entry yet (typing auto-creates the first one).
    // An empty title+body means the entry hasn't been filled in yet.
    if (opts.pendingEntryId() === null || opts.emptyCheck.isContentEmpty()) return;
    opts.setIsCreatingEntry(true);

    try {
      // Ask before silently erasing real content (TODO-0104). Structural consistency with
      // navigateToEntry/toggleLock — the isContentEmpty() gate above already keeps this
      // guard's delete branch unreachable through normal UI flow.
      if (!(await opts.lifecycle.canLeaveCurrentEntry('addEntry'))) return;
      if (opts.lifecycle.isDisposed()) return;

      // Save current first — snapshot-based, see navigateToEntry.
      await opts.lifecycle.flushCurrent('addEntry');
      if (opts.lifecycle.isDisposed()) return;

      const newEntry = await createEntry(opts.selectedDate());
      if (opts.lifecycle.isDisposed()) return;

      const refreshed = await fetchEntriesOrdered(opts.selectedDate());
      if (opts.lifecycle.isDisposed()) return;

      opts.setDayEntries(refreshed);
      // New entry is newest-first, so it should be at index 0 in the raw list;
      // after reversal the index depends on position — look it up by id.
      const idx = refreshed.findIndex((e) => e.id === newEntry.id);
      const newIndex = idx >= 0 ? idx : 0;
      opts.lifecycle.setJustCreatedEntryId(newEntry.id);
      // A brand-new entry is blank by definition, so its body needs no resolution:
      // the empty document IS its content, and the commit is atomic on its own.
      commitEntryToEditor(opts.lifecycle.entryCommitTargets, newEntry, '', newIndex);
      // Cancel any previously queued debounced save from the current entry before
      // switching to the new blank entry — prevents saving the wrong entry data.
      opts.lifecycle.debouncedSave.cancel();

      const dates = await getAllEntryDates();
      if (!opts.lifecycle.isDisposed()) setEntryDates(dates);
    } catch (error) {
      log.error('Failed to add entry:', error);
    } finally {
      opts.setIsCreatingEntry(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (opts.dayEntries().length <= 1) return;

    const confirmed = await confirmInApp(opts.t('editor.deleteConfirmMessage'), {
      title: opts.t('editor.deleteConfirmTitle'),
    });

    if (!confirmed) return;

    try {
      const entryToDelete = opts.dayEntries()[opts.currentIndex()];
      if (!entryToDelete?.id) return;

      // The entry is about to disappear — do not let a queued save fire against it.
      opts.lifecycle.debouncedSave.cancel();
      await deleteEntry(entryToDelete.id);

      const refreshed = await fetchEntriesOrdered(opts.selectedDate());
      if (opts.lifecycle.isDisposed()) return;

      if (refreshed.length === 0) {
        clearEntryFromEditor(opts.lifecycle.entryCommitTargets);
        opts.setDayEntries([]);
      } else {
        let newIndex = opts.currentIndex();
        if (newIndex >= refreshed.length) {
          newIndex = refreshed.length - 1;
        }
        const entry = refreshed[newIndex];
        // Resolve the body BEFORE committing anything — see commitEntryToEditor.
        const html = await resolveEntryHtml(entry);
        if (opts.lifecycle.isDisposed()) return;
        batch(() => {
          opts.setDayEntries(refreshed);
          commitEntryToEditor(opts.lifecycle.entryCommitTargets, entry, html, newIndex);
        });
      }
    } catch (error) {
      log.error('Failed to delete entry:', error);
    }
  };

  return { navigateToEntry, addEntry, handleDeleteEntry };
}
