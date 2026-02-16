import { createSignal, For, Show, onMount } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { preferences, setPreferences } from '../../state/preferences';
import { getThemePreference, setTheme, type ThemePreference } from '../../lib/theme';
import { authState } from '../../state/auth';
import * as tauri from '../../lib/tauri';

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

export default function PreferencesOverlay(props: PreferencesOverlayProps) {
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

  // Diary file state
  const [diaryPath, setDiaryPath] = createSignal<string>('');

  // Password change state
  const [oldPassword, setOldPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [passwordError, setPasswordError] = createSignal<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = createSignal(false);

  const isUnlocked = () => authState() === 'unlocked';

  // Load diary path on mount
  onMount(async () => {
    try {
      const path = await tauri.getDiaryPath();
      setDiaryPath(path);
    } catch (err) {
      console.error('Failed to load diary path:', err);
    }
  });

  // Reset local state when dialog opens
  const handleOpenChange = async (open: boolean) => {
    if (open) {
      setLocalTheme(getThemePreference());
      setLocalAllowFutureEntries(preferences().allowFutureEntries);
      setLocalFirstDayOfWeek(
        preferences().firstDayOfWeek === null ? 'null' : String(preferences().firstDayOfWeek),
      );
      setLocalHideTitles(preferences().hideTitles);
      setLocalEnableSpellcheck(preferences().enableSpellcheck);

      // Reset password fields
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);

      // Reload diary path
      try {
        const path = await tauri.getDiaryPath();
        setDiaryPath(path);
      } catch (err) {
        console.error('Failed to load diary path:', err);
      }
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

    if (newPassword().length < 6) {
      setPasswordError('New password must be at least 6 characters');
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
      const message = err instanceof Error ? err.message : String(err);
      setPasswordError(message);
    }
  };

  // Handle diary reset
  const handleResetDiary = async () => {
    const confirmed = confirm(
      'Are you sure you want to reset your diary? This will permanently delete all entries and cannot be undone.',
    );

    if (!confirmed) return;

    // Double confirmation
    const doubleConfirmed = confirm(
      'This is your last chance. Are you absolutely sure you want to delete all your diary entries?',
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

  return (
    <Dialog open={props.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            class="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-6 shadow-lg data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            onKeyDown={handleKeyDown}
          >
            <Dialog.Title class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Preferences
            </Dialog.Title>

            <Dialog.Description class="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Customize your journaling experience.
            </Dialog.Description>

            <div class="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              {/* Theme Section - Always shown */}
              <div>
                <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Appearance</h3>

                {/* Theme Selector */}
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Theme</label>
                  <select
                    value={localTheme()}
                    onChange={(e) => setLocalTheme(e.currentTarget.value as ThemePreference)}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="auto">Auto (System Default)</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Choose how the app should look. Auto follows your system theme.
                  </p>
                </div>
              </div>

              {/* Calendar Section - Only shown when unlocked */}
              <Show when={isUnlocked()}>
                <div>
                  <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Calendar</h3>

                  {/* First Day of Week */}
                  <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      First Day of Week
                    </label>
                    <select
                      value={localFirstDayOfWeek()}
                      onChange={(e) => setLocalFirstDayOfWeek(e.currentTarget.value)}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <For each={FIRST_DAY_OPTIONS}>
                        {(option) => <option value={option.value}>{option.label}</option>}
                      </For>
                    </select>
                  </div>

                  {/* Allow Future Entries */}
                  <div class="flex items-center">
                    <input
                      type="checkbox"
                      id="allow-future"
                      checked={localAllowFutureEntries()}
                      onChange={(e) => setLocalAllowFutureEntries(e.currentTarget.checked)}
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label for="allow-future" class="ml-2 text-sm text-gray-700">
                      Allow future entries
                    </label>
                  </div>
                  <p class="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
                    When disabled, you cannot create entries for future dates.
                  </p>
                </div>
              </Show>

              {/* Editor Section - Only shown when unlocked */}
              <Show when={isUnlocked()}>
                <div>
                  <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Editor</h3>

                  {/* Hide Titles */}
                  <div class="mb-4">
                    <div class="flex items-center">
                      <input
                        type="checkbox"
                        id="hide-titles"
                        checked={localHideTitles()}
                        onChange={(e) => setLocalHideTitles(e.currentTarget.checked)}
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label for="hide-titles" class="ml-2 text-sm text-gray-700">
                        Hide entry titles
                      </label>
                    </div>
                    <p class="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
                      When enabled, the title editor will be hidden. Title data is still saved.
                    </p>
                  </div>

                  {/* Enable Spellcheck */}
                  <div class="flex items-center">
                    <input
                      type="checkbox"
                      id="enable-spellcheck"
                      checked={localEnableSpellcheck()}
                      onChange={(e) => setLocalEnableSpellcheck(e.currentTarget.checked)}
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label for="enable-spellcheck" class="ml-2 text-sm text-gray-700">
                      Enable spellcheck
                    </label>
                  </div>
                  <p class="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
                    When enabled, browser spellcheck will highlight misspelled words.
                  </p>
                </div>
              </Show>

              {/* Diary File Section - Always shown */}
              <div>
                <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Diary File</h3>

                {/* Current Path */}
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Location
                  </label>
                  <div class="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-300 font-mono break-all">
                    {diaryPath() || 'Loading...'}
                  </div>
                </div>

                {/* Reset Diary Button */}
                <button
                  type="button"
                  onClick={handleResetDiary}
                  class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Reset Diary
                </button>
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Warning: This will permanently delete all entries. This action cannot be undone.
                </p>
              </div>

              {/* Password Section - Only shown when unlocked */}
              <Show when={isUnlocked()}>
                <div>
                  <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Password</h3>

                  {/* Old Password */}
                  <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={oldPassword()}
                      onInput={(e) => setOldPassword(e.currentTarget.value)}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter current password"
                    />
                  </div>

                  {/* New Password */}
                  <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword()}
                      onInput={(e) => setNewPassword(e.currentTarget.value)}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter new password (min 6 characters)"
                    />
                  </div>

                  {/* Confirm Password */}
                  <div class="mb-3">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword()}
                      onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Confirm new password"
                    />
                  </div>

                  {/* Error/Success Messages */}
                  <Show when={passwordError()}>
                    <div class="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
                      <p class="text-sm text-red-600">{passwordError()}</p>
                    </div>
                  </Show>
                  <Show when={passwordSuccess()}>
                    <div class="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
                      <p class="text-sm text-green-600">Password changed successfully!</p>
                    </div>
                  </Show>

                  {/* Change Password Button */}
                  <button
                    type="button"
                    onClick={handlePasswordChange}
                    class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Change Password
                  </button>
                </div>
              </Show>
            </div>

            {/* Footer Buttons */}
            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => props.onClose()}
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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

            <Dialog.CloseButton class="absolute top-4 right-4 inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
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
