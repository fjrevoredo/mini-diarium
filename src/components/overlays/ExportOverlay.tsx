import { createSignal, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { createLogger } from '../../lib/logger';
import { exportJson, exportMarkdown, type ExportResult } from '../../lib/tauri';
import { mapTauriError } from '../../lib/errors';
import { X, FileDown, CheckCircle, AlertCircle } from 'lucide-solid';

interface ExportOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'json' | 'markdown';

const log = createLogger('Export');

export default function ExportOverlay(props: ExportOverlayProps) {
  const [selectedFormat, setSelectedFormat] = createSignal<ExportFormat>('json');
  const [exporting, setExporting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [result, setResult] = createSignal<ExportResult | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
      setResult(null);
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !exporting()) {
      props.onClose();
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setResult(null);

    try {
      const format = selectedFormat();
      const isMarkdown = format === 'markdown';
      const defaultPath = isMarkdown ? 'mini-diarium-export.md' : 'mini-diarium-export.json';
      const filterName = isMarkdown ? 'Markdown' : 'JSON';
      const filterExt = isMarkdown ? ['md'] : ['json'];

      // Open save dialog
      const filePath = await saveDialog({
        defaultPath,
        filters: [
          {
            name: filterName,
            extensions: filterExt,
          },
        ],
      });

      if (!filePath) {
        // User cancelled the dialog
        setExporting(false);
        return;
      }

      let exportResult: ExportResult;

      if (format === 'json') {
        exportResult = await exportJson(filePath);
      } else if (format === 'markdown') {
        exportResult = await exportMarkdown(filePath);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }

      setResult(exportResult);
    } catch (err) {
      log.error('Export failed:', err);
      setError(mapTauriError(err) || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const formatCount = (num: number): string => {
    return num.toLocaleString();
  };

  const getFileName = (path: string): string => {
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            class="w-full max-w-md rounded-lg bg-primary p-6 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
            onKeyDown={handleKeyDown}
          >
            <div class="flex items-center justify-between mb-4">
              <Dialog.Title class="text-lg font-semibold text-primary">Export Entries</Dialog.Title>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-hover transition-colors"
                aria-label="Close"
                disabled={exporting()}
              >
                <X size={20} class="text-tertiary" />
              </Dialog.CloseButton>
            </div>

            <Dialog.Description class="text-sm text-secondary mb-6">
              Export all diary entries to a file
            </Dialog.Description>

            {/* Security Warning */}
            <div class="mb-4 rounded-md bg-amber-50 border border-amber-200 p-3 dark:bg-amber-900/20 dark:border-amber-800">
              <p class="text-sm text-amber-800 dark:text-amber-200">
                Exported files contain your diary entries as plain text. Store them in a secure
                location.
              </p>
            </div>

            {/* Format Selection */}
            <div class="mb-6">
              <label for="export-format" class="block text-sm font-medium text-secondary mb-2">
                Format
              </label>
              <select
                id="export-format"
                value={selectedFormat()}
                onChange={(e) => setSelectedFormat(e.currentTarget.value as ExportFormat)}
                disabled={exporting()}
                class="w-full rounded-md border border-primary px-3 py-2 text-sm text-primary bg-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-tertiary disabled:cursor-not-allowed"
              >
                <option value="json">Mini Diary JSON</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>

            {/* Error Display */}
            <Show when={error()}>
              <div class="mb-4 bg-error border border-error rounded-md p-4 flex items-start gap-2">
                <AlertCircle size={20} class="text-error flex-shrink-0 mt-0.5" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-error">Export Failed</p>
                  <p class="text-sm text-error mt-1">{error()}</p>
                </div>
              </div>
            </Show>

            {/* Success Display */}
            <Show when={result() && !error()}>
              <div class="mb-4 bg-success border border-success rounded-md p-4">
                <div class="flex items-start gap-2 mb-3">
                  <CheckCircle size={20} class="text-success flex-shrink-0 mt-0.5" />
                  <p class="text-sm font-medium text-success">Export Successful!</p>
                </div>
                <div class="space-y-2 text-sm text-success">
                  <div class="flex justify-between">
                    <span>Entries exported:</span>
                    <span class="font-semibold">{formatCount(result()!.entries_exported)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Saved to:</span>
                    <span class="font-semibold truncate ml-2">
                      {getFileName(result()!.file_path)}
                    </span>
                  </div>
                </div>
              </div>
            </Show>

            {/* Export Progress */}
            <Show when={exporting()}>
              <div class="mb-4 flex items-center justify-center py-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <span class="ml-3 text-sm text-secondary">Exporting...</span>
              </div>
            </Show>

            {/* Action Buttons */}
            <div class="flex justify-end gap-3">
              <button
                onClick={() => props.onClose()}
                disabled={exporting()}
                class="px-4 py-2 text-sm font-medium text-secondary hover:bg-hover rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {result() ? 'Close' : 'Cancel'}
              </button>
              <Show when={!result()}>
                <button
                  onClick={handleExport}
                  disabled={exporting()}
                  class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <FileDown size={16} />
                  Start Export
                </button>
              </Show>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
