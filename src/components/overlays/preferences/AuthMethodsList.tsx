import { createSignal, createEffect, For, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { confirm as dialogConfirm } from '@tauri-apps/plugin-dialog';
import { authMethods, loadAuthMethods } from '../../../state/auth';
import * as tauri from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';
import { useI18n } from '../../../i18n';

interface AuthMethodsListProps {
  isOpen: Accessor<boolean>;
}

export function AuthMethodsList(props: AuthMethodsListProps) {
  const t = useI18n();
  const hasPasswordSlot = () => authMethods().some((m) => m.slot_type === 'password');

  const [removePassword, setRemovePassword] = createSignal('');
  const [removeError, setRemoveError] = createSignal<string | null>(null);

  createEffect(() => {
    if (props.isOpen()) {
      setRemovePassword('');
      setRemoveError(null);
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
    } catch (err) {
      setRemoveError(mapTauriError(err, t));
    }
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
    </>
  );
}
