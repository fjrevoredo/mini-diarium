import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { getSpellcheckStatus, setSpellcheckEnabled } from './spellcheck';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('spellcheck command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setSpellcheckEnabled → set_spellcheck_enabled { enabled, locale }', async () => {
    await setSpellcheckEnabled(true, 'de');
    expect(mockInvoke).toHaveBeenCalledWith('set_spellcheck_enabled', {
      enabled: true,
      locale: 'de',
    });
  });

  it('passes the disabled state through', async () => {
    await setSpellcheckEnabled(false, 'pt-BR');
    expect(mockInvoke).toHaveBeenCalledWith('set_spellcheck_enabled', {
      enabled: false,
      locale: 'pt-BR',
    });
  });

  it('getSpellcheckStatus → get_spellcheck_status { locale }', async () => {
    mockInvoke.mockResolvedValueOnce({
      language: 'es_ES',
      dictionaryAvailable: false,
      isFlatpak: false,
    });

    await expect(getSpellcheckStatus('es')).resolves.toEqual({
      language: 'es_ES',
      dictionaryAvailable: false,
      isFlatpak: false,
    });
    expect(mockInvoke).toHaveBeenCalledWith('get_spellcheck_status', { locale: 'es' });
  });
});
