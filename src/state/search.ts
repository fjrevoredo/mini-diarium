import { createSignal } from 'solid-js';
import type { SearchResult } from '../lib/tauri';

// Search query
const [searchQuery, setSearchQuery] = createSignal<string>('');

// Search results
const [searchResults, setSearchResults] = createSignal<SearchResult[]>([]);

// Loading state
const [isSearching, setIsSearching] = createSignal(false);

export {
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  isSearching,
  setIsSearching,
};
