import { createSignal, createEffect, For, Show, Switch, Match, onMount } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { createLogger } from '../../lib/logger';
import { preferences, setPreferences, type EscAction } from '../../state/preferences';
import { getThemePreference, setTheme, type ThemePreference } from '../../lib/theme';
import { authState } from '../../state/auth';
import * as tauri from '../../lib/tauri';
import { mapTauriError } from '../../lib/errors';

interface PreferencesOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const FIRST_DAY_OPTIONS = [
  { value: 'null', label: 'System Default' },
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const log = createLogger('Preferences');

type Tab = 'general' | 'writing' | 'security' | 'data';

export default function PreferencesOverlay(props: PreferencesOverlayProps) {
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

  // Diary file state
  const [diaryPath, setDiaryPath] = createSignal<string>('');
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

  const isUnlocked = () => authState() === 'unlocked';
  const hasPasswordSlot = () => authMethods().some((m) => m.slot_type === 'password');

  // Reset locked-only tabs when diary is locked
  createEffect(() => {
    if (!isUnlocked() && (activeTab() === 'writing' || activeTab() === 'security')) {
      setActiveTab('general');
    }
  });

  // Load diary path and auth methods on mount
  onMount(async () => {
    try {
      const path = await tauri.getDiaryPath();
      setDiaryPath(path);
    } catch (err) {
      log.error('Failed to load diary path:', err);
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

      // Reload diary path
      try {
        const path = await tauri.getDiaryPath();
        setDiaryPath(path);
      } catch (err) {
        log.error('Failed to load diary path:', err);
      }

      // Reset change-dir state
      setChangeDirError(null);
      setIsChangingDir(false);
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
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword() !== confirmPassword()) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword().length < 8) {
      setPasswordError('New password must be at least 8 characters');
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
      setPasswordError(mapTauriError(err));
    }
  };

  // Handle generating and registering a keypair
  const handleGenerateAndRegisterKeypair = async () => {
    setAddKeypairError(null);
    setAddKeypairSuccess(false);

    if (!addKeypairPassword()) {
      setAddKeypairError('Current password is required');
      return;
    }
    if (!addKeypairLabel()) {
      setAddKeypairError('Label is required');
      return;
    }

    try {
      // Step 1: Validate password before any file operations
      await tauri.verifyPassword(addKeypairPassword());

      // Step 2: Generate keypair (in-memory, no side effects yet)
      const kp = await tauri.generateKeypair();

      // Step 3: Prompt user to choose a save path
      const { save } = await import('@tauri-apps/plugin-dialog');
      const savePath = await save({
        title: 'Save Private Key File',
        defaultPath: `mini-diarium-${addKeypairLabel().replace(/\s+/g, '-')}.key`,
        filters: [{ name: 'Key Files', extensions: ['key'] }],
      });
      if (!savePath) {
        setAddKeypairError('Key file save cancelled');
        return;
      }

      // Step 4: Register public key with the diary (DB write first)
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
      setAddKeypairError(mapTauriError(err));
    }
  };

  // Handle adding a password when none exists
  const handleAddPassword = async () => {
    setAddPasswordError(null);
    setAddPasswordSuccess(false);

    if (!addPasswordNew() || !addPasswordConfirm()) {
      setAddPasswordError('Both fields are required');
      return;
    }
    if (addPasswordNew() !== addPasswordConfirm()) {
      setAddPasswordError('Passwords do not match');
      return;
    }
    if (addPasswordNew().length < 8) {
      setAddPasswordError('Password must be at least 8 characters');
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
      setAddPasswordError(mapTauriError(err));
    }
  };

  // Handle removing an auth method
  const handleRemoveAuthMethod = async (slotId: number) => {
    setRemoveError(null);

    if (!removePassword()) {
      setRemoveError('Current password is required to remove an auth method');
      return;
    }

    try {
      // Validate password before showing the confirmation dialog
      await tauri.verifyPassword(removePassword());
    } catch (err) {
      setRemoveError(mapTauriError(err));
      return;
    }

    const { confirm: dialogConfirm } = await import('@tauri-apps/plugin-dialog');
    const confirmed = await dialogConfirm(
      'Are you sure you want to remove this authentication method?',
      { title: 'Remove Authentication Method', kind: 'warning' },
    );
    if (!confirmed) return;

    try {
      await tauri.removeAuthMethod(slotId, removePassword());
      const methods = await tauri.listAuthMethods();
      setAuthMethods(methods);
      setRemovePassword('');
    } catch (err) {
      setRemoveError(mapTauriError(err));
    }
  };

  // Handle diary reset
  const handleResetDiary = async () => {
    const { confirm: dialogConfirm } = await import('@tauri-apps/plugin-dialog');
    const confirmed = await dialogConfirm(
      'Are you sure you want to reset your diary? This will permanently delete all entries and cannot be undone.',
      { title: 'Reset Diary', kind: 'warning' },
    );

    if (!confirmed) return;

    // Double confirmation
    const doubleConfirmed = await dialogConfirm(
      'This is your last chance. Are you absolutely sure you want to delete all your diary entries?',
      { title: 'Reset Diary — Final Warning', kind: 'warning' },
    );

    if (!doubleConfirmed) return;

    try {
      await tauri.resetDiary();
      // The diary will be locked and reset, which will trigger the auth state to change
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Failed to reset diary: ${message}`);
    }
  };

  // Handle changing the diary storage directory
  const handleChangeDiaryDirectory = async () => {
    setChangeDirError(null);
    const { open: openDirDialog } = await import('@tauri-apps/plugin-dialog');
    const selected = await openDirDialog({
      directory: true,
      multiple: false,
      title: 'Choose Diary Directory',
    });
    if (!selected || typeof selected !== 'string') return;
    setIsChangingDir(true);
    try {
      await tauri.changeDiaryDirectory(selected);
      window.location.reload();
    } catch (err) {
      setChangeDirError(mapTauriError(err));
    } finally {
      setIsChangingDir(false);
    }
  };

  // Tab button class helper
  const tabClass = (tab: Tab) =>
    activeTab() === tab
      ? 'w-full text-left px-3 py-2 text-sm font-medium rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
      : 'w-full text-left px-3 py-2 text-sm font-medium rounded-md text-secondary hover:bg-hover hover:text-primary';

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
            <Dialog.Title class="text-lg font-semibold text-primary mb-6">Preferences</Dialog.Title>
            <Dialog.Description class="sr-only">
              Customize your journaling experience.
            </Dialog.Description>

            {/* Main content: sidebar tabs + pane */}
            <div class="flex flex-row min-h-0">
              {/* Tab sidebar */}
              <nav class="w-36 shrink-0 border-r border-primary pr-2 space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  class={tabClass('general')}
                >
                  General
                </button>

                <Show
                  when={isUnlocked()}
                  fallback={
                    <span class="block px-3 py-2 text-sm font-medium text-tertiary cursor-not-allowed select-none">
                      Writing
                    </span>
                  }
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('writing')}
                    class={tabClass('writing')}
                  >
                    Writing
                  </button>
                </Show>

                <Show
                  when={isUnlocked()}
                  fallback={
                    <span class="block px-3 py-2 text-sm font-medium text-tertiary cursor-not-allowed select-none">
                      Security
                    </span>
                  }
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('security')}
                    class={tabClass('security')}
                  >
                    Security
                  </button>
                </Show>

                <button type="button" onClick={() => setActiveTab('data')} class={tabClass('data')}>
                  Data
                </button>
              </nav>

              {/* Tab content */}
              <div class="flex-1 overflow-y-auto max-h-[60vh] pl-6">
                <Switch>
                  {/* ── General ── */}
                  <Match when={activeTab() === 'general'}>
                    <div class="space-y-6">
                      {/* Theme */}
                      <div>
                        <label class="block text-sm font-medium text-secondary mb-2">Theme</label>
                        <select
                          value={localTheme()}
                          onChange={(e) => setLocalTheme(e.currentTarget.value as ThemePreference)}
                          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="auto">Auto (System Default)</option>
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                        <p class="mt-2 text-xs text-tertiary leading-relaxed">
                          Choose how the app should look. Auto follows your system theme.
                        </p>
                      </div>

                      {/* ESC key action */}
                      <div>
                        <label class="block text-sm font-medium text-secondary mb-2">
                          ESC key action
                        </label>
                        <select
                          value={localEscAction()}
                          onChange={(e) => setLocalEscAction(e.currentTarget.value as EscAction)}
                          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="none">Do nothing</option>
                          <option value="quit">Quit the app</option>
                        </select>
                        <p class="mt-2 text-xs text-tertiary leading-relaxed">
                          When set to "Quit", pressing Escape closes the app while no dialog is
                          open.
                        </p>
                      </div>
                    </div>
                  </Match>

                  {/* ── Writing ── */}
                  <Match when={activeTab() === 'writing'}>
                    <div class="space-y-6">
                      {/* First Day of Week */}
                      <div>
                        <label class="block text-sm font-medium text-secondary mb-2">
                          First Day of Week
                        </label>
                        <select
                          value={localFirstDayOfWeek()}
                          onChange={(e) => setLocalFirstDayOfWeek(e.currentTarget.value)}
                          class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <For each={FIRST_DAY_OPTIONS}>
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
                            Allow future entries
                          </label>
                        </div>
                        <p class="ml-7 text-xs text-tertiary leading-relaxed">
                          When disabled, you cannot create entries for future dates.
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
                            Hide entry titles
                          </label>
                        </div>
                        <p class="ml-7 text-xs text-tertiary leading-relaxed">
                          When enabled, the title editor will be hidden. Title data is still saved.
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
                            Enable spellcheck
                          </label>
                        </div>
                        <p class="ml-7 text-xs text-tertiary leading-relaxed">
                          When enabled, browser spellcheck will highlight misspelled words.
                        </p>
                      </div>
                    </div>
                  </Match>

                  {/* ── Security ── */}
                  <Match when={activeTab() === 'security'}>
                    <div class="space-y-8">
                      {/* Authentication Methods */}
                      <div>
                        <h3 class="text-sm font-medium text-primary mb-3">
                          Authentication Methods
                        </h3>
                        <p class="text-xs text-tertiary mb-4 leading-relaxed">
                          Registered methods that can unlock this diary. At least one must remain.
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
                                      ({method.slot_type === 'password' ? 'Password' : 'Key File'})
                                    </span>
                                  </p>
                                  <Show when={method.last_used}>
                                    <p class="text-xs text-tertiary">
                                      Last used: {method.last_used!.slice(0, 10)}
                                    </p>
                                  </Show>
                                </div>
                                <Show when={authMethods().length > 1}>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAuthMethod(method.id)}
                                    class="text-xs text-red-500 hover:text-red-700 focus:outline-none"
                                  >
                                    Remove
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
                              Current Password (required to remove)
                            </label>
                            <input
                              type="password"
                              value={removePassword()}
                              onInput={(e) => setRemovePassword(e.currentTarget.value)}
                              class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter current password"
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
                              Add Password Auth
                            </h4>
                            <p class="text-xs text-tertiary mb-3 leading-relaxed">
                              No password method is registered. Add one so you can unlock with a
                              password.
                            </p>

                            <div class="mb-3">
                              <label class="block text-xs font-medium text-secondary mb-1">
                                New Password
                              </label>
                              <input
                                type="password"
                                value={addPasswordNew()}
                                onInput={(e) => setAddPasswordNew(e.currentTarget.value)}
                                class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Min. 8 characters"
                              />
                            </div>

                            <div class="mb-3">
                              <label class="block text-xs font-medium text-secondary mb-1">
                                Confirm Password
                              </label>
                              <input
                                type="password"
                                value={addPasswordConfirm()}
                                onInput={(e) => setAddPasswordConfirm(e.currentTarget.value)}
                                class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Repeat password"
                              />
                            </div>

                            <Show when={addPasswordError()}>
                              <p class="mb-2 text-sm text-error">{addPasswordError()}</p>
                            </Show>
                            <Show when={addPasswordSuccess()}>
                              <p class="mb-2 text-sm text-success">
                                Password registered successfully!
                              </p>
                            </Show>

                            <button
                              type="button"
                              onClick={handleAddPassword}
                              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              Add Password
                            </button>
                          </div>
                        </Show>

                        {/* Add Keypair section */}
                        <div class="mt-4 pt-4 border-t border-primary">
                          <h4 class="text-xs font-medium text-secondary mb-3">Add Key File Auth</h4>

                          <div class="mb-3">
                            <label class="block text-xs font-medium text-secondary mb-1">
                              Label
                            </label>
                            <input
                              type="text"
                              value={addKeypairLabel()}
                              onInput={(e) => setAddKeypairLabel(e.currentTarget.value)}
                              class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g. My YubiKey"
                            />
                          </div>

                          <div class="mb-3">
                            <label class="block text-xs font-medium text-secondary mb-1">
                              Current Password
                            </label>
                            <input
                              type="password"
                              value={addKeypairPassword()}
                              onInput={(e) => setAddKeypairPassword(e.currentTarget.value)}
                              class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Verify identity"
                            />
                          </div>

                          <Show when={addKeypairError()}>
                            <p class="mb-2 text-sm text-error">{addKeypairError()}</p>
                          </Show>
                          <Show when={addKeypairSuccess()}>
                            <p class="mb-2 text-sm text-success">
                              Key file registered successfully!
                            </p>
                          </Show>

                          <button
                            type="button"
                            onClick={handleGenerateAndRegisterKeypair}
                            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            Generate &amp; Register Key File
                          </button>
                          <p class="mt-2 text-xs text-tertiary leading-relaxed">
                            Generates a new keypair and saves the private key file locally. Register
                            the public key with your diary so you can unlock without a password.
                          </p>
                        </div>
                      </div>

                      {/* Change Password */}
                      <div>
                        <h3 class="text-sm font-medium text-primary mb-3">Change Password</h3>

                        <div class="mb-4">
                          <label class="block text-sm font-medium text-secondary mb-2">
                            Current Password
                          </label>
                          <input
                            type="password"
                            value={oldPassword()}
                            onInput={(e) => setOldPassword(e.currentTarget.value)}
                            class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter current password"
                          />
                        </div>

                        <div class="mb-4">
                          <label class="block text-sm font-medium text-secondary mb-2">
                            New Password
                          </label>
                          <input
                            type="password"
                            value={newPassword()}
                            onInput={(e) => setNewPassword(e.currentTarget.value)}
                            class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter new password (min 8 characters)"
                          />
                        </div>

                        <div class="mb-4">
                          <label class="block text-sm font-medium text-secondary mb-2">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            value={confirmPassword()}
                            onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                            class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Confirm new password"
                          />
                        </div>

                        <Show when={passwordError()}>
                          <div class="mb-4 p-2 bg-error border border-error rounded-md">
                            <p class="text-sm text-error">{passwordError()}</p>
                          </div>
                        </Show>
                        <Show when={passwordSuccess()}>
                          <div class="mb-4 p-2 bg-success border border-success rounded-md">
                            <p class="text-sm text-success">Password changed successfully!</p>
                          </div>
                        </Show>

                        <button
                          type="button"
                          onClick={handlePasswordChange}
                          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          Change Password
                        </button>
                      </div>

                      {/* Auto-Lock */}
                      <div>
                        <h3 class="text-sm font-medium text-primary mb-3">Auto-Lock</h3>
                        <div class="space-y-3">
                          <label class="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={localAutoLockEnabled()}
                              onChange={(e) => setLocalAutoLockEnabled(e.currentTarget.checked)}
                              class="h-4 w-4 rounded border-primary text-blue-600 focus:ring-blue-500"
                            />
                            <span class="text-sm text-primary">Lock after inactivity</span>
                          </label>
                          <Show when={localAutoLockEnabled()}>
                            <div class="flex items-center gap-2 pl-7">
                              <label class="text-sm text-secondary whitespace-nowrap">
                                Timeout (seconds)
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
                              <span class="text-xs text-tertiary">(1–999)</span>
                            </div>
                          </Show>
                        </div>
                      </div>
                    </div>
                  </Match>

                  {/* ── Data ── */}
                  <Match when={activeTab() === 'data'}>
                    <div class="space-y-6">
                      {/* Current Path */}
                      <div>
                        <label class="block text-sm font-medium text-secondary mb-2">
                          Current Location
                        </label>
                        <div class="px-3 py-3 bg-tertiary border border-primary rounded-md text-sm text-secondary font-mono break-all">
                          {diaryPath() || 'Loading...'}
                        </div>
                      </div>

                      {/* Change Location */}
                      <div class="space-y-2">
                        <button
                          type="button"
                          onClick={handleChangeDiaryDirectory}
                          disabled={isChangingDir()}
                          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isChangingDir() ? 'Moving...' : 'Change Location'}
                        </button>
                        <Show when={changeDirError()}>
                          <p class="text-sm text-error">{changeDirError()}</p>
                        </Show>
                        <p class="text-xs text-tertiary">
                          Moves your diary file to a new folder. The diary will be locked — you'll
                          need to unlock it again from the new location.
                        </p>
                      </div>

                      {/* Reset Diary */}
                      <div class="space-y-2">
                        <button
                          type="button"
                          onClick={handleResetDiary}
                          class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                          Reset Diary
                        </button>
                        <p class="text-xs text-tertiary leading-relaxed">
                          Warning: This will permanently delete all entries. This action cannot be
                          undone.
                        </p>
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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Save
              </button>
            </div>

            <Dialog.CloseButton class="absolute top-4 right-4 inline-flex items-center justify-center rounded-md p-1 text-tertiary hover:text-secondary hover:bg-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
              <span class="sr-only">Close</span>
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
