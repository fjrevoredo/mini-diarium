import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  listImportPlugins,
  listExportPlugins,
  runImportPlugin,
  runExportPlugin,
  type PluginInfo,
} from './plugins';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

const PLUGIN: PluginInfo = {
  id: 'obsidian',
  name: 'Obsidian',
  file_extensions: ['md'],
  builtin: true,
};

describe('plugins command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('listImportPlugins → list_import_plugins and passes plugins through', async () => {
    mockInvoke.mockResolvedValue([PLUGIN]);
    await expect(listImportPlugins()).resolves.toEqual([PLUGIN]);
    expect(mockInvoke).toHaveBeenCalledWith('list_import_plugins');
  });

  it('listExportPlugins → list_export_plugins and passes plugins through', async () => {
    mockInvoke.mockResolvedValue([PLUGIN]);
    await expect(listExportPlugins()).resolves.toEqual([PLUGIN]);
    expect(mockInvoke).toHaveBeenCalledWith('list_export_plugins');
  });

  it('runImportPlugin → run_import_plugin { pluginId, filePath } (camelCase)', async () => {
    const result = { entries_imported: 3, entries_skipped: 1 };
    mockInvoke.mockResolvedValue(result);
    await expect(runImportPlugin('obsidian', '/in.md')).resolves.toEqual(result);
    expect(mockInvoke).toHaveBeenCalledWith('run_import_plugin', {
      pluginId: 'obsidian',
      filePath: '/in.md',
    });
  });

  it('runExportPlugin → run_export_plugin { pluginId, filePath, ...options }', async () => {
    const result = { entries_exported: 4, file_path: '/out.md' };
    mockInvoke.mockResolvedValue(result);
    await expect(
      runExportPlugin('obsidian', '/out.md', { dateFrom: '2024-01-01' }),
    ).resolves.toEqual(result);
    expect(mockInvoke).toHaveBeenCalledWith('run_export_plugin', {
      pluginId: 'obsidian',
      filePath: '/out.md',
      dateFrom: '2024-01-01',
    });
  });

  it('runExportPlugin omits option keys when no options are given', async () => {
    mockInvoke.mockResolvedValue({ entries_exported: 0, file_path: '/out.md' });
    await runExportPlugin('obsidian', '/out.md');
    expect(mockInvoke).toHaveBeenCalledWith('run_export_plugin', {
      pluginId: 'obsidian',
      filePath: '/out.md',
    });
  });
});
