import {
  createSignal,
  createEffect,
  For,
  Show,
  Switch,
  Match,
  onMount,
  createMemo,
} from 'solid-js';
import { PasswordStrengthIndicator } from '../auth/PasswordStrengthIndicator';
import { save, confirm as dialogConfirm, open as openDirDialog } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Dialog } from '@kobalte/core/dialog';
import { createLogger } from '../../lib/logger';
import { preferences, setPreferences, type EscAction } from '../../state/preferences';
import {
  getThemePreference,
  setTheme,
  getActiveTheme,
  type ThemePreference,
} from '../../lib/theme';
import {
  saveThemeOverrides,
  applyThemeOverrides,
  resetThemeOverrides,
  getThemeOverridesJson,
  parseOverridesJson,
} from '../../lib/theme-overrides';
import { authState } from '../../state/auth';
import * as tauri from '../../lib/tauri';
import { mapTauriError } from '../../lib/errors';
import { useI18n } from '../../i18n';

interface PreferencesOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const log = createLogger('Preferences');

type Tab = 'general' | 'writing' | 'security' | 'data' | 'advanced';

export default function PreferencesOverlay(props: PreferencesOverlayProps) {
  const t = useI18n();

  // First day of week options — reactive so labels are translated
  const FIRST_DAY_OPTIONS = createMemo(() => [
    { value: 'null', label: t('prefs.writing.firstDaySystem') },
    { value: '0', label: t('prefs.writing.firstDaySunday') },
    { value: '1', label: t('prefs.writing.firstDayMonday') },
    { value: '2', label: t('prefs.writing.firstDayTuesday') },
    { value: '3', label: t('prefs.writing.firstDayWednesday') },
    { value: '4', label: t('prefs.writing.firstDayThursday') },
    { value: '5', label: t('prefs.writing.firstDayFriday') },
    { value: '6', label: t('prefs.writing.firstDaySaturday') },
  ]);

  // Tab state
  const [activeTab, setActiveTab] = createSignal<Tab>('general');

  // Local state for form values
  const [localTheme, setLocalTheme] = createSignal<ThemePreference>(getThemePreference());
  const [localAllowFutureEntries, setLocalAllowFutureEntries] = createSignal(
    preferences().allowFutureEntries,
  );
  const [localFirstDayOfWeek, setLocalFirstDayOfWeek] = createSignal<string>(
    preferences().firstDayOfWeek === null ? 'null' : String(preferences().firstDayOfWeek),
  );
  const [localHideTitles, setLocalHideTitles] = createSignal(preferences().hideTitles);
  const [localEnableSpellcheck, setLocalEnableSpellcheck] = createSignal(
    preferences().enableSpellcheck,
  );
  const [localEscAction, setLocalEscAction] = createSignal<EscAction>(preferences().escAction);
  const [localAutoLockEnabled, setLocalAutoLockEnabled] = createSignal(
    preferences().autoLockEnabled,
  );
  const [localAutoLockTimeout, setLocalAutoLockTimeout] = createSignal(
    String(preferences().autoLockTimeout),
  );
  const [localAdvancedToolbar, setLocalAdvancedToolbar] = createSignal(
    preferences().advancedToolbar,
  );
  const [localEditorFontSize, setLocalEditorFontSize] = createSignal(preferences().editorFontSize);
  const [localShowEntryTimestamps, setLocalShowEntryTimestamps] = createSignal(
    preferences().showEntryTimestamps,
  );

  // Theme overrides state
  const [localOverridesJson, setLocalOverridesJson] = createSignal('{}');
  const [overridesParseError, setOverridesParseError] = createSignal<string | null>(null);
  const [overridesApplied, setOverridesApplied] = createSignal(false);

  // Journal file state
  const [journalPath, setJournalPath] = createSignal<string>('');
  const [changeDirError, setChangeDirError] = createSignal<string | null>(null);
  const [isChangingDir, setIsChangingDir] = createSignal(false);

  // Password change state
  const [oldPassword, setOldPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [passwordError, setPasswordError] = createSignal<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = createSignal(false);

  // Auth methods state
  const [authMethods, setAuthMethods] = createSignal<tauri.AuthMethodInfo[]>([]);
  const [addKeypairPassword, setAddKeypairPassword] = createSignal('');
  const [addKeypairLabel, setAddKeypairLabel] = createSignal('');
  const [addKeypairError, setAddKeypairError] = createSignal<string | null>(null);
  const [addKeypairSuccess, setAddKeypairSuccess] = createSignal(false);
  const [removePassword, setRemovePassword] = createSignal('');
  const [removeError, setRemoveError] = createSignal<string | null>(null);

  // Add password state (shown when no password slot exists)
  const [addPasswordNew, setAddPasswordNew] = createSignal('');
  const [addPasswordConfirm, setAddPasswordConfirm] = createSignal('');
  const [addPasswordError, setAddPasswordError] = createSignal<string | null>(null);
  const [addPasswordSuccess, setAddPasswordSuccess] = createSignal(false);

  // Debug dump state
  const [dumpGenerating, setDumpGenerating] = createSignal(false);
  const [dumpStatus, setDumpStatus] = createSignal<'idle' | 'success' | 'error'>('idle');
  const [dumpError, setDumpError] = createSignal('');

  const isUnlocked = () => authState() === 'unlocked';
  const hasPasswordSlot = () => authMethods().some((m) => m.slot_type === 'password');

  // Reset locked-only tabs when journal is locked
  createEffect(() => {
    if (
      !isUnlocked() &&
      (activeTab() === 'writing' || activeTab() === 'security' || activeTab() === 'advanced')
    ) {
      setActiveTab('general');
    }
  });

  // Load journal path and auth methods on mount
  onMount(async () => {
    try {
      const path = await tauri.getJournalPath();
      setJournalPath(path);
    } catch (err) {
      log.error('Failed to load journal path:', err);
    }
    if (authState() === 'unlocked') {
      try {
        const methods = await tauri.listAuthMethods();
        setAuthMethods(methods);
      } catch (err) {
        log.error('Failed to load auth methods:', err);
      }
    }
  });

  // Reset local state when dialog opens
  const handleOpenChange = async (open: boolean) => {
    if (open) {
      setActiveTab('general');
      setLocalTheme(getThemePreference());
      setLocalAllowFutureEntries(preferences().allowFutureEntries);
      setLocalFirstDayOfWeek(
        preferences().firstDayOfWeek === null ? 'null' : String(preferences().firstDayOfWeek),
      );
      setLocalHideTitles(preferences().hideTitles);
      setLocalEnableSpellcheck(preferences().enableSpellcheck);
      setLocalEscAction(preferences().escAction);
      setLocalAutoLockEnabled(preferences().autoLockEnabled);
      setLocalAutoLockTimeout(String(preferences().autoLockTimeout));
      setLocalAdvancedToolbar(preferences().advancedToolbar);
      setLocalEditorFontSize(preferences().editorFontSize);
      setLocalShowEntryTimestamps(preferences().showEntryTimestamps);

      // Reset password fields
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);

      // Reload auth methods
      if (authState() === 'unlocked') {
        try {
          const methods = await tauri.listAuthMethods();
          setAuthMethods(methods);
        } catch (err) {
          log.error('Failed to reload auth methods:', err);
        }
      }
      // Reset add keypair fields
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

      // Reload journal path
      try {
        const path = await tauri.getJournalPath();
        setJournalPath(path);
      } catch (err) {
        log.error('Failed to load journal path:', err);
      }

      // Reset change-dir state
      setChangeDirError(null);
      setIsChangingDir(false);

      setDumpGenerating(false);
      setDumpStatus('idle');
      setDumpError('');

      // Initialize theme overrides editor
      setLocalOverridesJson(getThemeOverridesJson());
      setOverridesParseError(null);
      setOverridesApplied(false);
    }
    if (!open) {
      props.onClose();
    }
  };

  // Save preferences and close
  const handleSave = () => {
    // Save theme preference
    setTheme(localTheme());

    // Save other preferences
    setPreferences({
      allowFutureEntries: localAllowFutureEntries(),
      firstDayOfWeek: localFirstDayOfWeek() === 'null' ? null : Number(localFirstDayOfWeek()),
      hideTitles: localHideTitles(),
      enableSpellcheck: localEnableSpellcheck(),
      escAction: localEscAction(),
      autoLockEnabled: localAutoLockEnabled(),
      autoLockTimeout: Math.min(999, Math.max(1, parseInt(localAutoLockTimeout(), 10) || 300)),
      advancedToolbar: localAdvancedToolbar(),
      editorFontSize: Math.min(24, Math.max(12, Number(localEditorFontSize()))),
      showEntryTimestamps: localShowEntryTimestamps(),
    });
    props.onClose();
  };

  // Handle Escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validation
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

  // Handle generating and registering a keypair
  const handleGenerateAndRegisterKeypair = async () => {
    setAddKeypairError(null);
    setAddKeypairSuccess(false);

    if (!addKeypairPassword()) {
      setAddKeypairError(t('prefs.security.keypairPasswordRequired'));
      return;
    }
    if (!addKeypairLabel()) {
      setAddKeypairError(t('prefs.security.keypairLabelRequired'));
      return;
    }

    try {
      // Step 1: Validate password before any file operations
      await tauri.verifyPassword(addKeypairPassword());

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

      // Step 4: Register public key with the journal (DB write first)
      // Doing this before the file write means a failed registration never touches disk.
      await tauri.registerKeypair(addKeypairPassword(), kp.public_key_hex, addKeypairLabel());

      // Step 5: Write private key to the chosen file (only after DB confirms registration)
      await tauri.writeKeyFile(savePath, kp.private_key_hex);

      // Reload auth methods
      const methods = await tauri.listAuthMethods();
      setAuthMethods(methods);

      setAddKeypairSuccess(true);
      setAddKeypairPassword('');
      setAddKeypairLabel('');
      setTimeout(() => setAddKeypairSuccess(false), 4000);
    } catch (err) {
      setAddKeypairError(mapTauriError(err, t));
    }
  };

  // Handle adding a password when none exists
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
      const methods = await tauri.listAuthMethods();
      setAuthMethods(methods);
      setAddPasswordNew('');
      setAddPasswordConfirm('');
      setAddPasswordSuccess(true);
      setTimeout(() => setAddPasswordSuccess(false), 3000);
    } catch (err) {
      setAddPasswordError(mapTauriError(err, t));
    }
  };

  // Handle removing an auth method
  const handleRemoveAuthMethod = async (slotId: number) => {
    setRemoveError(null);

    if (!removePassword()) {
      setRemoveError(t('prefs.security.removeError'));
      return;
    }

    try {
      // Validate password before showing the confirmation dialog
      await tauri.verifyPassword(removePassword());
    } catch (err) {
      setRemoveError(mapTauriError(err, t));
      return;
    }

    const confirmed = await dialogConfirm(t('prefs.security.confirmRemoveMessage'), {
      title: t('prefs.security.confirmRemoveTitle'),
      kind: 'warning',
    });
    if (!confirmed) return;

    try {
      await tauri.removeAuthMethod(slotId, removePassword());
      const methods = await tauri.listAuthMethods();
      setAuthMethods(methods);
      setRemovePassword('');
    } catch (err) {
      setRemoveError(mapTauriError(err, t));
    }
  };

  // Handle journal reset
  const handleResetJournal = async () => {
    const confirmed = await dialogConfirm(t('prefs.data.resetConfirmMessage'), {
      title: t('prefs.data.resetConfirmTitle'),
      kind: 'warning',
    });

    if (!confirmed) return;

    // Double confirmation
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
      const message = err instanceof Error ? err.message : String(err);
      alert(t('prefs.data.resetFailedAlert', { message }));
    }
  };

  // Handle changing the journal storage directory
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

  const handleGenerateDebugDump = async () => {
    setDumpGenerating(true);
    setDumpStatus('idle');
    setDumpError('');
    try {
      const filePath = await save({
        defaultPath: `mini-diarium-debug-${Date.now()}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });
      if (!filePath) {
        setDumpGenerating(false);
        return;
      }
      await tauri.generateDebugDump(filePath, JSON.stringify(preferences()));
      setDumpStatus('success');
    } catch (err) {
      setDumpError(mapTauriError(err, t));
      setDumpStatus('error');
    } finally {
      setDumpGenerating(false);
    }
  };

  // Handle applying theme overrides
  const handleApplyOverrides = () => {
    const parsed = parseOverridesJson(localOverridesJson());
    if (parsed === null) {
      setOverridesParseError(t('prefs.advanced.overridesParseError'));
      setOverridesApplied(false);
      return;
    }
    saveThemeOverrides(parsed);
    applyThemeOverrides(getActiveTheme());
    setLocalOverridesJson(getThemeOverridesJson());
    setOverridesParseError(null);
    setOverridesApplied(true);
  };

  // Handle resetting theme overrides to defaults
  const handleResetOverrides = () => {
    resetThemeOverrides();
    setLocalOverridesJson('{}');
    setOverridesParseError(null);
    setOverridesApplied(false);
  };

  // Tab button class helper
  const tabClass = (tab: Tab) =>
    activeTab() === tab
      ? 'w-full text-left px-3 py-2 text-sm font-medium rounded-md bg-active text-primary'
      : 'w-full text-left px-3 py-2 text-sm font-medium rounded-md text-secondary hover:bg-hover hover:text-primary';

  // Keyboard navigation within the tablist
  const handleTabListKeyDown = (e: KeyboardEvent) => {
    // Vertical tablist uses ArrowUp/ArrowDown per ARIA spec (aria-orientation="vertical")
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const tabs: Tab[] = [
      'general',
      ...(isUnlocked() ? (['writing', 'security'] as Tab[]) : []),
      'data',
      ...(isUnlocked() ? (['advanced'] as Tab[]) : []),
    ];
    const currentIndex = tabs.indexOf(activeTab());
    let nextIndex = currentIndex;
    if (e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
    if (e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') nextIndex = 0;
    if (e.key === 'End') nextIndex = tabs.length - 1;
    setActiveTab(tabs[nextIndex]);
    requestAnimationFrame(() => {
      const btn = document.querySelector<HTMLButtonElement>(`#pref-tab-${tabs[nextIndex]}`);
      btn?.focus();
    });
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            class="w-full max-w-3xl rounded-lg bg-primary p-8 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
            onKeyDown={handleKeyDown}
          >
            <Dialog.Title class="text-lg font-semibold text-primary mb-6">
              {t('prefs.title')}
            </Dialog.Title>
            <Dialog.Description class="sr-only">{t('prefs.srDescription')}</Dialog.Description>

            {/* Main content: sidebar tabs + pane */}
            <div class="flex flex-row min-h-0">
              {/* Tab sidebar */}
              <nav
                role="tablist"
                aria-label={t('prefs.sectionsAria')}
                aria-orientation="vertical"
                class="w-36 shrink-0 border-r border-primary pr-2 space-y-1"
                onKeyDown={handleTabListKeyDown}
              >
                <button
                  id="pref-tab-general"
                  type="button"
                  role="tab"
                  aria-selected={activeTab() === 'general'}
                  aria-controls="pref-panel-general"
                  tabIndex={activeTab() === 'general' ? 0 : -1}
                  onClick={() => setActiveTab('general')}
                  class={tabClass('general')}
                >
                  {t('prefs.tabGeneral')}
                </button>

                <Show
                  when={isUnlocked()}
                  fallback={
                    <button
                      id="pref-tab-writing"
                      type="button"
                      role="tab"
                      disabled
                      aria-selected={false}
                      aria-controls="pref-panel-writing"
                      tabIndex={-1}
                      class="w-full text-left px-3 py-2 text-sm font-medium rounded-md text-tertiary cursor-not-allowed select-none opacity-50"
                    >
                      {t('prefs.tabWriting')}
                    </button>
                  }
                >
                  <button
                    id="pref-tab-writing"
                    type="button"
                    role="tab"
                    aria-selected={activeTab() === 'writing'}
                    aria-controls="pref-panel-writing"
                    tabIndex={activeTab() === 'writing' ? 0 : -1}
                    onClick={() => setActiveTab('writing')}
                    class={tabClass('writing')}
                  >
                    {t('prefs.tabWriting')}
                  </button>
                </Show>

                <Show
                  when={isUnlocked()}
                  fallback={
                    <button
                      id="pref-tab-security"
                      type="button"
                      role="tab"
                      disabled
                      aria-selected={false}
                      aria-controls="pref-panel-security"
                      tabIndex={-1}
                      class="w-full text-left px-3 py-2 text-sm font-medium rounded-md text-tertiary cursor-not-allowed select-none opacity-50"
                    >
                      {t('prefs.tabSecurity')}
                    </button>
                  }
                >
                  <button
                    id="pref-tab-security"
                    type="button"
                    role="tab"
                    aria-selected={activeTab() === 'security'}
                    aria-controls="pref-panel-security"
                    tabIndex={activeTab() === 'security' ? 0 : -1}
                    onClick={() => setActiveTab('security')}
                    class={tabClass('security')}
                  >
                    {t('prefs.tabSecurity')}
                  </button>
                </Show>

                <button
                  id="pref-tab-data"
                  type="button"
                  role="tab"
                  aria-selected={activeTab() === 'data'}
                  aria-controls="pref-panel-data"
                  tabIndex={activeTab() === 'data' ? 0 : -1}
                  onClick={() => setActiveTab('data')}
                  class={tabClass('data')}
                >
                  {t('prefs.tabData')}
                </button>

                <Show when={isUnlocked()}>
                  <button
                    id="pref-tab-advanced"
                    type="button"
                    role="tab"
                    aria-selected={activeTab() === 'advanced'}
                    aria-controls="pref-panel-advanced"
                    tabIndex={activeTab() === 'advanced' ? 0 : -1}
                    onClick={() => setActiveTab('advanced')}
                    class={tabClass('advanced')}
                  >
                    {t('prefs.tabAdvanced')}
                  </button>
                </Show>
              </nav>

              {/* Tab content */}
              <div class="flex-1 overflow-y-auto max-h-[60vh] pl-6">
                <Switch>
                  {/* ── General ── */}
                  <Match when={activeTab() === 'general'}>
                    <div
                      id="pref-panel-general"
                      role="tabpanel"
                      aria-labelledby="pref-tab-general"
                      tabIndex={0}
                      class="space-y-6 focus:outline-none"
                    >
                      {/* Theme */}
                      <div>
                        <label
                          for="pref-theme"
                          class="block text-sm font-medium text-secondary mb-2"
                        >
                          {t('prefs.general.themeLabel')}
                        </label>
                        <select
                          id="pref-theme"
                          value={localTheme()}
                          onChange={(e) => setLocalTheme(e.currentTarget.value as ThemePreference)}
                          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="auto">{t('prefs.general.themeAuto')}</option>
                          <option value="light">{t('prefs.general.themeLight')}</option>
                          <option value="dark">{t('prefs.general.themeDark')}</option>
                        </select>
                        <p class="mt-2 text-xs text-tertiary leading-relaxed">
                          {t('prefs.general.themeHint')}
                        </p>
                      </div>

                      {/* ESC key action */}
                      <div>
                        <label
                          for="pref-esc-action"
                          class="block text-sm font-medium text-secondary mb-2"
                        >
                          {t('prefs.general.escLabel')}
                        </label>
                        <select
                          id="pref-esc-action"
                          value={localEscAction()}
                          onChange={(e) => setLocalEscAction(e.currentTarget.value as EscAction)}
                          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="none">{t('prefs.general.escNone')}</option>
                          <option value="quit">{t('prefs.general.escQuit')}</option>
                        </select>
                        <p class="mt-2 text-xs text-tertiary leading-relaxed">
                          {t('prefs.general.escHint')}
                        </p>
                      </div>
                    </div>
                  </Match>

                  {/* ── Writing ── */}
                  <Match when={activeTab() === 'writing'}>
                    <div
                      id="pref-panel-writing"
                      role="tabpanel"
                      aria-labelledby="pref-tab-writing"
                      tabIndex={0}
                      class="space-y-6 focus:outline-none"
                    >
                      {/* First Day of Week */}
                      <div>
                        <label
                          for="pref-first-day"
                          class="block text-sm font-medium text-secondary mb-2"
                        >
                          {t('prefs.writing.firstDayLabel')}
                        </label>
                        <select
                          id="pref-first-day"
                          value={localFirstDayOfWeek()}
                          onChange={(e) => setLocalFirstDayOfWeek(e.currentTarget.value)}
                          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <For each={FIRST_DAY_OPTIONS()}>
                            {(option) => <option value={option.value}>{option.label}</option>}
                          </For>
                        </select>
                      </div>

                      {/* Allow Future Entries */}
                      <div class="space-y-2">
                        <div class="flex items-center">
                          <input
                            type="checkbox"
                            id="allow-future"
                            checked={localAllowFutureEntries()}
                            onChange={(e) => setLocalAllowFutureEntries(e.currentTarget.checked)}
                            class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
                          />
                          <label for="allow-future" class="ml-3 text-sm text-secondary">
                            {t('prefs.writing.allowFutureLabel')}
                          </label>
                        </div>
                        <p class="ml-7 text-xs text-tertiary leading-relaxed">
                          {t('prefs.writing.allowFutureHint')}
                        </p>
                      </div>

                      {/* Hide Titles */}
                      <div class="space-y-2">
                        <div class="flex items-center">
                          <input
                            type="checkbox"
                            id="hide-titles"
                            checked={localHideTitles()}
                            onChange={(e) => setLocalHideTitles(e.currentTarget.checked)}
                            class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
                          />
                          <label for="hide-titles" class="ml-3 text-sm text-secondary">
                            {t('prefs.writing.hideTitlesLabel')}
                          </label>
                        </div>
                        <p class="ml-7 text-xs text-tertiary leading-relaxed">
                          {t('prefs.writing.hideTitlesHint')}
                        </p>
                      </div>

                      {/* Show Entry Timestamps */}
                      <div class="space-y-2">
                        <div class="flex items-center">
                          <input
                            type="checkbox"
                            id="show-timestamps"
                            checked={localShowEntryTimestamps()}
                            onChange={(e) => setLocalShowEntryTimestamps(e.currentTarget.checked)}
                            class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
                          />
                          <label for="show-timestamps" class="ml-3 text-sm text-secondary">
                            {t('prefs.writing.showTimestampsLabel')}
                          </label>
                        </div>
                        <p class="ml-7 text-xs text-tertiary leading-relaxed">
                          {t('prefs.writing.showTimestampsHint')}
                        </p>
                      </div>

                      {/* Enable Spellcheck */}
                      <div class="space-y-2">
                        <div class="flex items-center">
                          <input
                            type="checkbox"
                            id="enable-spellcheck"
                            checked={localEnableSpellcheck()}
                            onChange={(e) => setLocalEnableSpellcheck(e.currentTarget.checked)}
                            class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
                          />
                          <label for="enable-spellcheck" class="ml-3 text-sm text-secondary">
                            {t('prefs.writing.spellcheckLabel')}
                          </label>
                        </div>
                        <p class="ml-7 text-xs text-tertiary leading-relaxed">
                          {t('prefs.writing.spellcheckHint')}
                        </p>
                      </div>

                      {/* Show Advanced Toolbar */}
                      <div class="space-y-2">
                        <div class="flex items-center">
                          <input
                            type="checkbox"
                            id="advanced-toolbar"
                            checked={localAdvancedToolbar()}
                            onChange={(e) => setLocalAdvancedToolbar(e.currentTarget.checked)}
                            class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
                          />
                          <label for="advanced-toolbar" class="ml-3 text-sm text-secondary">
                            {t('prefs.writing.advancedToolbarLabel')}
                          </label>
                        </div>
                        <p class="ml-7 text-xs text-tertiary leading-relaxed">
                          {t('prefs.writing.advancedToolbarHint')}
                        </p>
                      </div>

                      {/* Editor Font Size */}
                      <div>
                        <div class="flex items-center justify-between mb-2">
                          <label for="editor-font-size" class="text-sm font-medium text-secondary">
                            {t('prefs.writing.fontSizeLabel')}
                          </label>
                          <span class="text-sm text-tertiary">
                            {localEditorFontSize()} {t('prefs.writing.fontSizePxSuffix')}
                          </span>
                        </div>
                        <input
                          type="range"
                          id="editor-font-size"
                          min="12"
                          max="24"
                          step="1"
                          value={localEditorFontSize()}
                          onInput={(e) => setLocalEditorFontSize(Number(e.currentTarget.value))}
                          class="w-full accent-blue-500"
                        />
                        <div class="flex justify-between mt-1">
                          <span class="text-xs text-tertiary">
                            {t('prefs.writing.fontSizeMin')}
                          </span>
                          <span class="text-xs text-tertiary">
                            {t('prefs.writing.fontSizeMax')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Match>

                  {/* ── Security ── */}
                  <Match when={activeTab() === 'security'}>
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
                              <label
                                for="addPasswordNew"
                                class="mb-2 block text-sm font-medium text-secondary"
                              >
                                {t('prefs.security.passwordLabel')}{' '}
                                <span class="text-xs text-tertiary">
                                  {t('prefs.security.passwordHint')}
                                </span>
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
                              <p class="mb-2 text-sm text-success">
                                {t('prefs.security.addPasswordSuccess')}
                              </p>
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
                          <h4 class="text-xs font-medium text-secondary mb-3">
                            {t('prefs.security.addKeyTitle')}
                          </h4>

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

                          <Show when={addKeypairError()}>
                            <p class="mb-2 text-sm text-error">{addKeypairError()}</p>
                          </Show>
                          <Show when={addKeypairSuccess()}>
                            <p class="mb-2 text-sm text-success">
                              {t('prefs.security.addKeySuccess')}
                            </p>
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

                      {/* Change Password */}
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
                          <label
                            for="newPassword"
                            class="mb-2 block text-sm font-medium text-secondary"
                          >
                            {t('prefs.security.newPasswordLabel')}{' '}
                            <span class="text-xs text-tertiary">
                              {t('prefs.security.newPasswordHint')}
                            </span>
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
                            <p class="text-sm text-success">
                              {t('prefs.security.changePasswordSuccess')}
                            </p>
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

                      {/* Auto-Lock */}
                      <div>
                        <h3 class="text-sm font-medium text-primary mb-3">
                          {t('prefs.security.autoLockTitle')}
                        </h3>
                        <div class="space-y-3">
                          <label class="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={localAutoLockEnabled()}
                              onChange={(e) => setLocalAutoLockEnabled(e.currentTarget.checked)}
                              class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
                            />
                            <span class="text-sm text-primary">
                              {t('prefs.security.autoLockLabel')}
                            </span>
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
                                  const v = Math.min(
                                    999,
                                    Math.max(1, parseInt(e.currentTarget.value, 10) || 300),
                                  );
                                  setLocalAutoLockTimeout(String(v));
                                }}
                                class="w-20 px-2 py-1 text-sm border border-primary rounded-md bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span class="text-xs text-tertiary">
                                {t('prefs.security.autoLockRange')}
                              </span>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </div>
                  </Match>

                  {/* ── Data ── */}
                  <Match when={activeTab() === 'data'}>
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
                          {isChangingDir()
                            ? t('prefs.data.moving')
                            : t('prefs.data.changeLocation')}
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
                        <p class="text-xs text-tertiary leading-relaxed">
                          {t('prefs.data.resetJournalHint')}
                        </p>
                      </div>
                    </div>
                  </Match>

                  {/* ── Advanced ── */}
                  <Match when={activeTab() === 'advanced'}>
                    <div
                      id="pref-panel-advanced"
                      role="tabpanel"
                      aria-labelledby="pref-tab-advanced"
                      tabIndex={0}
                      class="space-y-6 focus:outline-none"
                    >
                      {/* Theme Overrides */}
                      <div>
                        <h3 class="text-sm font-medium text-primary mb-1">
                          {t('prefs.advanced.themeOverridesTitle')}
                        </h3>
                        <p class="text-xs text-tertiary mb-3 leading-relaxed">
                          {t('prefs.advanced.themeOverridesHint')}{' '}
                          <button
                            type="button"
                            class="underline text-xs text-tertiary hover:text-primary focus:outline-none"
                            onClick={() =>
                              openUrl(
                                'https://github.com/fjrevoredo/mini-diarium/blob/master/docs/USER_GUIDE.md#theme-overrides-advanced',
                              )
                            }
                          >
                            {t('prefs.advanced.seeUserGuide')}
                          </button>
                        </p>
                        <textarea
                          rows="6"
                          class="w-full text-xs font-mono bg-tertiary text-primary border border-primary rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                          value={localOverridesJson()}
                          onInput={(e) => {
                            setLocalOverridesJson(e.currentTarget.value);
                            setOverridesApplied(false);
                            setOverridesParseError(null);
                          }}
                          spellcheck={false}
                        />
                        <Show when={overridesParseError() !== null}>
                          <p class="text-xs text-error mt-1">{overridesParseError()}</p>
                        </Show>
                        <Show when={overridesApplied()}>
                          <p class="text-xs text-success mt-1">
                            {t('prefs.advanced.overridesApplied')}
                          </p>
                        </Show>
                        <div class="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={handleApplyOverrides}
                            class="px-3 py-1.5 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            {t('prefs.advanced.applyOverrides')}
                          </button>
                          <button
                            type="button"
                            onClick={handleResetOverrides}
                            class="px-3 py-1.5 text-sm font-medium text-destructive bg-primary border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          >
                            {t('prefs.advanced.resetToDefault')}
                          </button>
                        </div>
                      </div>
                      <div class="border-t border-primary pt-4 mt-4">
                        <h3 class="text-sm font-medium text-primary mb-1">
                          {t('prefs.advanced.diagnosticsTitle')}
                        </h3>
                        <p class="text-xs text-tertiary mb-3 leading-relaxed">
                          {t('prefs.advanced.diagnosticsHint')}
                        </p>
                        <div class="space-y-2">
                          <button
                            type="button"
                            onClick={handleGenerateDebugDump}
                            disabled={dumpGenerating()}
                            class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {dumpGenerating()
                              ? t('prefs.advanced.generating')
                              : t('prefs.advanced.generateDump')}
                          </button>
                          <Show when={dumpStatus() === 'success'}>
                            <p class="text-sm text-success">{t('prefs.advanced.dumpSuccess')}</p>
                          </Show>
                          <Show when={dumpStatus() === 'error'}>
                            <p class="text-sm text-error">{dumpError()}</p>
                          </Show>
                        </div>
                      </div>
                    </div>
                  </Match>
                </Switch>
              </div>
            </div>

            {/* Footer Buttons */}
            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => props.onClose()}
                class="px-4 py-2 text-sm font-medium text-secondary bg-primary border border-primary rounded-md hover:bg-hover focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {t('prefs.footer.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                class="px-4 py-2 text-sm font-medium interactive-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {t('prefs.footer.save')}
              </button>
            </div>

            <Dialog.CloseButton class="absolute top-4 right-4 inline-flex items-center justify-center rounded-md p-1 text-tertiary hover:text-secondary hover:bg-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
              <span class="sr-only">{t('common.close')}</span>
              <svg
                class="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Dialog.CloseButton>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
