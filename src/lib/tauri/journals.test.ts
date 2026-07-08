import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  listJournals,
  getActiveJournalId,
  addJournal,
  removeJournal,
  renameJournal,
  switchJournal,
  type JournalConfig,
} from './journals';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

const JOURNAL: JournalConfig = {
  id: 'j1',
  name: 'Main',
  path: '/data/main',
  auto_protected: false,
  require_all_auth: false,
  db_filename: 'diary.db',
};

describe('journals command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('listJournals → list_journals and passes the configs through', async () => {
    mockInvoke.mockResolvedValue([JOURNAL]);
    await expect(listJournals()).resolves.toEqual([JOURNAL]);
    expect(mockInvoke).toHaveBeenCalledWith('list_journals');
  });

  it('getActiveJournalId → get_active_journal_id and passes the id through', async () => {
    mockInvoke.mockResolvedValue('j1');
    await expect(getActiveJournalId()).resolves.toBe('j1');
    expect(mockInvoke).toHaveBeenCalledWith('get_active_journal_id');
  });

  it('getActiveJournalId passes a null id through', async () => {
    mockInvoke.mockResolvedValue(null);
    await expect(getActiveJournalId()).resolves.toBeNull();
  });

  it('addJournal → add_journal { name, path, dbFilename } (camelCase)', async () => {
    mockInvoke.mockResolvedValue(JOURNAL);
    await expect(addJournal('Main', '/data/main', 'diary.db')).resolves.toEqual(JOURNAL);
    expect(mockInvoke).toHaveBeenCalledWith('add_journal', {
      name: 'Main',
      path: '/data/main',
      dbFilename: 'diary.db',
    });
  });

  it('addJournal forwards an undefined dbFilename unchanged', async () => {
    mockInvoke.mockResolvedValue(JOURNAL);
    await addJournal('Main', '/data/main');
    expect(mockInvoke).toHaveBeenCalledWith('add_journal', {
      name: 'Main',
      path: '/data/main',
      dbFilename: undefined,
    });
  });

  it('removeJournal → remove_journal { id }', async () => {
    await removeJournal('j1');
    expect(mockInvoke).toHaveBeenCalledWith('remove_journal', { id: 'j1' });
  });

  it('renameJournal → rename_journal { id, name }', async () => {
    await renameJournal('j1', 'Renamed');
    expect(mockInvoke).toHaveBeenCalledWith('rename_journal', { id: 'j1', name: 'Renamed' });
  });

  it('switchJournal → switch_journal { id }', async () => {
    await switchJournal('j1');
    expect(mockInvoke).toHaveBeenCalledWith('switch_journal', { id: 'j1' });
  });
});
