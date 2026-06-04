import { createResource, createSignal, For, onMount, Show } from 'solid-js';
import { Image as ImageIcon, X } from 'lucide-solid';
import { getImageData, listJournalImageSummaries } from '../../lib/tauri';
import { useI18n } from '../../i18n';

interface ImagePickerOverlayProps {
  onInsert: (dataUrl: string) => void;
  onClose: () => void;
}

export default function ImagePickerOverlay(props: ImagePickerOverlayProps) {
  const t = useI18n();
  const [images] = createResource(async () => listJournalImageSummaries());
  const [loadingImageId, setLoadingImageId] = createSignal<number | null>(null);
  const [insertError, setInsertError] = createSignal(false);
  let dialogRef: HTMLDivElement | undefined;

  onMount(() => dialogRef?.focus());

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose();
  };

  const formatCreatedAt = (createdAt: string) => {
    const parsed = new Date(createdAt);
    return Number.isNaN(parsed.getTime()) ? createdAt : parsed.toLocaleString();
  };

  const handleInsert = async (imageId: number) => {
    setInsertError(false);
    setLoadingImageId(imageId);

    try {
      const image = await getImageData(imageId);
      const dataUrl = `data:${image.mime_type};base64,${image.data_base64}`;
      props.onInsert(dataUrl);
      props.onClose();
    } catch {
      setInsertError(true);
    } finally {
      setLoadingImageId(null);
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ 'background-color': 'var(--overlay-bg)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        ref={(el) => {
          dialogRef = el;
        }}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t('editor.imagePicker.title')}
        onKeyDown={handleKeyDown}
        class="w-full max-w-xl rounded-lg bg-primary p-6 flex flex-col gap-3 focus:outline-none"
        style={{ 'box-shadow': 'var(--shadow-lg)' }}
      >
        <div class="flex items-center justify-between">
          <span class="font-medium text-sm">{t('editor.imagePicker.title')}</span>
          <button
            type="button"
            class="text-secondary hover:text-primary"
            aria-label={t('common.close')}
            onClick={() => props.onClose()}
          >
            <X size={16} />
          </button>
        </div>

        <Show when={images.error || insertError()}>
          <p class="text-xs text-error" role="alert">
            {t('editor.imagePicker.error')}
          </p>
        </Show>

        <Show when={!images.loading && !images.error}>
          <Show
            when={(images() ?? []).length > 0}
            fallback={
              <p class="text-xs text-secondary py-6 text-center">
                {t('editor.imagePicker.noImages')}
              </p>
            }
          >
            <div class="image-picker-grid">
              <For each={images()}>
                {(img) => {
                  const isLoading = () => loadingImageId() === img.id;
                  return (
                    <button
                      type="button"
                      disabled={loadingImageId() !== null}
                      class="rounded border border-border hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary text-left p-3 flex items-start gap-3 disabled:opacity-60 disabled:cursor-wait"
                      onClick={() => void handleInsert(img.id)}
                      title={img.mime_type}
                    >
                      <span class="mt-0.5 text-secondary">
                        <ImageIcon size={18} />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block text-sm font-medium text-primary break-all">
                          {img.mime_type}
                        </span>
                        <span class="block text-xs text-secondary mt-1">
                          {formatCreatedAt(img.created_at)}
                        </span>
                        <Show when={isLoading()}>
                          <span class="block text-xs text-secondary mt-2">…</span>
                        </Show>
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>
        </Show>

        <Show when={images.loading}>
          <p class="text-xs text-secondary py-4 text-center">…</p>
        </Show>
      </div>
    </div>
  );
}
