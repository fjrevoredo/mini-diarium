import { createEffect, onCleanup } from 'solid-js';
import { X } from 'lucide-solid';
import {
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  setIsSearching,
  setTotalMatches,
  focusedResultIndex,
  setFocusedResultIndex,
  MIN_QUERY_LENGTH,
} from '../../state/search';
import { searchEntries } from '../../lib/tauri';
import { debounce } from '../../lib/debounce';
import { createLogger } from '../../lib/logger';
import { useI18n } from '../../i18n';

const log = createLogger('Search');

export default function SearchBar() {
  const t = useI18n();

  // eslint-disable-next-line no-unassigned-vars
  let inputRef: HTMLInputElement | undefined;

  // Monotonic token so a slow query can't overwrite a newer query's results: only the
  // latest invocation is allowed to commit to the result/loading signals.
  let searchSeq = 0;

  // Debounced search function — only called from the createEffect when query is non-empty.
  const performSearch = async (query: string) => {
    const seq = ++searchSeq;
    try {
      setIsSearching(true);
      const { results, totalMatches } = await searchEntries(query);
      if (seq !== searchSeq) return;
      setSearchResults(results);
      setTotalMatches(totalMatches);
    } catch (error) {
      if (seq !== searchSeq) return;
      log.error('Search failed:', error);
      setSearchResults([]);
      setTotalMatches(0);
    } finally {
      if (seq === searchSeq) setIsSearching(false);
    }
  };

  const debouncedSearch = debounce(performSearch, 500);

  // Search when query meets the minimum length; clear immediately when it drops below.
  createEffect(() => {
    const query = searchQuery();
    if (query.trim().length >= MIN_QUERY_LENGTH) {
      debouncedSearch(query);
    } else {
      setSearchResults([]);
      setTotalMatches(0);
    }
  });

  // When keyboard focus returns to the input (index -1), actually focus the element.
  createEffect(() => {
    if (focusedResultIndex() === -1) {
      inputRef?.focus();
    }
  });

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement;
    setFocusedResultIndex(-1);
    setSearchQuery(target.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' && searchResults().length > 0) {
      e.preventDefault();
      setFocusedResultIndex(0);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setTotalMatches(0);
    setFocusedResultIndex(-1);
    inputRef?.focus();
  };

  // Cleanup on unmount
  onCleanup(() => {
    setSearchQuery('');
    setSearchResults([]);
    setTotalMatches(0);
    setFocusedResultIndex(-1);
  });

  return (
    <div class="relative">
      <div class="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          class="w-full rounded-md border border-primary bg-primary text-primary px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-tertiary"
        />
        {searchQuery() && (
          <button
            onClick={handleClear}
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-tertiary hover:bg-hover hover:text-secondary"
            aria-label={t('search.clearAria')}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
