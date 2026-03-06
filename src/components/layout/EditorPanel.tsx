import { createSignal, createEffect, onCleanup, onMount, Show } from 'solid-js';
import { Editor } from '@tiptap/core';
import { createLogger } from '../../lib/logger';
import TitleEditor from '../editor/TitleEditor';
import DiaryEditor from '../editor/DiaryEditor';
import WordCount from '../editor/WordCount';
import { EntryNavBar } from '../editor/EntryNavBar';
import { selectedDate } from '../../state/ui';
import {
  createEntry,
  saveEntry,
  getEntriesForDate,
  deleteEntryIfEmpty,
  deleteEntry,
  getAllEntryDates,
} from '../../lib/tauri';
import type { DiaryEntry } from '../../lib/tauri';
import { debounce } from '../../lib/debounce';
import { isSaving, setIsSaving, setEntryDates, registerCleanupCallback } from '../../state/entries';
import { preferences } from '../../state/preferences';
import { confirm } from '@tauri-apps/plugin-dialog';

const log = createLogger('Editor');

export default function EditorPanel() {
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [wordCount, setWordCount] = createSignal(0);
  const [_isLoadingEntry, setIsLoadingEntry] = createSignal(false);
  const [editorInstance, setEditorInstance] = createSignal<Editor | null>(null);

  // Multi-entry state
  const [dayEntries, setDayEntries] = createSignal<DiaryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [pendingEntryId, setPendingEntryId] = createSignal<number | null>(null);

  let isDisposed = false;
  let loadRequestId = 0;
  let saveRequestId = 0;
  const [isCreatingEntry, setIsCreatingEntry] = createSignal(false);

  // Backend returns entries newest-first; reverse so index 0 = oldest and index N-1 = newest.
  // This makes the counter read "1/N … N/N" in chronological order and puts new entries last.
  const fetchEntriesOrdered = async (date: string): Promise<DiaryEntry[]> => {
    const entries = await getEntriesForDate(date);
    return entries.slice().reverse();
  };

  const isContentEmpty = () => {
    const editor = editorInstance();
    if (editor && !editor.isDestroyed) {
      return editor.isEmpty || editor.getText().trim() === '';
    }
    return !content().trim();
  };

  // Save the current entry by id (or create if no id yet on first keystroke)
  const saveCurrentById = async (entryId: number, currentTitle: string, currentContent: string) => {
    if (isDisposed) return;
    const requestId = ++saveRequestId;

    const shouldDelete =
      currentTitle.trim() === '' && (isContentEmpty() || currentContent.trim() === '');
    if (shouldDelete) {
      try {
        await deleteEntryIfEmpty(entryId, currentTitle, '');
        if (isDisposed || requestId !== saveRequestId) return;
        // Reset so the next real keystroke creates a fresh entry
        setPendingEntryId(null);
        setDayEntries((prev) => prev.filter((e) => e.id !== entryId));
        const dates = await getAllEntryDates();
        if (isDisposed || requestId !== saveRequestId) return;
        setEntryDates(dates);
        setWordCount(0);
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
  // eslint-disable-next-line solid/reactivity
  const debouncedSave = debounce((entryId: number, t: string, c: string) => {
    void saveCurrentById(entryId, t, c);
  }, 500);

  // Load entries for a date
  const loadEntriesForDate = async (date: string) => {
    const requestId = ++loadRequestId;
    setIsLoadingEntry(true);

    try {
      const entries = await fetchEntriesOrdered(date);
      if (isDisposed || requestId !== loadRequestId) return;

      setDayEntries(entries);

      if (entries.length > 0) {
        const startIndex = entries.length - 1; // newest entry is last in chronological order
        setCurrentIndex(startIndex);
        const entry = entries[startIndex];
        setPendingEntryId(entry.id);
        setTitle(entry.title);
        setContent(entry.text);
        const words = entry.text.trim().split(/\s+/).filter(Boolean);
        setWordCount(words.length);
      } else {
        setCurrentIndex(0);
        setPendingEntryId(null);
        setTitle('');
        setContent('');
        setWordCount(0);
      }
    } catch (error) {
      log.error('Failed to load entries:', error);
    } finally {
      if (!isDisposed && requestId === loadRequestId) {
        setIsLoadingEntry(false);
      }
    }
  };

  // Navigate to an entry within the current day
  const navigateToEntry = async (newIndex: number) => {
    // Save current first
    const currentId = pendingEntryId();
    if (currentId !== null) {
      debouncedSave.cancel();
      await saveCurrentById(currentId, title(), content());
    }

    const entries = dayEntries();
    if (newIndex < 0 || newIndex >= entries.length) return;

    // Refresh entries list from backend
    try {
      const refreshed = await fetchEntriesOrdered(selectedDate());
      if (isDisposed) return;
      setDayEntries(refreshed);

      // Filter to entries that still exist
      const validIndex = Math.min(newIndex, refreshed.length - 1);
      if (validIndex < 0) {
        setCurrentIndex(0);
        setPendingEntryId(null);
        setTitle('');
        setContent('');
        setWordCount(0);
        return;
      }

      setCurrentIndex(validIndex);
      const entry = refreshed[validIndex];
      setPendingEntryId(entry.id);
      setTitle(entry.title);
      setContent(entry.text);
      const words = entry.text.trim().split(/\s+/).filter(Boolean);
      setWordCount(words.length);
    } catch (error) {
      log.error('Failed to navigate to entry:', error);
    }
  };

  // Add a new entry for the current date
  const addEntry = async () => {
    if (isCreatingEntry()) return;
    // Only allow adding a second entry when the current one has real content.
    // An empty pendingEntryId means no entry yet (typing auto-creates the first one).
    // An empty title+body means the entry hasn't been filled in yet.
    if (pendingEntryId() === null || isContentEmpty()) return;
    setIsCreatingEntry(true);

    try {
      // Save current first
      const currentId = pendingEntryId();
      if (currentId !== null) {
        debouncedSave.cancel();
        await saveCurrentById(currentId, title(), content());
      }

      const newEntry = await createEntry(selectedDate());
      if (isDisposed) return;

      // Refresh entries for the date
      const refreshed = await fetchEntriesOrdered(selectedDate());
      if (isDisposed) return;

      setDayEntries(refreshed);
      // New entry is newest-first, so it should be at index 0
      const idx = refreshed.findIndex((e) => e.id === newEntry.id);
      const newIndex = idx >= 0 ? idx : 0;
      setCurrentIndex(newIndex);
      setPendingEntryId(newEntry.id);
      setTitle('');
      setContent('');
      setWordCount(0);
      // setContent('') causes TipTap to fire onUpdate synchronously, which schedules
      // a debounced save with empty content on the new entry ID — cancelling here
      // prevents that save from running and immediately deleting the new blank entry.
      debouncedSave.cancel();

      // Refresh dates
      const dates = await getAllEntryDates();
      if (!isDisposed) setEntryDates(dates);
    } catch (error) {
      log.error('Failed to add entry:', error);
    } finally {
      setIsCreatingEntry(false);
    }
  };

  createEffect(() => {
    void loadEntriesForDate(selectedDate());
  });

  const handleContentUpdate = (newContent: string) => {
    setContent(newContent);
    const id = pendingEntryId();
    if (id !== null) {
      debouncedSave(id, title(), newContent);
    } else {
      // Skip creation on programmatic updates (loading an empty day fires onUpdate with empty content)
      const editor = editorInstance();
      const isEmpty = editor
        ? editor.isEmpty || editor.getText().trim() === ''
        : newContent.trim() === '';
      if (isEmpty || isCreatingEntry()) return;

      // First real keystroke on empty day — create entry then save
      setIsCreatingEntry(true);
      void (async () => {
        try {
          const newEntry = await createEntry(selectedDate());
          if (isDisposed) return;
          setPendingEntryId(newEntry.id);
          const refreshed = await fetchEntriesOrdered(selectedDate());
          if (!isDisposed) setDayEntries(refreshed);
          // Use current signal values — user may have typed more while awaiting
          debouncedSave(newEntry.id, title(), content());
        } catch (error) {
          log.error('Failed to create entry on first keystroke:', error);
        } finally {
          setIsCreatingEntry(false);
        }
      })();
    }
  };

  const handleDeleteEntry = async () => {
    if (dayEntries().length <= 1) return;

    const confirmed = await confirm('Are you sure you want to delete this entry?', {
      title: 'Delete Entry',
      kind: 'warning',
    });

    if (!confirmed) return;

    try {
      const entryToDelete = dayEntries()[currentIndex()];
      if (!entryToDelete?.id) return;

      await deleteEntry(entryToDelete.id);

      const refreshed = await fetchEntriesOrdered(selectedDate());

      if (refreshed.length === 0) {
        setPendingEntryId(null);
        setTitle('');
        setContent('');
        setWordCount(0);
        setDayEntries([]);
        setCurrentIndex(0);
      } else {
        let newIndex = currentIndex();
        if (newIndex >= refreshed.length) {
          newIndex = refreshed.length - 1;
        }
        const entry = refreshed[newIndex];
        setPendingEntryId(entry.id);
        setTitle(entry.title);
        setContent(entry.text);
        const words = entry.text.trim().split(/\s+/).filter(Boolean);
        setWordCount(words.length);
        setDayEntries(refreshed);
        setCurrentIndex(newIndex);
      }
    } catch (error) {
      log.error('Failed to delete entry:', error);
    }
  };

  const handleTitleInput = (newTitle: string) => {
    setTitle(newTitle);
    const id = pendingEntryId();
    if (id !== null) {
      debouncedSave(id, newTitle, content());
    } else {
      // Skip creation on empty title (e.g. programmatic clear)
      if (newTitle.trim() === '' || isCreatingEntry()) return;

      // First real title keystroke on empty day — create entry then save
      setIsCreatingEntry(true);
      void (async () => {
        try {
          const newEntry = await createEntry(selectedDate());
          if (isDisposed) return;
          setPendingEntryId(newEntry.id);
          const refreshed = await fetchEntriesOrdered(selectedDate());
          if (!isDisposed) setDayEntries(refreshed);
          debouncedSave(newEntry.id, title(), content());
        } catch (error) {
          log.error('Failed to create entry on title keystroke:', error);
        } finally {
          setIsCreatingEntry(false);
        }
      })();
    }
  };

  const handleTitleEnter = () => {
    const editor = editorInstance();
    if (editor) {
      editor.commands.focus('end');
    }
  };

  // Save on window unload
  onMount(() => {
    const handleBeforeUnload = () => {
      const id = pendingEntryId();
      if (id !== null) {
        void saveCurrentById(id, title(), content());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    const unregister = registerCleanupCallback(async () => {
      const currentId = pendingEntryId();
      if (currentId !== null) {
        await saveCurrentById(currentId, title(), content());
      }
    });

    onCleanup(() => {
      isDisposed = true;
      loadRequestId += 1;
      saveRequestId += 1;
      debouncedSave.cancel();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unregister();
    });
  });

  return (
    <div class="flex h-full flex-col">
      <EntryNavBar
        total={dayEntries().length}
        index={currentIndex()}
        onPrev={() => void navigateToEntry(currentIndex() - 1)}
        onNext={() => void navigateToEntry(currentIndex() + 1)}
        onAdd={() => void addEntry()}
        addDisabled={isCreatingEntry() || pendingEntryId() === null || isContentEmpty()}
        addTitle={
          isCreatingEntry()
            ? 'Creating entry…'
            : pendingEntryId() === null || isContentEmpty()
              ? 'Write something first to add another entry for this day'
              : 'Add another entry for this day'
        }
        onDelete={handleDeleteEntry}
        deleteDisabled={isCreatingEntry() || dayEntries().length <= 1}
        deleteTitle="Delete entry"
      />
      <div class="flex-1 overflow-y-auto p-6">
        <div class="mx-auto w-full max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
          <div class="space-y-4">
            <Show when={!preferences().hideTitles}>
              <TitleEditor
                value={title()}
                onInput={handleTitleInput}
                onEnter={handleTitleEnter}
                placeholder="Title (optional)"
                spellCheck={preferences().enableSpellcheck}
              />
            </Show>
            <DiaryEditor
              content={content()}
              onUpdate={handleContentUpdate}
              placeholder="What's on your mind today?"
              onEditorReady={setEditorInstance}
              spellCheck={preferences().enableSpellcheck}
            />
          </div>
        </div>
      </div>

      {/* Footer with word count and save status */}
      <div class="border-t border-primary bg-tertiary px-6 py-2">
        <div class="flex items-center justify-between">
          <WordCount count={wordCount()} />
          {isSaving() && <p class="text-sm text-tertiary">Saving...</p>}
        </div>
      </div>
    </div>
  );
}
