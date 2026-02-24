import { createSignal, onMount, Show, For } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { createLogger } from '../../lib/logger';
import {
  listImportPlugins,
  runImportPlugin,
  type PluginInfo,
  type ImportResult,
} from '../../lib/tauri';
import { X, FileUp, CheckCircle, AlertCircle } from 'lucide-solid';

interface ImportOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

const log = createLogger('Import');

export default function ImportOverlay(props: ImportOverlayProps) {
  const [plugins, setPlugins] = createSignal<PluginInfo[]>([]);
  const [selectedPluginId, setSelectedPluginId] = createSignal<string>('');
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [importing, setImporting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [result, setResult] = createSignal<ImportResult | null>(null);

  onMount(async () => {
    try {
      const list = await listImportPlugins();
      setPlugins(list);
      if (list.length > 0) {
        setSelectedPluginId(list[0].id);
      }
    } catch (err) {
      log.error('Failed to load import plugins:', err);
    }
  });

  const selectedPlugin = () => plugins().find((p) => p.id === selectedPluginId());

  const handleOpenChange = (open: boolean) => {
    if (!open) {
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
      const plugin = selectedPlugin();
      const extensions = plugin?.file_extensions ?? ['json'];
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: plugin?.name ?? 'File',
            extensions,
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
    const pluginId = selectedPluginId();
    if (!file) {
      setError('Please select a file first');
      return;
    }
    if (!pluginId) {
      setError('Please select an import format');
      return;
    }

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const importResult = await runImportPlugin(pluginId, file);
      setResult(importResult);
      props.onImportComplete?.();
    } catch (err) {
      log.error('Import failed:', err);
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
              <Dialog.Title class="text-lg font-semibold text-primary">Import Entries</Dialog.Title>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-hover transition-colors"
                aria-label="Close"
                disabled={importing()}
              >
                <X size={20} class="text-tertiary" />
              </Dialog.CloseButton>
            </div>

            <Dialog.Description class="text-sm text-secondary mb-6">
              Import diary entries from a file
            </Dialog.Description>

            {/* Format Selection */}
            <div class="mb-4">
              <label for="format" class="block text-sm font-medium text-secondary mb-2">
                Format
              </label>
              <select
                id="format"
                value={selectedPluginId()}
                onChange={(e) => {
                  setSelectedPluginId(e.currentTarget.value);
                  setSelectedFile(null);
                  setError(null);
                  setResult(null);
                }}
                disabled={importing()}
                class="w-full rounded-md border border-primary px-3 py-2 text-sm text-primary bg-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-tertiary disabled:cursor-not-allowed"
              >
                <For each={plugins()}>
                  {(plugin) => <option value={plugin.id}>{plugin.name}</option>}
                </For>
              </select>
            </div>

            {/* File Selection */}
            <div class="mb-6">
              <label class="block text-sm font-medium text-secondary mb-2">File</label>
              <div class="flex gap-2">
                <div class="flex-1 px-3 py-2 border border-primary rounded-md bg-tertiary text-sm text-secondary truncate">
                  {selectedFile() ? getFileName(selectedFile()) : 'No file selected'}
                </div>
                <button
                  onClick={handleSelectFile}
                  disabled={importing()}
                  class="px-4 py-2 bg-tertiary text-secondary rounded-md hover:bg-hover transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Error Display */}
            <Show when={error()}>
              <div class="mb-4 bg-error border border-error rounded-md p-4 flex items-start gap-2">
                <AlertCircle size={20} class="text-error flex-shrink-0 mt-0.5" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-error">Import Failed</p>
                  <p class="text-sm text-error mt-1">{error()}</p>
                </div>
              </div>
            </Show>

            {/* Success Display */}
            <Show when={result() && !error()}>
              <div class="mb-4 bg-success border border-success rounded-md p-4">
                <div class="flex items-start gap-2 mb-3">
                  <CheckCircle size={20} class="text-success flex-shrink-0 mt-0.5" />
                  <p class="text-sm font-medium text-success">Import Successful!</p>
                </div>
                <div class="space-y-2 text-sm text-success">
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
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <span class="ml-3 text-sm text-secondary">Importing...</span>
              </div>
            </Show>

            {/* Action Buttons */}
            <div class="flex justify-end gap-3">
              <button
                onClick={() => props.onClose()}
                disabled={importing()}
                class="px-4 py-2 text-sm font-medium text-secondary hover:bg-hover rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
