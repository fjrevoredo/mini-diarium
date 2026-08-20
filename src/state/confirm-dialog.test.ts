import { describe, it, expect, beforeEach } from 'vitest';
import {
  confirmInApp,
  respondToConfirm,
  resetConfirmDialogState,
  isConfirmDialogOpen,
  confirmDialogMessage,
  confirmDialogTitle,
} from './confirm-dialog';

describe('confirm-dialog', () => {
  beforeEach(() => {
    resetConfirmDialogState();
  });

  it('confirmInApp resolves true when respondToConfirm(true) is called', async () => {
    const promise = confirmInApp('Are you sure?', { title: 'Confirm' });
    respondToConfirm(true);
    await expect(promise).resolves.toBe(true);
  });

  it('confirmInApp resolves false when respondToConfirm(false) is called', async () => {
    const promise = confirmInApp('Are you sure?', { title: 'Confirm' });
    respondToConfirm(false);
    await expect(promise).resolves.toBe(false);
  });

  it('isConfirmDialogOpen reflects open/closed state around a pending confirm', async () => {
    expect(isConfirmDialogOpen()).toBe(false);
    const promise = confirmInApp('Erase this?', { title: 'Delete Entry' });
    expect(isConfirmDialogOpen()).toBe(true);
    expect(confirmDialogMessage()).toBe('Erase this?');
    expect(confirmDialogTitle()).toBe('Delete Entry');
    respondToConfirm(true);
    expect(isConfirmDialogOpen()).toBe(false);
    await promise;
  });

  it('resetConfirmDialogState resolves a pending confirm as false and closes the dialog', async () => {
    const promise = confirmInApp('Erase this?');
    expect(isConfirmDialogOpen()).toBe(true);
    resetConfirmDialogState();
    expect(isConfirmDialogOpen()).toBe(false);
    await expect(promise).resolves.toBe(false);
  });

  it('resetConfirmDialogState is a no-op when nothing is pending', () => {
    expect(() => resetConfirmDialogState()).not.toThrow();
    expect(isConfirmDialogOpen()).toBe(false);
  });

  // TODO-0104 / UX-GATE scenario #12: auto-lock must never wait on a dialog, even one
  // already open when lock fires. Pins the actual wiring (resetSessionState → the
  // confirm-dialog reset), not just the standalone function — a future refactor that
  // moves the call out of resetSessionState should fail this test, not silently regress.
  it('resetSessionState (the real lock-cleanup entry point) resolves a pending confirmInApp as false', async () => {
    const { resetSessionState } = await import('./session');
    const promise = confirmInApp('Erase this?', { title: 'Delete Entry' });
    expect(isConfirmDialogOpen()).toBe(true);

    resetSessionState();

    expect(isConfirmDialogOpen()).toBe(false);
    await expect(promise).resolves.toBe(false);
  });
});
