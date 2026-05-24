import { createSignal, createEffect, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { PasswordStrengthIndicator } from '../../auth/PasswordStrengthIndicator';
import { loadAuthMethods } from '../../../state/auth';
import * as tauri from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';
import { useI18n } from '../../../i18n';

interface AddPasswordFormProps {
  isOpen: Accessor<boolean>;
}

export function AddPasswordForm(props: AddPasswordFormProps) {
  const t = useI18n();

  const [addPasswordNew, setAddPasswordNew] = createSignal('');
  const [addPasswordConfirm, setAddPasswordConfirm] = createSignal('');
  const [addPasswordError, setAddPasswordError] = createSignal<string | null>(null);
  const [addPasswordSuccess, setAddPasswordSuccess] = createSignal(false);

  createEffect(() => {
    if (props.isOpen()) {
      setAddPasswordNew('');
      setAddPasswordConfirm('');
      setAddPasswordError(null);
      setAddPasswordSuccess(false);
    }
  });

  const handleAddPassword = async () => {
    setAddPasswordError(null);
    setAddPasswordSuccess(false);

    if (!addPasswordNew() || !addPasswordConfirm()) {
      setAddPasswordError(t('prefs.security.addPasswordBothRequired'));
      return;
    }
    if (addPasswordNew() !== addPasswordConfirm()) {
      setAddPasswordError(t('prefs.security.addPasswordMismatch'));
      return;
    }

    try {
      await tauri.registerPassword(addPasswordNew());
      await loadAuthMethods();
      setAddPasswordNew('');
      setAddPasswordConfirm('');
      setAddPasswordSuccess(true);
      setTimeout(() => setAddPasswordSuccess(false), 3000);
    } catch (err) {
      setAddPasswordError(mapTauriError(err, t));
    }
  };

  return (
    <div class="mt-4 pt-4 border-t border-primary">
      <h4 class="text-xs font-medium text-secondary mb-3">
        {t('prefs.security.addPasswordTitle')}
      </h4>
      <p class="text-xs text-tertiary mb-3 leading-relaxed">
        {t('prefs.security.addPasswordHint')}
      </p>

      <div class="mb-3">
        <label for="addPasswordNew" class="mb-2 block text-sm font-medium text-secondary">
          {t('prefs.security.passwordLabel')}{' '}
          <span class="text-xs text-tertiary">{t('prefs.security.passwordHint')}</span>
        </label>
        <input
          id="addPasswordNew"
          type="password"
          value={addPasswordNew()}
          onInput={(e) => setAddPasswordNew(e.currentTarget.value)}
          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('prefs.security.passwordPlaceholder')}
        />
        <PasswordStrengthIndicator password={addPasswordNew()} />
      </div>

      <div class="mb-3">
        <label class="block text-xs font-medium text-secondary mb-1">
          {t('prefs.security.confirmPasswordLabel')}
        </label>
        <input
          type="password"
          value={addPasswordConfirm()}
          onInput={(e) => setAddPasswordConfirm(e.currentTarget.value)}
          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('prefs.security.confirmPasswordPlaceholder')}
        />
      </div>

      <Show when={addPasswordError()}>
        <p class="mb-2 text-sm text-error">{addPasswordError()}</p>
      </Show>
      <Show when={addPasswordSuccess()}>
        <p class="mb-2 text-sm text-success">{t('prefs.security.addPasswordSuccess')}</p>
      </Show>

      <button
        type="button"
        onClick={handleAddPassword}
        class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {t('prefs.security.addPasswordButton')}
      </button>
    </div>
  );
}
