import { invoke } from '@tauri-apps/api/core';

// Search commands
export interface SearchResult {
  id: number;
  date: string;
  title: string;
  snippet: string;
}

export async function searchEntries(query: string): Promise<SearchResult[]> {
  return await invoke('search_entries', { query });
}
