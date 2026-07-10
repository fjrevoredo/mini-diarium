import { For, Show } from 'solid-js';
import { Lock, Unlock } from 'lucide-solid';
import { useI18n } from '../../i18n';

interface EntryNavBarProps {
  total: number;
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onGoTo?: (index: number) => void;
  onAdd: () => void;
  addDisabled?: boolean;
  addTitle?: string;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteTitle?: string;
  onToggleLock?: () => void;
  locked?: boolean;
  lockDisabled?: boolean;
  lockTitle?: string;
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
          <For each={[...Array(props.total).keys()]}>
            {(i) => (
              <button
                data-testid={`entry-number-button-${i + 1}`}
                aria-current={i === props.index ? 'true' : undefined}
                aria-label={t('editor.goToEntry', { number: i + 1 })}
                onClick={() => props.onGoTo?.(i)}
                class={`px-1.5 py-0.5 rounded hover:bg-hover ${i === props.index ? 'font-bold text-primary' : 'text-tertiary'}`}
              >
                {i + 1}
              </button>
            )}
          </For>
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
      <div class="flex items-center gap-2 ml-auto">
        <Show when={props.onToggleLock}>
          <button
            data-testid="entry-lock-button"
            onClick={() => props.onToggleLock!()}
            disabled={props.lockDisabled}
            title={props.lockTitle}
            aria-pressed={props.locked ? 'true' : 'false'}
            class="px-2 py-0.5 rounded hover:bg-hover text-tertiary disabled:opacity-30"
            aria-label={
              props.lockTitle ?? (props.locked ? t('editor.unlockEntry') : t('editor.lockEntry'))
            }
          >
            {props.locked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
        </Show>
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
