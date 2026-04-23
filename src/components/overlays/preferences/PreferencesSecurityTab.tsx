import { createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import { save, confirm as dialogConfirm } from '@tauri-apps/plugin-dialog';
import { PasswordStrengthIndicator } from '../../auth/PasswordStrengthIndicator';
import { createLogger } from '../../../lib/logger';
import { authState, authMethods, loadAuthMethods } from '../../../state/auth';
import { preferences, setPreferences } from '../../../state/preferences';
import * as tauri from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';
import { useI18n } from '../../../i18n';
import { usePreferencesShell, type TabProps } from './shared';

const log = createLogger('Preferences');

export default function PreferencesSecurityTab(props: TabProps) {
  const t = useI18n();
  const shell = usePreferencesShell();

  const hasPasswordSlot = () => authMethods().some((m) => m.slot_type === 'password');

  // Buffered auto-lock fields — committed on Save
  const [localAutoLockEnabled, setLocalAutoLockEnabled] = createSignal(
    preferences().autoLockEnabled,
  );
  const [localAutoLockTimeout, setLocalAutoLockTimeout] = createSignal(
    String(preferences().autoLockTimeout),
  );

  // Change-password fields
  const [oldPassword, setOldPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [passwordError, setPasswordError] = createSignal<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = createSignal(false);

  // Add-keypair fields
  const [addKeypairPassword, setAddKeypairPassword] = createSignal('');
  const [addKeypairLabel, setAddKeypairLabel] = createSignal('');
  const [addKeypairError, setAddKeypairError] = createSignal<string | null>(null);
  const [addKeypairSuccess, setAddKeypairSuccess] = createSignal(false);

  // Remove-auth-method fields
  const [removePassword, setRemovePassword] = createSignal('');
  const [removeError, setRemoveError] = createSignal<string | null>(null);

  // Add-password fields (shown when no password slot exists)
  const [addPasswordNew, setAddPasswordNew] = createSignal('');
  const [addPasswordConfirm, setAddPasswordConfirm] = createSignal('');
  const [addPasswordError, setAddPasswordError] = createSignal<string | null>(null);
  const [addPasswordSuccess, setAddPasswordSuccess] = createSignal(false);

  // Re-init buffered + transient fields whenever the overlay re-opens
  createEffect(() => {
    if (props.isOpen()) {
      setLocalAutoLockEnabled(preferences().autoLockEnabled);
      setLocalAutoLockTimeout(String(preferences().autoLockTimeout));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);
      setAddKeypairPassword('');
      setAddKeypairLabel('');
      setAddKeypairError(null);
      setAddKeypairSuccess(false);
      setRemovePassword('');
      setRemoveError(null);
      setAddPasswordNew('');
      setAddPasswordConfirm('');
      setAddPasswordError(null);
      setAddPasswordSuccess(false);

      if (authState() === 'unlocked') {
        loadAuthMethods().catch((err) => log.error('Failed to reload auth methods:', err));
      }
    }
  });

  onMount(() => {
    const unregister = shell.registerCommit(
      // Invoked imperatively from the shell's Save click handler (tracked scope);
      // signal reads inside are intentional snapshots of the buffered draft.
      // eslint-disable-next-line solid/reactivity
      () => {
        setPreferences({
          autoLockEnabled: localAutoLockEnabled(),
          autoLockTimeout: Math.min(999, Math.max(1, parseInt(localAutoLockTimeout(), 10) || 300)),
        });
      },
    );
    onCleanup(unregister);
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

  const handleGenerateAndRegisterKeypair = async () => {
    setAddKeypairError(null);
    setAddKeypairSuccess(false);

    if (hasPasswordSlot() && !addKeypairPassword()) {
      setAddKeypairError(t('prefs.security.keypairPasswordRequired'));
      return;
    }
    if (!addKeypairLabel()) {
      setAddKeypairError(t('prefs.security.keypairLabelRequired'));
      return;
    }

    try {
      // Step 1: Validate password before any file operations (only when a password slot exists)
      if (hasPasswordSlot()) {
        await tauri.verifyPassword(addKeypairPassword());
      }

      // Step 2: Generate keypair (in-memory, no side effects yet)
      const kp = await tauri.generateKeypair();

      // Step 3: Prompt user to choose a save path
      const savePath = await save({
        title: t('prefs.security.savePrivateKeyTitle'),
        defaultPath: `mini-diarium-${addKeypairLabel().replace(/\s+/g, '-')}.key`,
        filters: [{ name: 'Key Files', extensions: ['key'] }],
      });
      if (!savePath) {
        setAddKeypairError(t('prefs.security.keypairFileCancelled'));
        return;
      }

      // Step 4: Register public key with the journal (DB write first) so a
      // failed registration never touches disk.
      await tauri.registerKeypair(
        hasPasswordSlot() ? addKeypairPassword() : null,
        kp.public_key_hex,
        addKeypairLabel(),
      );

      // Step 5: Write private key to disk only after DB confirms registration
      await tauri.writeKeyFile(savePath, kp.private_key_hex);

      await loadAuthMethods();

      setAddKeypairSuccess(true);
      setAddKeypairPassword('');
      setAddKeypairLabel('');
      setTimeout(() => setAddKeypairSuccess(false), 4000);
    } catch (err) {
      setAddKeypairError(mapTauriError(err, t));
    }
  };

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

  const handleRemoveAuthMethod = async (slotId: number) => {
    setRemoveError(null);

    if (hasPasswordSlot() && !removePassword()) {
      setRemoveError(t('prefs.security.removeError'));
      return;
    }

    if (hasPasswordSlot()) {
      try {
        // Validate password before showing the confirmation dialog
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
    <div
      id="pref-panel-security"
      role="tabpanel"
      aria-labelledby="pref-tab-security"
      tabIndex={0}
      class="space-y-8 focus:outline-none"
    >
      {/* Authentication Methods */}
      <div>
        <h3 class="text-sm font-medium text-primary mb-3">
          {t('prefs.security.authMethodsTitle')}
        </h3>
        <p class="text-xs text-tertiary mb-4 leading-relaxed">
          {t('prefs.security.authMethodsHint')}
        </p>

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

        {/* Add Password section — shown only when no password slot exists */}
        <Show when={!hasPasswordSlot()}>
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
        </Show>

        {/* Add Keypair section */}
        <div class="mt-4 pt-4 border-t border-primary">
          <h4 class="text-xs font-medium text-secondary mb-3">{t('prefs.security.addKeyTitle')}</h4>

          <div class="mb-3">
            <label class="block text-xs font-medium text-secondary mb-1">
              {t('prefs.security.labelLabel')}
            </label>
            <input
              type="text"
              value={addKeypairLabel()}
              onInput={(e) => setAddKeypairLabel(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('prefs.security.labelPlaceholder')}
            />
          </div>

          <Show when={hasPasswordSlot()}>
            <div class="mb-3">
              <label class="block text-xs font-medium text-secondary mb-1">
                {t('prefs.security.currentPasswordLabel')}
              </label>
              <input
                type="password"
                value={addKeypairPassword()}
                onInput={(e) => setAddKeypairPassword(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('prefs.security.currentPasswordPlaceholder')}
              />
            </div>
          </Show>

          <Show when={addKeypairError()}>
            <p class="mb-2 text-sm text-error">{addKeypairError()}</p>
          </Show>
          <Show when={addKeypairSuccess()}>
            <p class="mb-2 text-sm text-success">{t('prefs.security.addKeySuccess')}</p>
          </Show>

          <button
            type="button"
            onClick={handleGenerateAndRegisterKeypair}
            class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {t('prefs.security.generateRegister')}
          </button>
          <p class="mt-2 text-xs text-tertiary leading-relaxed">
            {t('prefs.security.generateHint')}
          </p>
        </div>
      </div>

      {/* Change Password — only shown when a password slot exists */}
      <Show when={hasPasswordSlot()}>
        <div>
          <h3 class="text-sm font-medium text-primary mb-3">
            {t('prefs.security.changePasswordTitle')}
          </h3>

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
      </Show>

      {/* Auto-Lock */}
      <div>
        <h3 class="text-sm font-medium text-primary mb-3">{t('prefs.security.autoLockTitle')}</h3>
        <div class="space-y-3">
          <label class="flex items-center gap-3">
            <input
              type="checkbox"
              checked={localAutoLockEnabled()}
              onChange={(e) => setLocalAutoLockEnabled(e.currentTarget.checked)}
              class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
            />
            <span class="text-sm text-primary">{t('prefs.security.autoLockLabel')}</span>
          </label>
          <Show when={localAutoLockEnabled()}>
            <div class="flex items-center gap-2 pl-7">
              <label class="text-sm text-secondary whitespace-nowrap">
                {t('prefs.security.autoLockTimeoutLabel')}
              </label>
              <input
                type="number"
                min="1"
                max="999"
                step="1"
                value={localAutoLockTimeout()}
                onInput={(e) => setLocalAutoLockTimeout(e.currentTarget.value)}
                onBlur={(e) => {
                  const v = Math.min(999, Math.max(1, parseInt(e.currentTarget.value, 10) || 300));
                  setLocalAutoLockTimeout(String(v));
                }}
                class="w-20 px-2 py-1 text-sm border border-primary rounded-md bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-xs text-tertiary">{t('prefs.security.autoLockRange')}</span>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
