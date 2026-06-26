import { invoke } from '@tauri-apps/api/core';

// File utility commands
export async function readFileBytes(path: string): Promise<number[]> {
  return await invoke('read_file_bytes', { path });
}

export async function readTextFile(path: string): Promise<string> {
  return await invoke('read_text_file', { path });
}

export async function writePdfFile(filePath: string, bytes: number[]): Promise<void> {
  await invoke('write_pdf_file', { filePath, bytes });
}
