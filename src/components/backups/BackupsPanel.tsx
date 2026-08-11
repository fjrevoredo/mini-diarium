import { createSignal, createEffect, Show, For } from 'solid-js';
import * as tauri from '../../lib/tauri';
import type { BackupHealth, SnapshotMeta, SnapshotTrigger } from '../../lib/tauri';
import { mapTauriError } from '../../lib/errors';
import { useI18n, type T } from '../../i18n';
import { preferences } from '../../state/preferences';
import { journals, activeJournalId } from '../../state/journals';
import { executeCleanupCallbacks } from '../../state/entries';
import { refreshAfterRestore } from '../../state/session';
import { createLogger } from '../../lib/logger';

const log = createLogger('BackupsPanel');

/**
 * The Backups panel, shared by Preferences → Backups and the unlock screen.
 *
 * Read-only by nature: nothing here modifies a journal. The three actions it does offer
 * (take a snapshot, re-check one, delete one) act on the backups directory, never on
 * entries.
 *
 * `reduced` is the pre-auth mode. The *payload* is identical — snapshot metadata needs no
 * key, which is the whole reason a pre-auth view is possible — so the difference is which
 * command supplies it, that every action requiring the master key is disabled with a reason
 * attached, and that the rendering additionally withholds entry counts and date ranges. That
 * last part is disclosure, not capability: the locked screen shows dates, ages, triggers,
 * sizes and health only, so a passer-by learns that backups exist without learning how much
 * has been written and over what span. That is also why this lives outside `preferences/`:
 * TODO-0094's locked-journal debug dump needs the same affordance.
 */
interface BackupsPanelProps {
  /** Re-run the load whenever this flips to true (overlay opened, view shown). */
  isVisible: () => boolean;
  /** Pre-auth mode: read without a key, disable everything that needs one. */
  reduced?: boolean;
}

/** Bytes as a short human-readable string. Locale-independent by design — the unit is the
 * information, and a translated "GB" buys nothing while risking a wrong unit. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** Renders a snapshot's trigger as translated prose. */
export function describeTrigger(trigger: SnapshotTrigger, t: T): string {
  if (typeof trigger === 'object') {
    return t('prefs.backups.triggerDestructive', { operation: trigger.destructive });
  }
  switch (trigger) {
    case 'unlock':
      return t('prefs.backups.triggerUnlock');
    case 'lock':
      return t('prefs.backups.triggerLock');
    case 'migration':
      return t('prefs.backups.triggerMigration');
    case 'manual':
      return t('prefs.backups.triggerManual');
    case 'pre_restore':
      return t('prefs.backups.triggerPreRestore');
    default:
      return t('prefs.backups.triggerAdopted');
  }
}

