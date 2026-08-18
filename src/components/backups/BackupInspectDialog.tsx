import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { X } from 'lucide-solid';
import * as tauri from '../../lib/tauri';
import type { BackupEntryDiff, SnapshotMeta } from '../../lib/tauri';
import { mapTauriError } from '../../lib/errors';
import { useI18n } from '../../i18n';
import { preferences } from '../../state/preferences';
import { setEntryDates, refreshLockedDates, executeReloadCallbacks } from '../../state/entries';
import { loadAllTags } from '../../state/tags';
import { selectedDate } from '../../state/ui';
import { open as openFileDialog } from '../../lib/dialog';
import { createLogger } from '../../lib/logger';

const log = createLogger('BackupInspectDialog');

type CredentialMode = 'password' | 'keyfile';

interface BackupInspectDialogProps {
  isOpen: boolean;
  snapshot: SnapshotMeta;
  onClose: () => void;
  /** Local-only (passwordless) journal: skip the credential form entirely and open with this
   * device's key, mirroring `unlock_diary_auto` / `PasswordCredential::AutoKey`. */
  autoProtected?: boolean;
}

/**
 * Per-entry restore (Task 4.3): browse one snapshot's entries and copy specific ones into the
 * live journal.
 *
 * Read-only until the user explicitly restores (UX-1): opening the snapshot and listing its
 * entries touches nothing. Restoring never overwrites — a restored entry is always added
 * alongside whatever the live journal already holds on that date (UX-5); the missing/shorter
 * flags (UX-4) are a hint about what is worth restoring, not a restriction on what can be
 * selected.
 *
 * Requires the live journal to already be unlocked — inspection decrypts snapshot content,
 * so this dialog is only reachable from the authenticated Backups panel, never the pre-auth
 * (reduced) one.
 */
