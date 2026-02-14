import { createEffect, onCleanup } from 'solid-js';
import { searchQuery, setSearchQuery, setSearchResults, setIsSearching } from '../../state/search';
import { searchEntries } from '../../lib/tauri';
import { debounce } from '../../lib/debounce';

export default function SearchBar() {
  let inputRef: HTMLInputElement | undefined;

  // Debounced search function
  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = await searchEntries(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const debouncedSearch = debounce(performSearch, 500);

  // Search when query changes
  createEffect(() => {
    const query = searchQuery();
    if (query.trim()) {
      debouncedSearch(query);
    } else {
      // Clear immediately when query is empty
      setSearchResults([]);
    }
  });

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement;
    setSearchQuery(target.value);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    inputRef?.focus();
  };

  // Cleanup on unmount
  onCleanup(() => {
    setSearchQuery('');
    setSearchResults([]);
  });

  return (
    <div class="relative">
      <div class="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery()}
          onInput={handleInput}
          placeholder="Search entries..."
          class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {searchQuery() && (
          <button
            onClick={handleClear}
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Clear search"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
