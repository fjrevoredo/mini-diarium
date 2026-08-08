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
 *
 * ## Rule: always use mapTauriError before displaying Tauri errors
 *
 * Every catch block that calls setError() with a value from a Tauri invoke()
 * must route through this function. Direct patterns like:
 *
 *   setError(err instanceof Error ? err.message : String(err))
 *   setError(String(err))
 *   setError(err.message)
 *
 * are prohibited at UI call sites — they bypass path and internals stripping.
 * Correct usage: `setError(mapTauriError(err, t))`
 *
 * Enforcement: grep for the patterns above in src/**\/*.tsx outside this file to
 * catch regressions, e.g.:
 *   rg "setError\(err instanceof Error|setError\(String\(err|setError\(err\.message" src
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
  // Per-entry lock rejection (save/delete of a locked entry) — localize the raw string.
  if (/^entry is locked$/i.test(raw)) {
    return t('errors.entryLocked');
  }
  if (/cannot remove.*(last|only)|minimum.*auth|last.*auth/i.test(raw)) {
    return t('errors.cannotRemoveLastAuth');
  }
  // File-size error from import size limit — already user-friendly, pass through
  if (/file is too large/i.test(raw)) {
    return raw;
  }

  // Journal-location rejections from add_journal — specific causes, not permission problems
  if (/temporary sandbox location/i.test(raw)) {
    return t('errors.portalPathRejected');
  }
  if (/is a backup snapshot/i.test(raw)) {
    return t('errors.backupFileRejected');
  }
  if (/already in your list/i.test(raw)) {
    return t('errors.journalAlreadyRegistered');
  }

  // Filesystem errors — strip paths / OS details
  if (/failed to (read|write|open|access) key file/i.test(raw)) {
    return /write/i.test(raw) ? t('errors.cannotSaveKeyFile') : t('errors.cannotReadKeyFile');
  }
  // Database-layer failures. This must precede the filesystem bucket: a rusqlite error is
  // routinely phrased "Failed to create schema: disk I/O error", and matching `failed to
  // create` first labelled it a permissions problem — the mislabelling that hid a Flathub
  // user's real failure for weeks. rusqlite's Display text never contains the word "sqlite",
  // so the schema and disk-I/O phrasings have to be matched explicitly.
  if (
    /rusqlite|sqlite|argon2/i.test(raw) ||
    /schema|disk i\/o error|database (is locked|disk image|or disk is full)/i.test(raw)
  ) {
    return t('errors.internalError');
  }
  if (/failed to (read|write|create|copy|open)/i.test(raw) || /os error \d+/i.test(raw)) {
    return t('errors.fileOperationFailed');
  }

  // If no sensitive patterns found, pass the message through as-is
  if (!(/[/\\]/.test(raw) || /os error/i.test(raw))) {
    return raw;
  }

  return t('errors.unexpectedError');
}
