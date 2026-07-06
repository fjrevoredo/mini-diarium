import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import PreferencesCustomFontsSection from './PreferencesCustomFontsSection';

const { mockOpenDialog } = vi.hoisted(() => ({
  mockOpenDialog: vi.fn(() => Promise.resolve(null as string | null)),
}));

const { mockListCustomFonts, mockImportCustomFont, mockDeleteCustomFontFamily } = vi.hoisted(
  () => ({
    mockListCustomFonts: vi.fn<() => Promise<import('../../../lib/tauri').CustomFontSummary[]>>(
      () => Promise.resolve([]),
    ),
    mockImportCustomFont: vi.fn(() => Promise.resolve()),
    mockDeleteCustomFontFamily: vi.fn(() => Promise.resolve()),
  }),
);

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mockOpenDialog,
}));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    listCustomFonts: mockListCustomFonts,
    importCustomFont: mockImportCustomFont,
    deleteCustomFontFamily: mockDeleteCustomFontFamily,
  };
});

describe('PreferencesCustomFontsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListCustomFonts.mockResolvedValue([]);
  });

  it('does not upload fonts until the explicit Add font action is clicked', async () => {
    mockOpenDialog.mockResolvedValueOnce('C:\\fonts\\MyFont-Regular.ttf');
    renderWithI18n(() => <PreferencesCustomFontsSection />);

    fireEvent.click(screen.getAllByRole('button', { name: /choose file/i })[0]);
    // Wait for the resolved path to actually land in component state (not just
    // for the dialog mock to have been called) — the dialog wrapper in
    // src/lib/dialog.ts adds its own microtask hop around the call, so
    // asserting only on the mock call count can race ahead of the state update.
    await waitFor(() =>
      expect(screen.getByTitle('C:\\fonts\\MyFont-Regular.ttf')).toBeInTheDocument(),
    );

    fireEvent.input(screen.getByTestId('custom-font-family-input'), {
      target: { value: 'My Font' },
    });

    expect(mockImportCustomFont).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /add font/i }));
    await waitFor(() => {
      expect(mockImportCustomFont).toHaveBeenCalledWith(
        'My Font',
        'Regular',
        'C:\\fonts\\MyFont-Regular.ttf',
      );
    });
  });

  it('does not delete a font family until the explicit Remove action is clicked', async () => {
    mockListCustomFonts.mockResolvedValue([
      { family: 'My Font', has_regular: true, has_bold: false },
    ]);
    renderWithI18n(() => <PreferencesCustomFontsSection />);

    await waitFor(() => expect(screen.getByText('My Font')).toBeInTheDocument());
    expect(mockDeleteCustomFontFamily).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => expect(mockDeleteCustomFontFamily).toHaveBeenCalledWith('My Font'));
  });
});
