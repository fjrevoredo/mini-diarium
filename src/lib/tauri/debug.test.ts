import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { generateDebugDump, type DebugDumpResult } from './debug';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('debug command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generateDebugDump → generate_debug_dump { filePath, preferencesJson } (camelCase)', async () => {
    const result: DebugDumpResult = {
      file_path: '/dump.txt',
      generated_at: '2024-01-01T00:00:00Z',
    };
    mockInvoke.mockResolvedValue(result);
    await expect(generateDebugDump('/dump.txt', '{"a":1}')).resolves.toEqual(result);
    expect(mockInvoke).toHaveBeenCalledWith('generate_debug_dump', {
      filePath: '/dump.txt',
      preferencesJson: '{"a":1}',
    });
  });
});
