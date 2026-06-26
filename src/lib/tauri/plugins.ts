import { invoke } from '@tauri-apps/api/core';
import type { ImportResult, ExportResult, ExportOptions } from './export';

// Plugin commands
export interface PluginInfo {
  id: string;
  name: string;
  file_extensions: string[];
  builtin: boolean;
}

export async function listImportPlugins(): Promise<PluginInfo[]> {
  return await invoke('list_import_plugins');
}

export async function listExportPlugins(): Promise<PluginInfo[]> {
  return await invoke('list_export_plugins');
}

export async function runImportPlugin(pluginId: string, filePath: string): Promise<ImportResult> {
  return await invoke('run_import_plugin', { pluginId, filePath });
}

export async function runExportPlugin(
  pluginId: string,
  filePath: string,
  options?: ExportOptions,
): Promise<ExportResult> {
  return await invoke('run_export_plugin', { pluginId, filePath, ...options });
}
