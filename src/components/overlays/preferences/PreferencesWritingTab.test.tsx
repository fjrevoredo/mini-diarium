import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { createSignal } from 'solid-js';
import { PreferencesShellContext } from './shared';
import * as prefState from '../../../state/preferences';
import PreferencesWritingTab from './PreferencesWritingTab';

const { mockListBundledFonts, mockListCustomFonts } = vi.hoisted(() => ({
  mockListBundledFonts: vi.fn<() => Promise<string[]>>(),
  mockListCustomFonts: vi.fn<() => Promise<import('../../../lib/tauri').CustomFontSummary[]>>(),
}));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    listBundledFonts: mockListBundledFonts,
    listCustomFonts: mockListCustomFonts,
  };
});

describe('PreferencesWritingTab - font family', () => {
  let commitCallback: (() => void) | null = null;

  function renderTab() {
    const [isOpen] = createSignal(true);
    const onClose = vi.fn();
    commitCallback = null;

    return renderWithI18n(() => (
      <PreferencesShellContext.Provider
        value={{
          registerCommit: vi.fn((fn: () => void) => {
            commitCallback = fn;
            return () => {
              commitCallback = null;
            };
          }),
        }}
      >
        <PreferencesWritingTab isOpen={isOpen} onClose={onClose} />
      </PreferencesShellContext.Provider>
    ));
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockListCustomFonts.mockResolvedValue([]);
  });

  it('renders System Default only when no bundled fonts are available', async () => {
    mockListBundledFonts.mockResolvedValue([]);
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('editor-font-family-select')).not.toBeDisabled();
    });

    const select = screen.getByTestId('editor-font-family-select') as HTMLSelectElement;
    expect(select.options).toHaveLength(1);
    expect(select.options[0].textContent).toBe('System Default');
  });

  it('renders font options alongside System Default when fonts are bundled', async () => {
    mockListBundledFonts.mockResolvedValue(['FiraMono', 'NotoSans']);
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('editor-font-family-select')).not.toBeDisabled();
    });

    const select = screen.getByTestId('editor-font-family-select') as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
    expect(screen.getByText('FiraMono')).toBeInTheDocument();
    expect(screen.getByText('NotoSans')).toBeInTheDocument();
  });

  it('selecting a bundled font updates the dropdown value', async () => {
    mockListBundledFonts.mockResolvedValue(['FiraMono']);
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('editor-font-family-select')).not.toBeDisabled();
    });

    const select = screen.getByTestId('editor-font-family-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'FiraMono' } });
    expect(select.value).toBe('FiraMono');
  });

  it('committing preferences persists the selected font family', async () => {
    const spy = vi.spyOn(prefState, 'setPreferences');

    mockListBundledFonts.mockResolvedValue(['FiraMono']);
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('editor-font-family-select')).not.toBeDisabled();
    });

    const select = screen.getByTestId('editor-font-family-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'FiraMono' } });
    expect(select.value).toBe('FiraMono');

    expect(commitCallback).not.toBeNull();
    commitCallback!();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ editorFontFamily: 'FiraMono' }));
  });
});

