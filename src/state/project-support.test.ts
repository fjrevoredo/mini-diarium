import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('state/project-support', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('toggling an item updates isChecklistItemDone immediately', async () => {
    const { isChecklistItemDone, toggleChecklistItem } = await import('./project-support');
    expect(isChecklistItemDone('star')).toBe(false);
    toggleChecklistItem('star');
    expect(isChecklistItemDone('star')).toBe(true);
  });

  it('persists across a fresh module import (simulated app restart)', async () => {
    const mod1 = await import('./project-support');
    mod1.toggleChecklistItem('review');

    vi.resetModules();
    const mod2 = await import('./project-support');
    expect(mod2.isChecklistItemDone('review')).toBe(true);
  });

  it('toggling twice returns to unchecked', async () => {
    const { isChecklistItemDone, toggleChecklistItem } = await import('./project-support');
    toggleChecklistItem('share');
    expect(isChecklistItemDone('share')).toBe(true);
    toggleChecklistItem('share');
    expect(isChecklistItemDone('share')).toBe(false);
  });

  it('checklistDoneCount reflects the current count', async () => {
    const { checklistDoneCount, toggleChecklistItem } = await import('./project-support');
    expect(checklistDoneCount()).toBe(0);
    toggleChecklistItem('star');
    toggleChecklistItem('donate');
    expect(checklistDoneCount()).toBe(2);
    toggleChecklistItem('star');
    expect(checklistDoneCount()).toBe(1);
  });
});
