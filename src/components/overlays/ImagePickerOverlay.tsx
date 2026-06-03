import { createResource, For, Show } from 'solid-js';
import { listJournalImages } from '../../lib/tauri';
import { useI18n } from '../../i18n';

interface ImagePickerOverlayProps {
  onInsert: (dataUrl: string) => void;
  onClose: () => void;
}

export default function ImagePickerOverlay(props: ImagePickerOverlayProps) {
  const t = useI18n();
  const [images] = createResource(listJournalImages);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose();
  };

  const handleInsert = (dataUrl: string) => {
    props.onInsert(dataUrl);
    props.onClose();
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label={t('editor.imagePicker.title')}
    >
      <div class="bg-surface rounded-lg shadow-xl w-[90vw] max-w-xl p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="font-medium text-sm">{t('editor.imagePicker.title')}</span>
          <button class="text-secondary hover:text-primary text-xs" onClick={() => props.onClose()}>
            ✕
          </button>
        </div>

        <Show when={images.error}>
          <p class="text-xs text-red-500">{t('editor.imagePicker.error')}</p>
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
                  const dataUrl = `data:${img.mime_type};base64,${img.data_base64}`;
                  return (
                    <button
                      class="rounded border border-border hover:border-primary overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
                      onClick={() => handleInsert(dataUrl)}
                      title={img.mime_type}
                    >
                      <img
                        src={dataUrl}
                        alt=""
                        class="w-full h-[120px] object-cover block"
                      />
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
