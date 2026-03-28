import { createEffect, onCleanup, onMount, createSignal } from 'solid-js';
import { Editor, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { Image as TiptapImage } from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import EditorToolbar from './EditorToolbar';
import { preferences } from '../../state/preferences';
import { readFileBytes } from '../../lib/tauri';

interface DiaryEditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  /** Called after a programmatic setContent so EditorPanel can update editorIsEmpty. */
  onSetContent?: (isEmpty: boolean) => void;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  spellCheck?: boolean;
}

// Core: resize a data URL via canvas and insert at the current cursor position.
async function resizeAndEmbedDataUrl(
  dataUrl: string,
  mimeHint: string,
  editor: Editor,
): Promise<void> {
  const MAX = 1200; // max dimension in px — caps large photos before base64 embedding
  const resized = await new Promise<string>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let w = img.width,
        h = img.height;
      if (w > MAX || h > MAX) {
        if (w >= h) {
          h = Math.round((h * MAX) / w);
          w = MAX;
        } else {
          w = Math.round((w * MAX) / h);
          h = MAX;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const useJpeg = mimeHint === 'image/jpeg' || mimeHint === 'image/webp';
      resolve(canvas.toDataURL(useJpeg ? 'image/jpeg' : 'image/png', 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
  editor.chain().focus().setImage({ src: resized }).run();
}

// For browser File objects: clipboard paste and toolbar file picker.
async function resizeAndEmbedImage(file: File, editor: Editor): Promise<void> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  await resizeAndEmbedDataUrl(dataUrl, file.type, editor);
}

// For file paths from the Tauri drag-drop event.
// Tauri intercepts OS-level drops on all platforms and emits tauri://drag-drop
// instead of populating event.dataTransfer.files in the browser's drop event.
async function resizeAndEmbedPath(path: string, editor: Editor): Promise<void> {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const mime =
    ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : ext === 'bmp'
            ? 'image/bmp'
            : 'image/png';
  const bytes = await readFileBytes(path);
  const uint8 = new Uint8Array(bytes);
  let binary = '';
  uint8.forEach((b) => (binary += String.fromCharCode(b)));
  await resizeAndEmbedDataUrl(`data:${mime};base64,${btoa(binary)}`, mime, editor);
}

// AlignableImage wraps every image in a <figure> container so that TextAlign's
// style="text-align: X" is applied to the container (a block element), not to
// the <img> itself. The <img> is display:inline-block so it responds to the
// parent's text-align — the generic container model.
const AlignableImage = TiptapImage.extend({
  renderHTML({ HTMLAttributes }) {
    // TextAlign sets style="text-align: X" on the node's HTMLAttributes.
    // Split it: alignment style → <figure> container, image attrs → <img>.
    const { style, ...imgAttrs } = HTMLAttributes;
    return [
      'figure',
      mergeAttributes({ class: 'image-container' }, style ? { style } : {}),
      ['img', mergeAttributes(this.options.HTMLAttributes, imgAttrs)],
    ];
  },
  parseHTML() {
    return [
      {
        // Primary: new wrapped format — read alignment from <figure>, image src from inner <img>
        tag: 'figure.image-container',
        getAttrs(dom) {
          const img = (dom as HTMLElement).querySelector('img');
          if (!img) return false;
          // Filter out null for optional attributes to avoid schema issues
          const attrs: Record<string, string> = { src: img.getAttribute('src') ?? '' };
          const alt = img.getAttribute('alt');
          const title = img.getAttribute('title');
          if (alt !== null) attrs.alt = alt;
          if (title !== null) attrs.title = title;
          return attrs;
        },
      },
      // Fallback: existing bare <img> entries render fine, loaded without alignment
      { tag: 'img[src]' },
    ];
  },
});

export default function DiaryEditor(props: DiaryEditorProps) {
  // eslint-disable-next-line no-unassigned-vars -- SolidJS assigns via ref={editorElement}; ESLint can't see the JSX assignment
  let editorElement!: HTMLDivElement;
  const [editor, setEditor] = createSignal<Editor | null>(null);
  let unlistenDragDrop: UnlistenFn | undefined;

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
        Underline,
        Highlight,
        AlignableImage.configure({ allowBase64: true, inline: false }),
        TextAlign.configure({ types: ['heading', 'paragraph', 'image'] }),
      ],
      content: props.content,
      editorProps: {
        attributes: {
          class:
            'journal-editor-content prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none',
          spellcheck: String(props.spellCheck ?? true),
        },
        // Fallback for when Tauri's file-drop interception is disabled or absent.
        handleDrop(_view, event) {
          const dragEvent = event as DragEvent;
          const files = Array.from(dragEvent.dataTransfer?.files ?? []).filter((f) =>
            f.type.startsWith('image/'),
          );
          if (!files.length) return false;
          dragEvent.preventDefault();
          files.forEach((f) =>
            resizeAndEmbedImage(f, editorInstance).catch((err) =>
              console.error('[mini-diarium] image embed failed:', err),
            ),
          );
          return true;
        },
        handlePaste(_view, event) {
          const items = Array.from(event.clipboardData?.items ?? []);
          const imageItems = items.filter((i) => i.type.startsWith('image/'));
          if (!imageItems.length) return false;
          event.preventDefault();
          imageItems.forEach((i) => {
            const file = i.getAsFile();
            if (file)
              resizeAndEmbedImage(file, editorInstance).catch((err) =>
                console.error('[mini-diarium] image embed failed:', err),
              );
          });
          return true;
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        props.onUpdate?.(html);
      },
    });

    setEditor(editorInstance);
    props.onEditorReady?.(editorInstance);

    // Tauri intercepts OS-level file drops on all platforms and emits tauri://drag-drop
    // instead of letting the browser's drop event see the files via dataTransfer.files.
    listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      const imagePaths = event.payload.paths.filter((p) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(p));
      imagePaths.forEach((path) =>
        resizeAndEmbedPath(path, editorInstance).catch((err) =>
          console.error('[mini-diarium] image embed failed:', err),
        ),
      );
    }).then((fn) => {
      unlistenDragDrop = fn;
    });
  });

  // Update editor content when prop changes
  createEffect(() => {
    const editorInstance = editor();
    if (editorInstance && props.content !== editorInstance.getHTML()) {
      // Pass emitUpdate:false to suppress onUpdate for programmatic content loads.
      // Without this, loading an entry fires handleContentUpdate which resets the
      // debounce timer with the newly-loaded content, discarding any pending save for
      // the previous entry. It also triggers the "first keystroke creates entry" path
      // on blank days, creating a spurious entry before the user types anything.
      editorInstance.commands.setContent(props.content, { emitUpdate: false });
      // Notify EditorPanel of the new empty state after TipTap processes the content.
      // This replaces the editorIsEmpty update that onUpdate previously provided:
      // EditorPanel uses this signal to re-evaluate addDisabled correctly.
      props.onSetContent?.(editorInstance.isEmpty);
    }
  });

  // Update spellcheck attribute when prop changes
  createEffect(() => {
    const editorInstance = editor();
    const spellCheck = props.spellCheck ?? true;
    if (editorInstance) {
      const editorElement = editorInstance.view.dom;
      editorElement.setAttribute('spellcheck', String(spellCheck));
    }
  });

  // Update TipTap Placeholder extension when props.placeholder changes (e.g. locale switch).
  // The editor is created once in onMount with the initial placeholder value; after that,
  // prop changes must be applied by mutating the extension options and dispatching a no-op
  // transaction so ProseMirror re-runs its decoration pass.
  createEffect(() => {
    const newPlaceholder = props.placeholder;
    const editorInstance = editor();
    if (!editorInstance || editorInstance.isDestroyed) return;
    const ext = editorInstance.extensionManager.extensions.find((e) => e.name === 'placeholder');
    if (ext) {
      ext.options.placeholder = newPlaceholder;
      editorInstance.view.dispatch(editorInstance.state.tr);
    }
  });

  onCleanup(() => {
    editor()?.destroy();
    unlistenDragDrop?.();
  });

  return (
    <div
      class="rounded-lg border border-primary bg-primary overflow-hidden"
      style={{ '--editor-font-size': `${preferences().editorFontSize}px` }}
    >
      <EditorToolbar
        editor={editor()}
        onInsertImage={(file) => {
          const e = editor();
          if (e)
            resizeAndEmbedImage(file, e).catch((err) =>
              console.error('[mini-diarium] image embed failed:', err),
            );
        }}
      />
      <div class="p-4">
        <div ref={editorElement} />
      </div>
    </div>
  );
}
