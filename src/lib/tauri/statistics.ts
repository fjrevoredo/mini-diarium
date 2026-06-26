import { invoke } from '@tauri-apps/api/core';

// Statistics commands
export interface Statistics {
  total_entries: number;
  entries_per_week: number;
  best_streak: number;
  current_streak: number;
  total_words: number;
  avg_words_per_entry: number;
}

export async function getStatistics(): Promise<Statistics> {
  return await invoke('get_statistics');
}
