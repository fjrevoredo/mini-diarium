import { invoke } from '@tauri-apps/api/core';

/**
 * Whether the app is running inside the Flatpak sandbox.
 *
 * A native save dialog under Flatpak's zero-`--filesystem=` sandbox can hand back a
 * temporary `/run/user/*\/doc/` portal path instead of a real one — the journal picker uses
 * this to skip the save dialog on Create and ask for a filename directly instead.
 */
export async function isFlatpakSandbox(): Promise<boolean> {
  return await invoke('is_flatpak_sandbox');
}
