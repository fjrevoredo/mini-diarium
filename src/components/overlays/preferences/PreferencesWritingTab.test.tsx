import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../../test/i18n-test-utils';
import { createSignal } from 'solid-js';
import { PreferencesShellContext } from './shared';
import * as prefState from '../../../state/preferences';
import PreferencesWritingTab from './PreferencesWritingTab';

const {
  mockListBundledFonts,
  mockListCustomFonts,
  mockImportCustomFont,
  mockDeleteCustomFontFamily,
  mockOpenDialog,
} = vi.hoisted(() => ({
  mockListBundledFonts: vi.fn<() => Promise<string[]>>(),
  mockListCustomFonts: vi.fn<() => Promise<import('../../../lib/tauri').CustomFontSummary[]>>(),
  mockImportCustomFont: vi.fn<() => Promise<void>>(),
  mockDeleteCustomFontFamily: vi.fn<() => Promise<void>>(),
  mockOpenDialog: vi.fn<() => Promise<string | null>>(),
}));

vi.mock('../../../lib/tauri', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/tauri')>('../../../lib/tauri');
  return {
    ...actual,
    listBundledFonts: mockListBundledFonts,
    listCustomFonts: mockListCustomFonts,
    importCustomFont: mockImportCustomFont,
    deleteCustomFontFamily: mockDeleteCustomFontFamily,
  };
});

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mockOpenDialog,
}));

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

describe('PreferencesWritingTab - custom fonts', () => {
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
    mockListBundledFonts.mockResolvedValue([]);
    mockOpenDialog.mockResolvedValue(null);
  });

  it('renders the Custom Fonts section heading and hint', async () => {
    mockListCustomFonts.mockResolvedValue([]);
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Custom fonts')).toBeInTheDocument();
    });
    expect(screen.getByText(/Custom fonts are stored inside your journal/)).toBeInTheDocument();
  });

  it('shows missing-Bold warning when a custom font has no bold weight', async () => {
    mockListCustomFonts.mockResolvedValue([
      { family: 'TestFont', has_regular: true, has_bold: false },
    ]);
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('custom-font-missing-bold-TestFont')).toBeInTheDocument();
    });
    expect(screen.getByTestId('custom-font-missing-bold-TestFont').textContent).toMatch(
      /Bold weight missing/,
    );
  });

  it('does not show missing-Bold warning when bold weight is present', async () => {
    mockListCustomFonts.mockResolvedValue([
      { family: 'TestFont', has_regular: true, has_bold: true },
    ]);
    renderTab();

    await waitFor(() => {
      expect(screen.getAllByText('TestFont').length).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId('custom-font-missing-bold-TestFont')).not.toBeInTheDocument();
  });

  it('deleting the currently selected custom font clears the persisted preference immediately', async () => {
    prefState.setPreferences({ editorFontFamily: 'TestFont' });
    const spy = vi.spyOn(prefState, 'setPreferences');

    mockListCustomFonts.mockResolvedValue([
      { family: 'TestFont', has_regular: true, has_bold: false },
    ]);
    mockDeleteCustomFontFamily.mockResolvedValue(undefined);
    renderTab();

    await waitFor(() => {
      expect(screen.getByTestId('custom-font-missing-bold-TestFont')).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: /Remove TestFont custom font/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockDeleteCustomFontFamily).toHaveBeenCalledWith('TestFont');
    });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ editorFontFamily: null }));
  });

  it('sanitizes dialog picker failures before displaying them', async () => {
    mockListCustomFonts.mockResolvedValue([]);
    mockOpenDialog.mockRejectedValueOnce(
      new Error('Failed to open D:\\secret\\fonts\\TestFont-Regular.ttf (os error 5)'),
    );
    renderTab();

    const chooseButtons = await screen.findAllByRole('button', { name: /Choose file/ });
    fireEvent.click(chooseButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A file operation failed. Check that you have the necessary permissions.',
      );
    });
    expect(screen.getByRole('alert')).not.toHaveTextContent('D:\\secret\\fonts');
  });

  it('sanitizes upload failures before displaying them', async () => {
    mockListCustomFonts.mockResolvedValue([]);
    mockOpenDialog.mockResolvedValueOnce('D:\\fonts\\TestFont-Regular.ttf');
    mockImportCustomFont.mockRejectedValueOnce(
      new Error('Cannot read font file: D:\\fonts\\TestFont-Regular.ttf (os error 2)'),
    );
    renderTab();

    const chooseButtons = await screen.findAllByRole('button', { name: /Choose file/ });
    fireEvent.click(chooseButtons[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue('TestFont')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('custom-font-add-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A file operation failed. Check that you have the necessary permissions.',
      );
    });
    expect(screen.getByRole('alert')).not.toHaveTextContent('D:\\fonts\\TestFont-Regular.ttf');
  });

  it('sanitizes delete failures before displaying them', async () => {
    mockListCustomFonts.mockResolvedValue([
      { family: 'TestFont', has_regular: true, has_bold: false },
    ]);
    mockDeleteCustomFontFamily.mockRejectedValueOnce(
      new Error("Failed to delete custom font 'TestFont': D:\\journals\\diary.db (os error 5)"),
    );
    renderTab();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Remove TestFont custom font/i })).toBeVisible();
    });

    fireEvent.click(screen.getByRole('button', { name: /Remove TestFont custom font/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A file operation failed. Check that you have the necessary permissions.',
      );
    });
    expect(screen.getByRole('alert')).not.toHaveTextContent('D:\\journals\\diary.db');
  });

  void commitCallback;
});
