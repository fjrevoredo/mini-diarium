import { createSignal, onMount, For, Show } from 'solid-js';
import { confirm, open, save } from '../../lib/dialog';
import {
  journals,
  activeJournalId,
  switchJournal,
  addJournal,
  removeJournal,
  renameJournal,
} from '../../state/journals';
import { refreshAuthState, error as authError } from '../../state/auth';
import { isFlatpak, loadPlatformInfo } from '../../state/platform';
import { checkJournalPath, getDefaultJournalDir } from '../../lib/tauri';
import { mapTauriError } from '../../lib/errors';
import { useI18n } from '../../i18n';

type AddMode = null | 'create' | 'open';

/** Joins a directory and filename using the directory's own path-separator style. */
function joinPath(dir: string, filename: string): string {
  const separator = dir.includes('\\') ? '\\' : '/';
  return dir.endsWith('/') || dir.endsWith('\\')
    ? `${dir}${filename}`
    : `${dir}${separator}${filename}`;
}

export default function JournalPicker() {
  const t = useI18n();

  const [isWorking, setIsWorking] = createSignal(false);
  const [localError, setLocalError] = createSignal<string | null>(null);
  const [addMode, setAddMode] = createSignal<AddMode>(null);
  const [newName, setNewName] = createSignal('');
  const [newDir, setNewDir] = createSignal('');
  const [dbFilename, setDbFilename] = createSignal<string | undefined>(undefined);
  // Whether the existence guard just refused the save-dialog result. Non-Flatpak's create form
  // has no inline way to change the filename — only Cancel — so this drives a "Choose a
  // different location…" action that re-opens the save dialog instead of leaving the user stuck.
  const [pathConflict, setPathConflict] = createSignal(false);
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal('');

  onMount(() => {
    void loadPlatformInfo();
  });

  const handleOpen = async (id: string) => {
    setLocalError(null);
    setIsWorking(true);
    try {
      await switchJournal(id);
      await refreshAuthState();
    } catch (err) {
      setLocalError(mapTauriError(err, t));
    } finally {
      setIsWorking(false);
    }
  };

  const handleRemove = async (id: string) => {
    const ok = await confirm(t('auth.picker.confirmRemoveMessage'), {
      title: t('auth.picker.confirmRemoveTitle'),
      kind: 'warning',
    });
    if (!ok) return;
    setLocalError(null);
    try {
      await removeJournal(id);
    } catch (err) {
      setLocalError(mapTauriError(err, t));
    }
  };

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const handleFinishRename = async () => {
    const id = renamingId();
    if (!id) return;
    const name = renameValue().trim();
    if (name) {
      try {
        await renameJournal(id, name);
      } catch (err) {
        setLocalError(mapTauriError(err, t));
      }
    }
    setRenamingId(null);
  };

  const handleUseDefaultLocation = async () => {
    setLocalError(null);
    try {
      setNewDir(await getDefaultJournalDir());
    } catch (err) {
      setLocalError(mapTauriError(err, t));
    }
  };

  /** Flatpak-only: overrides the pre-filled default location for the dialog-free create form. */
  const handleBrowseCreateFolder = async () => {
    setLocalError(null);
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('auth.picker.chooseFolderTitle'),
    });
    if (!selected || typeof selected !== 'string') return;
    setNewDir(selected);
  };

  /**
   * Opens the create flow.
   *
   * Non-Flatpak platforms go straight to a native save dialog — the same guarantee Open
   * Existing already gives, so the user always sees and confirms the exact save location.
   * Under Flatpak's zero-`--filesystem=` sandbox that same dialog can hand back a temporary
   * document-portal path instead of a real one (KI-10), so Flatpak shows a dialog-free form
   * with an editable Filename field instead.
   */
  const handleStartCreate = async () => {
    setLocalError(null);
    setPathConflict(false);

    if (isFlatpak()) {
      setAddMode('create');
      if (!dbFilename()) setDbFilename('diary.db');
      if (!newDir()) await handleUseDefaultLocation();
      return;
    }

    let defaultDir: string;
    try {
      defaultDir = await getDefaultJournalDir();
    } catch (err) {
      setLocalError(mapTauriError(err, t));
      return;
    }
    const selected = await save({
      defaultPath: joinPath(defaultDir, 'diary.db'),
      filters: [{ name: 'Database Files', extensions: ['db'] }],
      title: t('auth.picker.createSaveDialogTitle'),
    });
    if (!selected) return;

    const parentDir = selected.replace(/[/\\][^/\\]*$/, '');
    const filename = selected.split(/[/\\]/).pop() || 'diary.db';
    const stemName = filename.replace(/\.db$/i, '') || 'My Journal';
    setNewDir(parentDir);
    setDbFilename(filename);
    if (!newName()) setNewName(stemName);
    setAddMode('create');
  };

  const handleConfirmCreate = async () => {
    const name = newName().trim();
    const dir = newDir();
    if (!name) {
      setLocalError(t('auth.picker.nameRequired'));
      return;
    }
    const filename = isFlatpak() ? dbFilename()?.trim() || 'diary.db' : dbFilename();
    setLocalError(null);
    setPathConflict(false);
    setIsWorking(true);
    try {
      const exists = await checkJournalPath(joinPath(dir, filename ?? 'diary.db'));
      if (exists) {
        setLocalError(t('auth.picker.alreadyExistsError'));
        setPathConflict(true);
        setIsWorking(false);
        return;
      }
      const journal = await addJournal(name, dir, filename);
      await switchJournal(journal.id);
      await refreshAuthState();
    } catch (err) {
      setLocalError(mapTauriError(err, t));
      setIsWorking(false);
    }
  };

  const handleBrowseOpen = async () => {
    setLocalError(null);
    const selected = await open({
      filters: [{ name: 'Database Files', extensions: ['db'] }],
      multiple: false,
      directory: false,
      title: t('auth.picker.selectFolderTitle'),
    });
    if (!selected || typeof selected !== 'string') return;

    const found = await checkJournalPath(selected);
    if (!found) {
      setLocalError(t('auth.picker.noJournalFound'));
      setAddMode('open');
      return;
    }

    const parentDir = selected.replace(/[/\\][^/\\]*$/, '');
    const filename = selected.split(/[/\\]/).pop() || 'diary.db';
    const stemName = filename.replace(/\.db$/i, '') || 'My Journal';
    setNewDir(parentDir);
    setDbFilename(filename);
    if (!newName()) setNewName(stemName);
    setAddMode('open');
  };

  const handleConfirmOpen = async () => {
    const name = newName().trim();
    const dir = newDir();
    if (!name) {
      setLocalError(t('auth.picker.nameRequired'));
      return;
    }
    setLocalError(null);
    setIsWorking(true);
    try {
      const journal = await addJournal(name, dir, dbFilename());
      await switchJournal(journal.id);
      await refreshAuthState();
    } catch (err) {
      setLocalError(mapTauriError(err, t));
      setIsWorking(false);
    }
  };

  const cancelAdd = () => {
    setAddMode(null);
    setNewName('');
    setNewDir('');
    setDbFilename(undefined);
    setPathConflict(false);
    setLocalError(null);
  };

  const displayError = () => localError() ?? authError();

  return (
    <div
      data-testid="journal-picker"
      class="flex flex-col h-full items-center bg-tertiary px-4 py-6"
    >
      <div class="my-auto w-full max-w-md">
        <div class="rounded-lg bg-primary px-8 py-8 shadow-lg">
          {/* Header */}
          <div class="mb-3 flex justify-center">
            <img src="/logo-transparent.svg" alt="Mini Diarium" class="h-16 w-16 rounded-xl" />
          </div>
          <h1 class="mb-6 text-center text-3xl font-bold text-primary">{t('auth.picker.title')}</h1>

          {/* Error banner */}
          <Show when={displayError()}>
            <div role="alert" class="mb-4 rounded-md bg-error p-3">
              <p class="text-sm text-error">{displayError()}</p>
            </div>
          </Show>

          {/* Journal list */}
          <Show when={journals().length > 0}>
            <h2 class="mb-3 text-sm font-semibold text-secondary uppercase tracking-wide">
              {t('auth.picker.yourJournals')}
            </h2>
            <ul
              aria-label={t('auth.picker.yourJournalsAria')}
              class="space-y-2 mb-6 max-h-96 overflow-y-auto"
            >
              <For each={journals()}>
                {(journal) => (
                  <li class="rounded-md border border-primary bg-tertiary p-3">
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1 min-w-0">
                        <Show
                          when={renamingId() === journal.id}
                          fallback={
                            <button
                              type="button"
                              class="text-sm font-medium text-primary cursor-pointer hover:text-blue-600 text-left w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                              title={t('auth.picker.renameAria', { name: journal.name })}
                              aria-label={t('auth.picker.renameAria', { name: journal.name })}
                              onClick={() => handleStartRename(journal.id, journal.name)}
                            >
                              {journal.name}
                              <Show when={activeJournalId() === journal.id}>
                                <span class="ml-2 inline-block px-2 py-0.5 text-xs rounded-full btn-active">
                                  {t('auth.picker.lastUsed')}
                                </span>
                              </Show>
                            </button>
                          }
                        >
                          <input
                            type="text"
                            value={renameValue()}
                            onInput={(e) => setRenameValue(e.currentTarget.value)}
                            onBlur={() => handleFinishRename()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void handleFinishRename();
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            autofocus
                            class="w-full px-2 py-1 text-sm border border-primary bg-primary text-primary rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </Show>
                        <p
                          class="text-xs text-tertiary font-mono truncate mt-1"
                          title={journal.path}
                        >
                          {journal.path}
                        </p>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          data-testid="journal-open-button"
                          onClick={() => handleOpen(journal.id)}
                          disabled={isWorking()}
                          class="rounded-md interactive-primary px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('auth.picker.openButton')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(journal.id)}
                          disabled={isWorking()}
                          class="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-destructive hover:bg-hover focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('auth.picker.removeButton')}
                        </button>
                      </div>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          {/* Empty state */}
          <Show when={journals().length === 0}>
            <p class="mb-6 text-center text-sm text-secondary">{t('auth.picker.empty')}</p>
          </Show>

          {/* Add Journal section */}
          <div class="border-t border-primary pt-5">
            <Show when={addMode() === null}>
              <div class="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleStartCreate()}
                  disabled={isWorking()}
                  class="flex-1 rounded-md interactive-primary px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('auth.picker.createNew')}
                </button>
                <button
                  type="button"
                  onClick={() => handleBrowseOpen()}
                  disabled={isWorking()}
                  class="flex-1 rounded-md border border-primary px-4 py-2.5 text-sm font-medium text-secondary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('auth.picker.openExisting')}
                </button>
              </div>
            </Show>

            {/* Create form */}
            <Show when={addMode() === 'create'}>
              <div class="space-y-3">
                <p class="text-xs font-medium text-secondary">{t('auth.picker.createFormTitle')}</p>
                <div>
                  <label class="block text-xs font-medium text-secondary mb-1">
                    {t('auth.picker.nameLabel')}
                  </label>
                  <input
                    type="text"
                    value={newName()}
                    onInput={(e) => setNewName(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleConfirmCreate();
                    }}
                    autofocus
                    class="w-full rounded-md border border-primary px-3 py-2 text-sm text-primary bg-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('auth.picker.namePlaceholder')}
                  />
                </div>

                {/* Flatpak: no native dialog was used, so the filename and location are
                    still editable here (KI-10). */}
                <Show when={isFlatpak()}>
                  <div>
                    <label class="block text-xs font-medium text-secondary mb-1">
                      {t('auth.picker.filenameLabel')}
                    </label>
                    <input
                      type="text"
                      value={dbFilename() ?? ''}
                      onInput={(e) => setDbFilename(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleConfirmCreate();
                      }}
                      class="w-full rounded-md border border-primary px-3 py-2 text-sm text-primary bg-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-secondary mb-1">
                      {t('auth.picker.locationLabel')}
                    </label>
                    <div class="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => handleBrowseCreateFolder()}
                        class="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-secondary hover:bg-hover focus:outline-none"
                      >
                        {t('common.browseDotDotDot')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUseDefaultLocation()}
                        class="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-secondary hover:bg-hover focus:outline-none"
                      >
                        {t('auth.picker.useDefaultLocation')}
                      </button>
                      <Show when={newDir()}>
                        <p class="text-xs text-tertiary font-mono truncate" title={newDir()}>
                          {newDir()}
                        </p>
                      </Show>
                    </div>
                    <p class="mt-1 text-xs text-tertiary">{t('auth.picker.defaultLocationHint')}</p>
                  </div>
                </Show>

                {/* Everywhere else: the location was already confirmed in the native save
                    dialog, so this is a read-only reminder, not an editable field. When the
                    existence guard refuses it, this is the only way back to a different one —
                    there is no inline Filename field to edit instead. */}
                <Show when={!isFlatpak() && newDir()}>
                  <p class="mt-1 text-xs text-tertiary font-mono break-all">{newDir()}</p>
                  <Show when={pathConflict()}>
                    <button
                      type="button"
                      onClick={() => {
                        // Clear the auto-filled name too — it was derived from the rejected
                        // file, so keeping it would pair a stale name with the new one.
                        setNewName('');
                        void handleStartCreate();
                      }}
                      class="text-xs text-tertiary hover:text-secondary underline focus:outline-none"
                    >
                      {t('auth.picker.chooseAnotherLocation')}
                    </button>
                  </Show>
                </Show>

                <div class="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmCreate()}
                    disabled={isWorking() || !newDir()}
                    class="rounded-md interactive-primary px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isWorking() ? t('auth.picker.creating') : t('common.add')}
                  </button>
                  <button
                    type="button"
                    onClick={cancelAdd}
                    class="rounded-md border border-primary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover focus:outline-none"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            </Show>

            {/* Open existing form */}
            <Show when={addMode() === 'open'}>
              <div class="space-y-3">
                <p class="text-xs font-medium text-secondary">{t('auth.picker.openFormTitle')}</p>
                <div>
                  <button
                    type="button"
                    onClick={() => handleBrowseOpen()}
                    class="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-secondary hover:bg-hover focus:outline-none"
                  >
                    {t('common.browseDotDotDot')}
                  </button>
                  <Show when={newDir()}>
                    <p class="mt-1 text-xs text-tertiary font-mono break-all">{newDir()}</p>
                  </Show>
                </div>
                <Show when={newDir()}>
                  <div>
                    <label class="block text-xs font-medium text-secondary mb-1">
                      {t('auth.picker.nameLabel')}
                    </label>
                    <input
                      type="text"
                      value={newName()}
                      onInput={(e) => setNewName(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleConfirmOpen();
                      }}
                      autofocus
                      class="w-full rounded-md border border-primary px-3 py-2 text-sm text-primary bg-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('auth.picker.journalNamePlaceholder')}
                    />
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmOpen()}
                      disabled={isWorking()}
                      class="rounded-md interactive-primary px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isWorking() ? t('auth.picker.opening') : t('common.open')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelAdd}
                      class="rounded-md border border-primary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover focus:outline-none"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </Show>
                <Show when={!newDir()}>
                  <button
                    type="button"
                    onClick={cancelAdd}
                    class="text-xs text-tertiary hover:text-secondary underline focus:outline-none"
                  >
                    {t('common.cancel')}
                  </button>
                </Show>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
