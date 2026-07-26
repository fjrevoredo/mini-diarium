import { invoke } from '@tauri-apps/api/core';

export interface SpellcheckStatus {
  language: string;
  dictionaryAvailable: boolean;
  isFlatpak: boolean;
}

// Spellcheck commands
//
// The HTML `spellcheck` attribute on the editor is enough on Windows and macOS, but
// WebKitGTK runs no checker until it is enabled on the web context. This tells the
// backend to do that; `locale` is the app UI language, used to pick the dictionary.
export async function setSpellcheckEnabled(enabled: boolean, locale: string): Promise<void> {
  await invoke('set_spellcheck_enabled', { enabled, locale });
}

export async function getSpellcheckStatus(locale: string): Promise<SpellcheckStatus | null> {
  return invoke('get_spellcheck_status', { locale });
}
