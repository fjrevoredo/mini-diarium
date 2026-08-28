import { createSignal } from 'solid-js';
import type { SearchResult } from '../lib/tauri';
import { containsCjk } from '../lib/cjk';

const MIN_QUERY_LENGTH_DEFAULT = 3;
const MIN_QUERY_LENGTH_CJK = 1;

/**
 * Whether a raw (untrimmed) search query meets the minimum length to search.
 * The minimum drops to 1 character for queries containing CJK text (many complete
 * Chinese/Japanese words/phrases are 1-2 characters) and stays at 3 otherwise.
 */
export function meetsMinQueryLength(query: string): boolean {
  const trimmed = query.trim();
  const min = containsCjk(trimmed) ? MIN_QUERY_LENGTH_CJK : MIN_QUERY_LENGTH_DEFAULT;
  return trimmed.length >= min;
}

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
