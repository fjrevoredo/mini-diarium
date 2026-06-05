import { Image as ImageIcon } from 'lucide-solid';
import { Show } from 'solid-js';
import type { T } from '../../i18n';
import type { ImageSummary } from '../../lib/tauri';
import {
  formatBytes,
  formatDimensions,
  formatLinkedDates,
  formatTimestamp,
  thumbnailSrc,
} from './image-picker-shared';

interface ImagePickerPreviewProps {
  image: ImageSummary | null;
  t: T;
}

export default function ImagePickerPreview(props: ImagePickerPreviewProps) {
  return (
    <>
      <div class="mb-3 text-sm font-medium text-primary">
        {props.t('editor.imagePicker.previewTitle')}
      </div>
      <Show
        when={props.image}
        fallback={
          <div class="flex h-40 items-center justify-center text-sm text-secondary sm:h-[20rem]">
            {props.t('editor.imagePicker.previewEmpty')}
          </div>
        }
      >
        {(image) => (
          <div class="flex flex-col gap-3">
            <div class="aspect-[4/3] overflow-hidden rounded-md bg-secondary flex items-center justify-center sm:aspect-square">
              <Show
                when={thumbnailSrc(image())}
                fallback={
                  <div class="flex flex-col items-center gap-2 text-secondary">
                    <ImageIcon size={28} />
                    <span class="text-xs">
                      {props.t('editor.imagePicker.thumbnailUnavailable')}
                    </span>
                  </div>
                }
              >
                {(src) => <img src={src()} alt="" class="h-full w-full object-contain" />}
              </Show>
            </div>

            <dl class="grid gap-2 text-sm">
              <div class="flex justify-between gap-4">
                <dt class="text-secondary">{props.t('editor.imagePicker.createdLabel')}</dt>
                <dd class="text-primary text-right">{formatTimestamp(image().created_at)}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-secondary">{props.t('editor.imagePicker.dimensionsLabel')}</dt>
                <dd class="text-primary text-right">{formatDimensions(image())}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-secondary">{props.t('editor.imagePicker.formatLabel')}</dt>
                <dd class="text-primary text-right">{image().mime_type}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-secondary">{props.t('editor.imagePicker.sizeLabel')}</dt>
                <dd class="text-primary text-right">{formatBytes(image().byte_size)}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-secondary">{props.t('editor.imagePicker.usageLabel')}</dt>
                <dd class="text-primary text-right">{image().usage_count}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-secondary">{props.t('editor.imagePicker.linkedDatesLabel')}</dt>
                <dd class="text-primary text-right break-words">
                  {formatLinkedDates(image(), props.t)}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Show>
    </>
  );
}
