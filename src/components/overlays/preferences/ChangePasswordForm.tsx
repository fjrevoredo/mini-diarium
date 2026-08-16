import { createSignal, createEffect, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { PasswordStrengthIndicator } from '../../auth/PasswordStrengthIndicator';
import * as tauri from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';
import { useI18n } from '../../../i18n';

interface ChangePasswordFormProps {
  isOpen: Accessor<boolean>;
}

export function ChangePasswordForm(props: ChangePasswordFormProps) {
  const t = useI18n();

  const [oldPassword, setOldPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [passwordError, setPasswordError] = createSignal<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = createSignal(false);

  createEffect(() => {
    if (props.isOpen()) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);
    }
  });

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!oldPassword() || !newPassword() || !confirmPassword()) {
      setPasswordError(t('prefs.security.allFieldsRequired'));
      return;
    }
    if (newPassword() !== confirmPassword()) {
      setPasswordError(t('prefs.security.passwordsMismatch'));
      return;
    }

    try {
      await tauri.changePassword(oldPassword(), newPassword());
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(mapTauriError(err, t));
    }
  };

  return (
    <div>
      <h3 class="text-sm font-medium text-primary mb-3">
        {t('prefs.security.changePasswordTitle')}
      </h3>

      {/* Persistent, not the auto-dismissing success toast below — a disclosure about your
          existing backups needs to actually be read, not flash for three seconds. */}
      <div
        class="mb-4 rounded-md border border-primary bg-tertiary p-3"
        data-testid="change-password-snapshot-warning"
      >
        <p class="text-xs text-secondary leading-relaxed">
          {t('prefs.security.changePasswordSnapshotWarning')}
        </p>
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium text-secondary mb-2">
          {t('prefs.security.currentPasswordLabel2')}
        </label>
        <input
          type="password"
          value={oldPassword()}
          onInput={(e) => setOldPassword(e.currentTarget.value)}
          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('prefs.security.currentPasswordPlaceholder2')}
        />
      </div>

      <div class="mb-4">
        <label for="newPassword" class="mb-2 block text-sm font-medium text-secondary">
          {t('prefs.security.newPasswordLabel')}{' '}
          <span class="text-xs text-tertiary">{t('prefs.security.newPasswordHint')}</span>
        </label>
        <input
          id="newPassword"
          type="password"
          value={newPassword()}
          onInput={(e) => setNewPassword(e.currentTarget.value)}
          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('prefs.security.newPasswordPlaceholder')}
        />
        <PasswordStrengthIndicator password={newPassword()} />
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium text-secondary mb-2">
          {t('prefs.security.confirmNewPasswordLabel')}
        </label>
        <input
          type="password"
          value={confirmPassword()}
          onInput={(e) => setConfirmPassword(e.currentTarget.value)}
          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={t('prefs.security.confirmNewPasswordPlaceholder')}
        />
      </div>

      <Show when={passwordError()}>
        <div class="mb-4 p-2 bg-error border border-error rounded-md">
          <p class="text-sm text-error">{passwordError()}</p>
        </div>
      </Show>
      <Show when={passwordSuccess()}>
        <div class="mb-4 p-2 bg-success border border-success rounded-md">
          <p class="text-sm text-success">{t('prefs.security.changePasswordSuccess')}</p>
        </div>
      </Show>

      <button
        type="button"
        onClick={handlePasswordChange}
        class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        {t('prefs.security.changePasswordButton')}
      </button>
    </div>
  );
}
