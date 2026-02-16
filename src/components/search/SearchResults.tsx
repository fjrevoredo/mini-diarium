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
        <div class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">Searching...</div>
      </Show>

      <Show when={!isSearching() && searchQuery() && searchResults().length === 0}>
        <div class="rounded-md bg-yellow-50 dark:bg-yellow-900/30 p-4 text-sm text-yellow-800 dark:text-yellow-200">
          No results found for "{searchQuery()}"
        </div>
      </Show>

      <Show when={searchResults().length > 0}>
        <div class="space-y-1">
          <For each={searchResults()}>
            {(result) => (
              <button
                onClick={() => handleResultClick(result.date)}
                class="w-full rounded-md p-3 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {result.title || <span class="italic text-gray-400 dark:text-gray-500">No title</span>}
                    </div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDate(result.date)}</div>
                    <Show when={result.snippet}>
                      {/* Safe: snippet comes from our own FTS5 backend with controlled <mark> tags */}
                      <div
                        class="mt-2 text-sm text-gray-600 dark:text-gray-300"
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
