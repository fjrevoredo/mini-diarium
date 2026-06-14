import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createSignal } from 'solid-js';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { renderWithI18n } from '../../test/i18n-test-utils';

import * as tauri from '../../lib/tauri';
import * as pdfLib from '../../lib/pdf';
import ExportOverlay from './ExportOverlay';

const mockPlugins = [
  {
    id: 'builtin:markdown',
    name: 'Markdown',
    file_extensions: ['md'],
    builtin: true,
  },
];

const mockExportResult = {
  entries_exported: 5,
  file_path: '/home/user/mini-diarium-export.md',
};

const mockPrintResult = {
  entries_exported: 5,
  html: '<p>Test HTML</p>',
};

function renderOverlay() {
  return renderWithI18n(() => <ExportOverlay isOpen={true} onClose={() => {}} />);
}

async function waitForPlugins() {
  await waitFor(() => {
    expect(screen.getByText('Markdown')).toBeInTheDocument();
  });
  // Switch to file export format so tests that test the export flow find "Start Export"
  const formatSelect = screen.getByLabelText('Format') as HTMLSelectElement;
  fireEvent.change(formatSelect, { target: { value: 'builtin:markdown' } });
}

async function clickExport() {
  const exportButton = screen.getByRole('button', { name: /Start Export/ });
  await fireEvent.click(exportButton);
}

