import { untrack, type Accessor, type Setter } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { createEntry, saveEntry, deleteEntryIfEmpty, getAllEntryDates } from '../../../lib/tauri';
import type { DiaryEntry } from '../../../lib/tauri';
import { debounce } from '../../../lib/debounce';
import { setEntryDates, setIsSaving, registerCleanupCallback } from '../../../state/entries';
import { countWordsInHtml } from '../../../lib/wordcount';
import { createLogger } from '../../../lib/logger';
import type { EditorEmptyCheckHook } from './useEditorEmptyCheck';
import { fetchEntriesOrdered } from './useMultiEntryNav';

const log = createLogger('Editor');

export interface UseEntryLifecycleOptions {
  selectedDate: Accessor<string>;
  editorInstance: Accessor<Editor | null>;
  title: Accessor<string>;
  setTitle: Setter<string>;
  content: Accessor<string>;
  setContent: Setter<string>;
  setWordCount: Setter<number>;
  dayEntries: Accessor<DiaryEntry[]>;
  setDayEntries: Setter<DiaryEntry[]>;
  currentIndex: Accessor<number>;
  setCurrentIndex: Setter<number>;
  pendingEntryId: Accessor<number | null>;
  setPendingEntryId: Setter<number | null>;
  isCreatingEntry: Accessor<boolean>;
  setIsCreatingEntry: Setter<boolean>;
  setIsLoadingEntry: Setter<boolean>;
  emptyCheck: EditorEmptyCheckHook;
}

export type DebouncedSaveFn = ((entryId: number, titleArg: string, contentArg: string) => void) & {
  cancel: () => void;
};

export interface EntryLifecycleHook {
  saveCurrentById: (entryId: number, currentTitle: string, currentContent: string) => Promise<void>;
  loadEntriesForDate: (date: string) => Promise<void>;
  startEntryCreation: (reason: string) => void;
  debouncedSave: DebouncedSaveFn;
  /**
   * Guards the onSetContent(isEmpty=true) auto-delete debounce for a freshly
   * created entry. See `EditorPanel.tsx` history for the race this prevents.
   */
  getJustCreatedEntryId: () => number | null;
  setJustCreatedEntryId: (id: number | null) => void;
  isDisposed: () => boolean;
  dispose: () => void;
}

