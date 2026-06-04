import type { ImageSummary } from '../../lib/tauri';
import type { T } from '../../i18n';

export function thumbnailSrc(image: ImageSummary | null): string | null {
  if (!image?.thumbnail_data_base64 || !image.thumbnail_mime_type) return null;
  return `data:${image.thumbnail_mime_type};base64,${image.thumbnail_data_base64}`;
}

export function formatTimestamp(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function formatDimensions(image: ImageSummary | null): string {
  if (!image?.width || !image.height) return '—';
  return `${image.width} × ${image.height}`;
}

export function formatBytes(value: number | null): string {
  if (!value || value <= 0) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatLinkedDates(image: ImageSummary | null, t: T): string {
  if (!image?.first_entry_date && !image?.latest_entry_date) return '—';
  if (image.first_entry_date && image.latest_entry_date) {
    if (image.first_entry_date === image.latest_entry_date) {
      return t('editor.imagePicker.linkedDateSingle', { date: image.first_entry_date });
    }
    return t('editor.imagePicker.linkedDateRange', {
      from: image.first_entry_date,
      to: image.latest_entry_date,
    });
  }
  return image.first_entry_date ?? image.latest_entry_date ?? '—';
}
