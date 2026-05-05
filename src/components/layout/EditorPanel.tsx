import { createSignal, createEffect, onCleanup, onMount, Show, untrack } from 'solid-js';
import { Editor } from '@tiptap/core';
import { createLogger } from '../../lib/logger';
import { useI18n } from '../../i18n';
import TitleEditor from '../editor/TitleEditor';
import DiaryEditor from '../editor/DiaryEditor';
import WordCount from '../editor/WordCount';
import { EntryNavBar } from '../editor/EntryNavBar';
import { selectedDate } from '../../state/ui';
import { readTextFile } from '../../lib/tauri';
import type { DiaryEntry } from '../../lib/tauri';
import { formatTimestamp } from '../../lib/dates';
import { isSaving } from '../../state/entries';
import { preferences } from '../../state/preferences';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { parseMarkdownToHtml } from '../../lib/markdown';
import { mapTauriError } from '../../lib/errors';
import { countWordsInHtml, countWordsFromText } from '../../lib/wordcount';
import {
  useEditorEmptyCheck,
  computeIsEmpty,
  editorHasImages,
} from './editor-panel/useEditorEmptyCheck';
import { useEntryLifecycle } from './editor-panel/useEntryLifecycle';
import { useMultiEntryNav } from './editor-panel/useMultiEntryNav';

const log = createLogger('Editor');

export default function EditorPanel() {
  const t = useI18n();
  const [title, setTitle] = createSignal('');
  const [content, setContent] = createSignal('');
  const [wordCount, setWordCount] = createSignal(0);
  const [_isLoadingEntry, setIsLoadingEntry] = createSignal(false);
  const [editorInstance, setEditorInstance] = createSignal<Editor | null>(null);

  // Multi-entry state (shared between lifecycle + nav hooks).
  const [dayEntries, setDayEntries] = createSignal<DiaryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [pendingEntryId, setPendingEntryId] = createSignal<number | null>(null);
  const [isCreatingEntry, setIsCreatingEntry] = createSignal(false);

  const [importError, setImportError] = createSignal<string | null>(null);

  const emptyCheck = useEditorEmptyCheck({ editorInstance, content });

  const lifecycle = useEntryLifecycle({
    selectedDate,
    editorInstance,
    title,
    setTitle,
    content,
    setContent,
    setWordCount,
    dayEntries,
    setDayEntries,
    currentIndex,
    setCurrentIndex,
    pendingEntryId,
    setPendingEntryId,
    isCreatingEntry,
    setIsCreatingEntry,
    setIsLoadingEntry,
    emptyCheck,
  });

  const nav = useMultiEntryNav({
    t,
    selectedDate,
    editorInstance,
    title,
    setTitle,
    content,
    setContent,
    setWordCount,
    dayEntries,
    setDayEntries,
    currentIndex,
    setCurrentIndex,
    pendingEntryId,
    setPendingEntryId,
    isCreatingEntry,
    setIsCreatingEntry,
    emptyCheck,
    lifecycle,
  });

  createEffect(() => {
    void lifecycle.loadEntriesForDate(selectedDate());
  });

  const handleContentUpdate = (newContent: string) => {
    lifecycle.setJustCreatedEntryId(null); // user typed — entry is no longer "just created"
    setContent(newContent);
    // Update the reactive trigger so isContentEmpty() re-evaluates with TipTap's actual
    // document state. Fires after TipTap processes the content, not when the SolidJS
    // content() signal is set — closes the timing gap where editor.isEmpty is stale.
    const edInst = editorInstance();
    emptyCheck.setEditorIsEmpty(computeIsEmpty(edInst, newContent));
    setWordCount(
      edInst && !edInst.isDestroyed
        ? countWordsFromText(edInst.getText())
        : countWordsInHtml(newContent),
    );
    const id = pendingEntryId();
    if (id !== null) {
      lifecycle.debouncedSave(id, title(), newContent);
    } else {
      // Skip creation on programmatic updates (loading an empty day fires onUpdate with empty content).
      const editor = editorInstance();
      const isEmpty = editor
        ? editor.isEmpty || (editor.getText().trim() === '' && !editorHasImages(editor))
        : newContent.trim() === '';
      if (isEmpty) return;
      log.debug('handleContentUpdate: pendingEntryId=null, first real content keystroke');
      lifecycle.startEntryCreation('handleContentUpdate');
    }
  };

  const handleTitleInput = (newTitle: string) => {
    lifecycle.setJustCreatedEntryId(null); // user typed — entry is no longer "just created"
    setTitle(newTitle);
    const id = pendingEntryId();
    if (id !== null) {
      lifecycle.debouncedSave(id, newTitle, content());
    } else {
      if (newTitle.trim() === '') return;
      log.debug(`handleTitleInput: pendingEntryId=null, title='${newTitle.substring(0, 20)}'`);
      lifecycle.startEntryCreation('handleTitleInput');
    }
  };

  const handleTitleEnter = () => {
    const editor = editorInstance();
    if (editor) {
      editor.commands.focus('end');
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

    if (emptyCheck.isContentEmpty()) {
      // Empty entry: replace content — triggers onUpdate → handleContentUpdate →
      // auto-creates entry if needed, then queues debouncedSave.
      editor.commands.setContent(html, { emitUpdate: true });
    } else {
      // Non-empty entry: append after horizontal rule separator.
      editor.chain().focus('end').setHorizontalRule().insertContent(html).run();
    }
  };

  // Save on window unload
  onMount(() => {
    const handleBeforeUnload = () => {
      const id = pendingEntryId();
      if (id !== null) {
        const edInst = editorInstance();
        const currentContent = edInst && !edInst.isDestroyed ? edInst.getHTML() : content();
        void lifecycle.saveCurrentById(id, title(), currentContent);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    onCleanup(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      lifecycle.dispose();
    });
  });

  return (
    <div class="flex h-full flex-col">
      <EntryNavBar
        total={dayEntries().length}
        index={currentIndex()}
        onPrev={() => void nav.navigateToEntry(currentIndex() - 1)}
        onNext={() => void nav.navigateToEntry(currentIndex() + 1)}
        onGoTo={(idx) => void nav.navigateToEntry(idx)}
        onAdd={() => void nav.addEntry()}
        addDisabled={isCreatingEntry() || pendingEntryId() === null || emptyCheck.isContentEmpty()}
        addTitle={
          isCreatingEntry()
            ? t('editor.addEntryCreating')
            : pendingEntryId() === null || emptyCheck.isContentEmpty()
              ? t('editor.addEntryHint')
              : t('editor.addEntryTitle')
        }
        onDelete={nav.handleDeleteEntry}
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
                emptyCheck.setEditorIsEmpty(isEmpty);
                // When a blank entry is programmatically loaded, trigger the debounce so it
                // gets auto-deleted (replaces the onUpdate path suppressed by emitUpdate:false).
                if (isEmpty) {
                  const id = untrack(pendingEntryId);
                  // Skip the auto-delete debounce for freshly created entries — see
                  // justCreatedEntryId comment in useEntryLifecycle.ts. For blank entries
                  // loaded from DB (e.g. on navigation or date reload), justCreatedEntryId
                  // is null/mismatched and the debounce fires normally.
                  if (id !== null && id !== lifecycle.getJustCreatedEntryId()) {
                    lifecycle.debouncedSave(id, untrack(title), untrack(content));
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
