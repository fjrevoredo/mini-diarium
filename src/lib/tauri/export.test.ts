import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  exportJson,
  exportMarkdown,
  printEntries,
  type ExportResult,
  type PrintLabels,
  type PrintResult,
} from './export';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

const RESULT: ExportResult = { entries_exported: 5, file_path: '/out.json' };

describe('export command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(RESULT);
  });

  it('exportJson spreads date-range options into the args', async () => {
    await expect(
      exportJson('/out.json', { dateFrom: '2024-01-01', dateTo: '2024-01-31' }),
    ).resolves.toEqual(RESULT);
    expect(mockInvoke).toHaveBeenCalledWith('export_json', {
      filePath: '/out.json',
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
    });
  });

  it('exportJson omits option keys when no options are given', async () => {
    await exportJson('/out.json');
    expect(mockInvoke).toHaveBeenCalledWith('export_json', { filePath: '/out.json' });
  });

  it('exportMarkdown → export_markdown { filePath, ...options }', async () => {
    await exportMarkdown('/out.md', { dateFrom: '2024-02-01' });
    expect(mockInvoke).toHaveBeenCalledWith('export_markdown', {
      filePath: '/out.md',
      dateFrom: '2024-02-01',
    });
  });

  it('printEntries → print_entries { labels, ...options } and passes the result through', async () => {
    const labels: PrintLabels = {
      generated_label: 'Generated',
      tags_label: 'Tags',
      no_entries_label: 'No entries',
      months: ['January'],
    };
    const printResult: PrintResult = { entries_exported: 2, html: '<html></html>' };
    mockInvoke.mockResolvedValue(printResult);
    await expect(printEntries(labels, { dateTo: '2024-03-01' })).resolves.toEqual(printResult);
    expect(mockInvoke).toHaveBeenCalledWith('print_entries', {
      labels,
      dateTo: '2024-03-01',
    });
  });
});
