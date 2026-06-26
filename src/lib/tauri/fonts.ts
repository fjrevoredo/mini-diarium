import { invoke } from '@tauri-apps/api/core';

// Font commands
export async function listBundledFonts(): Promise<string[]> {
  return await invoke('list_bundled_fonts');
}

export interface FontFaceData {
  family: string;
  regular: string;
  bold: string;
  bold_synthesized: boolean;
}

export interface CustomFontSummary {
  family: string;
  has_regular: boolean;
  has_bold: boolean;
}

export async function getFontData(family: string): Promise<FontFaceData> {
  return await invoke('get_font_data', { family });
}

export async function listCustomFonts(): Promise<CustomFontSummary[]> {
  return await invoke('list_custom_fonts');
}

export async function importCustomFont(
  family: string,
  weight: string,
  path: string,
): Promise<void> {
  await invoke('import_custom_font', { family, weight, path });
}

export async function deleteCustomFontFamily(family: string): Promise<void> {
  await invoke('delete_custom_font_family', { family });
}
