import { createSignal, createEffect, Show, untrack } from 'solid-js';
import { createLogger } from '../../../lib/logger';
import { authState, authMethods, loadAuthMethods, setRequireAllAuth } from '../../../state/auth';
import { journals, activeJournalId } from '../../../state/journals';
import {
  preferences,
  setPreferences,
  MIN_AUTO_LOCK_TIMEOUT,
  MAX_AUTO_LOCK_TIMEOUT,
} from '../../../state/preferences';
import * as tauri from '../../../lib/tauri';
import { mapTauriError } from '../../../lib/errors';
import { useI18n } from '../../../i18n';
import type { TabProps } from './shared';
import { AuthMethodsList } from './AuthMethodsList';
import { AddPasswordForm } from './AddPasswordForm';
import { AddKeypairForm } from './AddKeypairForm';
import { ChangePasswordForm } from './ChangePasswordForm';

const log = createLogger('Preferences');

export default function PreferencesSecurityTab(props: TabProps) {
  const t = useI18n();

  const hasPasswordSlot = () => authMethods().some((m) => m.slot_type === 'password');
  const activeJournal = () => journals().find((j) => j.id === activeJournalId());
  const isAutoProtected = () => activeJournal()?.auto_protected ?? false;
  const hasMultipleNonAutoMethods = () =>
    authMethods().filter((m) => m.slot_type !== 'auto').length >= 2;

  const [autoLockTimeoutDraft, setAutoLockTimeoutDraft] = createSignal(
    String(preferences().autoLockTimeout),
  );

  // Require-all-auth toggle
  const [requireAllAuth, setRequireAllAuthLocal] = createSignal(false);
  const [requireAllAuthError, setRequireAllAuthError] = createSignal<string | null>(null);

  // Reset transient state + reload auth-related data when the overlay opens.
  createEffect(() => {
    if (props.isOpen()) {
      setRequireAllAuthError(null);
      setAutoLockTimeoutDraft(String(untrack(() => preferences().autoLockTimeout)));

      if (authState() === 'unlocked') {
        loadAuthMethods().catch((err) => log.error('Failed to reload auth methods:', err));
        tauri
          .peekAuthSlotTypes()
          .then((peek) => setRequireAllAuthLocal(peek.require_all_auth))
          .catch((err) => log.error('Failed to load require_all_auth:', err));
      }
    }
  });

  const clampAutoLockTimeout = (value: string) =>
    Math.min(MAX_AUTO_LOCK_TIMEOUT, Math.max(MIN_AUTO_LOCK_TIMEOUT, parseInt(value, 10) || 300));

  const isTimeoutBelowMinimum = () =>
    /^\d+$/.test(autoLockTimeoutDraft()) && Number(autoLockTimeoutDraft()) < MIN_AUTO_LOCK_TIMEOUT;

  const persistAutoLockTimeout = (value: string) => {
    const clamped = clampAutoLockTimeout(value);
    setAutoLockTimeoutDraft(String(clamped));
    setPreferences({ autoLockTimeout: clamped });
  };

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
              <span class="text-sm text-secondary">{t('prefs.security.requireAllAuthLabel')}</span>
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
              checked={preferences().autoLockEnabled}
              onChange={(e) => setPreferences({ autoLockEnabled: e.currentTarget.checked })}
              class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
            />
            <span class="text-sm text-secondary">{t('prefs.security.autoLockLabel')}</span>
          </label>
          <label class="flex items-center gap-3">
            <input
              type="checkbox"
              checked={preferences().autoLockOnFocusLoss}
              onChange={(e) => setPreferences({ autoLockOnFocusLoss: e.currentTarget.checked })}
              class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
            />
            <span class="text-sm text-secondary">
              {t('prefs.security.autoLockOnFocusLossLabel')}
            </span>
          </label>
          <Show when={preferences().autoLockEnabled}>
            <div class="flex items-center gap-2 pl-7">
              <label class="text-sm text-secondary whitespace-nowrap">
                {t('prefs.security.autoLockTimeoutLabel')}
              </label>
              <input
                type="number"
                min={MIN_AUTO_LOCK_TIMEOUT}
                max={MAX_AUTO_LOCK_TIMEOUT}
                step="1"
                value={autoLockTimeoutDraft()}
                onInput={(e) => {
                  const next = e.currentTarget.value;
                  setAutoLockTimeoutDraft(next);
                  if (/^\d+$/.test(next)) {
                    const parsed = Number(next);
                    if (parsed >= MIN_AUTO_LOCK_TIMEOUT && parsed <= MAX_AUTO_LOCK_TIMEOUT) {
                      setPreferences({ autoLockTimeout: parsed });
                    }
                  }
                }}
                onBlur={(e) => persistAutoLockTimeout(e.currentTarget.value)}
                class="w-20 px-2 py-1 text-sm border border-primary rounded-md bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-xs text-tertiary">{t('prefs.security.autoLockRange')}</span>
              <Show when={isTimeoutBelowMinimum()}>
                <p class="text-xs text-error" role="alert">
                  {t('prefs.security.autoLockTimeoutTooLow', { min: MIN_AUTO_LOCK_TIMEOUT })}
                </p>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
