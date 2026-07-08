import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockTauriBarrel } from '../test/mock-tauri';
import type { JournalConfig } from '../lib/tauri';

const mocks = vi.hoisted(() => ({
  listJournals: vi.fn(),
  getActiveJournalId: vi.fn(),
  switchJournal: vi.fn(),
  addJournal: vi.fn(),
  removeJournal: vi.fn(),
  renameJournal: vi.fn(),
}));

vi.mock('../lib/tauri', () =>
  mockTauriBarrel({
    listJournals: mocks.listJournals,
    getActiveJournalId: mocks.getActiveJournalId,
    switchJournal: mocks.switchJournal,
    addJournal: mocks.addJournal,
    removeJournal: mocks.removeJournal,
    renameJournal: mocks.renameJournal,
  }),
);

import {
  journals,
  activeJournalId,
  isSwitching,
  loadJournals,
  switchJournal,
  addJournal,
  removeJournal,
  renameJournal,
} from './journals';
import { registerCleanupCallback } from './entries';

function makeJournal(overrides: Partial<JournalConfig> = {}): JournalConfig {
  return {
    id: 'j1',
    name: 'Main',
    path: '/data/main',
    auto_protected: false,
    require_all_auth: false,
    db_filename: 'diary.db',
    ...overrides,
  };
}

describe('state/journals', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.listJournals.mockResolvedValue([]);
    mocks.getActiveJournalId.mockResolvedValue(null);
    mocks.switchJournal.mockResolvedValue(undefined);
    mocks.addJournal.mockResolvedValue(makeJournal());
    mocks.removeJournal.mockResolvedValue(undefined);
    mocks.renameJournal.mockResolvedValue(undefined);
    // Reset the module signals to a known empty baseline, then zero the call
    // history so per-test assertions start clean (impls are preserved).
    await loadJournals();
    vi.clearAllMocks();
  });

  it('loadJournals populates journals and active id from the backend', async () => {
    const list = [makeJournal({ id: 'a' }), makeJournal({ id: 'b' })];
    mocks.listJournals.mockResolvedValue(list);
    mocks.getActiveJournalId.mockResolvedValue('b');

    await loadJournals();

    expect(journals()).toEqual(list);
    expect(activeJournalId()).toBe('b');
  });

  it('switchJournal runs cleanup callbacks BEFORE the backend switch, then updates the active id', async () => {
    const order: string[] = [];
    const unregister = registerCleanupCallback(() => {
      order.push('cleanup');
    });
    mocks.switchJournal.mockImplementation(async () => {
      order.push('switch');
    });

    await switchJournal('j5');

    expect(order).toEqual(['cleanup', 'switch']);
    expect(mocks.switchJournal).toHaveBeenCalledWith('j5');
    expect(activeJournalId()).toBe('j5');
    unregister();
  });

  it('switchJournal ignores a re-entrant call while a switch is in flight', async () => {
    // Capture the resolver synchronously (before any switchJournal call) so the
    // in-flight backend switch stays pending until we release it.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.switchJournal.mockReturnValue(gate);

    const first = switchJournal('j2');
    expect(isSwitching()).toBe(true);

    // Second call while the first is still pending must be a no-op.
    const second = switchJournal('j3');

    release();
    await Promise.all([first, second]);

    expect(mocks.switchJournal).toHaveBeenCalledTimes(1);
    expect(mocks.switchJournal).toHaveBeenCalledWith('j2');
    expect(activeJournalId()).toBe('j2');
    expect(isSwitching()).toBe(false);
  });

  it('switchJournal resets isSwitching even when the backend switch rejects', async () => {
    mocks.switchJournal.mockRejectedValue(new Error('boom'));

    await expect(switchJournal('jx')).rejects.toThrow('boom');

    expect(isSwitching()).toBe(false);
  });

  it('addJournal creates via backend (forwarding args) then reloads the list', async () => {
    const created = makeJournal({ id: 'new', name: 'New' });
    mocks.addJournal.mockResolvedValue(created);
    mocks.listJournals.mockResolvedValue([created]);
    mocks.getActiveJournalId.mockResolvedValue('new');

    const result = await addJournal('New', '/path');

    expect(mocks.addJournal).toHaveBeenCalledWith('New', '/path', undefined);
    expect(result).toEqual(created);
    expect(journals()).toEqual([created]);
  });

  it('removeJournal deletes via backend then reloads the list', async () => {
    mocks.listJournals.mockResolvedValue([]);

    await removeJournal('gone');

    expect(mocks.removeJournal).toHaveBeenCalledWith('gone');
    expect(mocks.listJournals).toHaveBeenCalledTimes(1);
    expect(journals()).toEqual([]);
  });

  it('renameJournal renames via backend then reloads the list', async () => {
    const renamed = makeJournal({ id: 'j1', name: 'Renamed' });
    mocks.listJournals.mockResolvedValue([renamed]);

    await renameJournal('j1', 'Renamed');

    expect(mocks.renameJournal).toHaveBeenCalledWith('j1', 'Renamed');
    expect(journals()).toEqual([renamed]);
  });
});
