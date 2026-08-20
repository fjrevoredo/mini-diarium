import { createSignal } from 'solid-js';

/**
 * Promise-based in-app confirm dialog service (TODO-0104). Replaces the native OS
 * `confirm()` (`src/lib/dialog.ts`) for this app's one confirm-dialog use case: it is
 * ordinary WebView content, driveable by WebDriver/CDP, unlike the native dialog.
 *
 * Only one pending confirm is ever in flight (a single delete-confirmation call site
 * active at a time) — no queueing is implemented, and none should be added.
 */
const [isOpen, setIsOpen] = createSignal(false);
const [message, setMessage] = createSignal('');
const [dialogTitle, setDialogTitle] = createSignal('');
let pendingResolve: ((result: boolean) => void) | null = null;

export const isConfirmDialogOpen = isOpen;
export const confirmDialogMessage = message;
export const confirmDialogTitle = dialogTitle;

/** Shows the confirm dialog and resolves with the user's choice. Mirrors native `confirm()`'s call shape. */
export function confirmInApp(msg: string, options?: { title?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    setMessage(msg);
    setDialogTitle(options?.title ?? '');
    pendingResolve = resolve;
    setIsOpen(true);
  });
}

/** Called by `ConfirmDialog`'s Cancel/Confirm buttons — the only two ways to settle a pending confirm. */
export function respondToConfirm(result: boolean): void {
  setIsOpen(false);
  pendingResolve?.(result);
  pendingResolve = null;
}

/**
 * Resolves any pending confirm as `false` and closes the dialog, without touching
 * anything else. Auto-lock must never wait on a dialog (see root CLAUDE.md's auto-lock
 * gotcha); this is what makes that guarantee hold even for a dialog already open when
 * lock fires, not just for ones not yet opened. Session-scoped state — called from
 * `resetSessionState()` per src/CLAUDE.md's state-management invariant.
 */
export function resetConfirmDialogState(): void {
  setIsOpen(false);
  pendingResolve?.(false);
  pendingResolve = null;
}
