import { createSignal, createEffect, onCleanup, onMount, Show } from 'solid-js';
import { Editor } from '@tiptap/core';
import { createLogger } from '../../lib/logger';
import TitleEditor from '../editor/TitleEditor';
import DiaryEditor from '../editor/DiaryEditor';
import WordCount from '../editor/WordCount';
import { selectedDate } from '../../state/ui';
import { saveEntry, getEntry, deleteEntryIfEmpty, getAllEntryDates } from '../../lib/tauri';
import { debounce } from '../../lib/debounce';
import { isSaving, setIsSaving, setEntryDates } from '../../state/entries';
import { preferences } from '../../state/preferences';

const log = createLogger('Editor');

export default function EditorPanel() {
  interface SavePayload {
    date: string;
    title: string;
    content: string;
    isContentEmpty: boolean;
  }

  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [wordCount, setWordCount] = createSignal(0);
  const [isLoadingEntry, setIsLoadingEntry] = createSignal(false);
  const [editorInstance, setEditorInstance] = createSignal<Editor | null>(null);
  let isDisposed = false;
  let loadRequestId = 0;
  let saveRequestId = 0;

  // Load entry when selected date changes
  const loadEntryForDate = async (date: string) => {
    const requestId = ++loadRequestId;
    setIsLoadingEntry(true);

    try {
      const entry = await getEntry(date);
      if (isDisposed || requestId !== loadRequestId) return;
      if (entry) {
        setTitle(entry.title);
        setContent(entry.text);
        const words = entry.text.trim().split(/\s+/).filter(Boolean);
        setWordCount(words.length);
      } else {
        // New entry for this date
        setTitle('');
        setContent('');
        setWordCount(0);
      }
    } catch (error) {
      log.error('Failed to load entry:', error);
    } finally {
      if (!isDisposed && requestId === loadRequestId) {
        setIsLoadingEntry(false);
      }
    }
  };

  createEffect(() => {
    void loadEntryForDate(selectedDate());
  });

  const createSavePayload = (
    nextTitle = title(),
    nextContent = content(),
    nextDate = selectedDate(),
  ): SavePayload => {
    // Use TipTap emptiness when available to handle cases like <p></p>.
    const editor = editorInstance();
    const isContentEmpty =
      editor && !editor.isDestroyed
        ? editor.isEmpty || editor.getText().trim() === ''
        : !nextContent.trim();

    return {
      date: nextDate,
      title: nextTitle,
      content: nextContent,
      isContentEmpty,
    };
  };

  // Save entry function
  const saveCurrentEntry = async (payload: SavePayload) => {
    if (isDisposed) return;
    const requestId = ++saveRequestId;
    const date = payload.date;
    const currentTitle = payload.title;
    const currentContent = payload.content;

    if (!currentTitle.trim() && payload.isContentEmpty) {
      // Delete empty entry — pass '' so the backend check (text.trim().is_empty()) also passes
      try {
        await deleteEntryIfEmpty(date, currentTitle, '');
        if (isDisposed || requestId !== saveRequestId) return;
        // Refresh entry dates after deletion
        const dates = await getAllEntryDates();
        if (isDisposed || requestId !== saveRequestId) return;
        setEntryDates(dates);
        setWordCount(0);
      } catch (error) {
        log.error('Failed to delete empty entry:', error);
      }
      return;
    }

    // Save entry
    try {
      setIsSaving(true);
      await saveEntry(date, currentTitle, currentContent);
      if (isDisposed || requestId !== saveRequestId) return;

      // Refresh entry dates after save
      const dates = await getAllEntryDates();
      if (isDisposed || requestId !== saveRequestId) return;
      setEntryDates(dates);

      // Update word count from persisted data
      const savedEntry = await getEntry(date);
      if (isDisposed || requestId !== saveRequestId) return;
      if (savedEntry) {
        setWordCount(savedEntry.word_count);
      }
    } catch (error) {
      log.error('Failed to save entry:', error);
    } finally {
      if (!isDisposed && requestId === saveRequestId) {
        setIsSaving(false);
      }
    }
  };

  // Debounced save (500ms after typing stops)
  const debouncedSave = debounce((payload: SavePayload) => {
    void saveCurrentEntry(payload);
  }, 500);

  const handleContentUpdate = (newContent: string) => {
    setContent(newContent);
    // Trigger debounced save (word count will update after save completes)
    debouncedSave(createSavePayload(title(), newContent, selectedDate()));
  };

  const handleTitleInput = (newTitle: string) => {
    setTitle(newTitle);
    // Trigger debounced save
    debouncedSave(createSavePayload(newTitle, content(), selectedDate()));
  };

  const handleTitleEnter = () => {
    // Focus the editor when Enter is pressed in title
    const editor = editorInstance();
    if (editor) {
      editor.commands.focus('end');
    }
  };

  // Save on window unload
  onMount(() => {
    const handleBeforeUnload = () => {
      void saveCurrentEntry(createSavePayload());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    onCleanup(() => {
      isDisposed = true;
      loadRequestId += 1;
      saveRequestId += 1;
      debouncedSave.cancel();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    });
  });

  return (
    <div class="flex h-full flex-col">
      <div class="flex-1 overflow-y-auto p-6">
        <div class="mx-auto w-full max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
          <div class="space-y-4">
            <Show when={!preferences().hideTitles}>
              <TitleEditor
                value={title()}
                onInput={handleTitleInput}
                onEnter={handleTitleEnter}
                placeholder={isLoadingEntry() ? 'Loading...' : 'Title (optional)'}
                spellCheck={preferences().enableSpellcheck}
              />
            </Show>
            <DiaryEditor
              content={content()}
              onUpdate={handleContentUpdate}
              placeholder={isLoadingEntry() ? 'Loading...' : "What's on your mind today?"}
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
