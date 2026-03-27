import { Show } from 'solid-js';
import { useI18n } from '../../i18n';

interface EntryNavBarProps {
  total: number;
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onAdd: () => void;
  addDisabled?: boolean;
  addTitle?: string;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteTitle?: string;
}

export function EntryNavBar(props: EntryNavBarProps) {
  const t = useI18n();

  return (
    <div
      data-testid="entry-nav-bar"
      class="flex items-center justify-between px-4 py-1 border-b border-primary text-sm"
    >
      <Show when={props.total >= 2}>
        <div class="flex items-center gap-2">
          <button
            data-testid="entry-prev-button"
            onClick={() => props.onPrev()}
            disabled={props.index === 0}
            class="px-2 py-0.5 rounded disabled:opacity-30 hover:bg-hover"
            aria-label={t('editor.prevEntry')}
          >
            ←
          </button>
          <span data-testid="entry-counter" class="text-tertiary">
            {props.index + 1} / {props.total}
          </span>
          <button
            data-testid="entry-next-button"
            onClick={() => props.onNext()}
            disabled={props.index === props.total - 1}
            class="px-2 py-0.5 rounded disabled:opacity-30 hover:bg-hover"
            aria-label={t('editor.nextEntry')}
          >
            →
          </button>
        </div>
      </Show>
      <div class="flex items-center gap-2">
        <Show when={props.total > 1 && props.onDelete}>
          <button
            data-testid="entry-delete-button"
            onClick={() => props.onDelete!()}
            disabled={props.deleteDisabled}
            title={props.deleteTitle}
            class="px-2 py-0.5 rounded hover:bg-hover text-tertiary disabled:opacity-30"
            aria-label={props.deleteTitle ?? t('editor.deleteEntry')}
          >
            −
          </button>
        </Show>
        <button
          data-testid="entry-add-button"
          onClick={() => props.onAdd()}
          disabled={props.addDisabled}
          title={props.addTitle}
          class="px-2 py-0.5 rounded hover:bg-hover text-tertiary disabled:opacity-30"
          aria-label={props.addTitle ?? t('editor.addEntry')}
        >
          +
        </button>
      </div>
    </div>
  );
}
