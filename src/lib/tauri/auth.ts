import { invoke } from '@tauri-apps/api/core';

// Authentication commands
export async function createJournal(password: string): Promise<void> {
  await invoke('create_diary', { password });
}

export async function unlockJournal(password: string): Promise<void> {
  await invoke('unlock_diary', { password });
}

export async function lockJournal(): Promise<void> {
  await invoke('lock_diary');
}

export async function journalExists(): Promise<boolean> {
  return await invoke('diary_exists');
}

export async function checkJournalPath(path: string): Promise<boolean> {
  return invoke<boolean>('check_diary_path', { path });
}

export async function isJournalUnlocked(): Promise<boolean> {
  return await invoke('is_diary_unlocked');
}

export async function getJournalPath(): Promise<string> {
  return await invoke('get_diary_path');
}

export async function changeJournalDirectory(newDir: string): Promise<void> {
  await invoke('change_diary_directory', { newDir });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await invoke('change_password', { oldPassword, newPassword });
}

export async function resetJournal(): Promise<void> {
  await invoke('reset_diary');
}

export async function unlockJournalWithKeypair(keyPath: string): Promise<void> {
  await invoke('unlock_diary_with_keypair', { keyPath });
}

export async function verifyPassword(password: string): Promise<void> {
  await invoke('verify_password', { password });
}

// Auth method management
export interface AuthMethodInfo {
  id: number;
  slot_type: string;
  label: string;
  public_key_hex: string | null;
  created_at: string;
  last_used: string | null;
}

export interface AuthSlotPeek {
  id: number;
  slot_type: string;
  label: string;
}

export interface JournalPeek {
  slots: AuthSlotPeek[];
  require_all_auth: boolean;
}

export async function peekAuthSlotTypes(): Promise<JournalPeek> {
  return await invoke('peek_auth_slot_types');
}

export interface KeypairFiles {
  public_key_hex: string;
  private_key_hex: string;
}

export type MultiAuthCredential =
  { type: 'password'; value: string } | { type: 'keypair'; key_path: string };

export async function listAuthMethods(): Promise<AuthMethodInfo[]> {
  return await invoke('list_auth_methods');
}

export async function generateKeypair(): Promise<KeypairFiles> {
  return await invoke('generate_keypair');
}

export async function writeKeyFile(path: string, privateKeyHex: string): Promise<void> {
  await invoke('write_key_file', { path, privateKeyHex });
}

export async function registerKeypair(
  currentPassword: string | null,
  publicKeyHex: string,
  label: string,
): Promise<void> {
  await invoke('register_keypair', { currentPassword, publicKeyHex, label });
}

export async function registerPassword(newPassword: string): Promise<void> {
  await invoke('register_password', { newPassword });
}

export async function removeAuthMethod(
  slotId: number,
  currentPassword: string | null,
): Promise<void> {
  await invoke('remove_auth_method', { slotId, currentPassword });
}

export async function unlockJournalAllMethods(credentials: MultiAuthCredential[]): Promise<void> {
  await invoke('unlock_diary_all_methods', { credentials });
}

export async function setRequireAllAuth(enabled: boolean): Promise<void> {
  await invoke('set_require_all_auth', { enabled });
}

export async function createJournalAuto(): Promise<void> {
  await invoke('create_diary_auto');
}

export async function unlockJournalAuto(): Promise<void> {
  await invoke('unlock_diary_auto');
}
