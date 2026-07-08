import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { updateMenuLocale } from './menu';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('menu command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateMenuLocale → update_menu_locale { locale }', async () => {
    await updateMenuLocale('de');
    expect(mockInvoke).toHaveBeenCalledWith('update_menu_locale', { locale: 'de' });
  });
});
