import { createEffect, onCleanup, onMount } from 'solid-js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface DiaryEditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  placeholder?: string;
}

export default function DiaryEditor(props: DiaryEditorProps) {
  // eslint-disable-next-line no-unassigned-vars
  let editorElement!: HTMLDivElement;
  let editor: Editor | null = null;

  onMount(() => {
    if (!editorElement) return;

    // Initialize TipTap editor
    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Placeholder.configure({
          placeholder: props.placeholder || 'Start writing...',
        }),
      ],
      content: props.content,
      editorProps: {
        attributes: {
          class:
            'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[200px] max-w-none',
        },
      },
      onUpdate: ({ editor }) => {
        const markdown = editor.getText();
        props.onUpdate?.(markdown);
      },
    });
  });

  // Update editor content when prop changes
  createEffect(() => {
    if (editor && props.content !== editor.getText()) {
      editor.commands.setContent(props.content);
    }
  });

  onCleanup(() => {
    editor?.destroy();
  });

  return (
    <div class="rounded-lg border border-gray-200 bg-white p-4">
      <div ref={editorElement} />
    </div>
  );
}

// Helper function to get markdown from editor
export function getMarkdown(editor: Editor | null): string {
  return editor?.getText() || '';
}

// Helper function to set markdown in editor
export function setMarkdown(editor: Editor | null, markdown: string): void {
  editor?.commands.setContent(markdown);
}
