import { createSignal } from 'solid-js';
import type { SearchResult } from '../lib/tauri';

export const MIN_QUERY_LENGTH = 3;

// Search query
const [searchQuery, setSearchQuery] = createSignal<string>('');

// Search results
const [searchResults, setSearchResults] = createSignal<SearchResult[]>([]);

// Loading state
const [isSearching, setIsSearching] = createSignal(false);

// Total matches before MAX_RESULTS truncation
const [totalMatches, setTotalMatches] = createSignal<number>(0);

// Keyboard navigation: -1 means input focused, ≥0 means result at that index is focused
const [focusedResultIndex, setFocusedResultIndex] = createSignal<number>(-1);

export function resetSearchState(): void {
  setSearchQuery('');
  setSearchResults([]);
  setIsSearching(false);
  setTotalMatches(0);
  setFocusedResultIndex(-1);
}

export {
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  isSearching,
  setIsSearching,
  totalMatches,
  setTotalMatches,
  focusedResultIndex,
  setFocusedResultIndex,
};
