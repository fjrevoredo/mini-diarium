import { For, Show, createEffect } from 'solid-js';
import {
  searchQuery,
  searchResults,
  isSearching,
  totalMatches,
  focusedResultIndex,
  setFocusedResultIndex,
  MIN_QUERY_LENGTH,
} from '../../state/search';
import { setSelectedEntryId, setIsSearchOpen, requestDateAndViewChange } from '../../state/ui';
import { preferences } from '../../state/preferences';
import { useI18n } from '../../i18n';

// Mirrors MAX_RESULTS in src-tauri/src/commands/search.rs.
const MAX_RESULTS = 200;

export default function SearchResults() {
  const t = useI18n();
  const resultRefs: (HTMLButtonElement | undefined)[] = [];

  // Move DOM focus to the active result whenever the focused index changes.
  createEffect(() => {
    const idx = focusedResultIndex();
    if (idx >= 0 && idx < searchResults().length) {
      resultRefs[idx]?.focus();
    }
  });

  const handleResultClick = async (id: number, date: string) => {
    // Set the entry deep-link before the date so the editor's date effect opens this exact
    // entry (a day can hold multiple entries) rather than the day's newest.
    setSelectedEntryId(id);
    // Guarded, single-fire date+view change (TODO-0104) — a denied navigation leaves the
    // search overlay open rather than closing it over nothing having happened.
    if (!(await requestDateAndViewChange(date, 'editor'))) {
      // Clear the deep-link set above: a cancelled click must not leave a stale target
      // sitting in selectedEntryId, since the next unrelated date load anywhere in the app
      // (loadEntriesForDate) consumes it unconditionally and would deep-link into this
      // entry instead of that day's default/newest one, resurfacing a click the user
      // explicitly backed out of.
      setSelectedEntryId(null);
      return;
    }
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

      <Show
        when={
          !isSearching() &&
          searchQuery().trim().length >= MIN_QUERY_LENGTH &&
          searchResults().length === 0
        }
      >
        <div class="rounded-md bg-warning p-4 text-sm text-warning">
          {t('search.noResults', { query: searchQuery() })}
        </div>
      </Show>

      <Show when={searchResults().length > 0}>
        <div class="mb-2 px-1 text-xs text-tertiary">
          {t(totalMatches() === 1 ? 'search.resultCount_one' : 'search.resultCount_other', {
            count: totalMatches(),
          })}
          <Show when={totalMatches() > MAX_RESULTS}>
            {' — '}
            {t('search.truncated', { max: MAX_RESULTS })}
          </Show>
        </div>
        <div class="space-y-1">
          <For each={searchResults()}>
            {(result, index) => (
              <button
                ref={(el) => {
                  resultRefs[index()] = el;
                }}
                onClick={() => void handleResultClick(result.id, result.date)}
                onKeyDown={(e: KeyboardEvent) => {
                  const idx = index();
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedResultIndex(Math.min(idx + 1, searchResults().length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (idx === 0) {
                      // SearchBar's createEffect re-focuses the input when index returns to -1.
                      setFocusedResultIndex(-1);
                    } else {
                      setFocusedResultIndex(idx - 1);
                    }
                  }
                }}
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
