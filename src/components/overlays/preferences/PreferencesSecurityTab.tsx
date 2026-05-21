import { createSignal, createEffect, Show, onMount, onCleanup } from 'solid-js';
import { createLogger } from '../../../lib/logger';
import { authState, authMethods, loadAuthMethods, setRequireAllAuth } from '../../../state/auth';
import { journals, activeJournalId } from '../../../state/journals';
import { preferences, setPreferences } from '../../../state/preferences';
import * as tauri from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';
import { useI18n } from '../../../i18n';
import { usePreferencesShell, type TabProps } from './shared';
import { AuthMethodsList } from './AuthMethodsList';
import { AddPasswordForm } from './AddPasswordForm';
import { AddKeypairForm } from './AddKeypairForm';
import { ChangePasswordForm } from './ChangePasswordForm';

const log = createLogger('Preferences');

export default function PreferencesSecurityTab(props: TabProps) {
  const t = useI18n();
  const shell = usePreferencesShell();

  const hasPasswordSlot = () => authMethods().some((m) => m.slot_type === 'password');
  const activeJournal = () => journals().find((j) => j.id === activeJournalId());
  const isAutoProtected = () => activeJournal()?.auto_protected ?? false;
  const hasMultipleNonAutoMethods = () =>
    authMethods().filter((m) => m.slot_type !== 'auto').length >= 2;

  // Buffered auto-lock fields — committed on Save
  const [localAutoLockEnabled, setLocalAutoLockEnabled] = createSignal(
    preferences().autoLockEnabled,
  );
  const [localAutoLockTimeout, setLocalAutoLockTimeout] = createSignal(
    String(preferences().autoLockTimeout),
  );

  // Require-all-auth toggle
  const [requireAllAuth, setRequireAllAuthLocal] = createSignal(false);
  const [requireAllAuthError, setRequireAllAuthError] = createSignal<string | null>(null);

  // Re-init buffered + transient fields whenever the overlay re-opens
  createEffect(() => {
    if (props.isOpen()) {
      setLocalAutoLockEnabled(preferences().autoLockEnabled);
      setLocalAutoLockTimeout(String(preferences().autoLockTimeout));
      setRequireAllAuthError(null);

      if (authState() === 'unlocked') {
        loadAuthMethods().catch((err) => log.error('Failed to reload auth methods:', err));
        tauri
          .peekAuthSlotTypes()
          .then((peek) => setRequireAllAuthLocal(peek.require_all_auth))
          .catch((err) => log.error('Failed to load require_all_auth:', err));
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

  const handleToggleRequireAllAuth = async (checked: boolean) => {
    setRequireAllAuthError(null);
    try {
      await setRequireAllAuth(checked);
      setRequireAllAuthLocal(checked);
    } catch (err) {
      setRequireAllAuthError(mapTauriError(err, t));
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

        <AuthMethodsList isOpen={props.isOpen} />

        <Show when={!hasPasswordSlot()}>
          <AddPasswordForm isOpen={props.isOpen} />
        </Show>

        <AddKeypairForm isOpen={props.isOpen} />
      </div>

      {/* Require All Auth — hidden for auto-protected journals */}
      <Show when={!isAutoProtected()}>
        <div>
          <h3 class="text-sm font-medium text-primary mb-3">
            {t('prefs.security.requireAllAuthTitle')}
          </h3>
          <p class="text-xs text-tertiary mb-4 leading-relaxed">
            {t('prefs.security.requireAllAuthHint')}
          </p>
          <Show
            when={hasMultipleNonAutoMethods()}
            fallback={
              <p class="text-xs text-tertiary italic">
                {t('prefs.security.requireAllAuthNeedsTwo')}
              </p>
            }
          >
            <label class="flex items-center gap-3">
              <input
                type="checkbox"
                checked={requireAllAuth()}
                onChange={(e) => handleToggleRequireAllAuth(e.currentTarget.checked)}
                class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
              />
              <span class="text-sm text-primary">{t('prefs.security.requireAllAuthLabel')}</span>
            </label>
            <Show when={requireAllAuthError()}>
              <p class="mt-2 text-sm text-error">{requireAllAuthError()}</p>
            </Show>
          </Show>
        </div>
      </Show>

      {/* Change Password — only shown when a password slot exists */}
      <Show when={hasPasswordSlot()}>
        <ChangePasswordForm isOpen={props.isOpen} />
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
