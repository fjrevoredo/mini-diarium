import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import PreferencesAdvancedTab from './PreferencesAdvancedTab';

const {
  mockSaveThemeOverrides,
  mockApplyThemeOverrides,
  mockResetThemeOverrides,
  mockGetThemeOverridesJson,
  mockParseOverridesJson,
} = vi.hoisted(() => ({
  mockSaveThemeOverrides: vi.fn(),
  mockApplyThemeOverrides: vi.fn(),
  mockResetThemeOverrides: vi.fn(),
  mockGetThemeOverridesJson: vi.fn(() => '{}'),
  mockParseOverridesJson: vi.fn((json: string) => {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }),
}));

vi.mock('../../../lib/theme-overrides', () => ({
  saveThemeOverrides: mockSaveThemeOverrides,
  applyThemeOverrides: mockApplyThemeOverrides,
  resetThemeOverrides: mockResetThemeOverrides,
  getThemeOverridesJson: mockGetThemeOverridesJson,
  parseOverridesJson: mockParseOverridesJson,
}));

vi.mock('../../../lib/theme', () => ({
  getActiveTheme: vi.fn(() => 'light'),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn(() => Promise.resolve()),
}));

vi.mock('./PreferencesCustomFontsSection', () => ({
  default: () => <div data-testid="custom-fonts-section" />,
}));

const { mockRecalculateWordCounts } = vi.hoisted(() => ({
  mockRecalculateWordCounts: vi.fn(),
}));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    recalculateWordCounts: mockRecalculateWordCounts,
  };
});

// The real FEATURE_FLAGS registry is empty (see feature-flags.test.ts), so the
// Experimental section is hidden in production today. Mocking the module with a
// mutable array lets both branches be exercised: tests mutate `mockFlagDefs` in place
// — the component holds the same array reference and re-reads it on every render.
const { mockFlagDefs, mockIsFeatureEnabled, mockSetFeatureFlag } = vi.hoisted(() => ({
  mockFlagDefs: [] as { flag: string; labelKey: string }[],
  mockIsFeatureEnabled: vi.fn(() => false),
  mockSetFeatureFlag: vi.fn(),
}));

vi.mock('../../../state/feature-flags', () => ({
  FEATURE_FLAGS: mockFlagDefs,
  isFeatureEnabled: mockIsFeatureEnabled,
  setFeatureFlag: mockSetFeatureFlag,
}));

describe('PreferencesAdvancedTab', () => {
  function renderTab() {
    const [isOpen] = createSignal(true);
    return renderWithI18n(() => <PreferencesAdvancedTab isOpen={isOpen} onClose={vi.fn()} />);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetThemeOverridesJson.mockReturnValue('{}');
    mockFlagDefs.length = 0;
    mockIsFeatureEnabled.mockReturnValue(false);
  });

  describe('word count recalculation', () => {
    it('renders the button and hint', () => {
      renderTab();
      expect(screen.getByText('Word Counts')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Recalculate Word Counts' })).toBeInTheDocument();
    });

    it('shows the summary on success, with the skipped-locked clause when locked entries exist', async () => {
      mockRecalculateWordCounts.mockResolvedValue({ scanned: 5, updated: 2, skipped_locked: 1 });
      renderTab();

      fireEvent.click(screen.getByRole('button', { name: 'Recalculate Word Counts' }));

      expect(
        await screen.findByText('Checked 5 entries, updated 2.', { exact: false }),
      ).toBeInTheDocument();
      expect(screen.getByText(/1 locked entry was skipped\./)).toBeInTheDocument();
    });

    it('omits the skipped-locked clause when no entries were skipped', async () => {
      mockRecalculateWordCounts.mockResolvedValue({ scanned: 3, updated: 0, skipped_locked: 0 });
      renderTab();

      fireEvent.click(screen.getByRole('button', { name: 'Recalculate Word Counts' }));

      expect(
        await screen.findByText('Checked 3 entries, updated 0.', { exact: false }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/was skipped|were skipped/)).not.toBeInTheDocument();
    });

    it('shows the mapped error and re-enables the button on failure', async () => {
      mockRecalculateWordCounts.mockRejectedValue('Journal must be unlocked');
      renderTab();

      const button = screen.getByRole('button', { name: 'Recalculate Word Counts' });
      fireEvent.click(button);

      expect(await screen.findByText('Please unlock your journal first.')).toBeInTheDocument();
      expect((button as HTMLButtonElement).disabled).toBe(false);
    });

    it('shows the generic recalculate error for an unmapped internal failure', async () => {
      mockRecalculateWordCounts.mockRejectedValue('BEGIN failed: cannot start a transaction');
      renderTab();

      fireEvent.click(screen.getByRole('button', { name: 'Recalculate Word Counts' }));

      expect(await screen.findByText('Failed to recalculate word counts.')).toBeInTheDocument();
    });
  });

  it('auto-applies valid JSON without an Apply Overrides button', () => {
    renderTab();

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: '{"light":{"--bg-primary":"#fff"}}' } });

    expect(mockSaveThemeOverrides).toHaveBeenCalledWith({
      light: { '--bg-primary': '#fff' },
    });
    expect(mockApplyThemeOverrides).toHaveBeenCalledWith('light');
    expect(screen.queryByRole('button', { name: 'Apply Overrides' })).not.toBeInTheDocument();
  });

  it('shows parse error for invalid JSON and preserves last valid persisted overrides', () => {
    renderTab();

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: '{"light":{"--bg-primary":"#fff"}}' } });
    expect(mockSaveThemeOverrides).toHaveBeenCalledTimes(1);

    fireEvent.input(textarea, { target: { value: '{bad' } });

    expect(mockSaveThemeOverrides).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/invalid json/i)).toBeInTheDocument();
  });

  it('reset to default remains an explicit action', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Default' }));
    expect(mockResetThemeOverrides).toHaveBeenCalledTimes(1);
  });

  describe('experimental features section', () => {
    it('is hidden entirely when no flags are registered', () => {
      renderTab();

      expect(screen.queryByText('Experimental Features')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('renders a toggle per registered flag and flips it on change', () => {
      // `labelKey` is any real i18n key — the label's wording is irrelevant to the
      // wiring under test, only that it is resolved through t().
      mockFlagDefs.push({ flag: 'someFlag', labelKey: 'common.save' });
      renderTab();

      expect(screen.getByText('Experimental Features')).toBeInTheDocument();

      const checkbox = screen.getByRole('checkbox', { name: 'Save' }) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      fireEvent.click(checkbox);

      expect(mockSetFeatureFlag).toHaveBeenCalledWith('someFlag', true);
    });

    it('reflects the stored state of a registered flag', () => {
      mockFlagDefs.push({ flag: 'someFlag', labelKey: 'common.save' });
      mockIsFeatureEnabled.mockReturnValue(true);
      renderTab();

      expect((screen.getByRole('checkbox', { name: 'Save' }) as HTMLInputElement).checked).toBe(
        true,
      );
    });
  });
});
