import { defaultT, type T } from '../i18n';

/**
 * Maps raw Tauri/Rust error strings to user-friendly translated messages.
 * Prevents filesystem paths and system internals from leaking into the UI.
 *
 * @param err   - The raw error value thrown by a Tauri invoke() call.
 * @param t     - The translator function from useI18n(). Components should pass
 *                their own `t` so the message is returned in the active locale.
 *                State modules (auth.ts etc.) that lack access to useI18n() may
 *                omit this argument; defaultT (English) is used as a fallback.
 */
export function mapTauriError(err: unknown, t: T = defaultT): string {
  const raw = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);

  // Auth errors — safe to pass through, already user-friendly
  if (/wrong password|invalid password|incorrect password/i.test(raw)) {
    return t('errors.incorrectPassword');
  }
  if (/cannot decrypt|decryption failed|failed to decrypt/i.test(raw)) {
    return t('errors.decryptionFailed');
  }
  if (/journal (must be|is not) unlocked/i.test(raw)) {
    return t('errors.journalNotUnlocked');
  }
  if (/cannot remove.*(last|only)|minimum.*auth|last.*auth/i.test(raw)) {
    return t('errors.cannotRemoveLastAuth');
  }
  // File-size error from import size limit — already user-friendly, pass through
  if (/file is too large/i.test(raw)) {
    return raw;
  }

  // Filesystem errors — strip paths / OS details
  if (/failed to (read|write|open|access) key file/i.test(raw)) {
    return /write/i.test(raw) ? t('errors.cannotSaveKeyFile') : t('errors.cannotReadKeyFile');
  }
  if (/failed to (read|write|create|copy|open)/i.test(raw) || /os error \d+/i.test(raw)) {
    return t('errors.fileOperationFailed');
  }
  if (/rusqlite|sqlite|argon2/i.test(raw)) {
    return t('errors.internalError');
  }

  // If no sensitive patterns found, pass the message through as-is
  if (!(/[/\\]/.test(raw) || /os error/i.test(raw))) {
    return raw;
  }

  return t('errors.unexpectedError');
}
