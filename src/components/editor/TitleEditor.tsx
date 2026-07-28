import { onMount } from 'solid-js';
import { useI18n } from '../../i18n';

interface TitleEditorProps {
  value: string;
  onInput?: (value: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  spellCheck?: boolean;
  /** When true the title input is read-only and does not auto-focus on mount (TODO-0071). */
  readOnly?: boolean;
}

export default function TitleEditor(props: TitleEditorProps) {
  const t = useI18n();

  // eslint-disable-next-line no-unassigned-vars
  let inputRef!: HTMLInputElement;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      props.onEnter?.();
    }
  };

  const handleInput = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    props.onInput?.(target.value);
  };

  // Focus on mount — skipped when read-only so a locked entry doesn't steal focus.
  //
  // Must be onMount, not createEffect: `readOnly` is derived from dayEntries/currentIndex,
  // so a tracking scope re-runs this on every entry-list change — including the
  // setDayEntries inside startEntryCreation, which fires while the user is still typing
  // their first sentence. The title input would then steal focus mid-word and swallow the
  // rest of the keystrokes. onMount reads props untracked, so it focuses once. See TODO-0089.
  onMount(() => {
    if (!props.readOnly) inputRef?.focus();
  });

  return (
    <input
      ref={inputRef}
      type="text"
      data-testid="title-input"
      value={props.value}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      readOnly={props.readOnly}
      placeholder={props.placeholder || t('editor.titlePlaceholder')}
      spellcheck={props.spellCheck ?? true}
      dir="auto"
      class="w-full border-0 bg-transparent px-0 text-2xl font-semibold text-primary placeholder-tertiary focus:outline-none focus:ring-0"
    />
  );
}
