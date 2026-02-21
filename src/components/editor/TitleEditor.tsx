import { createEffect } from 'solid-js';

interface TitleEditorProps {
  value: string;
  onInput?: (value: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  spellCheck?: boolean;
}

export default function TitleEditor(props: TitleEditorProps) {
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

  // Focus on mount
  createEffect(() => {
    inputRef?.focus();
  });

  return (
    <input
      ref={inputRef}
      type="text"
      data-testid="title-input"
      value={props.value}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      placeholder={props.placeholder || 'Title'}
      spellcheck={props.spellCheck ?? true}
      class="w-full border-0 bg-transparent px-0 text-2xl font-semibold text-primary placeholder-tertiary focus:outline-none focus:ring-0"
    />
  );
}
