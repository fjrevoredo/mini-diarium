/**
 * Splits and joins paths returned by native file dialogs.
 *
 * A path is Windows-style only when it starts with a drive (`C:\`, `C:/`) or a UNC prefix
 * (`\\`). Only then is `\` a separator. On Linux and macOS `\` is an ordinary filename
 * character, so splitting on it would hand the backend a different folder and filename than
 * the file the user picked.
 */
function isWindowsPath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

/** Splits a dialog path into its parent folder and its last component. */
export function splitDialogPath(path: string): { dir: string; filename: string } {
  const separators = isWindowsPath(path) ? /[/\\]/ : /\//;
  let index = -1;
  for (let i = path.length - 1; i >= 0; i--) {
    if (separators.test(path[i])) {
      index = i;
      break;
    }
  }
  if (index < 0) return { dir: '', filename: path };
  return { dir: path.slice(0, index), filename: path.slice(index + 1) };
}

/** Joins a folder and a filename using the folder's own path style. */
export function joinDialogPath(dir: string, filename: string): string {
  const windows = isWindowsPath(dir);
  const separator = windows && dir.includes('\\') ? '\\' : '/';
  const endsWithSeparator = dir.endsWith('/') || (windows && dir.endsWith('\\'));
  return endsWithSeparator ? `${dir}${filename}` : `${dir}${separator}${filename}`;
}
