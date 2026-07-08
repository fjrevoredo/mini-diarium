import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  listBundledFonts,
  getFontData,
  listCustomFonts,
  importCustomFont,
  deleteCustomFontFamily,
  type FontFaceData,
  type CustomFontSummary,
} from './fonts';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const mockInvoke = vi.mocked(invoke);

describe('fonts command wrappers (IPC contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('listBundledFonts → list_bundled_fonts and passes the list through', async () => {
    mockInvoke.mockResolvedValue(['Merriweather', 'Inter']);
    await expect(listBundledFonts()).resolves.toEqual(['Merriweather', 'Inter']);
    expect(mockInvoke).toHaveBeenCalledWith('list_bundled_fonts');
  });

  it('getFontData → get_font_data { family } and passes the face data through', async () => {
    const data: FontFaceData = {
      family: 'Inter',
      regular: 'r',
      bold: 'b',
      bold_synthesized: false,
    };
    mockInvoke.mockResolvedValue(data);
    await expect(getFontData('Inter')).resolves.toEqual(data);
    expect(mockInvoke).toHaveBeenCalledWith('get_font_data', { family: 'Inter' });
  });

  it('listCustomFonts → list_custom_fonts and passes the summaries through', async () => {
    const fonts: CustomFontSummary[] = [{ family: 'MyFont', has_regular: true, has_bold: false }];
    mockInvoke.mockResolvedValue(fonts);
    await expect(listCustomFonts()).resolves.toEqual(fonts);
    expect(mockInvoke).toHaveBeenCalledWith('list_custom_fonts');
  });

  it('importCustomFont → import_custom_font { family, weight, path }', async () => {
    await importCustomFont('MyFont', 'bold', '/font.ttf');
    expect(mockInvoke).toHaveBeenCalledWith('import_custom_font', {
      family: 'MyFont',
      weight: 'bold',
      path: '/font.ttf',
    });
  });

  it('deleteCustomFontFamily → delete_custom_font_family { family }', async () => {
    await deleteCustomFontFamily('MyFont');
    expect(mockInvoke).toHaveBeenCalledWith('delete_custom_font_family', { family: 'MyFont' });
  });
});
