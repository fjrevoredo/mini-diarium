import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { createSignal } from 'solid-js';
import * as prefState from '../../../state/preferences';
import { DEFAULT_TOOLBAR_ITEMS } from '../../../state/preferences';
import { formatDate, getTodayString } from '../../../lib/dates';
import PreferencesWritingTab from './PreferencesWritingTab';

const { mockGetSpellcheckStatus, mockListBundledFonts, mockListCustomFonts, mockOpenUrl } =
  vi.hoisted(() => ({
    mockGetSpellcheckStatus:
      vi.fn<() => Promise<import('../../../lib/tauri').SpellcheckStatus | null>>(),
    mockListBundledFonts: vi.fn<() => Promise<string[]>>(),
    mockListCustomFonts: vi.fn<() => Promise<import('../../../lib/tauri').CustomFontSummary[]>>(),
    mockOpenUrl: vi.fn<() => Promise<void>>(),
  }));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    getSpellcheckStatus: mockGetSpellcheckStatus,
    listBundledFonts: mockListBundledFonts,
    listCustomFonts: mockListCustomFonts,
  };
});

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: mockOpenUrl,
}));

describe('PreferencesWritingTab', () => {
  function renderTab() {
    const [isOpen] = createSignal(true);
    return renderWithI18n(() => <PreferencesWritingTab isOpen={isOpen} onClose={vi.fn()} />);
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockListCustomFonts.mockResolvedValue([]);
    mockGetSpellcheckStatus.mockResolvedValue(null);
    prefState.setPreferences({
      hideTitles: false,
      editorFontFamily: null,
      toolbarItems: DEFAULT_TOOLBAR_ITEMS.map((item) => ({ ...item })),
      timelineDateFormat: 'full',
      showTimelinePreview: true,
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

  it('warns when the active Linux dictionary is unavailable', async () => {
    mockGetSpellcheckStatus.mockResolvedValue({
      language: 'es_ES',
      dictionaryAvailable: false,
      isFlatpak: false,
    });

    renderTab();

    expect(
      await screen.findByText(/spell check needs the English language pack/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open the spell-check setup guide/i }));
    expect(mockOpenUrl).toHaveBeenCalledWith(
      'https://mini-diarium.com/docs/preferences/#spell-check-on-linux',
    );
  });

  it('does not warn when the active Linux dictionary is available', async () => {
    mockGetSpellcheckStatus.mockResolvedValue({
      language: 'es_ES',
      dictionaryAvailable: true,
      isFlatpak: false,
    });

    renderTab();

    await waitFor(() => {
      expect(mockGetSpellcheckStatus).toHaveBeenCalledWith('en', expect.anything());
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('tells Flatpak users to repair a missing bundled dictionary', async () => {
    mockGetSpellcheckStatus.mockResolvedValue({
      language: 'es_ES',
      dictionaryAvailable: false,
      isFlatpak: true,
    });

    renderTab();

    expect(
      await screen.findByText(/spell check should be included with Mini Diarium/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /open the spell-check setup guide/i }),
    ).toBeInTheDocument();
  });

  it('changing the timeline date format persists immediately', () => {
    renderTab();

    const select = screen.getByLabelText(/date format/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'medium' } });

    expect(select.value).toBe('medium');
    const stored = JSON.parse(localStorage.getItem('preferences') ?? '{}') as prefState.Preferences;
    expect(stored.timelineDateFormat).toBe('medium');
  });

  it('labels each timeline date format option with a live example', () => {
    renderTab();

    const select = screen.getByLabelText(/date format/i) as HTMLSelectElement;
    const isoOption = [...select.options].find((o) => o.value === 'iso');
    expect(isoOption?.textContent).toContain('—');
    expect(isoOption?.textContent).toContain(getTodayString());

    const fullOption = [...select.options].find((o) => o.value === 'full');
    expect(fullOption?.textContent).toContain(formatDate(getTodayString(), 'en'));
  });

  it('toggling the timeline preview persists immediately', () => {
    renderTab();

    fireEvent.click(screen.getByLabelText(/show entry preview/i));

    const stored = JSON.parse(localStorage.getItem('preferences') ?? '{}') as prefState.Preferences;
    expect(stored.showTimelinePreview).toBe(false);
  });

  it('select none persists a disabled toolbar-items list immediately', () => {
    const spy = vi.spyOn(prefState, 'setPreferences');
    renderTab();

    fireEvent.click(screen.getByRole('button', { name: /select none/i }));

    const latestCall = spy.mock.calls[spy.mock.calls.length - 1]?.[0] as
      Partial<prefState.Preferences> | undefined;
    expect(latestCall?.toolbarItems).toBeDefined();
    expect(latestCall?.toolbarItems?.every((item) => item.enabled === false)).toBe(true);
  });
});
