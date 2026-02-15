import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importMiniDiaryJson, importDayOneJson, type ImportResult } from './tauri';
import { invoke } from '@tauri-apps/api/core';

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Import functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importMiniDiaryJson', () => {
    it('should call the correct Tauri command', async () => {
      const mockResult: ImportResult = {
        entries_imported: 5,
        entries_merged: 2,
        entries_skipped: 0,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResult);

      const result = await importMiniDiaryJson('/path/to/file.json');

      expect(invoke).toHaveBeenCalledWith('import_minidiary_json', {
        filePath: '/path/to/file.json',
      });
      expect(result).toEqual(mockResult);
    });

    it('should propagate errors from Tauri command', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Parse error'));

      await expect(importMiniDiaryJson('/path/to/file.json')).rejects.toThrow('Parse error');
    });
  });

  describe('importDayOneJson', () => {
    it('should call the correct Tauri command', async () => {
      const mockResult: ImportResult = {
        entries_imported: 10,
        entries_merged: 1,
        entries_skipped: 0,
      };

      vi.mocked(invoke).mockResolvedValueOnce(mockResult);

      const result = await importDayOneJson('/path/to/dayone.json');

      expect(invoke).toHaveBeenCalledWith('import_dayone_json', {
        filePath: '/path/to/dayone.json',
      });
      expect(result).toEqual(mockResult);
    });

    it('should propagate errors from Tauri command', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Invalid Day One format'));

      await expect(importDayOneJson('/path/to/file.json')).rejects.toThrow(
        'Invalid Day One format',
      );
    });
  });
});
