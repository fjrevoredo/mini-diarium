import { createEffect } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import SearchBar from './SearchBar';
import SearchResults from './SearchResults';
import { isSearchOpen, setIsSearchOpen } from '../../state/ui';
import { resetSearchState } from '../../state/search';
import { useI18n } from '../../i18n';

/**
 * Palette-style search overlay. Wraps the existing SearchBar + SearchResults in a
 * Kobalte Dialog (focus-trap / ESC / backdrop for free). The visible title is
 * omitted — the dialog opens straight into the focused input (the Dialog.Title is
 * sr-only for screen readers, which Kobalte requires for accessibility).
 */
export default function SearchOverlay() {
  const t = useI18n();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Clear query + results so the overlay is clean the next time it opens and the
      // SearchBar createEffect doesn't immediately re-fire a stale search.
      resetSearchState();
    }
    setIsSearchOpen(open);
  };

  // Safety net for programmatic closes (e.g. SearchResults.handleResultClick calls
  // setIsSearchOpen(false) directly, which does not fire onOpenChange). Watching the
  // signal guarantees the query/results are cleared on every close → open transition
  // regardless of whether Kobalte unmounts the SearchBar in time.
  let wasOpen = false;
  createEffect(() => {
    const open = isSearchOpen();
    if (wasOpen && !open) resetSearchState();
    wasOpen = open;
  });

  return (
    <Dialog open={isSearchOpen()} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-24">
          <Dialog.Content
            data-testid="search-overlay"
            class="w-full max-w-lg rounded-lg bg-primary p-4 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
          >
            <Dialog.Title class="sr-only">{t('search.title')}</Dialog.Title>
            <Dialog.Description class="sr-only">{t('search.placeholder')}</Dialog.Description>
            <SearchBar />
            <div class="mt-2 max-h-[60vh] overflow-y-auto">
              <SearchResults />
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
