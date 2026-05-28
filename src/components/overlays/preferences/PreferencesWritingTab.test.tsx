import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { createSignal } from 'solid-js';
import * as prefState from '../../../state/preferences';
import { DEFAULT_TOOLBAR_ITEMS } from '../../../state/preferences';
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

describe('PreferencesWritingTab', () => {
  function renderTab() {
    const [isOpen] = createSignal(true);
    return renderWithI18n(() => <PreferencesWritingTab isOpen={isOpen} onClose={vi.fn()} />);
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockListCustomFonts.mockResolvedValue([]);
    prefState.setPreferences({
      hideTitles: false,
      editorFontFamily: null,
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((item) => ({ ...item })),
    });
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

  it('selecting a bundled font persists immediately', async () => {
    const spy = vi.spyOn(prefState, 'setPreferences');
    mockListBundledFonts.mockResolvedValue(['FiraMono']);
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('editor-font-family-select')).not.toBeDisabled();
    });

    const select = screen.getByTestId('editor-font-family-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'FiraMono' } });

    expect(select.value).toBe('FiraMono');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ editorFontFamily: 'FiraMono' }));
  });

  it('toggling hide titles persists immediately', () => {
    const spy = vi.spyOn(prefState, 'setPreferences');
    renderTab();

    const checkbox = screen.getByLabelText(/hide entry titles/i);
    fireEvent.click(checkbox);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ hideTitles: true }));
  });

  it('select none persists a disabled toolbar-items list immediately', () => {
    const spy = vi.spyOn(prefState, 'setPreferences');
    renderTab();

    fireEvent.click(screen.getByRole('button', { name: /select none/i }));

    const latestCall = spy.mock.calls[spy.mock.calls.length - 1]?.[0] as
      | Partial<prefState.Preferences>
      | undefined;
    expect(latestCall?.toolbarItems).toBeDefined();
    expect(latestCall?.toolbarItems?.every((item) => item.enabled === false)).toBe(true);
  });
});
