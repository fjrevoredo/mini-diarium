import { describe, it, expect, vi, afterEach } from 'vitest';

const { mockOpen, mockSave, mockConfirm } = vi.hoisted(() => ({
  mockOpen: vi.fn(),
  mockSave: vi.fn(),
  mockConfirm: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mockOpen,
  save: mockSave,
  confirm: mockConfirm,
}));

import { open, save, confirm, isDialogOpen } from './dialog';

afterEach(() => {
  vi.clearAllMocks();
});

describe('dialog guard', () => {
  it('isDialogOpen() is false when nothing is open', () => {
    expect(isDialogOpen()).toBe(false);
  });

  it('isDialogOpen() is true while open() is pending and false after it resolves', async () => {
    let resolveOpen!: (v: string | null) => void;
    mockOpen.mockReturnValue(new Promise((resolve) => (resolveOpen = resolve)));

    const promise = open();
    expect(isDialogOpen()).toBe(true);

    resolveOpen(null);
    await promise;

    expect(isDialogOpen()).toBe(false);
  });

  it('isDialogOpen() is true while save() is pending and false after it resolves', async () => {
    let resolveSave!: (v: string | null) => void;
    mockSave.mockReturnValue(new Promise((resolve) => (resolveSave = resolve)));

    const promise = save();
    expect(isDialogOpen()).toBe(true);

    resolveSave(null);
    await promise;

    expect(isDialogOpen()).toBe(false);
  });

  it('isDialogOpen() is true while confirm() is pending and false after it resolves', async () => {
    let resolveConfirm!: (v: boolean) => void;
    mockConfirm.mockReturnValue(new Promise((resolve) => (resolveConfirm = resolve)));

    const promise = confirm('Are you sure?');
    expect(isDialogOpen()).toBe(true);

    resolveConfirm(true);
    await promise;

    expect(isDialogOpen()).toBe(false);
  });

  it('stays true until all overlapping dialogs resolve', async () => {
    let resolveOpen!: (v: string | null) => void;
    let resolveSave!: (v: string | null) => void;
    mockOpen.mockReturnValue(new Promise((resolve) => (resolveOpen = resolve)));
    mockSave.mockReturnValue(new Promise((resolve) => (resolveSave = resolve)));

    const openPromise = open();
    const savePromise = save();
    expect(isDialogOpen()).toBe(true);

    resolveOpen(null);
    await openPromise;
    expect(isDialogOpen()).toBe(true); // save() is still pending

    resolveSave(null);
    await savePromise;
    expect(isDialogOpen()).toBe(false);
  });

  it('resets isDialogOpen() to false even when the underlying call rejects', async () => {
    mockOpen.mockRejectedValue(new Error('dialog failed'));

    await expect(open()).rejects.toThrow('dialog failed');

    expect(isDialogOpen()).toBe(false);
  });
});
