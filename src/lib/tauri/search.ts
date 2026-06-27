import { invoke } from '@tauri-apps/api/core';

// Search commands
export interface SearchResult {
  id: number;
  date: string;
  title: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  /** Count of matching entries BEFORE truncation to MAX_RESULTS (200). */
  totalMatches: number;
}

export async function searchEntries(query: string): Promise<SearchResponse> {
  return await invoke('search_entries', { query });
}
