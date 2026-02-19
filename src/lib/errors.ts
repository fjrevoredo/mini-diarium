/**
 * Maps raw Tauri/Rust error strings to user-friendly messages.
 * Prevents filesystem paths and system internals from leaking into the UI.
 */
export function mapTauriError(err: unknown): string {
  const raw = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);

  // Auth errors — safe to pass through, already user-friendly
  if (/wrong password|invalid password|incorrect password/i.test(raw)) {
    return 'Incorrect password.';
  }
  if (/cannot decrypt|decryption failed|failed to decrypt/i.test(raw)) {
    return 'Could not decrypt. The key file may be incorrect or the data may be corrupted.';
  }
  if (/diary (must be|is not) unlocked/i.test(raw)) {
    return 'Please unlock your diary first.';
  }
  if (/cannot remove.*(last|only)|minimum.*auth|last.*auth/i.test(raw)) {
    return 'Cannot remove the last authentication method.';
  }
  // File-size error from import size limit — already user-friendly, pass through
  if (/file is too large/i.test(raw)) {
    return raw;
  }

  // Filesystem errors — strip paths / OS details
  if (/failed to (read|write|open|access) key file/i.test(raw)) {
    return /write/i.test(raw)
      ? 'Could not save key file. Check folder permissions.'
      : 'Could not read key file. Check that the file exists and you have permission to read it.';
  }
  if (/failed to (read|write|create|copy|open)/i.test(raw) || /os error \d+/i.test(raw)) {
    return 'A file operation failed. Check that you have the necessary permissions.';
  }
  if (/rusqlite|sqlite|argon2/i.test(raw)) {
    return 'An internal error occurred.';
  }

  // If no sensitive patterns found, pass the message through as-is
  if (!(/[/\\]/.test(raw) || /os error/i.test(raw))) {
    return raw;
  }

  return 'An unexpected error occurred.';
}
