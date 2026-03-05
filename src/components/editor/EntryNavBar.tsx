import { Show } from 'solid-js';

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
  return (
    <div class="flex items-center justify-between px-4 py-1 border-b border-neutral-200 dark:border-neutral-700 text-sm">
      <Show when={props.total >= 2}>
        <div class="flex items-center gap-2">
          <button
            onClick={() => props.onPrev()}
            disabled={props.index === 0}
            class="px-2 py-0.5 rounded disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            aria-label="Previous entry"
          >
            ←
          </button>
          <span class="text-neutral-500">
            {props.index + 1} / {props.total}
          </span>
          <button
            onClick={() => props.onNext()}
            disabled={props.index === props.total - 1}
            class="px-2 py-0.5 rounded disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            aria-label="Next entry"
          >
            →
          </button>
        </div>
      </Show>
      <div class="flex items-center gap-2">
        <Show when={props.total > 1 && props.onDelete}>
          <button
            onClick={() => props.onDelete!()}
            disabled={props.deleteDisabled}
            title={props.deleteTitle}
            class="px-2 py-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 disabled:opacity-30"
            aria-label={props.deleteTitle ?? 'Delete entry'}
          >
            −
          </button>
        </Show>
        <button
          onClick={() => props.onAdd()}
          disabled={props.addDisabled}
          title={props.addTitle}
          class="px-2 py-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 disabled:opacity-30"
          aria-label={props.addTitle ?? 'Add entry'}
        >
          +
        </button>
      </div>
    </div>
  );
}
