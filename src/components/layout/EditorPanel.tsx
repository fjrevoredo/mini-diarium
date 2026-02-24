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
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [wordCount, setWordCount] = createSignal(0);
  const [isLoadingEntry, setIsLoadingEntry] = createSignal(false);
  const [editorInstance, setEditorInstance] = createSignal<Editor | null>(null);

  // Load entry when selected date changes
  createEffect(async () => {
    const date = selectedDate();
    setIsLoadingEntry(true);

    try {
      const entry = await getEntry(date);
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
      setIsLoadingEntry(false);
    }
  });

  // Save entry function
  const saveCurrentEntry = async () => {
    const currentTitle = title();
    const currentContent = content();
    const date = selectedDate();

    // Check if entry is empty — use TipTap's isEmpty to correctly handle <p></p>
    const editor = editorInstance();
    const isContentEmpty =
      editor && !editor.isDestroyed
        ? editor.isEmpty || editor.getText().trim() === ''
        : !currentContent.trim();

    if (!currentTitle.trim() && isContentEmpty) {
      // Delete empty entry — pass '' so the backend check (text.trim().is_empty()) also passes
      try {
        await deleteEntryIfEmpty(date, currentTitle, '');
        // Refresh entry dates after deletion
        const dates = await getAllEntryDates();
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

      // Refresh entry dates after save
      const dates = await getAllEntryDates();
      setEntryDates(dates);

      // Update word count from persisted data
      const savedEntry = await getEntry(date);
      if (savedEntry) {
        setWordCount(savedEntry.word_count);
      }
    } catch (error) {
      log.error('Failed to save entry:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced save (500ms after typing stops)
  const debouncedSave = debounce(saveCurrentEntry, 500);

  const handleContentUpdate = (newContent: string) => {
    setContent(newContent);
    // Trigger debounced save (word count will update after save completes)
    debouncedSave();
  };

  const handleTitleInput = (newTitle: string) => {
    setTitle(newTitle);
    // Trigger debounced save
    debouncedSave();
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
      saveCurrentEntry();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    onCleanup(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save on component cleanup
      saveCurrentEntry();
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
