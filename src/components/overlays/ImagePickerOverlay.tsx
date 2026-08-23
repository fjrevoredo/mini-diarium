import { Dialog } from '@kobalte/core/dialog';
import { Check, LoaderCircle, X } from 'lucide-solid';
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from 'solid-js';
import {
  getImageData,
  listJournalImageSummaries,
  type ImageSummarySort,
  type ImageSummary,
} from '../../lib/tauri';
import { useI18n } from '../../i18n';
import ImagePickerGrid from './ImagePickerGrid';
import ImagePickerPreview from './ImagePickerPreview';

interface ImagePickerOverlayProps {
  onInsert: (dataUrl: string) => void;
  onClose: () => void;
}

const PAGE_SIZE = 24;

export default function ImagePickerOverlay(props: ImagePickerOverlayProps) {
  const t = useI18n();
  const [items, setItems] = createSignal<ImageSummary[]>([]);
  const [isDesktopLayout, setIsDesktopLayout] = createSignal(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const [mobilePanel, setMobilePanel] = createSignal<'library' | 'preview'>('library');
  const [sort, setSort] = createSignal<ImageSummarySort>('newest');
  const [month, setMonth] = createSignal('');
  const [hasMore, setHasMore] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [insertError, setInsertError] = createSignal<string | null>(null);
  const [inserting, setInserting] = createSignal(false);

  let requestId = 0;

  const selectedImage = createMemo(
    () => items().find((image) => image.id === selectedId()) ?? null,
  );

  const loadPage = async (reset: boolean) => {
    const currentRequestId = ++requestId;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setLoadError(null);

    try {
      const page = await listJournalImageSummaries({
        limit: PAGE_SIZE,
        offset: reset ? 0 : items().length,
        sort: sort(),
        month: month() || null,
      });

      if (currentRequestId !== requestId) return;

      setItems((current) => {
        const next = reset ? page.items : [...current, ...page.items];
        setSelectedId((selected) => (next.some((item) => item.id === selected) ? selected : null));
        return next;
      });
      setHasMore(page.has_more);
    } catch {
      if (currentRequestId !== requestId) return;
      if (reset) setItems([]);
      setHasMore(false);
      setLoadError(t('editor.imagePicker.loadError'));
    } finally {
      if (currentRequestId === requestId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const handleSelect = (imageId: number) => {
    setInsertError(null);
    setSelectedId(imageId);
  };

  const handleInsert = async (explicitImageId?: number) => {
    const imageId = explicitImageId ?? selectedId();
    if (imageId === null) return;

    setInsertError(null);
    setInserting(true);

    try {
      const image = await getImageData(imageId);
      props.onInsert(`data:${image.mime_type};base64,${image.data_base64}`);
      props.onClose();
    } catch {
      setInsertError(t('editor.imagePicker.insertError'));
    } finally {
      setInserting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !inserting()) {
      props.onClose();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !inserting()) {
      event.preventDefault();
      event.stopPropagation();
      props.onClose();
      return;
    }
    if (event.key !== 'Enter' || selectedId() === null || inserting()) return;

    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName;
    if (tagName === 'SELECT' || tagName === 'INPUT' || tagName === 'TEXTAREA') return;

    event.preventDefault();
    void handleInsert();
  };

  onMount(() => {
    const syncViewport = () => setIsDesktopLayout(window.innerWidth >= 1024);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    onCleanup(() => window.removeEventListener('resize', syncViewport));

    void loadPage(true);
  });

  createEffect(
    on(
      [sort, month],
      () => {
        void loadPage(true);
      },
      { defer: true },
    ),
  );

  const libraryPanel = () => (
    <section class="min-h-[18rem] min-w-0 rounded-md border border-primary p-3 sm:min-h-[24rem] lg:min-h-0 lg:overflow-y-auto">
      <ImagePickerGrid
        hasMore={hasMore()}
        inserting={inserting()}
        items={items()}
        loading={loading()}
        loadingMore={loadingMore()}
        onInsert={(imageId) => void handleInsert(imageId)}
        onLoadMore={() => void loadPage(false)}
        onSelect={handleSelect}
        selectedId={selectedId()}
        t={t}
      />
    </section>
  );

  const previewPanel = () => (
    <aside class="min-w-0 rounded-md border border-primary p-3 lg:overflow-y-auto">
      <ImagePickerPreview image={selectedImage()} t={t} />
    </aside>
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Content
            class="flex h-full w-full flex-col overflow-hidden bg-primary p-4 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 sm:max-h-[calc(100dvh-2rem)] sm:max-w-6xl sm:rounded-lg sm:p-6"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
            onKeyDown={handleKeyDown}
          >
            <div class="flex items-start justify-between gap-4 mb-4">
              <div>
                <Dialog.Title class="text-lg font-semibold text-primary">
                  {t('editor.imagePicker.title')}
                </Dialog.Title>
                <Dialog.Description class="text-sm text-secondary mt-1">
                  {t('editor.imagePicker.description')}
                </Dialog.Description>
              </div>
              <Dialog.CloseButton
                class="rounded-md p-1 hover:bg-hover transition-colors disabled:opacity-60"
                aria-label={t('common.close')}
                disabled={inserting()}
              >
                <X size={20} class="text-tertiary" />
              </Dialog.CloseButton>
            </div>

            <div class="flex flex-col gap-3 mb-4 sm:flex-row sm:items-end sm:justify-between">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label class="flex flex-col gap-1 text-sm text-secondary">
                  <span>{t('editor.imagePicker.sortLabel')}</span>
                  <select
                    value={sort()}
                    onChange={(event) => setSort(event.currentTarget.value as ImageSummarySort)}
                    class="min-w-40 rounded-md border border-primary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="newest">{t('editor.imagePicker.sortNewest')}</option>
                    <option value="oldest">{t('editor.imagePicker.sortOldest')}</option>
                    <option value="most_used">{t('editor.imagePicker.sortMostUsed')}</option>
                  </select>
                </label>

                <label class="flex flex-col gap-1 text-sm text-secondary">
                  <span>{t('editor.imagePicker.monthLabel')}</span>
                  <input
                    type="month"
                    value={month()}
                    onInput={(event) => setMonth(event.currentTarget.value)}
                    class="min-w-40 rounded-md border border-primary bg-primary px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            <Show when={loadError() || insertError()}>
              <div
                class="mb-4 rounded-md border border-error bg-error px-3 py-2 text-sm text-error"
                role="alert"
              >
                {loadError() ?? insertError()}
              </div>
            </Show>

            <Show
              when={isDesktopLayout()}
              fallback={
                <>
                  <div class="mb-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      class="rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                      classList={{
                        'border-blue-500 bg-secondary text-primary': mobilePanel() === 'library',
                        'border-primary text-secondary hover:bg-hover': mobilePanel() !== 'library',
                      }}
                      onClick={() => setMobilePanel('library')}
                    >
                      {t('editor.imagePicker.libraryTab')}
                    </button>
                    <button
                      type="button"
                      class="rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                      classList={{
                        'border-blue-500 bg-secondary text-primary': mobilePanel() === 'preview',
                        'border-primary text-secondary hover:bg-hover': mobilePanel() !== 'preview',
                      }}
                      onClick={() => setMobilePanel('preview')}
                      disabled={selectedId() === null && items().length === 0}
                    >
                      {t('editor.imagePicker.previewTitle')}
                    </button>
                  </div>

                  <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <Show when={mobilePanel() === 'library'} fallback={previewPanel()}>
                      {libraryPanel()}
                    </Show>
                  </div>
                </>
              }
            >
              <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:overflow-hidden">
                {libraryPanel()}
                {previewPanel()}
              </div>
            </Show>

            <div class="mt-4 flex shrink-0 items-center justify-end gap-3 border-t border-primary pt-4">
              <Dialog.CloseButton
                class="rounded-md border border-primary px-3 py-2 text-sm text-primary hover:bg-hover disabled:opacity-60"
                disabled={inserting()}
              >
                {t('common.close')}
              </Dialog.CloseButton>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-primary hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handleInsert()}
                disabled={selectedId() === null || inserting()}
              >
                <Show when={inserting()} fallback={<Check size={16} />}>
                  <LoaderCircle size={16} class="animate-spin" />
                </Show>
                {t('editor.imagePicker.insertButton')}
              </button>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
