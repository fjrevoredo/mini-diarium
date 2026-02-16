import { For, Show } from 'solid-js';
import { searchQuery, searchResults, isSearching } from '../../state/search';
import { setSelectedDate } from '../../state/ui';

export default function SearchResults() {
  const handleResultClick = (date: string) => {
    setSelectedDate(date);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div class="mt-2">
      <Show when={isSearching()}>
        <div class="py-4 text-center text-sm text-tertiary">Searching...</div>
      </Show>

      <Show when={!isSearching() && searchQuery() && searchResults().length === 0}>
        <div class="rounded-md bg-warning p-4 text-sm text-warning">
          No results found for "{searchQuery()}"
        </div>
      </Show>

      <Show when={searchResults().length > 0}>
        <div class="space-y-1">
          <For each={searchResults()}>
            {(result) => (
              <button
                onClick={() => handleResultClick(result.date)}
                class="w-full rounded-md p-3 text-left transition-colors hover:bg-hover"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="text-sm font-medium text-primary">
                      {result.title || <span class="italic text-muted">No title</span>}
                    </div>
                    <div class="mt-1 text-xs text-tertiary">{formatDate(result.date)}</div>
                    <Show when={result.snippet}>
                      {/* Safe: snippet comes from our own FTS5 backend with controlled <mark> tags */}
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
