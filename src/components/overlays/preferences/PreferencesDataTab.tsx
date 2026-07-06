import { createSignal, createEffect, Show } from 'solid-js';
import { confirm as dialogConfirm, open as openDirDialog } from '../../../lib/dialog';
import { createLogger } from '../../../lib/logger';
import * as tauri from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';
import { useI18n } from '../../../i18n';
import type { TabProps } from './shared';

const log = createLogger('Preferences');

export default function PreferencesDataTab(props: TabProps) {
  const t = useI18n();

  const [journalPath, setJournalPath] = createSignal<string>('');
  const [changeDirError, setChangeDirError] = createSignal<string | null>(null);
  const [isChangingDir, setIsChangingDir] = createSignal(false);

  // Load (and reload on overlay re-open) the journal path
  createEffect(() => {
    if (props.isOpen()) {
      setChangeDirError(null);
      setIsChangingDir(false);
      tauri
        .getJournalPath()
        .then(setJournalPath)
        .catch((err) => log.error('Failed to load journal path:', err));
    }
  });

  const handleResetJournal = async () => {
    const confirmed = await dialogConfirm(t('prefs.data.resetConfirmMessage'), {
      title: t('prefs.data.resetConfirmTitle'),
      kind: 'warning',
    });
    if (!confirmed) return;

    const doubleConfirmed = await dialogConfirm(t('prefs.data.resetDoubleConfirmMessage'), {
      title: t('prefs.data.resetDoubleConfirmTitle'),
      kind: 'warning',
    });
    if (!doubleConfirmed) return;

    try {
      await tauri.resetJournal();
      // The journal will be locked and reset, which will trigger the auth state to change
      window.location.reload();
    } catch (err) {
      const message = mapTauriError(err, t);
      alert(t('prefs.data.resetFailedAlert', { message }));
    }
  };

  const handleChangeJournalDirectory = async () => {
    setChangeDirError(null);
    const selected = await openDirDialog({
      directory: true,
      multiple: false,
      title: t('prefs.data.changeDirectoryTitle'),
    });
    if (!selected || typeof selected !== 'string') return;
    setIsChangingDir(true);
    try {
      await tauri.changeJournalDirectory(selected);
      window.location.reload();
    } catch (err) {
      setChangeDirError(mapTauriError(err, t));
    } finally {
      setIsChangingDir(false);
    }
  };

  return (
    <div
      id="pref-panel-data"
      role="tabpanel"
      aria-labelledby="pref-tab-data"
      tabIndex={0}
      class="space-y-6 focus:outline-none"
    >
      {/* Current Path */}
      <div>
        <label class="block text-sm font-medium text-secondary mb-2">
          {t('prefs.data.currentLocationLabel')}
        </label>
        <div class="px-3 py-3 bg-tertiary border border-primary rounded-md text-sm text-secondary font-mono break-all">
          {journalPath() || t('layout.loading')}
        </div>
      </div>

      {/* Change Location */}
      <div class="space-y-2">
        <button
          type="button"
          onClick={handleChangeJournalDirectory}
          disabled={isChangingDir()}
          class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isChangingDir() ? t('prefs.data.moving') : t('prefs.data.changeLocation')}
        </button>
        <Show when={changeDirError()}>
          <p class="text-sm text-error">{changeDirError()}</p>
        </Show>
        <p class="text-xs text-tertiary">{t('prefs.data.changeLocationHint')}</p>
      </div>

      {/* Reset Journal */}
      <div class="space-y-2">
        <button
          type="button"
          onClick={handleResetJournal}
          class="px-4 py-2 text-sm font-medium interactive-destructive rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          {t('prefs.data.resetJournal')}
        </button>
        <p class="text-xs text-tertiary leading-relaxed">{t('prefs.data.resetJournalHint')}</p>
      </div>
    </div>
  );
}
