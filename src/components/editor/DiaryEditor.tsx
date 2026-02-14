import { createEffect, onCleanup, onMount, createSignal } from 'solid-js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import EditorToolbar from './EditorToolbar';

interface DiaryEditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
}

export default function DiaryEditor(props: DiaryEditorProps) {
  // eslint-disable-next-line no-unassigned-vars
  let editorElement!: HTMLDivElement;
  const [editor, setEditor] = createSignal<Editor | null>(null);

  onMount(() => {
    if (!editorElement) return;

    // Initialize TipTap editor
    const editorInstance = new Editor({
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

    setEditor(editorInstance);

    // Notify parent that editor is ready
    props.onEditorReady?.(editorInstance);
  });

  // Update editor content when prop changes
  createEffect(() => {
    const editorInstance = editor();
    if (editorInstance && props.content !== editorInstance.getText()) {
      editorInstance.commands.setContent(props.content);
    }
  });

  onCleanup(() => {
    editor()?.destroy();
  });

  return (
    <div class="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <EditorToolbar editor={editor()} />
      <div class="p-4">
        <div ref={editorElement} />
      </div>
    </div>
  );
}
