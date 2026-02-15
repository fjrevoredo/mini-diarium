import { createSignal } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { isGoToDateOpen, setIsGoToDateOpen, selectedDate, setSelectedDate } from '../../state/ui';
import { getTodayString, isValidDate } from '../../lib/dates';
import { preferences } from '../../state/preferences';

export default function GoToDateOverlay() {
  const [dateInput, setDateInput] = createSignal(selectedDate());

  // Reset input when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setDateInput(selectedDate());
    }
    setIsGoToDateOpen(open);
  };

  // Check if submit should be disabled
  const isSubmitDisabled = () => {
    const input = dateInput();

    // Invalid date format
    if (!isValidDate(input)) {
      return true;
    }

    // Unchanged from current selection
    if (input === selectedDate()) {
      return true;
    }

    // Future date check (controlled by preference)
    if (!preferences().allowFutureEntries) {
      const today = getTodayString();
      if (input > today) {
        return true;
      }
    }

    return false;
  };

  // Handle form submission
  const handleSubmit = (e: Event) => {
    e.preventDefault();

    if (!isSubmitDisabled()) {
      setSelectedDate(dateInput());
      setIsGoToDateOpen(false);
    }
  };

  // Handle Escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsGoToDateOpen(false);
    }
  };

  return (
    <Dialog open={isGoToDateOpen()} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0" />
        <div class="fixed inset-0 z-50 flex items-center justify-center">
          <Dialog.Content
            class="w-full max-w-md rounded-lg bg-white p-6 shadow-lg data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            onKeyDown={handleKeyDown}
          >
            <Dialog.Title class="text-lg font-semibold text-gray-900 mb-4">Go to Date</Dialog.Title>

            <Dialog.Description class="text-sm text-gray-600 mb-4">
              Jump to a specific date in your journal.
            </Dialog.Description>

            <form onSubmit={handleSubmit} class="space-y-4">
              <div>
                <label for="date-input" class="block text-sm font-medium text-gray-700 mb-2">
                  Select Date
                </label>
                <input
                  id="date-input"
                  type="date"
                  value={dateInput()}
                  onInput={(e) => setDateInput(e.currentTarget.value)}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autofocus
                />
              </div>

              <div class="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsGoToDateOpen(false)}
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitDisabled()}
                  class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                >
                  Go to Date
                </button>
              </div>
            </form>

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
