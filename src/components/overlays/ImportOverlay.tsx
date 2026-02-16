import { createSignal, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { importMiniDiaryJson, importDayOneJson, importDayOneTxt, importJrnlJson, type ImportResult } from '../../lib/tauri';
import { X, FileUp, CheckCircle, AlertCircle } from 'lucide-solid';

interface ImportOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type ImportFormat = 'minidiary-json' | 'dayone-json' | 'dayone-txt' | 'jrnl-json';

export default function ImportOverlay(props: ImportOverlayProps) {
  const [selectedFormat, setSelectedFormat] = createSignal<ImportFormat>('minidiary-json');
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [importing, setImporting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [result, setResult] = createSignal<ImportResult | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setSelectedFile(null);
      setError(null);
      setResult(null);
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !importing()) {
      props.onClose();
    }
  };

  const handleSelectFile = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        setSelectedFile(selected);
        setError(null);
        setResult(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open file picker');
    }
  };

  const handleImport = async () => {
    const file = selectedFile();
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      console.log('[Import] Starting import from file:', file);

      // Call appropriate import function based on selected format
      const format = selectedFormat();
      let importResult: ImportResult;

      if (format === 'minidiary-json') {
        importResult = await importMiniDiaryJson(file);
      } else if (format === 'dayone-json') {
        importResult = await importDayOneJson(file);
      } else if (format === 'dayone-txt') {
        importResult = await importDayOneTxt(file);
      } else if (format === 'jrnl-json') {
        importResult = await importJrnlJson(file);
      } else {
        throw new Error(`Unsupported import format: ${format}`);
      }

      console.log('[Import] Success:', importResult);
      setResult(importResult);

      // Notify parent to refresh data
      props.onImportComplete?.();
    } catch (err) {
      console.error('[Import] Failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const getFileName = (path: string | null): string => {
    if (!path) return '';
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  };

  const formatCount = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            class="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-6 shadow-lg data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            onKeyDown={handleKeyDown}
          >
            <div class="flex items-center justify-between mb-4">
              <Dialog.Title class="text-lg font-semibold text-gray-900">
                Import Entries
              </Dialog.Title>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-gray-100 transition-colors"
                aria-label="Close"
                disabled={importing()}
              >
                <X size={20} class="text-gray-500" />
              </Dialog.CloseButton>
            </div>

            <Dialog.Description class="text-sm text-gray-600 mb-6">
              Import diary entries from a JSON file
            </Dialog.Description>

            {/* Format Selection */}
            <div class="mb-4">
              <label for="format" class="block text-sm font-medium text-gray-700 mb-2">
                Format
              </label>
              <select
                id="format"
                value={selectedFormat()}
                onChange={(e) => setSelectedFormat(e.currentTarget.value as ImportFormat)}
                disabled={importing()}
                class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="minidiary-json">Mini Diary JSON</option>
                <option value="dayone-json">Day One JSON</option>
                <option value="dayone-txt">Day One TXT</option>
                <option value="jrnl-json">jrnl JSON</option>
              </select>
            </div>

            {/* File Selection */}
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">File</label>
              <div class="flex gap-2">
                <div class="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-700 truncate">
                  {selectedFile() ? getFileName(selectedFile()) : 'No file selected'}
                </div>
                <button
                  onClick={handleSelectFile}
                  disabled={importing()}
                  class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Error Display */}
            <Show when={error()}>
              <div class="mb-4 bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-2">
                <AlertCircle size={20} class="text-red-600 flex-shrink-0 mt-0.5" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-red-800">Import Failed</p>
                  <p class="text-sm text-red-700 mt-1">{error()}</p>
                </div>
              </div>
            </Show>

            {/* Success Display */}
            <Show when={result() && !error()}>
              <div class="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
                <div class="flex items-start gap-2 mb-3">
                  <CheckCircle size={20} class="text-green-600 flex-shrink-0 mt-0.5" />
                  <p class="text-sm font-medium text-green-800">Import Successful!</p>
                </div>
                <div class="space-y-2 text-sm text-green-700">
                  <div class="flex justify-between">
                    <span>Entries imported:</span>
                    <span class="font-semibold">{formatCount(result()!.entries_imported)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Entries merged:</span>
                    <span class="font-semibold">{formatCount(result()!.entries_merged)}</span>
                  </div>
                  <Show when={result()!.entries_skipped > 0}>
                    <div class="flex justify-between">
                      <span>Entries skipped:</span>
                      <span class="font-semibold">{formatCount(result()!.entries_skipped)}</span>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            {/* Import Progress */}
            <Show when={importing()}>
              <div class="mb-4 flex items-center justify-center py-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span class="ml-3 text-sm text-gray-600">Importing...</span>
              </div>
            </Show>

            {/* Action Buttons */}
            <div class="flex justify-end gap-3">
              <button
                onClick={() => props.onClose()}
                disabled={importing()}
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {result() ? 'Close' : 'Cancel'}
              </button>
              <Show when={!result()}>
                <button
                  onClick={handleImport}
                  disabled={!selectedFile() || importing()}
                  class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <FileUp size={16} />
                  Start Import
                </button>
              </Show>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
