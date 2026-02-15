import { createSignal, For } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { preferences, setPreferences } from '../../state/preferences';

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

  // Reset local state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setLocalAllowFutureEntries(preferences().allowFutureEntries);
      setLocalFirstDayOfWeek(
        preferences().firstDayOfWeek === null ? 'null' : String(preferences().firstDayOfWeek),
      );
      setLocalHideTitles(preferences().hideTitles);
      setLocalEnableSpellcheck(preferences().enableSpellcheck);
    }
    if (!open) {
      props.onClose();
    }
  };

  // Save preferences and close
  const handleSave = () => {
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

  return (
    <Dialog open={props.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            class="w-full max-w-md rounded-lg bg-white p-6 shadow-lg data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            onKeyDown={handleKeyDown}
          >
            <Dialog.Title class="text-lg font-semibold text-gray-900 mb-4">
              Preferences
            </Dialog.Title>

            <Dialog.Description class="text-sm text-gray-600 mb-6">
              Customize your journaling experience.
            </Dialog.Description>

            <div class="space-y-6">
              {/* Calendar Section */}
              <div>
                <h3 class="text-sm font-medium text-gray-900 mb-3">Calendar</h3>

                {/* First Day of Week */}
                <div class="mb-4">
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    First Day of Week
                  </label>
                  <select
                    value={localFirstDayOfWeek()}
                    onChange={(e) => setLocalFirstDayOfWeek(e.currentTarget.value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <p class="mt-1 ml-6 text-xs text-gray-500">
                  When disabled, you cannot create entries for future dates.
                </p>
              </div>

              {/* Editor Section */}
              <div>
                <h3 class="text-sm font-medium text-gray-900 mb-3">Editor</h3>

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
                  <p class="mt-1 ml-6 text-xs text-gray-500">
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
                <p class="mt-1 ml-6 text-xs text-gray-500">
                  When enabled, browser spellcheck will highlight misspelled words.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div class="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => props.onClose()}
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
