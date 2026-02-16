import { createSignal, createEffect, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { getStatistics, type Statistics } from '../../lib/tauri';
import { X } from 'lucide-solid';

interface StatsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StatsOverlay(props: StatsOverlayProps) {
  const [stats, setStats] = createSignal<Statistics | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Fetch statistics when dialog opens
  createEffect(() => {
    if (props.isOpen) {
      loadStatistics();
    }
  });

  const loadStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStatistics();
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    }
  };

  // Format numbers with locale separators
  const formatNumber = (num: number, decimals: number = 0): string => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Format decimal with max 1 decimal place
  const formatDecimal = (num: number): string => {
    if (num === Math.floor(num)) {
      return formatNumber(num, 0);
    }
    return formatNumber(num, 1);
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
            class="w-full max-w-md rounded-lg bg-primary p-6 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
            onKeyDown={handleKeyDown}
          >
            <div class="flex items-center justify-between mb-4">
              <Dialog.Title class="text-lg font-semibold text-primary">Statistics</Dialog.Title>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-hover transition-colors"
                aria-label="Close"
              >
                <X size={20} class="text-tertiary" />
              </Dialog.CloseButton>
            </div>

            <Dialog.Description class="text-sm text-secondary mb-6">
              Overview of your diary entries and writing habits
            </Dialog.Description>

            <Show when={loading()}>
              <div class="flex items-center justify-center py-12">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            </Show>

            <Show when={error()}>
              <div class="bg-error border border-error rounded-md p-4 mb-4">
                <p class="text-sm text-error">{error()}</p>
              </div>
            </Show>

            <Show when={!loading() && !error() && stats()}>
              <div class="space-y-4">
                {/* Total Entries */}
                <div class="flex items-center justify-between border-b border-primary pb-3">
                  <span class="text-sm font-medium text-secondary">Total Entries</span>
                  <span class="text-lg font-semibold text-primary">
                    {formatNumber(stats()!.total_entries)}
                  </span>
                </div>

                {/* Entries per Week */}
                <div class="flex items-center justify-between border-b border-primary pb-3">
                  <span class="text-sm font-medium text-secondary">Entries per Week</span>
                  <span class="text-lg font-semibold text-primary">
                    {formatDecimal(stats()!.entries_per_week)}
                  </span>
                </div>

                {/* Best Streak */}
                <div class="flex items-center justify-between border-b border-primary pb-3">
                  <span class="text-sm font-medium text-secondary">Best Streak</span>
                  <span class="text-lg font-semibold text-primary">
                    {formatNumber(stats()!.best_streak)}{' '}
                    {stats()!.best_streak === 1 ? 'day' : 'days'}
                  </span>
                </div>

                {/* Current Streak */}
                <div class="flex items-center justify-between border-b border-primary pb-3">
                  <span class="text-sm font-medium text-secondary">Current Streak</span>
                  <span class="text-lg font-semibold text-primary">
                    {formatNumber(stats()!.current_streak)}{' '}
                    {stats()!.current_streak === 1 ? 'day' : 'days'}
                  </span>
                </div>

                {/* Total Words */}
                <div class="flex items-center justify-between border-b border-primary pb-3">
                  <span class="text-sm font-medium text-secondary">Total Words</span>
                  <span class="text-lg font-semibold text-primary">
                    {formatNumber(stats()!.total_words)}
                  </span>
                </div>

                {/* Average Words per Entry */}
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-secondary">Avg. Words per Entry</span>
                  <span class="text-lg font-semibold text-primary">
                    {formatDecimal(stats()!.avg_words_per_entry)}
                  </span>
                </div>
              </div>
            </Show>

            <div class="mt-6 flex justify-end">
              <button
                onClick={() => props.onClose()}
                class="rounded-md bg-tertiary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors"
              >
                Close
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
