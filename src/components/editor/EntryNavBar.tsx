import { Show } from 'solid-js';

interface EntryNavBarProps {
  total: number;
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onAdd: () => void;
}

export function EntryNavBar(props: EntryNavBarProps) {
  return (
    <Show when={props.total > 0}>
      <div class="flex items-center justify-between px-4 py-1 border-b border-neutral-200 dark:border-neutral-700 text-sm">
        <div class="flex items-center gap-2">
          <button
            onClick={props.onPrev}
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
            onClick={props.onNext}
            disabled={props.index === props.total - 1}
            class="px-2 py-0.5 rounded disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            aria-label="Next entry"
          >
            →
          </button>
        </div>
        <button
          onClick={props.onAdd}
          class="px-2 py-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500"
          aria-label="Add entry"
        >
          +
        </button>
      </div>
    </Show>
  );
}
