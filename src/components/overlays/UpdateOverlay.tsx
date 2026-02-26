import { createSignal, createEffect, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { getVersion } from '@tauri-apps/api/app';
import { check, Update } from '@tauri-apps/plugin-updater';
import { X, RefreshCw, CheckCircle, AlertCircle, Download } from 'lucide-solid';

interface UpdateOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

type CheckState =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'done'
  | 'error';

export default function UpdateOverlay(props: UpdateOverlayProps) {
  const [checkState, setCheckState] = createSignal<CheckState>('idle');
  const [currentVersion, setCurrentVersion] = createSignal('');
  const [updateInfo, setUpdateInfo] = createSignal<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = createSignal(0);
  const [downloadedBytes, setDownloadedBytes] = createSignal(0);
  const [totalBytes, setTotalBytes] = createSignal(0);
  const [errorMessage, setErrorMessage] = createSignal('');

  createEffect(() => {
    if (props.isOpen) {
      void runCheck();
    } else {
      // Reset state when closed so next open starts fresh
      setCheckState('idle');
      setUpdateInfo(null);
      setDownloadProgress(0);
      setDownloadedBytes(0);
      setTotalBytes(0);
      setErrorMessage('');
    }
  });

  async function runCheck() {
    setCheckState('checking');
    try {
      const ver = await getVersion();
      setCurrentVersion(ver);
      const update = await check();
      if (update) {
        setUpdateInfo(update);
        setCheckState('available');
      } else {
        setCheckState('up-to-date');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setCheckState('error');
    }
  }

  async function handleDownloadAndInstall() {
    const update = updateInfo();
    if (!update) return;
    setCheckState('downloading');
    setDownloadProgress(0);
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setTotalBytes(event.data.contentLength ?? 0);
          setDownloadedBytes(0);
          setDownloadProgress(0);
        } else if (event.event === 'Progress') {
          const dl = downloadedBytes() + event.data.chunkLength;
          setDownloadedBytes(dl);
          const total = totalBytes();
          setDownloadProgress(total > 0 ? Math.round((dl / total) * 100) : 0);
        } else if (event.event === 'Finished') {
          setDownloadProgress(100);
        }
      });
      setCheckState('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setCheckState('error');
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) props.onClose();
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
            class="w-full max-w-sm rounded-lg bg-primary p-6 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
          >
            {/* Title row */}
            <div class="flex items-center justify-between mb-6">
              <Dialog.Title class="text-lg font-semibold text-primary">
                Check for Updates
              </Dialog.Title>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-hover transition-colors"
                aria-label="Close"
              >
                <X size={20} class="text-tertiary" />
              </Dialog.CloseButton>
            </div>

            {/* Checking */}
            <Show when={checkState() === 'checking'}>
              <div class="flex flex-col items-center gap-3 py-4">
                <RefreshCw size={32} class="text-secondary animate-spin" />
                <p class="text-sm text-secondary">Checking for updates...</p>
              </div>
            </Show>

            {/* Up to date */}
            <Show when={checkState() === 'up-to-date'}>
              <div class="flex flex-col items-center gap-3 py-4">
                <CheckCircle size={32} class="text-green-500" />
                <p class="text-sm font-medium text-primary">You're on the latest version</p>
                <Show when={currentVersion()}>
                  <p class="text-xs text-tertiary">v{currentVersion()}</p>
                </Show>
              </div>
              <div class="flex justify-end mt-4">
                <button
                  onClick={() => props.onClose()}
                  class="rounded-md bg-tertiary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors"
                >
                  Close
                </button>
              </div>
            </Show>

            {/* Update available */}
            <Show when={checkState() === 'available'}>
              <div class="space-y-4">
                <div class="rounded-md bg-blue-500/10 border border-blue-500/20 p-4">
                  <p class="text-sm font-medium text-primary mb-1">
                    Version {updateInfo()?.version} is available
                  </p>
                  <Show when={currentVersion()}>
                    <p class="text-xs text-tertiary">Current: v{currentVersion()}</p>
                  </Show>
                </div>
                <Show when={updateInfo()?.body}>
                  <div class="rounded-md bg-secondary p-3 max-h-40 overflow-y-auto">
                    <p class="text-xs font-medium text-secondary mb-1">Release notes:</p>
                    <pre class="text-xs text-tertiary whitespace-pre-wrap font-sans">
                      {updateInfo()?.body}
                    </pre>
                  </div>
                </Show>
                <div class="flex justify-end gap-2">
                  <button
                    onClick={() => props.onClose()}
                    class="rounded-md bg-tertiary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors"
                  >
                    Later
                  </button>
                  <button
                    onClick={() => void handleDownloadAndInstall()}
                    class="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <Download size={14} />
                    Download &amp; Install
                  </button>
                </div>
              </div>
            </Show>

            {/* Downloading */}
            <Show when={checkState() === 'downloading'}>
              <div class="space-y-4 py-2">
                <div class="flex items-center gap-2">
                  <RefreshCw size={18} class="text-secondary animate-spin flex-shrink-0" />
                  <p class="text-sm text-secondary">Downloading update...</p>
                </div>
                <div class="w-full bg-tertiary rounded-full h-2">
                  <div
                    class="bg-blue-600 h-2 rounded-full transition-all duration-200"
                    style={{ width: `${downloadProgress()}%` }}
                  />
                </div>
                <p class="text-xs text-tertiary text-right">{downloadProgress()}%</p>
              </div>
            </Show>

            {/* Done */}
            <Show when={checkState() === 'done'}>
              <div class="flex flex-col items-center gap-3 py-4">
                <CheckCircle size={32} class="text-green-500" />
                <p class="text-sm font-medium text-primary">Update installed successfully</p>
                <p class="text-xs text-secondary text-center">
                  Restart the app to apply the update.
                </p>
              </div>
              <div class="flex justify-end mt-4">
                <button
                  onClick={() => props.onClose()}
                  class="rounded-md bg-tertiary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors"
                >
                  Close
                </button>
              </div>
            </Show>

            {/* Error */}
            <Show when={checkState() === 'error'}>
              <div class="space-y-4">
                <div class="flex items-start gap-3 rounded-md bg-red-500/10 border border-red-500/20 p-4">
                  <AlertCircle size={18} class="text-red-500 flex-shrink-0 mt-0.5" />
                  <div class="space-y-1 min-w-0">
                    <p class="text-sm font-medium text-primary">Update check failed</p>
                    <p class="text-xs text-secondary break-words">{errorMessage()}</p>
                  </div>
                </div>
                <div class="flex justify-end gap-2">
                  <button
                    onClick={() => props.onClose()}
                    class="rounded-md bg-tertiary px-4 py-2 text-sm font-medium text-secondary hover:bg-hover transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => void runCheck()}
                    class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </Show>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
