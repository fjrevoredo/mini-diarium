import { createSignal } from 'solid-js';
import { isFlatpakSandbox } from '../lib/tauri';

const [isFlatpak, setIsFlatpak] = createSignal(false);

/**
 * Fetches Flatpak-sandbox status once. `JournalPicker` calls this on mount so its
 * Create flow knows whether to open a native save dialog (everywhere else) or show the
 * dialog-free create form with a Filename field (Flatpak — see KI-10).
 */
export async function loadPlatformInfo(): Promise<void> {
  setIsFlatpak(await isFlatpakSandbox());
}

export { isFlatpak };
