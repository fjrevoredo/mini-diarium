import { invoke } from '@tauri-apps/api/core';

// Navigation commands
export async function navigatePreviousDay(currentDate: string): Promise<string> {
  return await invoke('navigate_previous_day', { currentDate });
}

export async function navigateNextDay(currentDate: string): Promise<string> {
  return await invoke('navigate_next_day', { currentDate });
}

export async function navigateToToday(): Promise<string> {
  return await invoke('navigate_to_today');
}

export async function navigatePreviousMonth(currentDate: string): Promise<string> {
  return await invoke('navigate_previous_month', { currentDate });
}

export async function navigateNextMonth(currentDate: string): Promise<string> {
  return await invoke('navigate_next_month', { currentDate });
}
