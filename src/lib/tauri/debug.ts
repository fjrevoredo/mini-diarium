import { invoke } from '@tauri-apps/api/core';

// Debug commands
export interface DebugDumpResult {
  file_path: string;
  generated_at: string;
}

export async function generateDebugDump(
  filePath: string,
  preferencesJson: string,
): Promise<DebugDumpResult> {
  return await invoke<DebugDumpResult>('generate_debug_dump', { filePath, preferencesJson });
}
