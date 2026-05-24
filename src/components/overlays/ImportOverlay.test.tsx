import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { renderWithI18n } from '../../test/i18n-test-utils';
import * as tauri from '../../lib/tauri';
import ImportOverlay from './ImportOverlay';

const mockPlugins: tauri.PluginInfo[] = [
  {
    id: 'builtin:json',
    name: 'Mini Diarium JSON',
    file_extensions: ['json'],
    builtin: true,
  },
];

const mockImportResult: tauri.ImportResult = {
  entries_imported: 5,
  entries_skipped: 2,
};

function renderOverlay(onClose = vi.fn(), onImportComplete = vi.fn()) {
  return renderWithI18n(() => (
    <ImportOverlay isOpen={true} onClose={onClose} onImportComplete={onImportComplete} />
  ));
}

async function waitForPlugins() {
  await waitFor(() => expect(screen.getByText('Mini Diarium JSON')).toBeInTheDocument());
}

describe('ImportOverlay', () => {
  beforeEach(() => {
    vi.spyOn(tauri, 'listImportPlugins').mockResolvedValue(mockPlugins);
    vi.spyOn(tauri, 'runImportPlugin').mockResolvedValue(mockImportResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the dialog title when open', async () => {
    renderOverlay();
    await waitForPlugins();
    expect(screen.getByRole('heading', { name: 'Import Entries' })).toBeInTheDocument();
  });

  it('loads and populates the format select from listImportPlugins', async () => {
    renderOverlay();
    await waitForPlugins();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBe(1);
    expect(select.options[0].text).toBe('Mini Diarium JSON');
  });

  it('shows "No file selected" text initially', async () => {
    renderOverlay();
    await waitForPlugins();
    expect(screen.getByText('No file selected')).toBeInTheDocument();
  });

  it('clicking Browse opens the file dialog', async () => {
    vi.mocked(openDialog).mockResolvedValue(null);
    renderOverlay();
    await waitForPlugins();
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    await waitFor(() => expect(openDialog).toHaveBeenCalled());
  });

  it('shows the filename (not full path) after a file is selected', async () => {
    vi.mocked(openDialog).mockResolvedValue('/some/path/to/export.json');
    renderOverlay();
    await waitForPlugins();
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    await waitFor(() => expect(screen.getByText('export.json')).toBeInTheDocument());
  });

  it('import button is disabled when no file is selected', async () => {
    renderOverlay();
    await waitForPlugins();
    expect(screen.getByRole('button', { name: /Start Import/ })).toBeDisabled();
  });

  it('successful import shows status with entry counts and calls onImportComplete', async () => {
    vi.mocked(openDialog).mockResolvedValue('/path/to/export.json');
    const onImportComplete = vi.fn();
    renderOverlay(vi.fn(), onImportComplete);
    await waitForPlugins();
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    await waitFor(() => expect(screen.getByText('export.json')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Start Import/ }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(onImportComplete).toHaveBeenCalled();
  });

  it('failed import shows an error alert', async () => {
    vi.mocked(openDialog).mockResolvedValue('/path/to/export.json');
    vi.spyOn(tauri, 'runImportPlugin').mockRejectedValue(new Error('Import failed'));
    renderOverlay();
    await waitForPlugins();
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    await waitFor(() => expect(screen.getByText('export.json')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Start Import/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('sanitizes raw Tauri error — does not display rusqlite internals to user', async () => {
    vi.mocked(openDialog).mockResolvedValue('/path/to/export.json');
    vi.spyOn(tauri, 'runImportPlugin').mockRejectedValue(
      new Error('rusqlite: disk I/O error at /home/user/diary.db'),
    );
    renderOverlay();
    await waitForPlugins();
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    await waitFor(() => expect(screen.getByText('export.json')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Start Import/ }));
    await waitFor(() => {
      expect(screen.queryByText(/rusqlite/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/home\/user\/diary\.db/)).not.toBeInTheDocument();
      expect(screen.getByText('An internal error occurred.')).toBeInTheDocument();
    });
  });
});
