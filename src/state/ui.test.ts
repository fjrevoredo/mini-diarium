import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  requestDateChange,
  requestMainViewChange,
  requestDateAndViewChange,
  resetUiState,
  selectedDate,
  mainView,
  setSelectedDate,
  setMainView,
  isAnyOverlayOpen,
  setIsProjectSupportOpen,
} from './ui';
import { registerNavigationGuard } from './entries';

describe('guarded navigation entry points (TODO-0104)', () => {
  let unregister: (() => void) | null = null;

  afterEach(() => {
    unregister?.();
    unregister = null;
    setSelectedDate('2026-01-01');
    setMainView('editor');
  });

  it('requestDateChange calls requestNavigationConsent exactly once and writes the date when approved', async () => {
    const guard = vi.fn(async () => true);
    unregister = registerNavigationGuard(guard);

    const result = await requestDateChange('2026-02-02');

    expect(guard).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    expect(selectedDate()).toBe('2026-02-02');
  });

  it('requestDateChange skips the setter when a guard denies', async () => {
    setSelectedDate('2026-01-01');
    const guard = vi.fn(async () => false);
    unregister = registerNavigationGuard(guard);

    const result = await requestDateChange('2026-02-02');

    expect(guard).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
    expect(selectedDate()).toBe('2026-01-01');
  });

  it('requestMainViewChange calls requestNavigationConsent exactly once and writes the view when approved', async () => {
    const guard = vi.fn(async () => true);
    unregister = registerNavigationGuard(guard);

    const result = await requestMainViewChange('timeline');

    expect(guard).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    expect(mainView()).toBe('timeline');
  });

  it('requestMainViewChange skips the setter when a guard denies', async () => {
    setMainView('editor');
    const guard = vi.fn(async () => false);
    unregister = registerNavigationGuard(guard);

    const result = await requestMainViewChange('timeline');

    expect(guard).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
    expect(mainView()).toBe('editor');
  });

  it('requestDateAndViewChange calls requestNavigationConsent exactly once and writes both when approved', async () => {
    const guard = vi.fn(async () => true);
    unregister = registerNavigationGuard(guard);

    const result = await requestDateAndViewChange('2026-03-03', 'timeline');

    expect(guard).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    expect(selectedDate()).toBe('2026-03-03');
    expect(mainView()).toBe('timeline');
  });

  it('requestDateAndViewChange skips both setters when a guard denies', async () => {
    setSelectedDate('2026-01-01');
    setMainView('editor');
    const guard = vi.fn(async () => false);
    unregister = registerNavigationGuard(guard);

    const result = await requestDateAndViewChange('2026-03-03', 'timeline');

    expect(guard).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
    expect(selectedDate()).toBe('2026-01-01');
    expect(mainView()).toBe('editor');
  });

  it('resetUiState does not call the navigation guard at all', async () => {
    const guard = vi.fn(async () => true);
    unregister = registerNavigationGuard(guard);

    resetUiState();

    expect(guard).not.toHaveBeenCalled();
  });

  it('isAnyOverlayOpen becomes true when isProjectSupportOpen is set', () => {
    expect(isAnyOverlayOpen()).toBe(false);
    setIsProjectSupportOpen(true);
    expect(isAnyOverlayOpen()).toBe(true);
    setIsProjectSupportOpen(false);
    expect(isAnyOverlayOpen()).toBe(false);
  });
});
