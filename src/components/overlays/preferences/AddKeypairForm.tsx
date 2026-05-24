import { createSignal, createEffect, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import { save } from '@tauri-apps/plugin-dialog';
import { authMethods, loadAuthMethods } from '../../../state/auth';
import * as tauri from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';
import { useI18n } from '../../../i18n';

interface AddKeypairFormProps {
  isOpen: Accessor<boolean>;
}

export function AddKeypairForm(props: AddKeypairFormProps) {
  const t = useI18n();
  const hasPasswordSlot = () => authMethods().some((m) => m.slot_type === 'password');

  const [addKeypairPassword, setAddKeypairPassword] = createSignal('');
  const [addKeypairLabel, setAddKeypairLabel] = createSignal('');
  const [addKeypairError, setAddKeypairError] = createSignal<string | null>(null);
  const [addKeypairSuccess, setAddKeypairSuccess] = createSignal(false);

  createEffect(() => {
    if (props.isOpen()) {
      setAddKeypairPassword('');
      setAddKeypairLabel('');
      setAddKeypairError(null);
      setAddKeypairSuccess(false);
    }
  });

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

  return (
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
      <p class="mt-2 text-xs text-tertiary leading-relaxed">{t('prefs.security.generateHint')}</p>
    </div>
  );
}
