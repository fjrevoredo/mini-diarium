import { type Accessor, type Setter } from 'solid-js';
import type { Editor } from '@tiptap/core';
import {
  createEntry,
  deleteEntry,
  getEntriesForDate,
  getAllEntryDates,
  getEntryImages,
} from '../../../lib/tauri';
import type { DiaryEntry, EntryMetadata } from '../../../lib/tauri';
import { setEntryDates } from '../../../state/entries';
import { countWordsInHtml } from '../../../lib/wordcount';
import { createLogger } from '../../../lib/logger';
import { confirm } from '../../../lib/dialog';
import { useI18n } from '../../../i18n';
import type { EditorEmptyCheckHook } from './useEditorEmptyCheck';
import type { EntryLifecycleHook } from './useEntryLifecycle';
import { hasImageRefs, resolveImageRefs } from '../../../lib/image-refs';

const log = createLogger('Editor');

/**
 * Backend returns entries newest-first; reverse so index 0 = oldest and index N-1 = newest.
 * This makes the counter read "1/N … N/N" in chronological order and puts new entries last.
 */
export async function fetchEntriesOrdered(date: string): Promise<DiaryEntry[]> {
  const entries = await getEntriesForDate(date);
  return entries.slice().reverse();
}

export interface UseMultiEntryNavOptions {
  t: ReturnType<typeof useI18n>;
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
  emptyCheck: EditorEmptyCheckHook;
  lifecycle: EntryLifecycleHook;
  entryMetadata: Accessor<EntryMetadata | null>;
  setEntryMetadata: Setter<EntryMetadata | null>;
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
    // Save current first — read from editor directly to capture alignment transactions
    // that may not have propagated to the content() signal yet.
    const currentId = opts.pendingEntryId();
    if (currentId !== null) {
      opts.lifecycle.debouncedSave.cancel();
      const edInst = opts.editorInstance();
      const currentContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : opts.content();
      await opts.lifecycle.saveCurrentById(currentId, opts.title(), currentContent);
    }

    const entries = opts.dayEntries();
    if (newIndex < 0 || newIndex >= entries.length) return;

    try {
      const refreshed = await fetchEntriesOrdered(opts.selectedDate());
      if (opts.lifecycle.isDisposed() || token !== navToken) return;
      opts.setDayEntries(refreshed);

      // Filter to entries that still exist
      const validIndex = Math.min(newIndex, refreshed.length - 1);
      if (validIndex < 0) {
        opts.setCurrentIndex(0);
        opts.setPendingEntryId(null);
        opts.setTitle('');
        opts.setContent('');
        opts.setWordCount(0);
        return;
      }

      opts.setCurrentIndex(validIndex);
      const entry = refreshed[validIndex];
      opts.setPendingEntryId(entry.id);
      opts.setTitle(entry.title);
      let html = entry.text;
      if (hasImageRefs(html)) {
        const images = await getEntryImages(entry.id);
        if (opts.lifecycle.isDisposed() || token !== navToken) return;
        html = resolveImageRefs(html, images);
      }
      opts.setContent(html);
      opts.setWordCount(countWordsInHtml(html));
      opts.setEntryMetadata(entry.metadata ?? null);
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
      // Save current first — read from editor directly to capture alignment.
      const currentId = opts.pendingEntryId();
      if (currentId !== null) {
        opts.lifecycle.debouncedSave.cancel();
        const edInst = opts.editorInstance();
        const currentContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : opts.content();
        await opts.lifecycle.saveCurrentById(currentId, opts.title(), currentContent);
      }

      const newEntry = await createEntry(opts.selectedDate());
      if (opts.lifecycle.isDisposed()) return;

      const refreshed = await fetchEntriesOrdered(opts.selectedDate());
      if (opts.lifecycle.isDisposed()) return;

      opts.setDayEntries(refreshed);
      // New entry is newest-first, so it should be at index 0 in the raw list;
      // after reversal the index depends on position — look it up by id.
      const idx = refreshed.findIndex((e) => e.id === newEntry.id);
      const newIndex = idx >= 0 ? idx : 0;
      opts.setCurrentIndex(newIndex);
      opts.setPendingEntryId(newEntry.id);
      opts.lifecycle.setJustCreatedEntryId(newEntry.id);
      opts.setTitle('');
      opts.setContent('');
      opts.setWordCount(0);
      opts.setEntryMetadata(null);
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

    const confirmed = await confirm(opts.t('editor.deleteConfirmMessage'), {
      title: opts.t('editor.deleteConfirmTitle'),
      kind: 'warning',
    });

    if (!confirmed) return;

    try {
      const entryToDelete = opts.dayEntries()[opts.currentIndex()];
      if (!entryToDelete?.id) return;

      await deleteEntry(entryToDelete.id);

      const refreshed = await fetchEntriesOrdered(opts.selectedDate());

      if (refreshed.length === 0) {
        opts.setPendingEntryId(null);
        opts.setTitle('');
        opts.setContent('');
        opts.setWordCount(0);
        opts.setEntryMetadata(null);
        opts.setDayEntries([]);
        opts.setCurrentIndex(0);
      } else {
        let newIndex = opts.currentIndex();
        if (newIndex >= refreshed.length) {
          newIndex = refreshed.length - 1;
        }
        const entry = refreshed[newIndex];
        opts.setPendingEntryId(entry.id);
        opts.setTitle(entry.title);
        let html = entry.text;
        if (hasImageRefs(html)) {
          const images = await getEntryImages(entry.id);
          if (opts.lifecycle.isDisposed()) return;
          html = resolveImageRefs(html, images);
        }
        opts.setContent(html);
        opts.setWordCount(countWordsInHtml(html));
        opts.setEntryMetadata(entry.metadata ?? null);
        opts.setDayEntries(refreshed);
        opts.setCurrentIndex(newIndex);
      }
    } catch (error) {
      log.error('Failed to delete entry:', error);
    }
  };

  return { navigateToEntry, addEntry, handleDeleteEntry };
}
