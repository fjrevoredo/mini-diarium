import { invoke } from '@tauri-apps/api/core';

// Import commands
export interface ImportResult {
  entries_imported: number;
  entries_skipped: number;
}

// Export commands
export interface ExportResult {
  entries_exported: number;
  file_path: string;
}

export interface ExportOptions {
  dateFrom?: string;
  dateTo?: string;
}

export async function exportJson(filePath: string, options?: ExportOptions): Promise<ExportResult> {
  return await invoke('export_json', { filePath, ...options });
}

export async function exportMarkdown(
  filePath: string,
  options?: ExportOptions,
): Promise<ExportResult> {
  return await invoke('export_markdown', { filePath, ...options });
}

export interface PrintLabels {
  generated_label: string;
  tags_label: string;
  no_entries_label: string;
  months: string[];
}

export interface PrintResult {
  entries_exported: number;
  html: string;
}

export async function printEntries(
  labels: PrintLabels,
  options?: ExportOptions,
): Promise<PrintResult> {
  return await invoke<PrintResult>('print_entries', { labels, ...options });
}