export default function BackupInspectDialog(props: BackupInspectDialogProps) {
  const t = useI18n();

  const [credentialDiffers, setCredentialDiffers] = createSignal(false);
  const [mode, setMode] = createSignal<CredentialMode>('password');
  const [password, setPassword] = createSignal('');
  const [keyFilePath, setKeyFilePath] = createSignal('');
  const [isOpeningSnapshot, setIsOpeningSnapshot] = createSignal(false);
  const [openError, setOpenError] = createSignal<string | null>(null);

  const [phase, setPhase] = createSignal<'credential' | 'entries'>('credential');
  const [entries, setEntries] = createSignal<BackupEntryDiff[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = createSignal(false);
  const [listError, setListError] = createSignal<string | null>(null);
  const [selected, setSelected] = createSignal<Set<number>>(new Set());

  const [isRestoring, setIsRestoring] = createSignal(false);
  const [restoreError, setRestoreError] = createSignal<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = createSignal<string | null>(null);

  let opened = false;

  createEffect(() => {
    if (!props.isOpen) return;
    // Best-effort: this is a hint (scenario UX-3), not a gate. A failure here must not block
    // opening the credential form.
    tauri
      .checkBackupCredentials(props.snapshot.file_name)
      .then((report) => setCredentialDiffers(report.compared && report.differs_from_live))
      .catch(() => setCredentialDiffers(false));
  });

  const closeSnapshot = async () => {
    if (!opened) return;
    opened = false;
    try {
      await tauri.closeBackup();
    } catch (err) {
      log.warn('closeBackup failed while tearing down the inspect dialog:', err);
    }
  };

  onCleanup(() => {
    void closeSnapshot();
  });

  const resetForNextOpen = () => {
    setPhase('credential');
    setPassword('');
    setKeyFilePath('');
    setEntries([]);
    setSelected(new Set<number>());
    setOpenError(null);
    setListError(null);
    setRestoreError(null);
    setRestoreSuccess(null);
  };

  const handleClose = () => {
    void closeSnapshot();
    resetForNextOpen();
    props.onClose();
  };

  const handlePickKeyFile = async () => {
    try {
      const selection = await openFileDialog({
        title: t('auth.prompt.keyFileLabel'),
        filters: [{ name: 'Key Files', extensions: ['key', 'txt', '*'] }],
        multiple: false,
        directory: false,
      });
      if (selection && typeof selection === 'string') {
        setKeyFilePath(selection);
        setOpenError(null);
      }
    } catch {
      setOpenError(t('auth.prompt.openFilePickerError'));
    }
  };

  const loadEntries = async () => {
    setIsLoadingEntries(true);
    setListError(null);
    try {
      setEntries(await tauri.listBackupEntriesWithStatus());
    } catch (err) {
      setListError(mapTauriError(err, t));
    } finally {
      setIsLoadingEntries(false);
    }
  };

  const openSnapshot = async (
    credential?: Parameters<typeof tauri.openBackupReadonly>[1],
  ): Promise<void> => {
    setIsOpeningSnapshot(true);
    setOpenError(null);
    try {
      await tauri.openBackupReadonly(props.snapshot.file_name, credential);
      opened = true;
      setPhase('entries');
      await loadEntries();
    } catch (err) {
      setOpenError(mapTauriError(err, t));
    } finally {
      setIsOpeningSnapshot(false);
    }
  };

  // Local-only journals have no password and no key file — `openBackupReadonly` with neither
  // argument is the only way to reach `SnapshotCredential::AutoKey` on the backend, mirroring
  // `unlock_diary_auto`. There is no credential form to show here.
  const handleOpenAutoProtected = () => {
    void openSnapshot(undefined);
  };

  const handleOpenSnapshot = async (e: Event) => {
    e.preventDefault();

    const credential =
      mode() === 'password'
        ? { password: password() }
        : keyFilePath()
          ? { keyPath: keyFilePath() }
          : undefined;

    if (mode() === 'keyfile' && !credential) {
      setOpenError(t('auth.prompt.selectKeyFileError'));
      return;
    }

    await openSnapshot(credential);
  };

  const toggleSelected = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllMissing = () => {
    setSelected(
      new Set(
        entries()
          .filter((entry) => entry.status !== 'present')
          .map((entry) => entry.id),
      ),
    );
  };

  const handleRestore = async () => {
    const ids = [...selected()];
    if (ids.length === 0) return;

    // Captured before the restore call, while `entries()` still holds the pre-restore list,
    // so this reflects which *dates* are about to gain a new entry.
    const restoredDates = new Set(
      entries()
        .filter((entry) => ids.includes(entry.id))
        .map((entry) => entry.date),
    );

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(null);
    try {
      const summary = await tauri.restoreEntriesFromBackup(ids);
      setSelected(new Set<number>());

      // Non-destructive by construction (nothing existing is touched), so unlike the
      // whole-journal restore this does not unconditionally discard the editor's held entry
      // — only the date list and tags, which the newly added entries may have changed.
      try {
        setEntryDates(await tauri.getAllEntryDates());
        await Promise.all([refreshLockedDates(), loadAllTags()]);

        // The one case that does need a nudge: a restored entry landed on the date already
        // open in the editor. That editor fetched its day's entries before this restore
        // happened, so its list (and EntryNavBar's count) is stale until something tells it
        // to refetch — manually confirmed via the dev app: without this, the calendar shows
        // "has entry" immediately but the open editor keeps showing its pre-restore state
        // until the user navigates away and back. Scoped to only this date, not called
        // unconditionally, because `executeReloadCallbacks` cancels any in-flight debounced
        // save on the currently open (unrelated) entry — a cost worth paying only when the
        // editor is actually stale.
        if (restoredDates.has(selectedDate())) {
          await executeReloadCallbacks();
        }
      } catch (err) {
        log.warn('Post-restore state refresh failed:', err);
      }

      setRestoreSuccess(
        t(
          summary.added_count === 1
            ? 'prefs.backups.restoreEntriesSuccess_one'
            : 'prefs.backups.restoreEntriesSuccess_other',
          { count: summary.added_count },
        ),
      );
      await loadEntries();
    } catch (err) {
      setRestoreError(mapTauriError(err, t));
    } finally {
      setIsRestoring(false);
    }
  };

  const locale = () => preferences().language || 'en';
  const formatInstant = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
  };

  const statusLabel = (status: BackupEntryDiff['status']) => {
    if (status === 'missing') return t('prefs.backups.statusMissing');
    if (status === 'shorter_in_live') return t('prefs.backups.statusShorter');
    return t('prefs.backups.statusPresent');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) handleClose();
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            data-testid="backup-inspect-dialog"
            class="relative w-full max-w-xl rounded-lg bg-primary p-8 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'Escape') handleClose();
            }}
          >
            <Dialog.Title class="text-lg font-semibold text-primary mb-2">
              {t('prefs.backups.restoreEntriesTitle')}
            </Dialog.Title>
            <Dialog.Description class="text-xs text-tertiary mb-4">
              {t('prefs.backups.restoreEntriesDescription')}
            </Dialog.Description>

            <div class="overflow-y-auto max-h-[65vh] pr-2 space-y-4">
              <Show when={phase() === 'credential' && props.autoProtected}>
                {/* Local-only journal: no password, no key file — a single click reaches
                    `SnapshotCredential::AutoKey` on the backend (this device's key). */}
                <p class="text-sm text-secondary">{t('prefs.backups.localOnlyNotice')}</p>

                <Show when={openError()}>
                  <p class="text-sm text-error" role="alert">
                    {openError()}
                  </p>
                </Show>

                <button
                  type="button"
                  onClick={handleOpenAutoProtected}
                  disabled={isOpeningSnapshot()}
                  data-testid="backup-inspect-open-button"
                  class="w-full rounded-md interactive-primary px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isOpeningSnapshot()
                    ? t('auth.prompt.unlocking')
                    : t('prefs.backups.viewEntriesButton')}
                </button>
              </Show>

              <Show when={phase() === 'credential' && !props.autoProtected}>
                <p class="text-sm text-secondary">{t('prefs.backups.credentialPrompt')}</p>

                <Show when={credentialDiffers()}>
                  <div
                    class="rounded-md border border-primary bg-tertiary p-3"
                    data-testid="backup-inspect-credential-differs"
                  >
                    <p class="text-xs text-secondary leading-relaxed">
                      {t('prefs.backups.credentialDiffersNotice')}
                    </p>
                  </div>
                </Show>

                <div class="flex rounded-md border border-primary overflow-hidden" role="group">
                  <button
                    type="button"
                    onClick={() => setMode('password')}
                    aria-pressed={mode() === 'password'}
                    class={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      mode() === 'password'
                        ? 'interactive-primary'
                        : 'bg-primary text-secondary hover:bg-hover'
                    }`}
                  >
                    {t('auth.prompt.passwordMode')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('keyfile')}
                    aria-pressed={mode() === 'keyfile'}
                    class={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      mode() === 'keyfile'
                        ? 'interactive-primary'
                        : 'bg-primary text-secondary hover:bg-hover'
                    }`}
                  >
                    {t('auth.prompt.keyFileMode')}
                  </button>
                </div>

                <form onSubmit={handleOpenSnapshot} class="space-y-4">
                  <Show when={mode() === 'password'}>
                    <input
                      type="password"
                      value={password()}
                      onInput={(e) => setPassword(e.currentTarget.value)}
                      disabled={isOpeningSnapshot()}
                      autofocus
                      placeholder={t('auth.prompt.passwordPlaceholder')}
                      autocomplete="current-password"
                      class="w-full rounded-md border border-primary bg-primary px-4 py-2 text-primary focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-tertiary"
                    />
                  </Show>
                  <Show when={mode() === 'keyfile'}>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        value={keyFilePath()}
                        readOnly
                        class="flex-1 rounded-md border border-primary px-4 py-2 text-primary bg-tertiary text-sm"
                        placeholder={t('auth.prompt.keyFilePlaceholder')}
                      />
                      <button
                        type="button"
                        onClick={handlePickKeyFile}
                        disabled={isOpeningSnapshot()}
                        aria-label={t('auth.prompt.keyFileBrowseAria')}
                        class="rounded-md border border-primary px-3 py-2 text-sm font-medium text-secondary hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {t('common.browse')}
                      </button>
                    </div>
                  </Show>

                  <Show when={openError()}>
                    <p class="text-sm text-error" role="alert">
                      {openError()}
                    </p>
                  </Show>

                  <button
                    type="submit"
                    disabled={isOpeningSnapshot()}
                    data-testid="backup-inspect-open-button"
                    class="w-full rounded-md interactive-primary px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isOpeningSnapshot()
                      ? t('auth.prompt.unlocking')
                      : t('prefs.backups.viewEntriesButton')}
                  </button>
                </form>
              </Show>

              <Show when={phase() === 'entries'}>
                <div class="text-xs text-tertiary space-y-0.5">
                  <p>
                    {t('prefs.backups.viewingEntriesFor', {
                      when: formatInstant(props.snapshot.created_at),
                    })}
                  </p>
                  <p data-testid="backup-inspect-entry-count">
                    {props.snapshot.entry_count === null
                      ? '—'
                      : t(
                          props.snapshot.entry_count === 1
                            ? 'prefs.backups.entryCount_one'
                            : 'prefs.backups.entryCount_other',
                          { count: props.snapshot.entry_count },
                        )}
                  </p>
                  <p>{t('prefs.backups.readOnlyNotice')}</p>
                </div>

                <Show when={isLoadingEntries()}>
                  <p class="text-sm text-secondary">{t('prefs.backups.loadingEntries')}</p>
                </Show>

                <Show when={listError()}>
                  <p class="text-sm text-error" role="alert">
                    {listError()}
                  </p>
                </Show>

                <Show when={!isLoadingEntries() && !listError()}>
                  <Show
                    when={entries().length > 0}
                    fallback={
                      <p class="text-sm text-secondary" data-testid="backup-inspect-empty">
                        {t('prefs.backups.noEntries')}
                      </p>
                    }
                  >
                    <button
                      type="button"
                      onClick={selectAllMissing}
                      data-testid="backup-inspect-select-all"
                      class="text-xs text-secondary underline hover:text-primary focus:outline-none"
                    >
                      {t('prefs.backups.selectAllMissing')}
                    </button>

                    <ul class="space-y-1.5" aria-label={t('prefs.backups.restoreEntriesTitle')}>
                      <For each={entries()}>
                        {(entry) => (
                          <li
                            class="flex items-start gap-2 rounded-md border border-primary p-2"
                            data-testid="backup-inspect-entry-item"
                          >
                            <input
                              type="checkbox"
                              checked={selected().has(entry.id)}
                              onChange={() => toggleSelected(entry.id)}
                              disabled={isRestoring()}
                              aria-label={entry.title || entry.date}
                              class="mt-1"
                            />
                            <div class="flex-1 min-w-0">
                              <div class="flex flex-wrap items-baseline justify-between gap-2">
                                <span class="text-sm font-medium text-primary truncate">
                                  {entry.title || entry.date}
                                </span>
                                <span class="text-xs text-tertiary">{entry.date}</span>
                              </div>
                              <p class="text-xs text-secondary truncate">{entry.preview}</p>
                              <span
                                class={
                                  entry.status === 'present'
                                    ? 'text-xs text-tertiary'
                                    : 'text-xs text-error'
                                }
                                data-testid={`backup-inspect-status-${entry.status}`}
                              >
                                {statusLabel(entry.status)}
                              </span>
                            </div>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </Show>

                <Show when={selected().size > 0}>
                  <p class="text-xs text-tertiary">
                    {t(
                      selected().size === 1
                        ? 'prefs.backups.entriesSelectedCount_one'
                        : 'prefs.backups.entriesSelectedCount_other',
                      { count: selected().size },
                    )}
                  </p>
                </Show>

                <Show when={restoreError()}>
                  <p class="text-sm text-error" role="alert">
                    {restoreError()}
                  </p>
                </Show>
                <Show when={restoreSuccess()}>
                  <p
                    class="text-sm text-success"
                    role="status"
                    data-testid="backup-inspect-success"
                  >
                    {restoreSuccess()}
                  </p>
                </Show>

                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={isRestoring() || selected().size === 0}
                  data-testid="backup-inspect-restore-button"
                  class="w-full rounded-md interactive-primary px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRestoring()
                    ? t('prefs.backups.restoringEntries')
                    : t('prefs.backups.restoreSelectedButton')}
                </button>
              </Show>
            </div>

            <Dialog.CloseButton class="absolute top-5 right-5 rounded-md p-1 text-tertiary hover:bg-hover hover:text-secondary focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors">
              <span class="sr-only">{t('common.close')}</span>
              <X size={20} />
            </Dialog.CloseButton>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
