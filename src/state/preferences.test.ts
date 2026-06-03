import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ToolbarItem } from './preferences';

// preferences.ts reads localStorage at module init via loadPreferences().
// Each test that exercises that path resets localStorage and reimports the
// module to force a fresh load. vi.resetModules() makes the dynamic import
// re-evaluate the module body.

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('preferences — loadPreferences migration', () => {
  it('appends the new "link" key to existing toolbarItems that do not have it', async () => {
    // Simulate a user from before the link feature existed: their stored
    // toolbarItems array does not include 'link' (or any newer entry).
    const legacyToolbarItems: ToolbarItem[] = [
      { key: 'headings', enabled: true },
      { key: 'underline', enabled: true },
      { key: 'strikethrough', enabled: true },
      { key: 'textColor', enabled: true },
      { key: 'highlightColor', enabled: true },
      { key: 'blockquote', enabled: true },
      { key: 'inlineCode', enabled: true },
      { key: 'bulletList', enabled: true },
      { key: 'orderedList', enabled: true },
      { key: 'horizontalRule', enabled: true },
      { key: 'insertImage', enabled: true },
      { key: 'importMarkdown', enabled: true },
      { key: 'insertTimestamp', enabled: true },
      { key: 'textDirection', enabled: true },
      { key: 'alignment', enabled: true },
      { key: 'fontFamily', enabled: false },
      { key: 'fontSize', enabled: false },
    ];

    localStorage.setItem('preferences', JSON.stringify({ toolbarItems: legacyToolbarItems }));

    const { preferences } = await import('./preferences');

    const items = preferences().toolbarItems;
    const linkItem = items.find((i) => i.key === 'link');
    expect(linkItem).toBeDefined();
    expect(linkItem!.enabled).toBe(true);
  });

  it('preserves the user-chosen order of pre-existing toolbar items when appending new keys', async () => {
    // The user has reordered "underline" before "headings" — that custom
    // order must be retained even though new keys are appended.
    // This simulates a user who already has all keys up to 'link' but not 'insertExistingImage'.
    const reorderedToolbarItems: ToolbarItem[] = [
      { key: 'underline', enabled: true },
      { key: 'headings', enabled: false },
      { key: 'strikethrough', enabled: true },
      { key: 'textColor', enabled: true },
      { key: 'highlightColor', enabled: true },
      { key: 'blockquote', enabled: true },
      { key: 'inlineCode', enabled: true },
      { key: 'link', enabled: true },
      { key: 'bulletList', enabled: true },
      { key: 'orderedList', enabled: true },
      { key: 'horizontalRule', enabled: true },
      { key: 'insertImage', enabled: true },
      { key: 'importMarkdown', enabled: true },
      { key: 'insertTimestamp', enabled: true },
      { key: 'textDirection', enabled: true },
      { key: 'alignment', enabled: true },
      { key: 'fontFamily', enabled: false },
      { key: 'fontSize', enabled: false },
    ];

    localStorage.setItem('preferences', JSON.stringify({ toolbarItems: reorderedToolbarItems }));

    const { preferences } = await import('./preferences');

    const items = preferences().toolbarItems;
    expect(items[0].key).toBe('underline');
    expect(items[1].key).toBe('headings');
    // The new 'insertExistingImage' key is appended at the end, after all pre-existing keys
    expect(items[items.length - 1].key).toBe('insertExistingImage');
  });

  it('uses DEFAULT_TOOLBAR_ITEMS when localStorage is empty (includes link)', async () => {
    const { preferences } = await import('./preferences');
    const items = preferences().toolbarItems;
    const linkItem = items.find((i) => i.key === 'link');
    expect(linkItem).toBeDefined();
    expect(linkItem!.enabled).toBe(true);
  });

  it('places "link" between "inlineCode" and "bulletList" in default order', async () => {
    const { DEFAULT_TOOLBAR_ITEMS } = await import('./preferences');
    const inlineCodeIdx = DEFAULT_TOOLBAR_ITEMS.findIndex((i) => i.key === 'inlineCode');
    const linkIdx = DEFAULT_TOOLBAR_ITEMS.findIndex((i) => i.key === 'link');
    const bulletListIdx = DEFAULT_TOOLBAR_ITEMS.findIndex((i) => i.key === 'bulletList');

    expect(inlineCodeIdx).toBeGreaterThanOrEqual(0);
    expect(linkIdx).toBe(inlineCodeIdx + 1);
    expect(bulletListIdx).toBe(linkIdx + 1);
  });
});
