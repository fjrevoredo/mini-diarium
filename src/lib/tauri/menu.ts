import { invoke } from '@tauri-apps/api/core';

// Menu commands
export async function updateMenuLocale(locale: string): Promise<void> {
  await invoke('update_menu_locale', { locale });
}
