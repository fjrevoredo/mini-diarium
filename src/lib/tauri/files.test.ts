import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { readFileBytes, readTextFile, writePdfFile } from './files';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('files command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('readFileBytes → read_file_bytes { path } and passes the bytes through', async () => {
    mockInvoke.mockResolvedValue([1, 2, 3]);
    await expect(readFileBytes('/img.png')).resolves.toEqual([1, 2, 3]);
    expect(mockInvoke).toHaveBeenCalledWith('read_file_bytes', { path: '/img.png' });
  });

  it('readTextFile → read_text_file { path } and passes the text through', async () => {
    mockInvoke.mockResolvedValue('contents');
    await expect(readTextFile('/notes.txt')).resolves.toBe('contents');
    expect(mockInvoke).toHaveBeenCalledWith('read_text_file', { path: '/notes.txt' });
  });

  it('writePdfFile → write_pdf_file { filePath, bytes } (camelCase)', async () => {
    await writePdfFile('/out.pdf', [4, 5, 6]);
    expect(mockInvoke).toHaveBeenCalledWith('write_pdf_file', {
      filePath: '/out.pdf',
      bytes: [4, 5, 6],
    });
  });
});
