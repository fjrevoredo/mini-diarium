import { invoke } from '@tauri-apps/api/core';

// Debug commands
export interface DebugDumpResult {
  file_path: string;
  generated_at: string;
}

/**
 * `clientStateJson` is a serialised `ClientState` (see `src/lib/debug-dump-payload.ts`) —
 * the whole browser-side payload, not just preferences.
 */
export async function generateDebugDump(
  filePath: string,
  clientStateJson: string,
): Promise<DebugDumpResult> {
  return await invoke<DebugDumpResult>('generate_debug_dump', { filePath, clientStateJson });
}