export default function BackupsPanel(props: BackupsPanelProps) {
  const t = useI18n();

  const [snapshots, setSnapshots] = createSignal<SnapshotMeta[]>([]);
  const [health, setHealth] = createSignal<BackupHealth | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
  const [busyAction, setBusyAction] = createSignal<'backup' | 'verify' | 'restore' | null>(null);
  const [busyFile, setBusyFile] = createSignal<string | null>(null);

  const isAutoProtected = () =>
    journals().find((j) => j.id === activeJournalId())?.auto_protected ?? false;

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (props.reduced) {
        const overview = await tauri.listBackupsUnauthenticated();
        setSnapshots(overview.snapshots);
        setHealth(overview.health);
      } else {
        const [list, state] = await Promise.all([tauri.listBackups(), tauri.getBackupHealth()]);
        setSnapshots(list);
        setHealth(state);
      }
    } catch (err) {
      setError(mapTauriError(err, t));
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    if (props.isVisible()) void load();
  });

  const handleBackUpNow = async () => {
    setBusyAction('backup');
    setError(null);
    setSuccessMessage(null);
    try {
      await tauri.createBackupNow();
      await load();
    } catch (err) {
      setError(mapTauriError(err, t));
    } finally {
      setBusyAction(null);
    }
  };

  const handleVerify = async (fileName: string) => {
    setBusyAction('verify');
    setBusyFile(fileName);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await tauri.verifyBackup(fileName);
      setSnapshots((current) => current.map((s) => (s.file_name === fileName ? updated : s)));
      setHealth(await tauri.getBackupHealth());
    } catch (err) {
      setError(mapTauriError(err, t));
    } finally {
      setBusyAction(null);
      setBusyFile(null);
    }
  };

  const handleDelete = async (fileName: string) => {
    // Deliberately the browser confirm rather than a native dialog: a native one is a
    // separate OS window that steals focus and would trip the focus-loss auto-lock.
    if (!window.confirm(t('prefs.backups.confirmDelete'))) return;
    setError(null);
    setSuccessMessage(null);
    try {
      await tauri.deleteBackup(fileName);
      await load();
    } catch (err) {
      setError(mapTauriError(err, t));
    }
  };

  const handleRestore = async (snapshot: SnapshotMeta) => {
    // UX-2: name the snapshot, warn that entries written since will be replaced, and state
    // that a safety snapshot is taken first — before anything happens, not after.
    if (
      !window.confirm(
        t('prefs.backups.confirmRestore', { when: formatInstant(snapshot.created_at) }),
      )
    ) {
      return;
    }

    setBusyAction('restore');
    setBusyFile(snapshot.file_name);
    setError(null);
    setSuccessMessage(null);
    try {
      // Flush any pending edit into the live journal first, so it is captured by the safety
      // snapshot the backend takes before swapping the file. Without this, unsaved typing
      // would simply vanish — captured by neither the restored content nor the safety copy.
      await executeCleanupCallbacks();

      const result = await tauri.restoreBackup(snapshot.file_name);

      // The restore is committed and irreversible from this point on — a failure below is
      // cosmetic (a stale view) next to that, and must never land in the same `role="alert"`
      // slot as a failed restore, or a successful restore would read to the user as failed.
      try {
        // The journal now holds different content, but the app's in-memory state (entries,
        // the open editor, tags) still reflects the pre-restore journal. Discard and refetch
        // it before anything else can flush stale content back over the restored entry.
        await refreshAfterRestore();
      } catch (err) {
        log.warn('refreshAfterRestore failed after a successful restore:', err);
      }
      // `load()` catches and reports its own errors via `error()` — it never throws, so a
      // failed list refresh cannot be conflated with a failed restore below.
      await load();

      const safetySnapshot = result.safety_snapshot
        ? snapshots().find((s) => s.file_name === result.safety_snapshot)
        : undefined;
      setSuccessMessage(
        safetySnapshot
          ? t('prefs.backups.restoreSuccess', {
              when: formatInstant(snapshot.created_at),
              safetyWhen: formatInstant(safetySnapshot.created_at),
            })
          : t('prefs.backups.restoreSuccessGeneric', {
              when: formatInstant(snapshot.created_at),
            }),
      );
    } catch (err) {
      setError(mapTauriError(err, t));
    } finally {
      setBusyAction(null);
      setBusyFile(null);
    }
  };

  const handleReveal = async () => {
    setError(null);
    try {
      await tauri.revealBackupsFolder();
    } catch (err) {
      setError(mapTauriError(err, t));
    }
  };

  const locale = () => preferences().language || 'en';

  const formatInstant = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
  };

  const formatAge = (iso: string) => {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.round((then - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
    const scales: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31536000],
      ['month', 2592000],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    for (const [unit, size] of scales) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return rtf.format(Math.round(seconds), 'second');
  };

  /**
   * The single worst thing true of the backups right now, or `null` when all is well.
   * Ordered by how much it costs the user: a folder that cannot be used means no backups
   * at all, a failed attempt means no *new* backups, an exceeded budget only means the
   * newest ones get trimmed.
   */
  const problem = () => {
    const state = health();
    if (!state) return null;
    // `directory_accessible` is "exists and can be listed, or does not exist yet and can be
    // created", so a journal that has simply never been backed up reports true. False means
    // the journal's own folder is gone, or something has taken the backups path's place.
    if (!state.directory_accessible) return t('prefs.backups.healthUnreachable');
    if (state.last_failure)
      return t('prefs.backups.healthFailed', {
        when: formatInstant(state.last_failure.at),
      });
    if (state.budget_exceeded) return t('prefs.backups.healthBudget');
    return null;
  };

  const actionsDisabled = () => props.reduced === true;

  return (
    <div class="space-y-5" data-testid="backups-panel">
      <div>
        <p class="text-xs text-tertiary leading-relaxed">{t('prefs.backups.hint')}</p>
        <Show when={health()}>
          {(state) => (
            <p class="text-xs text-tertiary leading-relaxed mt-1">
              {t('prefs.backups.retentionPolicy', {
                recent: state().recent,
                dailyDays: state().daily_days,
                weeklyWeeks: state().weekly_weeks,
                monthlyMonths: state().monthly_months,
              })}
            </p>
          )}
        </Show>
      </div>

      {/* Local-only journals (UX-7): the backups are real, but they are not portable. */}
      <Show when={isAutoProtected()}>
        <div
          class="rounded-md border border-primary bg-tertiary p-3"
          data-testid="backups-local-only-notice"
        >
          <p class="text-sm font-medium text-primary">{t('prefs.backups.localOnlyTitle')}</p>
          <p class="text-xs text-secondary mt-1 leading-relaxed">
            {t('prefs.backups.localOnlyNotice')}
          </p>
        </div>
      </Show>

      {/* Health */}
      <div>
        <h3 class="text-sm font-medium text-primary mb-2">{t('prefs.backups.statusTitle')}</h3>
        <Show
          when={problem()}
          fallback={
            <Show when={health()}>
              <p class="text-sm text-success" data-testid="backups-health-ok">
                {t('prefs.backups.healthOk')}
              </p>
            </Show>
          }
        >
          {(message) => (
            <p class="text-sm text-error" role="status" data-testid="backups-health-problem">
              {message()}
            </p>
          )}
        </Show>
        <Show when={health()}>
          {(state) => (
            <div class="text-xs text-tertiary mt-1 space-y-0.5">
              <p>
                {state().newest_created_at
                  ? t('prefs.backups.lastBackup', {
                      when: formatInstant(state().newest_created_at as string),
                    })
                  : t('prefs.backups.lastBackupNever')}
              </p>
              <p>
                {t(
                  state().snapshot_count === 1
                    ? 'prefs.backups.countSummary_one'
                    : 'prefs.backups.countSummary_other',
                  { count: state().snapshot_count },
                )}{' '}
                {t('prefs.backups.totalSize', {
                  used: formatBytes(state().total_bytes),
                  budget: formatBytes(state().budget_bytes),
                })}
              </p>
            </div>
          )}
        </Show>
      </div>

      {/* Actions */}
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleBackUpNow}
          disabled={actionsDisabled() || busyAction() === 'backup'}
          data-testid="backups-create-button"
          class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busyAction() === 'backup' ? t('prefs.backups.backingUp') : t('prefs.backups.backUpNow')}
        </button>
        <button
          type="button"
          onClick={handleReveal}
          data-testid="backups-reveal-button"
          class="px-4 py-2 text-sm font-medium text-secondary bg-primary border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {t('prefs.backups.revealFolder')}
        </button>
      </div>

      <Show when={actionsDisabled()}>
        <p class="text-xs text-tertiary" data-testid="backups-locked-hint">
          {t('prefs.backups.actionsNeedUnlock')}
        </p>
      </Show>

      <Show when={error()}>
        <p class="text-sm text-error" role="alert">
          {error()}
        </p>
      </Show>

      <Show when={successMessage()}>
        <p class="text-sm text-success" role="status" data-testid="backups-restore-success">
          {successMessage()}
        </p>
      </Show>

      {/* List */}
      <Show
        when={!isLoading()}
        fallback={<p class="text-sm text-secondary">{t('prefs.backups.loading')}</p>}
      >
        <Show
          when={snapshots().length > 0}
          fallback={
            <p class="text-sm text-secondary" data-testid="backups-empty">
              {props.reduced ? t('prefs.backups.emptyLocked') : t('prefs.backups.empty')}
            </p>
          }
        >
          <ul class="space-y-2" aria-label={t('prefs.backups.listAria')}>
            <For each={snapshots()}>
              {(snapshot) => (
                <li class="rounded-md border border-primary p-3" data-testid="backups-list-item">
                  <div class="flex flex-wrap items-baseline justify-between gap-2">
                    <span class="text-sm font-medium text-primary">
                      {formatInstant(snapshot.created_at)}
                    </span>
                    <span class="text-xs text-tertiary">{formatAge(snapshot.created_at)}</span>
                  </div>
                  <p class="text-xs text-secondary mt-1">
                    {describeTrigger(snapshot.trigger, t)}
                    <Show when={!props.reduced}>
                      {' · '}
                      {snapshot.entry_count === null
                        ? '—'
                        : t(
                            snapshot.entry_count === 1
                              ? 'prefs.backups.entryCount_one'
                              : 'prefs.backups.entryCount_other',
                            { count: snapshot.entry_count },
                          )}
                    </Show>
                    {' · '}
                    {formatBytes(snapshot.byte_size)}
                  </p>
                  <Show when={!props.reduced && snapshot.entry_date_range}>
                    {(range) => (
                      <p class="text-xs text-tertiary mt-0.5">
                        {t('prefs.backups.dateRange', { from: range()[0], to: range()[1] })}
                      </p>
                    )}
                  </Show>
                  <div class="flex flex-wrap items-center gap-2 mt-2">
                    <span
                      class={snapshot.verified ? 'text-xs text-success' : 'text-xs text-tertiary'}
                      title={snapshot.verified ? undefined : t('prefs.backups.unverifiedHint')}
                      data-testid={
                        snapshot.verified ? 'backups-item-verified' : 'backups-item-unverified'
                      }
                    >
                      {snapshot.verified
                        ? t('prefs.backups.verified')
                        : t('prefs.backups.unverified')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleVerify(snapshot.file_name)}
                      disabled={actionsDisabled() || busyFile() === snapshot.file_name}
                      class="px-2 py-1 text-xs font-medium text-secondary border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busyAction() === 'verify' && busyFile() === snapshot.file_name
                        ? t('prefs.backups.verifying')
                        : t('prefs.backups.verify')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestore(snapshot)}
                      disabled={actionsDisabled() || busyFile() === snapshot.file_name}
                      data-testid="backups-restore-button"
                      class="px-2 py-1 text-xs font-medium text-secondary border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busyAction() === 'restore' && busyFile() === snapshot.file_name
                        ? t('prefs.backups.restoring')
                        : t('prefs.backups.restore')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(snapshot.file_name)}
                      disabled={actionsDisabled() || busyFile() === snapshot.file_name}
                      class="px-2 py-1 text-xs font-medium text-destructive border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('prefs.backups.delete')}
                    </button>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
    </div>
  );
}
