import { Check, ChevronDown, Image as ImageIcon, LoaderCircle } from 'lucide-solid';
import { For, Show } from 'solid-js';
import type { T } from '../../i18n';
import type { ImageSummary } from '../../lib/tauri';
import { formatTimestamp, thumbnailSrc } from './image-picker-shared';

interface ImagePickerGridProps {
  hasMore: boolean;
  inserting: boolean;
  items: ImageSummary[];
  loading: boolean;
  loadingMore: boolean;
  onInsert: (imageId: number) => void;
  onLoadMore: () => void;
  onSelect: (imageId: number) => void;
  selectedId: number | null;
  t: T;
}

export default function ImagePickerGrid(props: ImagePickerGridProps) {
  const isSelected = (imageId: number) => imageId === props.selectedId;

  return (
    <Show
      when={!props.loading || props.items.length > 0}
      fallback={
        <>
          <p class="mb-3 text-sm text-secondary" role="status">
            {props.t('editor.imagePicker.loading')}
          </p>
          <div
            class="grid gap-3"
            style={{
              'grid-template-columns': 'repeat(auto-fill, minmax(8.5rem, 1fr))',
            }}
          >
            <For each={Array.from({ length: 8 })}>
              {() => (
                <div class="rounded-md border border-primary p-2">
                  <div class="aspect-square rounded bg-tertiary animate-pulse" />
                  <div class="mt-2 h-3 rounded bg-tertiary animate-pulse" />
                  <div class="mt-2 h-3 w-2/3 rounded bg-tertiary animate-pulse" />
                </div>
              )}
            </For>
          </div>
        </>
      }
    >
      <Show
        when={props.items.length > 0}
        fallback={
          <div class="flex h-full items-center justify-center py-12 text-sm text-secondary">
            {props.t('editor.imagePicker.noImages')}
          </div>
        }
      >
        <div
          class="grid gap-3"
          style={{ 'grid-template-columns': 'repeat(auto-fill, minmax(8.5rem, 1fr))' }}
        >
          <For each={props.items}>
            {(image) => (
              <button
                type="button"
                aria-pressed={isSelected(image.id)}
                class="rounded-md border p-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                classList={{
                  'border-blue-500 bg-secondary': isSelected(image.id),
                  'border-primary hover:border-blue-400': !isSelected(image.id),
                }}
                onClick={() => props.onSelect(image.id)}
                onDblClick={() => {
                  props.onSelect(image.id);
                  props.onInsert(image.id);
                }}
                disabled={props.inserting}
              >
                <div class="aspect-square overflow-hidden rounded bg-secondary flex items-center justify-center">
                  <Show
                    when={thumbnailSrc(image)}
                    fallback={<ImageIcon size={26} class="text-tertiary" />}
                  >
                    {(src) => (
                      <img src={src()} alt="" class="h-full w-full object-cover" loading="lazy" />
                    )}
                  </Show>
                </div>
                <div class="mt-2 flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="truncate text-sm font-medium text-primary">
                      {image.mime_type.replace('image/', '').toUpperCase()}
                    </div>
                    <div class="truncate text-xs text-secondary">
                      {formatTimestamp(image.created_at)}
                    </div>
                  </div>
                  <Show when={isSelected(image.id)}>
                    <Check size={16} class="mt-0.5 flex-shrink-0 text-blue-500" />
                  </Show>
                </div>
              </button>
            )}
          </For>
        </div>

        <Show when={props.hasMore}>
          <div class="mt-4 flex justify-center">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-md border border-primary px-3 py-2 text-sm text-primary hover:bg-hover disabled:opacity-60"
              onClick={() => props.onLoadMore()}
              disabled={props.loadingMore || props.inserting}
            >
              <Show
                when={props.loadingMore}
                fallback={<ChevronDown size={16} class="text-tertiary" />}
              >
                <LoaderCircle size={16} class="animate-spin text-tertiary" />
              </Show>
              {props.t('editor.imagePicker.loadMore')}
            </button>
          </div>
        </Show>
      </Show>
    </Show>
  );
}
