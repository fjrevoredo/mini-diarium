import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  createJournal,
  unlockJournal,
  lockJournal,
  journalExists,
  checkJournalPath,
  isJournalUnlocked,
  getJournalPath,
  changeJournalDirectory,
  changePassword,
  resetJournal,
  unlockJournalWithKeypair,
  verifyPassword,
  peekAuthSlotTypes,
  listAuthMethods,
  generateKeypair,
  writeKeyFile,
  registerKeypair,
  registerPassword,
  removeAuthMethod,
  unlockJournalAllMethods,
  setRequireAllAuth,
  createJournalAuto,
  unlockJournalAuto,
  type AuthMethodInfo,
  type JournalPeek,
  type KeypairFiles,
  type MultiAuthCredential,
} from './auth';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('auth command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('createJournal → create_diary { password }', async () => {
    await createJournal('pw');
    expect(mockInvoke).toHaveBeenCalledWith('create_diary', { password: 'pw' });
  });

  it('unlockJournal → unlock_diary { password }', async () => {
    await unlockJournal('pw');
    expect(mockInvoke).toHaveBeenCalledWith('unlock_diary', { password: 'pw' });
  });

  it('lockJournal → lock_diary with no args', async () => {
    await lockJournal();
    expect(mockInvoke).toHaveBeenCalledWith('lock_diary');
  });

  it('journalExists → diary_exists and passes the boolean through', async () => {
    mockInvoke.mockResolvedValue(true);
    await expect(journalExists()).resolves.toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('diary_exists');
  });

  it('checkJournalPath → check_diary_path { path } and passes result through', async () => {
    mockInvoke.mockResolvedValue(false);
    await expect(checkJournalPath('/tmp/j')).resolves.toBe(false);
    expect(mockInvoke).toHaveBeenCalledWith('check_diary_path', { path: '/tmp/j' });
  });

  it('isJournalUnlocked → is_diary_unlocked and passes the boolean through', async () => {
    mockInvoke.mockResolvedValue(true);
    await expect(isJournalUnlocked()).resolves.toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('is_diary_unlocked');
  });

  it('getJournalPath → get_diary_path and passes the path through', async () => {
    mockInvoke.mockResolvedValue('/data/diary');
    await expect(getJournalPath()).resolves.toBe('/data/diary');
    expect(mockInvoke).toHaveBeenCalledWith('get_diary_path');
  });

  it('changeJournalDirectory → change_diary_directory { newDir, moveBackups } (camelCase)', async () => {
    await changeJournalDirectory('/new/dir', true);
    expect(mockInvoke).toHaveBeenCalledWith('change_diary_directory', {
      newDir: '/new/dir',
      moveBackups: true,
    });
  });

  it('changePassword → change_password { oldPassword, newPassword } (camelCase)', async () => {
    await changePassword('old', 'new');
    expect(mockInvoke).toHaveBeenCalledWith('change_password', {
      oldPassword: 'old',
      newPassword: 'new',
    });
  });

  it('resetJournal → reset_diary with no args', async () => {
    await resetJournal();
    expect(mockInvoke).toHaveBeenCalledWith('reset_diary');
  });

  it('unlockJournalWithKeypair → unlock_diary_with_keypair { keyPath } (camelCase)', async () => {
    await unlockJournalWithKeypair('/key');
    expect(mockInvoke).toHaveBeenCalledWith('unlock_diary_with_keypair', { keyPath: '/key' });
  });

  it('verifyPassword → verify_password { password }', async () => {
    await verifyPassword('pw');
    expect(mockInvoke).toHaveBeenCalledWith('verify_password', { password: 'pw' });
  });

  it('peekAuthSlotTypes → peek_auth_slot_types and passes the peek through', async () => {
    const peek: JournalPeek = {
      slots: [{ id: 1, slot_type: 'password', label: 'main' }],
      require_all_auth: false,
    };
    mockInvoke.mockResolvedValue(peek);
    await expect(peekAuthSlotTypes()).resolves.toEqual(peek);
    expect(mockInvoke).toHaveBeenCalledWith('peek_auth_slot_types');
  });

  it('listAuthMethods → list_auth_methods and passes the array through', async () => {
    const methods: AuthMethodInfo[] = [
      {
        id: 1,
        slot_type: 'password',
        label: 'main',
        public_key_hex: null,
        created_at: 'now',
        last_used: null,
      },
    ];
    mockInvoke.mockResolvedValue(methods);
    await expect(listAuthMethods()).resolves.toEqual(methods);
    expect(mockInvoke).toHaveBeenCalledWith('list_auth_methods');
  });

  it('generateKeypair → generate_keypair and passes the files through', async () => {
    const files: KeypairFiles = { public_key_hex: 'pub', private_key_hex: 'priv' };
    mockInvoke.mockResolvedValue(files);
    await expect(generateKeypair()).resolves.toEqual(files);
    expect(mockInvoke).toHaveBeenCalledWith('generate_keypair');
  });

  it('writeKeyFile → write_key_file { path, privateKeyHex } (camelCase)', async () => {
    await writeKeyFile('/key', 'deadbeef');
    expect(mockInvoke).toHaveBeenCalledWith('write_key_file', {
      path: '/key',
      privateKeyHex: 'deadbeef',
    });
  });

  it('registerKeypair → register_keypair { currentPassword, publicKeyHex, label }', async () => {
    await registerKeypair('pw', 'pub', 'my key');
    expect(mockInvoke).toHaveBeenCalledWith('register_keypair', {
      currentPassword: 'pw',
      publicKeyHex: 'pub',
      label: 'my key',
    });
  });

  it('registerKeypair passes null currentPassword through unchanged', async () => {
    await registerKeypair(null, 'pub', 'my key');
    expect(mockInvoke).toHaveBeenCalledWith('register_keypair', {
      currentPassword: null,
      publicKeyHex: 'pub',
      label: 'my key',
    });
  });

  it('registerPassword → register_password { newPassword } (camelCase)', async () => {
    await registerPassword('pw');
    expect(mockInvoke).toHaveBeenCalledWith('register_password', { newPassword: 'pw' });
  });

  it('removeAuthMethod → remove_auth_method { slotId, currentPassword } (camelCase)', async () => {
    await removeAuthMethod(3, null);
    expect(mockInvoke).toHaveBeenCalledWith('remove_auth_method', {
      slotId: 3,
      currentPassword: null,
    });
  });

  it('unlockJournalAllMethods → unlock_diary_all_methods { credentials }', async () => {
    const creds: MultiAuthCredential[] = [
      { type: 'password', value: 'pw' },
      { type: 'keypair', key_path: '/key' },
    ];
    await unlockJournalAllMethods(creds);
    expect(mockInvoke).toHaveBeenCalledWith('unlock_diary_all_methods', { credentials: creds });
  });

  it('setRequireAllAuth → set_require_all_auth { enabled }', async () => {
    await setRequireAllAuth(true);
    expect(mockInvoke).toHaveBeenCalledWith('set_require_all_auth', { enabled: true });
  });

  it('createJournalAuto → create_diary_auto with no args', async () => {
    await createJournalAuto();
    expect(mockInvoke).toHaveBeenCalledWith('create_diary_auto');
  });

  it('unlockJournalAuto → unlock_diary_auto with no args', async () => {
    await unlockJournalAuto();
    expect(mockInvoke).toHaveBeenCalledWith('unlock_diary_auto');
  });
});