describe('ExportOverlay', () => {
  beforeEach(() => {
    vi.spyOn(tauri, 'listExportPlugins').mockResolvedValue(mockPlugins);
    vi.spyOn(tauri, 'runExportPlugin').mockResolvedValue(mockExportResult);
    vi.spyOn(tauri, 'printEntries').mockResolvedValue(mockPrintResult);
    vi.spyOn(tauri, 'writePdfFile').mockResolvedValue(undefined);
    vi.spyOn(pdfLib, 'generatePdfFromElement').mockResolvedValue([0x25, 0x50, 0x44, 0x46]);
    vi.mocked(saveDialog).mockResolvedValue('/test/export.md');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders filter mode selector with all three options', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByLabelText('Filter') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(3);
    expect(select.options[0].value).toBe('all');
    expect(select.options[1].value).toBe('range');
    expect(select.options[2].value).toBe('month');
  });

  it('defaults to all entries filter mode', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByLabelText('Filter') as HTMLSelectElement;
    expect(select.value).toBe('all');
  });

  it('passes no date options when filter is all entries', async () => {
    renderOverlay();
    await waitForPlugins();
    await clickExport();

    await waitFor(() => {
      expect(tauri.runExportPlugin).toHaveBeenCalledWith(
        'builtin:markdown',
        '/test/export.md',
        undefined,
      );
    });
  });

  it('shows date range inputs when filter mode is range', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByLabelText('Filter');
    fireEvent.change(select, { target: { value: 'range' } });

    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
  });

  it('disables export when only one date is filled in range mode', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByLabelText('Filter');
    fireEvent.change(select, { target: { value: 'range' } });

    const fromInput = screen.getByLabelText('From') as HTMLInputElement;
    fireEvent.input(fromInput, { target: { value: '2026-01-01' } });

    const exportButton = screen.getByRole('button', { name: /Start Export/ });
    expect(exportButton).toBeDisabled();
  });

  it('passes date range options when both dates are filled', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByLabelText('Filter');
    fireEvent.change(select, { target: { value: 'range' } });

    const fromInput = screen.getByLabelText('From') as HTMLInputElement;
    const toInput = screen.getByLabelText('To') as HTMLInputElement;
    fireEvent.input(fromInput, { target: { value: '2026-01-01' } });
    fireEvent.input(toInput, { target: { value: '2026-03-31' } });

    await clickExport();

    await waitFor(() => {
      expect(tauri.runExportPlugin).toHaveBeenCalledWith('builtin:markdown', '/test/export.md', {
        dateFrom: '2026-01-01',
        dateTo: '2026-03-31',
      });
    });
  });

  it('shows month input when filter mode is month', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByLabelText('Filter');
    fireEvent.change(select, { target: { value: 'month' } });

    expect(screen.getByLabelText('Month')).toBeInTheDocument();
  });

  it('disables export when month is not selected', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByLabelText('Filter');
    fireEvent.change(select, { target: { value: 'month' } });

    const exportButton = screen.getByRole('button', { name: /Start Export/ });
    expect(exportButton).toBeDisabled();
  });

  it('passes correct date range for single month March 2026', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByLabelText('Filter');
    fireEvent.change(select, { target: { value: 'month' } });

    const monthInput = screen.getByLabelText('Month') as HTMLInputElement;
    fireEvent.input(monthInput, { target: { value: '2026-03' } });

    await clickExport();

    await waitFor(() => {
      expect(tauri.runExportPlugin).toHaveBeenCalledWith('builtin:markdown', '/test/export.md', {
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
      });
    });
  });

  it('passes correct date range for single month February 2024 (leap year)', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByLabelText('Filter');
    fireEvent.change(select, { target: { value: 'month' } });

    const monthInput = screen.getByLabelText('Month') as HTMLInputElement;
    fireEvent.input(monthInput, { target: { value: '2024-02' } });

    await clickExport();

    await waitFor(() => {
      expect(tauri.runExportPlugin).toHaveBeenCalledWith('builtin:markdown', '/test/export.md', {
        dateFrom: '2024-02-01',
        dateTo: '2024-02-29',
      });
    });
  });

  it('resets filter state when switching filter mode', async () => {
    renderOverlay();
    await waitForPlugins();

    const select = screen.getByLabelText('Filter');
    fireEvent.change(select, { target: { value: 'range' } });

    const fromInput = screen.getByLabelText('From') as HTMLInputElement;
    fireEvent.input(fromInput, { target: { value: '2026-01-01' } });

    fireEvent.change(select, { target: { value: 'all' } });
    fireEvent.change(select, { target: { value: 'range' } });

    const fromInputAgain = screen.getByLabelText('From') as HTMLInputElement;
    expect(fromInputAgain.value).toBe('');
  });

  it('disables export when from date is after to date', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByLabelText('Filter');
    fireEvent.change(select, { target: { value: 'range' } });

    const fromInput = screen.getByLabelText('From') as HTMLInputElement;
    const toInput = screen.getByLabelText('To') as HTMLInputElement;
    fireEvent.input(fromInput, { target: { value: '2026-12-31' } });
    fireEvent.input(toInput, { target: { value: '2026-01-01' } });

    const exportButton = screen.getByRole('button', { name: /Start Export/ });
    expect(exportButton).toBeDisabled();
  });

  it('generates PDF and writes to the file chosen by save dialog', async () => {
    vi.mocked(saveDialog).mockResolvedValueOnce('/test/export.pdf');
    renderWithI18n(() => <ExportOverlay isOpen={true} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Print$/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Print$/ }));
    await waitFor(() => {
      expect(tauri.printEntries).toHaveBeenCalled();
      expect(pdfLib.generatePdfFromElement).toHaveBeenCalled();
      expect(tauri.writePdfFile).toHaveBeenCalledWith('/test/export.pdf', expect.any(Array));
    });
  });

  it('shows success panel after PDF is saved', async () => {
    vi.mocked(saveDialog).mockResolvedValueOnce('/test/export.pdf');
    renderWithI18n(() => <ExportOverlay isOpen={true} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Print$/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Print$/ }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });

  it('does not generate PDF when save dialog is cancelled', async () => {
    vi.mocked(saveDialog).mockResolvedValueOnce(null);
    renderWithI18n(() => <ExportOverlay isOpen={true} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Print$/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Print$/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Print$/ })).not.toBeDisabled());
    expect(pdfLib.generatePdfFromElement).not.toHaveBeenCalled();
    expect(tauri.writePdfFile).not.toHaveBeenCalled();
  });

  it('shows error when printEntries rejects', async () => {
    vi.spyOn(tauri, 'printEntries').mockRejectedValueOnce(new Error('network error'));
    renderOverlay();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Print$/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Print$/ }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('does not call runExportPlugin when save dialog is cancelled', async () => {
    vi.mocked(saveDialog).mockResolvedValueOnce(null);
    renderOverlay();
    await waitForPlugins();
    fireEvent.click(screen.getByRole('button', { name: /Start Export/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Start Export/ })).not.toBeDisabled(),
    );
    expect(tauri.runExportPlugin).not.toHaveBeenCalled();
  });

  it('shows error when export plugin fails', async () => {
    vi.spyOn(tauri, 'runExportPlugin').mockRejectedValueOnce(new Error('Export failed'));
    renderOverlay();
    await waitForPlugins();
    await clickExport();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('shows Print / PDF as first format option and defaults to it', async () => {
    renderOverlay();
    await waitFor(() => {
      expect(screen.getByText('Print / PDF')).toBeInTheDocument();
    });
    const formatSelect = screen.getByLabelText('Format') as HTMLSelectElement;
    expect(formatSelect.options[0].value).toBe('print');
    expect(formatSelect.options[0].text).toBe('Print / PDF');
  });

  it('shows Print button when print format is selected', async () => {
    renderOverlay();
    await waitFor(() => {
      expect(screen.getByText('Print / PDF')).toBeInTheDocument();
    });
    const printButton = screen.getByRole('button', { name: /^Print$/ });
    expect(printButton).toBeInTheDocument();
  });

  it('clears error state when the overlay is reopened', async () => {
    function ToggleWrapper() {
      const [open, setOpen] = createSignal(true);
      return (
        <>
          <button data-testid="close-ctrl" onClick={() => setOpen(false)}>
            close
          </button>
          <button data-testid="open-ctrl" onClick={() => setOpen(true)}>
            open
          </button>
          <ExportOverlay isOpen={open()} onClose={() => setOpen(false)} />
        </>
      );
    }
    vi.spyOn(tauri, 'printEntries').mockRejectedValueOnce(new Error('fail'));
    renderWithI18n(() => <ToggleWrapper />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Print$/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Print$/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    // Close and wait for portal to fully unmount before reopening.
    fireEvent.click(screen.getByTestId('close-ctrl'));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-ctrl'));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Print$/ })).toBeInTheDocument();
    });
  });

  it('clears success result when the overlay is reopened', async () => {
    function ToggleWrapper() {
      const [open, setOpen] = createSignal(true);
      return (
        <>
          <button data-testid="close-ctrl" onClick={() => setOpen(false)}>
            close
          </button>
          <button data-testid="open-ctrl" onClick={() => setOpen(true)}>
            open
          </button>
          <ExportOverlay isOpen={open()} onClose={() => setOpen(false)} />
        </>
      );
    }
    vi.mocked(saveDialog).mockResolvedValueOnce('/test/export.pdf');
    renderWithI18n(() => <ToggleWrapper />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Print$/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Print$/ }));
    // After a successful export the Print button is hidden by <Show when={!result()}>.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Print$/ })).not.toBeInTheDocument(),
    );

    // Close and reopen.
    fireEvent.click(screen.getByTestId('close-ctrl'));
    fireEvent.click(screen.getByTestId('open-ctrl'));

    // Print button reappearing proves createEffect cleared result() on reopen,
    // because Print is only rendered when result() is null.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Print$/ })).toBeInTheDocument(),
    );
  });

  it('Cancel button calls onClose', async () => {
    const onClose = vi.fn();
    renderWithI18n(() => <ExportOverlay isOpen={true} onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Cancel$/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(onClose).toHaveBeenCalled();
  });
});
