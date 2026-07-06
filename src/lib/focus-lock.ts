import { createEffect, onCleanup } from 'solid-js';
import { listen } from '@tauri-apps/api/event';
import { isDialogOpen } from './dialog';

// Default debounce between losing focus and actually locking. A quick misclick
// outside the window (or a native dialog opening/closing quickly) regains focus
// well within this window, so no lock should happen. Parametrized (not just a
// bare constant used inline) so it's easy to retune from a single call site if
// user feedback says 3s is too short or too long.
export const FOCUS_LOSS_DEBOUNCE_MS = 3000;

export interface FocusLossAutoLockOptions {
  enabled: () => boolean;
  isUnlocked: () => boolean;
  lock: () => void;
  /** Overrides FOCUS_LOSS_DEBOUNCE_MS — primarily for tests. */
  debounceMs?: number;
}

// Listens for the backend "window-unfocused"/"window-focused" events
// (src-tauri/src/window_focus.rs), which fire on every OS-level focus change —
// minimize, Alt+Tab/Cmd+Tab away, clicking another app's window, and (on macOS)
// Cmd+H "Hide" — rather than DOM `visibilitychange` (WebView2 does not reliably
// update document.visibilityState on minimize — confirmed via manual testing with
// the debugger fully detached, TODO-0068).
//
// The lock does not fire immediately on focus loss: it's debounced by
// FOCUS_LOSS_DEBOUNCE_MS so a quick misclick outside the window doesn't lock the
// journal (the same "window-focused" event that fires when a native dialog opened
// via src/lib/dialog.ts steals focus, then closes, cancels the pending lock too —
// `isDialogOpen()` is still checked at the moment the debounce fires as a second
// layer, for a dialog left open longer than the debounce). This does not cover
// focus stolen by the native menu bar or other focus-stealers outside the app's
// own dialog call sites — a known, narrower gap than a full "which process owns
// the active window" check, which is unreliable on Linux/Wayland.
export function createFocusLossAutoLock(options: FocusLossAutoLockOptions): void {
  createEffect(() => {
    if (!options.enabled() || !options.isUnlocked()) return;

    let disposed = false;
    let unlistenUnfocused: (() => void) | undefined;
    let unlistenFocused: (() => void) | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    function clearDebounce() {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
    }

    void listen('window-unfocused', () => {
      clearDebounce();
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        if (isDialogOpen()) return; // suppress: our own dialog stole focus, not the user
        if (!options.isUnlocked()) return; // inline guard: state may have changed during the wait
        options.lock();
      }, options.debounceMs ?? FOCUS_LOSS_DEBOUNCE_MS);
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlistenUnfocused = fn;
      }
    });

    void listen('window-focused', () => {
      clearDebounce(); // focus returned before the debounce fired — cancel the pending lock
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlistenFocused = fn;
      }
    });

    onCleanup(() => {
      disposed = true;
      clearDebounce();
      unlistenUnfocused?.();
      unlistenFocused?.();
    });
  });
}
