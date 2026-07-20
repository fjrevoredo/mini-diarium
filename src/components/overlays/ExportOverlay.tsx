import { createSignal, createEffect, onMount, Show, For } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { save as saveDialog } from '../../lib/dialog';
import { createLogger } from '../../lib/logger';
import { generatePdfFromElement } from '../../lib/pdf';
import {
  listExportPlugins,
  runExportPlugin,
  printEntries,
  writePdfFile,
  type PluginInfo,
  type ExportResult,
  type PrintLabels,
} from '../../lib/tauri';
import { mapTauriError } from '../../lib/errors';
import { useI18n } from '../../i18n';
import { preferences } from '../../state/preferences';
import { isValidDate, addMonths, addDays } from '../../lib/dates';
import { X, FileDown, CheckCircle, AlertCircle, Printer } from 'lucide-solid';

interface ExportOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const log = createLogger('Export');

export default function ExportOverlay(props: ExportOverlayProps) {
  const t = useI18n();

  const [plugins, setPlugins] = createSignal<PluginInfo[]>([]);
  const [selectedPluginId, setSelectedPluginId] = createSignal<string>('');
  const [exporting, setExporting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [result, setResult] = createSignal<ExportResult | null>(null);
  const [filterMode, setFilterMode] = createSignal<'all' | 'range' | 'month'>('all');
  const [dateFrom, setDateFrom] = createSignal('');
  const [dateTo, setDateTo] = createSignal('');
  const [selectedMonth, setSelectedMonth] = createSignal('');

  const isPrint = () => selectedPluginId() === 'print';

  const buildPrintLabels = (): PrintLabels => ({
    generated_label: t('export.printGeneratedLabel'),
    tags_label: t('export.printTagsLabel'),
    no_entries_label: t('export.printNoEntries'),
    months: Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(preferences().language, { month: 'long' }).format(
        new Date(2024, i, 1),
      ),
    ),
  });

  onMount(async () => {
    const printOption: PluginInfo = {
      id: 'print',
      name: t('export.printFormat'),
      file_extensions: [],
      builtin: true,
    };
    try {
      const list = await listExportPlugins();
      setPlugins([printOption, ...list]);
    } catch (err) {
      log.error('Failed to load export plugins:', err);
      setPlugins([printOption]);
    }
    setSelectedPluginId('print');
  });

  const selectedPlugin = () => plugins().find((p) => p.id === selectedPluginId());

  const computedExportOptions = () => {
    const mode = filterMode();
    if (mode === 'all') return undefined;
    if (mode === 'range') {
      const from = dateFrom();
      const to = dateTo();
      if (!from || !to || !isValidDate(from) || !isValidDate(to)) return undefined;
      if (from > to) return undefined;
      return { dateFrom: from, dateTo: to };
    }
    if (mode === 'month') {
      const month = selectedMonth();
      if (!month) return undefined;
      const from = `${month}-01`;
      const to = addDays(addMonths(from, 1), -1);
      return { dateFrom: from, dateTo: to };
    }
    return undefined;
  };

  const isExportDisabled = () => {
    if (exporting()) return true;
    const mode = filterMode();
    if (mode === 'range') {
      const from = dateFrom();
      const to = dateTo();
      if (!from || !to || !isValidDate(from) || !isValidDate(to)) return true;
      if (from > to) return true;
    }
    if (mode === 'month') {
      if (!selectedMonth()) return true;
    }
    return false;
  };

  const resetFilterState = () => {
    setFilterMode('all');
    setDateFrom('');
    setDateTo('');
    setSelectedMonth('');
  };

  // Reset transient state each time the overlay becomes visible.
  // Kobalte's controlled Dialog does not fire onOpenChange when the parent
  // sets open={false} externally, so cleanup on close is unreliable.
  // Resetting on open is the single authoritative reset path.
  createEffect(() => {
    if (props.isOpen) {
      setError(null);
      setResult(null);
      resetFilterState();
    }
  });

  // Single close handler — the only code path that calls props.onClose().
  // All close triggers (X button, Escape, Cancel/Close button) delegate here
  // so the exporting guard and the call are never duplicated.
  const handleClose = () => {
    if (exporting()) return;
    props.onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) handleClose();
  };

  const exportTimestamp = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
  };

  const handlePrint = async () => {
    setExporting(true);
    setError(null);
    setResult(null);

    try {
      const printResult = await printEntries(buildPrintLabels(), computedExportOptions());

      const filePath = await saveDialog({
        defaultPath: `mini-diarium-export-${exportTimestamp()}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (!filePath) {
        return; // finally handles setExporting(false)
      }

      const layer = document.createElement('div');
      layer.id = 'mini-diarium-print-layer';
      // Keep the temporary layer under the dialog so it never flashes over the UI.
      layer.style.display = 'block';
      layer.style.position = 'fixed';
      layer.style.top = '0';
      layer.style.left = '0';
      layer.style.zIndex = '0';
      layer.style.visibility = 'hidden';
      layer.style.pointerEvents = 'none';
      layer.innerHTML = printResult.html;
      document.body.appendChild(layer);

      try {
        // Ensure images are fully decoded before html2canvas captures the layer
        await Promise.all(
          [...layer.querySelectorAll<HTMLImageElement>('img')].map((img) =>
            img.decode().catch(() => {}),
          ),
        );
        const bytes = await generatePdfFromElement(layer);
        await writePdfFile(filePath, bytes);
        setResult({ entries_exported: printResult.entries_exported, file_path: filePath });
      } finally {
        layer.remove();
      }
    } catch (err) {
      log.error('PDF export failed:', err);
      setError(mapTauriError(err, t) || t('export.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleExport = async () => {
    const plugin = selectedPlugin();
    if (!plugin) return;

    setExporting(true);
    setError(null);
    setResult(null);

    try {
      const ext = plugin.file_extensions[0] ?? 'txt';
      const defaultPath = `mini-diarium-export-${exportTimestamp()}.${ext}`;

      const filePath = await saveDialog({
        defaultPath,
        filters: [
          {
            name: plugin.name,
            extensions: plugin.file_extensions,
          },
        ],
      });

      if (!filePath) {
        setExporting(false);
        return;
      }

      const exportResult = await runExportPlugin(plugin.id, filePath, computedExportOptions());
      setResult(exportResult);
    } catch (err) {
      log.error('Export failed:', err);
      setError(mapTauriError(err, t) || t('export.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const formatCount = (num: number): string => {
    return num.toLocaleString(preferences().language);
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
            data-testid="export-overlay"
            class="w-full max-w-lg rounded-lg bg-primary p-6 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
            onKeyDown={handleKeyDown}
          >
            <div class="flex items-center justify-between mb-4">
              <Dialog.Title class="text-lg font-semibold text-primary">
                {t('export.title')}
              </Dialog.Title>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-hover transition-colors"
                aria-label={t('export.closeAria')}
                disabled={exporting()}
              >
                <X size={20} class="text-tertiary" />
              </Dialog.CloseButton>
            </div>

            <Dialog.Description class="text-sm text-secondary mb-6">
              {t('export.description')}
            </Dialog.Description>

            {/* Security Warning */}
            <div class="mb-4 rounded-md bg-amber-50 border border-amber-200 p-3 dark:bg-amber-900/20 dark:border-amber-800">
              <p class="text-sm text-amber-800 dark:text-amber-200">
                {t('export.securityWarning')}
              </p>
            </div>

            {/* Format Selection */}
            <div class="mb-4">
              <label for="export-format" class="block text-sm font-medium text-secondary mb-2">
                {t('export.formatLabel')}
              </label>
              <select
                id="export-format"
                value={selectedPluginId()}
                onChange={(e) => {
                  setSelectedPluginId(e.currentTarget.value);
                  setError(null);
                  setResult(null);
                }}
                disabled={exporting()}
                class="w-full rounded-md border border-primary px-3 py-2 text-sm text-primary bg-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-tertiary disabled:cursor-not-allowed"
              >
                <For each={plugins()}>
                  {(plugin) => <option value={plugin.id}>{plugin.name}</option>}
                </For>
              </select>
            </div>

            {/* Date Range Filter */}
            <div class="mb-6">
              <label for="export-filter" class="block text-sm font-medium text-secondary mb-2">
                {t('export.filterModeLabel')}
              </label>
              <select
                id="export-filter"
                value={filterMode()}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setFilterMode(value as 'all' | 'range' | 'month');
                  setDateFrom('');
                  setDateTo('');
                  setSelectedMonth('');
                }}
                disabled={exporting()}
                class="w-full rounded-md border border-primary px-3 py-2 text-sm text-primary bg-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-tertiary disabled:cursor-not-allowed"
              >
                <option value="all">{t('export.filterAll')}</option>
                <option value="range">{t('export.filterDateRange')}</option>
                <option value="month">{t('export.filterMonth')}</option>
              </select>

              <Show when={filterMode() === 'range'}>
                <div class="flex gap-3 mt-3">
                  <div class="flex-1">
                    <label
                      for="export-date-from"
                      class="block text-sm font-medium text-secondary mb-1"
                    >
                      {t('export.dateFromLabel')}
                    </label>
                    <input
                      id="export-date-from"
                      type="date"
                      value={dateFrom()}
                      onInput={(e) => setDateFrom(e.currentTarget.value)}
                      disabled={exporting()}
                      class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-tertiary disabled:cursor-not-allowed"
                    />
                  </div>
                  <div class="flex-1">
                    <label
                      for="export-date-to"
                      class="block text-sm font-medium text-secondary mb-1"
                    >
                      {t('export.dateToLabel')}
                    </label>
                    <input
                      id="export-date-to"
                      type="date"
                      value={dateTo()}
                      onInput={(e) => setDateTo(e.currentTarget.value)}
                      disabled={exporting()}
                      class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-tertiary disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </Show>

              <Show when={filterMode() === 'month'}>
                <div class="mt-3">
                  <label for="export-month" class="block text-sm font-medium text-secondary mb-1">
                    {t('export.monthLabel')}
                  </label>
                  <input
                    id="export-month"
                    type="month"
                    value={selectedMonth()}
                    onInput={(e) => setSelectedMonth(e.currentTarget.value)}
                    disabled={exporting()}
                    class="w-full px-3 py-2 border border-primary bg-primary text-primary rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-tertiary disabled:cursor-not-allowed"
                  />
                </div>
              </Show>
            </div>

            {/* Error Display */}
            <Show when={error()}>
              <div
                role="alert"
                class="mb-4 bg-error border border-error rounded-md p-4 flex items-start gap-2"
              >
                <AlertCircle size={20} class="text-error flex-shrink-0 mt-0.5" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-error">{t('export.failedTitle')}</p>
                  <p class="text-sm text-error mt-1">{error()}</p>
                </div>
              </div>
            </Show>

            {/* Success Display */}
            <Show when={result() && !error()}>
              <div role="status" class="mb-4 bg-success border border-success rounded-md p-4">
                <div class="flex items-start gap-2 mb-3">
                  <CheckCircle size={20} class="text-success flex-shrink-0 mt-0.5" />
                  <p class="text-sm font-medium text-success">{t('export.successTitle')}</p>
                </div>
                <div class="space-y-2 text-sm text-success">
                  <div class="flex justify-between">
                    <span>{t('export.entriesExported')}</span>
                    <span class="font-semibold">{formatCount(result()!.entries_exported)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>{t('export.savedTo')}</span>
                    <span class="font-semibold truncate ml-2">
                      {getFileName(result()!.file_path)}
                    </span>
                  </div>
                </div>
              </div>
            </Show>

            {/* Export Progress */}
            <Show when={exporting()}>
              <div class="mb-4 flex items-center justify-center py-4" aria-busy="true">
                <div
                  class="animate-spin rounded-full h-8 w-8 border-b-2 spinner-border"
                  aria-hidden="true"
                />
                <span class="ml-3 text-sm text-secondary" role="status">
                  {isPrint() ? t('export.printing') : t('export.exporting')}
                </span>
              </div>
            </Show>

            {/* Action Buttons */}
            <div class="flex justify-end gap-3">
              <button
                onClick={handleClose}
                disabled={exporting()}
                class="px-4 py-2 text-sm font-medium text-secondary hover:bg-hover rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {result() ? t('common.close') : t('common.cancel')}
              </button>
              <Show when={!result()}>
                <button
                  onClick={() => (isPrint() ? handlePrint() : handleExport())}
                  disabled={isExportDisabled()}
                  class="px-4 py-2 interactive-primary rounded-md transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Show when={isPrint()} fallback={<FileDown size={16} />}>
                    <Printer size={16} />
                  </Show>
                  {isPrint() ? t('export.print') : t('export.startExport')}
                </button>
              </Show>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
