import { createSignal, createEffect, onCleanup, onMount, Show, untrack } from 'solid-js';
import { Editor } from '@tiptap/core';
import { createLogger } from '../../lib/logger';
import { useI18n } from '../../i18n';
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
  readTextFile,
} from '../../lib/tauri';
import type { DiaryEntry } from '../../lib/tauri';
import { debounce } from '../../lib/debounce';
import { formatTimestamp } from '../../lib/dates';
import { isSaving, setIsSaving, setEntryDates, registerCleanupCallback } from '../../state/entries';
import { preferences } from '../../state/preferences';
import { confirm, open as openDialog } from '@tauri-apps/plugin-dialog';
import { parseMarkdownToHtml } from '../../lib/markdown';
import { mapTauriError } from '../../lib/errors';
import { countWordsInHtml, countWordsFromText } from '../../lib/wordcount';

const log = createLogger('Editor');

export default function EditorPanel() {
  const t = useI18n();
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [wordCount, setWordCount] = createSignal(0);
  const [_isLoadingEntry, setIsLoadingEntry] = createSignal(false);
  const [editorInstance, setEditorInstance] = createSignal<Editor | null>(null);

  // Multi-entry state
  const [dayEntries, setDayEntries] = createSignal<DiaryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [pendingEntryId, setPendingEntryId] = createSignal<number | null>(null);

  const [importError, setImportError] = createSignal<string | null>(null);

  let isDisposed = false;
  let pendingCreationPromise: Promise<DiaryEntry> | null = null;
  let loadRequestId = 0;
  let saveRequestId = 0;
  // Guards the onSetContent(isEmpty=true) auto-delete debounce for an entry that was
  // just created by addEntry(). The race: addEntry() calls debouncedSave.cancel()
  // synchronously (line 290), but DiaryEditor's createEffect runs as a SolidJS
  // microtask — at the `await getAllEntryDates()` on line 293 — AFTER cancel() has
  // already returned. onSetContent(isEmpty=true) then re-queues debouncedSave on a
  // fresh timer that was never cancelled, deleting the entry before the user types.
  //
  // Set in addEntry() after the new entry's ID is known. Cleared on first real user
  // input in handleContentUpdate() or handleTitleInput(). While set, the onSetContent
  // callback skips queuing the auto-delete debounce for this specific entry ID.
  //
  // Note: navigateToEntry and loadEntriesForDate are unaffected — they call
  // saveCurrentById() directly, which still cleans up blank entries on navigation.
  let justCreatedEntryId: number | null = null;
  const [isCreatingEntry, setIsCreatingEntry] = createSignal(false);
  // Reactive trigger: updated by handleContentUpdate (user edits via onUpdate) and by
  // the onSetContent callback from DiaryEditor (programmatic loads via setContent).
  // Forces isContentEmpty() to re-evaluate AFTER TipTap updates editor.isEmpty.
  // Without this, addDisabled evaluates when setPendingEntryId() fires but editor.isEmpty
  // is still stale from the previous entry — causing the wrong addDisabled state.
  // onSetContent also triggers debouncedSave for blank entries (auto-deletion on navigation)
  // because emitUpdate:false suppresses the onUpdate path that previously handled this.
  const [editorIsEmpty, setEditorIsEmpty] = createSignal(true);

  // Backend returns entries newest-first; reverse so index 0 = oldest and index N-1 = newest.
  // This makes the counter read "1/N … N/N" in chronological order and puts new entries last.
  const fetchEntriesOrdered = async (date: string): Promise<DiaryEntry[]> => {
    const entries = await getEntriesForDate(date);
    return entries.slice().reverse();
  };

  const isContentEmpty = () => {
    // Access editorIsEmpty() to add it as a reactive dependency. This forces re-evaluation
    // when handleContentUpdate sets it (after TipTap fires onUpdate), not only when
    // editorInstance() or content() changes. The actual empty check still reads
    // editor.isEmpty directly so it reflects TipTap's current document state.
    editorIsEmpty();
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
        const updatedEntries = dayEntries().filter((e) => e.id !== entryId);
        setDayEntries(updatedEntries);
        const dates = await getAllEntryDates();
        if (isDisposed || requestId !== saveRequestId) return;
        setEntryDates(dates);
        if (updatedEntries.length > 0) {
          // Other entries remain — navigate to the nearest so the editor always shows
          // real content after a blank entry is auto-deleted. Without this, switching
          // days and back leaves pendingEntryId=null with stale blank content,
          // permanently disabling the "+" button (Bug 2).
          const newIdx = Math.min(currentIndex(), updatedEntries.length - 1);
          const entry = updatedEntries[newIdx];
          setCurrentIndex(newIdx);
          setPendingEntryId(entry.id);
          setTitle(entry.title);
          setContent(entry.text);
          setWordCount(countWordsInHtml(entry.text));
          // Prevent the debounced save that setContent triggers via TipTap —
          // the remaining entry is already persisted and has not changed.
          debouncedSave.cancel();
        } else {
          // No entries remain — reset so the next keystroke creates a fresh entry.
          setPendingEntryId(null);
          setCurrentIndex(0);
          setWordCount(0);
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
  // eslint-disable-next-line solid/reactivity
  const debouncedSave = debounce((entryId: number, titleArg: string, contentArg: string) => {
    void saveCurrentById(entryId, titleArg, contentArg);
  }, 500);

  // Load entries for a date
  const loadEntriesForDate = async (date: string) => {
    const requestId = ++loadRequestId;
    setIsLoadingEntry(true);

    // Flush any pending save for the current entry before switching dates.
    // Without this, the onSetContent(isEmpty=true) callback on the new date's blank entry
    // calls debouncedSave() with the new entry's args, resetting the timer and replacing
    // the pending save for the current entry — silently discarding edits (incl. alignment).
    //
    // Critical: ALL signal reads here must go through untrack(). This block runs
    // synchronously before the first await, still inside the createEffect tracking scope.
    // Without untrack(), pendingEntryId/title/content and — via saveCurrentById's
    // synchronous isContentEmpty() call — editorIsEmpty/editorInstance would all become
    // reactive dependencies of the calling effect, causing loadEntriesForDate to re-fire
    // on every keystroke (reactive loop).
    const currentId = untrack(pendingEntryId);
    if (currentId !== null) {
      debouncedSave.cancel();
      const savedTitle = untrack(title);
      // Read directly from the TipTap editor instance rather than the content() signal.
      // Alignment changes (style="text-align: X") are node-attribute transactions in TipTap.
      // If onUpdate timing is inconsistent or the signal is stale for any reason, content()
      // would silently save the pre-alignment HTML. editor.getHTML() always reflects the
      // true current document state, capturing alignment even if onUpdate hasn't propagated.
      const edInst = untrack(editorInstance);
      const savedContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : untrack(content);
      // untrack() wraps the call so saveCurrentById's synchronous body (isContentEmpty reads)
      // is also isolated from the outer effect's tracking scope.
      await untrack(() => saveCurrentById(currentId, savedTitle, savedContent));
      if (isDisposed || requestId !== loadRequestId) return;
    }

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
        setWordCount(countWordsInHtml(entry.text));
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
    // Save current first — read from editor directly to capture alignment (see loadEntriesForDate comment).
    const currentId = pendingEntryId();
    if (currentId !== null) {
      debouncedSave.cancel();
      const edInst = editorInstance();
      const currentContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : content();
      await saveCurrentById(currentId, title(), currentContent);
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
      setWordCount(countWordsInHtml(entry.text));
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
      // Save current first — read from editor directly to capture alignment (see loadEntriesForDate comment).
      const currentId = pendingEntryId();
      if (currentId !== null) {
        debouncedSave.cancel();
        const edInst = editorInstance();
        const currentContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : content();
        await saveCurrentById(currentId, title(), currentContent);
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
      justCreatedEntryId = newEntry.id;
      setTitle('');
      setContent('');
      setWordCount(0);
      // Cancel any previously queued debounced save from the current entry before
      // switching to the new blank entry — prevents saving the wrong entry data.
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

  const startEntryCreation = (reason: string) => {
    if (isCreatingEntry()) {
      log.debug(`${reason}: isCreatingEntry guard fired — skipping duplicate creation`);
      return;
    }
    log.info(`${reason}: pendingEntryId null — creating entry for date ${selectedDate()}`);
    setIsCreatingEntry(true);
    const creationPromise = createEntry(selectedDate());
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
        setPendingEntryId(newEntry.id);
        const refreshed = await fetchEntriesOrdered(selectedDate());
        if (!isDisposed) setDayEntries(refreshed);
        debouncedSave(newEntry.id, title(), content());
      } catch (error) {
        pendingCreationPromise = null;
        log.error(`${reason}: failed to create entry:`, error);
      } finally {
        setIsCreatingEntry(false);
      }
    })();
  };

  const handleContentUpdate = (newContent: string) => {
    justCreatedEntryId = null; // user typed — entry is no longer "just created"
    setContent(newContent);
    // Update the reactive trigger so isContentEmpty() re-evaluates with TipTap's actual
    // document state. This fires after TipTap processes the content, not when the SolidJS
    // content() signal is set — closing the timing gap where editor.isEmpty is stale.
    const edInst = editorInstance();
    setEditorIsEmpty(
      edInst && !edInst.isDestroyed
        ? edInst.isEmpty || edInst.getText().trim() === ''
        : newContent.trim() === '',
    );
    setWordCount(
      edInst && !edInst.isDestroyed
        ? countWordsFromText(edInst.getText())
        : countWordsInHtml(newContent),
    );
    const id = pendingEntryId();
    if (id !== null) {
      debouncedSave(id, title(), newContent);
    } else {
      // Skip creation on programmatic updates (loading an empty day fires onUpdate with empty content)
      const editor = editorInstance();
      const isEmpty = editor
        ? editor.isEmpty || editor.getText().trim() === ''
        : newContent.trim() === '';
      if (isEmpty) return;
      log.debug('handleContentUpdate: pendingEntryId=null, first real content keystroke');
      startEntryCreation('handleContentUpdate');
    }
  };

  const handleDeleteEntry = async () => {
    if (dayEntries().length <= 1) return;

    const confirmed = await confirm(t('editor.deleteConfirmMessage'), {
      title: t('editor.deleteConfirmTitle'),
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
        setWordCount(countWordsInHtml(entry.text));
        setDayEntries(refreshed);
        setCurrentIndex(newIndex);
      }
    } catch (error) {
      log.error('Failed to delete entry:', error);
    }
  };

  const handleImportMarkdown = async () => {
    setImportError(null);

    const editor = editorInstance();
    if (!editor || editor.isDestroyed) {
      setImportError(t('editor.importMarkdownNoEditor'));
      return;
    }

    let filePath: string | null;
    try {
      filePath = (await openDialog({
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      })) as string | null;
    } catch (err) {
      log.error('Failed to open file dialog:', err);
      return;
    }
    if (!filePath) return; // user cancelled

    let markdown: string;
    try {
      markdown = await readTextFile(filePath);
    } catch (err) {
      log.error('Failed to read markdown file:', err);
      setImportError(mapTauriError(err, t));
      return;
    }

    const html = parseMarkdownToHtml(markdown);

    if (isContentEmpty()) {
      // Empty entry: replace content — triggers onUpdate → handleContentUpdate →
      // auto-creates entry if needed, then queues debouncedSave.
      editor.commands.setContent(html, { emitUpdate: true });
    } else {
      // Non-empty entry: append after horizontal rule separator.
      // setHorizontalRule() uses the ProseMirror command directly (more reliable than
      // parsing '<hr />' from an HTML string in insertContent).
      editor.chain().focus('end').setHorizontalRule().insertContent(html).run();
      // insertContent triggers onUpdate → handleContentUpdate → debouncedSave.
    }
  };

  const handleTitleInput = (newTitle: string) => {
    justCreatedEntryId = null; // user typed — entry is no longer "just created"
    setTitle(newTitle);
    const id = pendingEntryId();
    if (id !== null) {
      debouncedSave(id, newTitle, content());
    } else {
      if (newTitle.trim() === '') return;
      log.debug(`handleTitleInput: pendingEntryId=null, title='${newTitle.substring(0, 20)}'`);
      startEntryCreation('handleTitleInput');
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
        const edInst = editorInstance();
        const currentContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : content();
        void saveCurrentById(id, title(), currentContent);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // eslint-disable-next-line solid/reactivity -- cleanup callback runs imperatively on journal lock, not in a reactive tracking scope; reading signals here is intentional snapshot behaviour
    const unregister = registerCleanupCallback(async () => {
      // If a createEntry() call is in-flight, await it and save immediately.
      // This window (pendingCreationPromise non-null) is the core of the race:
      // the cleanup callback fires before the DB is locked but after typing started,
      // so pendingEntryId is still null and the normal save path below would skip.
      if (pendingCreationPromise !== null) {
        try {
          const newEntry = await pendingCreationPromise;
          const capturedTitle = title();
          const edInst = editorInstance();
          const capturedContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : content();
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
      const currentId = pendingEntryId();
      if (currentId !== null) {
        const edInst = editorInstance();
        const currentContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : content();
        await saveCurrentById(currentId, title(), currentContent);
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
            ? t('editor.addEntryCreating')
            : pendingEntryId() === null || isContentEmpty()
              ? t('editor.addEntryHint')
              : t('editor.addEntryTitle')
        }
        onDelete={handleDeleteEntry}
        deleteDisabled={isCreatingEntry() || dayEntries().length <= 1}
        deleteTitle={t('editor.deleteEntry')}
      />
      <div class="flex-1 overflow-y-auto p-6">
        <div class="mx-auto w-full max-w-3xl xl:max-w-5xl 2xl:max-w-6xl">
          <div class="space-y-4">
            <Show when={!preferences().hideTitles}>
              <TitleEditor
                value={title()}
                onInput={handleTitleInput}
                onEnter={handleTitleEnter}
                placeholder={t('editor.titleOptionalPlaceholder')}
                spellCheck={preferences().enableSpellcheck}
              />
              <Show when={preferences().showEntryTimestamps}>
                <Show when={dayEntries()[currentIndex()]}>
                  {(entry) => (
                    <div class="flex flex-wrap gap-x-4 gap-y-0.5">
                      <p class="text-xs text-tertiary">
                        {t('editor.timestampCreated', {
                          timestamp: formatTimestamp(entry().date_created, preferences().language),
                        })}
                      </p>
                      <Show when={entry().date_updated !== entry().date_created}>
                        <p class="text-xs text-tertiary">
                          {t('editor.timestampUpdated', {
                            timestamp: formatTimestamp(
                              entry().date_updated,
                              preferences().language,
                            ),
                          })}
                        </p>
                      </Show>
                    </div>
                  )}
                </Show>
              </Show>
            </Show>
            <DiaryEditor
              content={content()}
              onUpdate={handleContentUpdate}
              onSetContent={(isEmpty) => {
                setEditorIsEmpty(isEmpty);
                // When a blank entry is programmatically loaded, trigger the debounce so it
                // gets auto-deleted (replaces the onUpdate path suppressed by emitUpdate:false).
                // untrack() prevents signal reads from being tracked by DiaryEditor's effect.
                if (isEmpty) {
                  const id = untrack(pendingEntryId);
                  // Skip the auto-delete debounce for freshly created entries — see justCreatedEntryId
                  // comment above. For blank entries loaded from DB (e.g. on navigation or date reload),
                  // justCreatedEntryId is null/mismatched and the debounce fires normally.
                  if (id !== null && id !== justCreatedEntryId) {
                    debouncedSave(id, untrack(title), untrack(content));
                  }
                }
              }}
              placeholder={t('editor.editorPlaceholder')}
              onEditorReady={setEditorInstance}
              spellCheck={preferences().enableSpellcheck}
              onImportMarkdown={handleImportMarkdown}
            />
          </div>
        </div>
      </div>

      {/* Import markdown error banner */}
      <Show when={importError()}>
        <div class="px-6 pt-2">
          <div role="alert" class="rounded-md bg-error p-3 flex items-center justify-between gap-2">
            <p class="text-sm text-error">{importError()}</p>
            <button
              onClick={() => setImportError(null)}
              class="text-sm text-error hover:opacity-75 flex-shrink-0"
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>
        </div>
      </Show>

      {/* Footer with word count and save status */}
      <div class="border-t border-primary bg-tertiary px-6 py-2">
        <div class="flex items-center justify-between">
          <WordCount count={wordCount()} />
          {isSaving() && <p class="text-sm text-tertiary">{t('editor.saving')}</p>}
        </div>
      </div>
    </div>
  );
}
