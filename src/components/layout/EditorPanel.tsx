import { createSignal, createEffect, onCleanup, onMount } from 'solid-js';
import TitleEditor from '../editor/TitleEditor';
import DiaryEditor from '../editor/DiaryEditor';
import WordCount from '../editor/WordCount';
import { selectedDate } from '../../state/ui';
import { saveEntry, getEntry, deleteEntryIfEmpty, getAllEntryDates } from '../../lib/tauri';
import { debounce } from '../../lib/debounce';
import { isSaving, setIsSaving, setEntryDates } from '../../state/entries';

export default function EditorPanel() {
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [wordCount, setWordCount] = createSignal(0);
  const [isLoadingEntry, setIsLoadingEntry] = createSignal(false);

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
      console.error('Failed to load entry:', error);
    } finally {
      setIsLoadingEntry(false);
    }
  });

  // Save entry function
  const saveCurrentEntry = async () => {
    const currentTitle = title();
    const currentContent = content();
    const date = selectedDate();

    // Check if entry is empty
    if (!currentTitle.trim() && !currentContent.trim()) {
      // Delete empty entry
      try {
        await deleteEntryIfEmpty(date, currentTitle, currentContent);
        // Refresh entry dates after deletion
        const dates = await getAllEntryDates();
        setEntryDates(dates);
        setWordCount(0);
      } catch (error) {
        console.error('Failed to delete empty entry:', error);
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
      console.error('Failed to save entry:', error);
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
    // Focus will automatically move to editor
    console.log('Title entered, focus should move to editor');
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
        <div class="mx-auto max-w-3xl">
          <div class="space-y-4">
            <TitleEditor
              value={title()}
              onInput={handleTitleInput}
              onEnter={handleTitleEnter}
              placeholder={isLoadingEntry() ? 'Loading...' : 'Title (optional)'}
            />
            <DiaryEditor
              content={content()}
              onUpdate={handleContentUpdate}
              placeholder={isLoadingEntry() ? 'Loading...' : "What's on your mind today?"}
            />
          </div>
        </div>
      </div>

      {/* Footer with word count and save status */}
      <div class="border-t border-gray-200 bg-gray-50 px-6 py-2">
        <div class="flex items-center justify-between">
          <WordCount count={wordCount()} />
          {isSaving() && <p class="text-sm text-gray-500">Saving...</p>}
        </div>
      </div>
    </div>
  );
}
