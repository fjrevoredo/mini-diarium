import { For, Show } from 'solid-js';
import { searchQuery, searchResults, isSearching } from '../../state/search';
import { setSelectedDate, setSelectedEntryId, setMainView, setIsSearchOpen } from '../../state/ui';
import { preferences } from '../../state/preferences';
import { useI18n } from '../../i18n';

export default function SearchResults() {
  const t = useI18n();

  const handleResultClick = (id: number, date: string) => {
    // Set the entry deep-link before the date so the editor's date effect opens this exact
    // entry (a day can hold multiple entries) rather than the day's newest.
    setSelectedEntryId(id);
    setSelectedDate(date);
    // Switch to the editor (the user may have clicked from the Timeline view) and close
    // the overlay so the entry is visible underneath.
    setMainView('editor');
    setIsSearchOpen(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(preferences().language, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div class="mt-2">
      <Show when={isSearching()}>
        <div class="py-4 text-center text-sm text-tertiary">{t('search.searching')}</div>
      </Show>

      <Show when={!isSearching() && searchQuery() && searchResults().length === 0}>
        <div class="rounded-md bg-warning p-4 text-sm text-warning">
          {t('search.noResults', { query: searchQuery() })}
        </div>
      </Show>

      <Show when={searchResults().length > 0}>
        <div class="space-y-1">
          <For each={searchResults()}>
            {(result) => (
              <button
                onClick={() => handleResultClick(result.id, result.date)}
                class="w-full rounded-md p-3 text-left transition-colors hover:bg-hover"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="text-sm font-medium text-primary">
                      {result.title || <span class="italic text-muted">{t('search.noTitle')}</span>}
                    </div>
                    <div class="mt-1 text-xs text-tertiary">{formatDate(result.date)}</div>
                    <Show when={result.snippet}>
                      {/* Safe: snippet comes from our own backend search with controlled <mark>
                          tags and HTML-escaped surrounding text (see escape_html in search.rs). */}
                      <div
                        class="mt-2 text-sm text-secondary"
                        // eslint-disable-next-line solid/no-innerhtml
                        innerHTML={result.snippet}
                      />
                    </Show>
                  </div>
                </div>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
