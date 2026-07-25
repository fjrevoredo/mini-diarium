import { isAnyOverlayOpen, setIsGoToDateOpen, setIsSearchOpen } from '../state/ui';
import {
  goToPreviousDay,
  goToNextDay,
  goToToday,
  goToPreviousMonth,
  goToNextMonth,
} from './day-navigation';

/**
 * App-level keyboard shortcuts — the single home for every combo the app claims.
 *
 * These used to be OS-level native-menu accelerators, which fired before the webview
 * saw the keystroke. The native menu was reduced to Preferences + Quit (TODO-0065), so
 * each one is now a plain `keydown` listener on `document`:
 *
 * | Combo               | Action                |
 * |---------------------|-----------------------|
 * | `Mod+[` / `Mod+]`   | previous / next day   |
 * | `Mod+Shift+[` / `]` | previous / next month |
 * | `Mod+T`             | go to today           |
 * | `Mod+G`             | Go to Date overlay    |
 * | `Mod+F`             | search overlay        |
 *
 * `Mod` is Cmd on macOS, Ctrl elsewhere. `CmdOrCtrl+,` (Preferences) is deliberately
 * *not* here — it remains a native accelerator on the surviving File/App menu.
 *
 * Two implementation details that are easy to get wrong:
 *
 * - Brackets match on `e.code` (`BracketLeft`/`BracketRight`), not `e.key`. With Shift
 *   held, `e.key` is `{`/`}` on a US layout, so an `e.key === '['` test would silently
 *   break both month shortcuts.
 * - `Alt` must be excluded. On Windows, AltGr reports `ctrlKey && altKey`, and on many
 *   non-US layouts AltGr is how `[` and `]` are typed — without the guard, typing a
 *   bracket in the editor would navigate the journal.
 */
export function handleAppShortcut(e: KeyboardEvent): void {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  // Overlays own the keyboard while they are open.
  if (isAnyOverlayOpen()) return;

  // Bracket navigation: Shift selects month granularity.
  if (e.code === 'BracketLeft') {
    e.preventDefault();
    void (e.shiftKey ? goToPreviousMonth() : goToPreviousDay());
    return;
  }
  if (e.code === 'BracketRight') {
    e.preventDefault();
    void (e.shiftKey ? goToNextMonth() : goToNextDay());
    return;
  }

  // Letter shortcuts are unshifted only, matching the accelerators they replaced.
  if (e.shiftKey) return;
  switch (e.key.toLowerCase()) {
    case 't':
      e.preventDefault();
      void goToToday();
      break;
    case 'g':
      e.preventDefault();
      setIsGoToDateOpen(true);
      break;
    case 'f':
      // The webview has no native find-in-page, so this combo is free to claim.
      e.preventDefault();
      setIsSearchOpen(true);
      break;
  }
}

/**
 * Attach the shortcut handler to `document`. Returns the matching detach function,
 * intended for `onCleanup`.
 */
export function registerKeyboardShortcuts(): () => void {
  document.addEventListener('keydown', handleAppShortcut);
  return () => document.removeEventListener('keydown', handleAppShortcut);
}
