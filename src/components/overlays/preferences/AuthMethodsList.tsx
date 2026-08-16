import { createSignal, createEffect, For, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { confirm as dialogConfirm } from '../../../lib/dialog';
import { authMethods, loadAuthMethods } from '../../../state/auth';
import * as tauri from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';
import { useI18n } from '../../../i18n';

interface AuthMethodsListProps {
  isOpen: Accessor<boolean>;
  /** Switches Preferences to the Backups tab. Omitted where there is nowhere to switch to
   * (e.g. a future non-Preferences host for this list). */
  onReviewBackups?: () => void;
}

export function AuthMethodsList(props: AuthMethodsListProps) {
  const t = useI18n();
  const hasPasswordSlot = () => authMethods().some((m) => m.slot_type === 'password');

  const [removePassword, setRemovePassword] = createSignal('');
  const [removeError, setRemoveError] = createSignal<string | null>(null);
  // Dismissible, not auto-timed: a removed credential still opening every existing backup is
  // a genuine threat-model fact, not a convenience toast that can be allowed to disappear on
  // its own.
  const [showRemovedNotice, setShowRemovedNotice] = createSignal(false);

  createEffect(() => {
    if (props.isOpen()) {
      setRemovePassword('');
      setRemoveError(null);
      setShowRemovedNotice(false);
    }
  });

  const handleRemoveAuthMethod = async (slotId: number) => {
    setRemoveError(null);

    if (hasPasswordSlot() && !removePassword()) {
      setRemoveError(t('prefs.security.removeError'));
      return;
    }

    if (hasPasswordSlot()) {
      try {
        await tauri.verifyPassword(removePassword());
      } catch (err) {
        setRemoveError(mapTauriError(err, t));
        return;
      }
    }

    const confirmed = await dialogConfirm(t('prefs.security.confirmRemoveMessage'), {
      title: t('prefs.security.confirmRemoveTitle'),
      kind: 'warning',
    });
    if (!confirmed) return;

    try {
      await tauri.removeAuthMethod(slotId, hasPasswordSlot() ? removePassword() : null);
      await loadAuthMethods();
      setRemovePassword('');
      setShowRemovedNotice(true);
    } catch (err) {
      setRemoveError(mapTauriError(err, t));
    }
  };

  const handleReviewBackups = () => {
    setShowRemovedNotice(false);
    props.onReviewBackups?.();
  };

  return (
    <>
      {/* Registered methods list */}
      <div class="space-y-2 mb-6">
        <For each={authMethods()}>
          {(method) => (
            <div class="flex items-center justify-between p-3 bg-tertiary border border-primary rounded-md">
              <div>
                <p class="text-sm font-medium text-primary">
                  {method.label}
                  <span class="ml-2 text-xs text-tertiary">
                    (
                    {method.slot_type === 'password'
                      ? t('prefs.security.password')
                      : t('prefs.security.keyFile')}
                    )
                  </span>
                </p>
                <Show when={method.last_used}>
                  <p class="text-xs text-tertiary">
                    {t('prefs.security.lastUsed', {
                      date: method.last_used!.slice(0, 10),
                    })}
                  </p>
                </Show>
              </div>
              <Show when={authMethods().length > 1}>
                <button
                  type="button"
                  onClick={() => handleRemoveAuthMethod(method.id)}
                  class="text-xs text-destructive focus:outline-none"
                >
                  {t('prefs.security.removeMethod')}
                </button>
              </Show>
            </div>
          )}
        </For>
      </div>

      {/* Password for removal */}
      <Show when={authMethods().length > 1}>
        <Show when={hasPasswordSlot()}>
          <div class="mb-4">
            <label class="block text-xs font-medium text-secondary mb-1">
              {t('prefs.security.currentPwdRequired')}
            </label>
            <input
              type="password"
              value={removePassword()}
              onInput={(e) => setRemovePassword(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('prefs.security.currentPwdPlaceholder')}
            />
          </div>
        </Show>
        <Show when={removeError()}>
          <p class="mb-4 text-sm text-error">{removeError()}</p>
        </Show>
      </Show>

      {/* Post-removal disclosure: dismissible, not auto-timed — see the signal above. */}
      <Show when={showRemovedNotice()}>
        <div
          class="mb-4 flex items-start justify-between gap-3 rounded-md border border-primary bg-tertiary p-3"
          data-testid="removed-method-notice"
        >
          <p class="text-xs text-secondary leading-relaxed">
            {t('prefs.security.removedMethodStillValidWarning')}
          </p>
          <div class="flex shrink-0 items-center gap-2">
            <Show when={props.onReviewBackups}>
              <button
                type="button"
                onClick={handleReviewBackups}
                class="text-xs font-medium text-primary underline focus:outline-none"
              >
                {t('prefs.security.reviewBackupsButton')}
              </button>
            </Show>
            <button
              type="button"
              onClick={() => setShowRemovedNotice(false)}
              aria-label={t('common.close')}
              class="text-xs text-tertiary hover:text-secondary focus:outline-none"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