export function useEntryLifecycle(opts: UseEntryLifecycleOptions): EntryLifecycleHook {
  let isDisposed = false;
  let loadRequestId = 0;
  let saveRequestId = 0;
  let pendingCreationPromise: Promise<DiaryEntry> | null = null;
  let justCreatedEntryId: number | null = null;

  const saveCurrentById = async (entryId: number, currentTitle: string, currentContent: string) => {
    if (isDisposed) return;
    const requestId = ++saveRequestId;

    const shouldDelete =
      currentTitle.trim() === '' &&
      (opts.emptyCheck.isContentEmpty() || currentContent.trim() === '');
    if (shouldDelete) {
      try {
        await deleteEntryIfEmpty(entryId, currentTitle, '');
        if (isDisposed || requestId !== saveRequestId) return;
        const updatedEntries = opts.dayEntries().filter((e) => e.id !== entryId);
        opts.setDayEntries(updatedEntries);
        const dates = await getAllEntryDates();
        if (isDisposed || requestId !== saveRequestId) return;
        setEntryDates(dates);
        if (updatedEntries.length > 0) {
          // Other entries remain — navigate to the nearest so the editor always shows
          // real content after a blank entry is auto-deleted. Without this, switching
          // days and back leaves pendingEntryId=null with stale blank content,
          // permanently disabling the "+" button (Bug 2).
          const newIdx = Math.min(opts.currentIndex(), updatedEntries.length - 1);
          const entry = updatedEntries[newIdx];
          opts.setCurrentIndex(newIdx);
          opts.setPendingEntryId(entry.id);
          opts.setTitle(entry.title);
          opts.setContent(entry.text);
          opts.setWordCount(countWordsInHtml(entry.text));
          // Prevent the debounced save that setContent triggers via TipTap —
          // the remaining entry is already persisted and has not changed.
          debouncedSave.cancel();
        } else {
          // No entries remain — reset so the next keystroke creates a fresh entry.
          opts.setPendingEntryId(null);
          opts.setCurrentIndex(0);
          opts.setWordCount(0);
        }
      } catch (error) {
        log.error('Failed to delete empty entry:', error);
      }
      return;
    }

    try {
      setIsSaving(true);
      await saveEntry(entryId, currentTitle, currentContent);
      if (isDisposed || requestId !== saveRequestId) return;

      const dates = await getAllEntryDates();
      if (isDisposed || requestId !== saveRequestId) return;
      setEntryDates(dates);
    } catch (error) {
      log.error('Failed to save entry:', error);
    } finally {
      if (!isDisposed && requestId === saveRequestId) {
        setIsSaving(false);
      }
    }
  };

  // Debounced save. Reactive reads (isContentEmpty) must happen at debounce-fire time (500 ms
  // later), not at call-site time — pre-reading the value would capture stale emptiness state
  // before the user has finished typing.

  const debouncedSave = debounce((entryId: number, titleArg: string, contentArg: string) => {
    void saveCurrentById(entryId, titleArg, contentArg);
  }, 500) as DebouncedSaveFn;

  const loadEntriesForDate = async (date: string) => {
    const requestId = ++loadRequestId;
    opts.setIsLoadingEntry(true);

    // Flush any pending save for the current entry before switching dates. ALL signal reads
    // here must go through untrack(): this block runs synchronously before the first await,
    // still inside the createEffect tracking scope. Without untrack(), pendingEntryId/title/
    // content (and via saveCurrentById's synchronous isContentEmpty() call — editorIsEmpty/
    // editorInstance) would all become reactive deps of the calling effect, causing
    // loadEntriesForDate to re-fire on every keystroke (reactive loop).
    const currentId = untrack(opts.pendingEntryId);
    if (currentId !== null) {
      debouncedSave.cancel();
      const savedTitle = untrack(opts.title);
      // Read directly from the TipTap editor instance rather than the content() signal —
      // alignment changes are node-attribute transactions and may not have propagated to
      // the signal yet. editor.getHTML() always reflects the true current document state.
      const edInst = untrack(opts.editorInstance);
      const savedContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : untrack(opts.content);
      await untrack(() => saveCurrentById(currentId, savedTitle, savedContent));
      if (isDisposed || requestId !== loadRequestId) return;
    }

    try {
      const entries = await fetchEntriesOrdered(date);
      if (isDisposed || requestId !== loadRequestId) return;

      opts.setDayEntries(entries);

      if (entries.length > 0) {
        const startIndex = entries.length - 1; // newest entry is last in chronological order
        opts.setCurrentIndex(startIndex);
        const entry = entries[startIndex];
        opts.setPendingEntryId(entry.id);
        opts.setTitle(entry.title);
        opts.setContent(entry.text);
        opts.setWordCount(countWordsInHtml(entry.text));
      } else {
        opts.setCurrentIndex(0);
        opts.setPendingEntryId(null);
        opts.setTitle('');
        opts.setContent('');
        opts.setWordCount(0);
      }
    } catch (error) {
      log.error('Failed to load entries:', error);
    } finally {
      if (!isDisposed && requestId === loadRequestId) {
        opts.setIsLoadingEntry(false);
      }
    }
  };

  const startEntryCreation = (reason: string) => {
    if (opts.isCreatingEntry()) {
      log.debug(`${reason}: isCreatingEntry guard fired — skipping duplicate creation`);
      return;
    }
    log.info(`${reason}: pendingEntryId null — creating entry for date ${opts.selectedDate()}`);
    opts.setIsCreatingEntry(true);
    const creationPromise = createEntry(opts.selectedDate());
    pendingCreationPromise = creationPromise;
    void (async () => {
      try {
        const newEntry = await creationPromise;
        pendingCreationPromise = null;
        if (isDisposed) {
          log.warn(
            `${reason}: component disposed during createEntry — id=${newEntry.id}, content will be saved by cleanup callback`,
          );
          return;
        }
        log.info(`${reason}: createEntry completed, id=${newEntry.id}`);
        opts.setPendingEntryId(newEntry.id);
        const refreshed = await fetchEntriesOrdered(opts.selectedDate());
        if (!isDisposed) opts.setDayEntries(refreshed);
        debouncedSave(newEntry.id, opts.title(), opts.content());
      } catch (error) {
        pendingCreationPromise = null;
        log.error(`${reason}: failed to create entry:`, error);
      } finally {
        opts.setIsCreatingEntry(false);
      }
    })();
  };

  // Register journal-lock cleanup. Fires when the journal is being locked: we flush any
  // in-flight creation + save so typed content is not lost when the DB closes.

  const unregister = registerCleanupCallback(async () => {
    // If a createEntry() call is in-flight, await it and save immediately.
    // This window (pendingCreationPromise non-null) is the core of the race:
    // the cleanup callback fires before the DB is locked but after typing started,
    // so pendingEntryId is still null and the normal save path below would skip.
    if (pendingCreationPromise !== null) {
      try {
        const newEntry = await pendingCreationPromise;
        const capturedTitle = opts.title();
        const edInst = opts.editorInstance();
        const capturedContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : opts.content();
        const isContentBlank =
          edInst && !edInst.isDestroyed
            ? edInst.isEmpty || edInst.getText().trim() === ''
            : capturedContent.trim() === '';
        if (capturedTitle.trim() !== '' || !isContentBlank) {
          log.info(`cleanup: saving entry id=${newEntry.id} created during lock-race`);
          await saveEntry(newEntry.id, capturedTitle, capturedContent);
        } else {
          log.info(`cleanup: deleting blank ghost entry id=${newEntry.id} from lock-race`);
          await deleteEntryIfEmpty(newEntry.id, '', '');
        }
      } catch (err) {
        log.warn('cleanup: could not save/delete in-flight entry during lock:', err);
      }
      // pendingEntryId may be non-null by now (IIFE's .then() ran first on the same Promise);
      // return to prevent a redundant second save via saveCurrentById below
      return;
    }

    // Normal path: flush any unsaved content for the current entry
    const currentId = opts.pendingEntryId();
    if (currentId !== null) {
      const edInst = opts.editorInstance();
      const currentContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : opts.content();
      await saveCurrentById(currentId, opts.title(), currentContent);
    }
  });

  const dispose = () => {
    isDisposed = true;
    loadRequestId += 1;
    saveRequestId += 1;
    debouncedSave.cancel();
    unregister();
  };

  return {
    saveCurrentById,
    loadEntriesForDate,
    startEntryCreation,
    debouncedSave,
    getJustCreatedEntryId: () => justCreatedEntryId,
    setJustCreatedEntryId: (id) => {
      justCreatedEntryId = id;
    },
    isDisposed: () => isDisposed,
    dispose,
  };
}
