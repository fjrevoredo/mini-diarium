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

describe('PreferencesAdvancedTab', () => {
  function renderTab() {
    const [isOpen] = createSignal(true);
    return renderWithI18n(() => <PreferencesAdvancedTab isOpen={isOpen} onClose={vi.fn()} />);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetThemeOverridesJson.mockReturnValue('{}');
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
});
