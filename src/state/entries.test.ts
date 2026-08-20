import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLockedEntryDates: vi.fn<() => Promise<string[]>>(),
}));

vi.mock('../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../lib/tauri')>('../lib/tauri');
  return { ...actual, getLockedEntryDates: mocks.getLockedEntryDates };
});

import {
  lockedDates,
  setLockedDates,
  lockVersion,
  refreshLockedDates,
  resetEntriesState,
  setEntryDates,
  entryDates,
  registerNavigationGuard,
  requestNavigationConsent,
} from './entries';

describe('entries state — lock signals', () => {
  beforeEach(() => {
    mocks.getLockedEntryDates.mockReset();
    resetEntriesState();
  });

  it('refreshLockedDates loads locked dates and bumps lockVersion', async () => {
    mocks.getLockedEntryDates.mockResolvedValue(['2024-01-01', '2024-02-02']);
    const before = lockVersion();
    await refreshLockedDates();
    expect(lockedDates()).toEqual(['2024-01-01', '2024-02-02']);
    expect(lockVersion()).toBe(before + 1);
  });

  it('refreshLockedDates keeps the previous set but still bumps version on error', async () => {
    setLockedDates(['2024-03-03']);
    mocks.getLockedEntryDates.mockRejectedValue(new Error('locked'));
    const before = lockVersion();
    await refreshLockedDates();
    expect(lockedDates()).toEqual(['2024-03-03']);
    expect(lockVersion()).toBe(before + 1);
  });

  it('resetEntriesState clears locked dates, entry dates, and resets lockVersion', async () => {
    setEntryDates(['2024-01-01']);
    setLockedDates(['2024-01-01']);
    mocks.getLockedEntryDates.mockResolvedValue([]);
    await refreshLockedDates(); // bump version above 0
    expect(lockVersion()).toBeGreaterThan(0);

    resetEntriesState();
    expect(entryDates()).toEqual([]);
    expect(lockedDates()).toEqual([]);
    expect(lockVersion()).toBe(0);
  });
});

describe('entries state — navigation guard registry', () => {
  const unregisters: (() => void)[] = [];
  const register = (guard: () => Promise<boolean>) => {
    const unregister = registerNavigationGuard(guard);
    unregisters.push(unregister);
    return unregister;
  };

  afterEach(() => {
    while (unregisters.length > 0) unregisters.pop()?.();
  });

  it('resolves true when zero guards are registered', async () => {
    await expect(requestNavigationConsent()).resolves.toBe(true);
  });

  it('resolves true when the one registered guard approves', async () => {
    register(async () => true);
    await expect(requestNavigationConsent()).resolves.toBe(true);
  });

  it('resolves false when the one registered guard denies', async () => {
    register(async () => false);
    await expect(requestNavigationConsent()).resolves.toBe(false);
  });

  it('short-circuits: a denying first guard prevents the second guard from running', async () => {
    const secondGuard = vi.fn(async () => true);
    register(async () => false);
    register(secondGuard);
    await expect(requestNavigationConsent()).resolves.toBe(false);
    expect(secondGuard).not.toHaveBeenCalled();
  });

  it('unregistering a guard removes it from future consent checks', async () => {
    const unregister = register(async () => false);
    unregister();
    await expect(requestNavigationConsent()).resolves.toBe(true);
  });
});
