import { createEffect, onCleanup, onMount, createSignal, createResource, Show } from 'solid-js';
import { Editor, Extension, Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Image as TiptapImage } from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import EditorToolbar from './EditorToolbar';
import { preferences } from '../../state/preferences';
import { readFileBytes, getFontData } from '../../lib/tauri';
import { extractImageSourcesFromHtml, htmlHasImages } from '../../lib/image-drag';
import { useI18n } from '../../i18n';

interface DiaryEditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  /** Called after a programmatic setContent so EditorPanel can update editorIsEmpty. */
  onSetContent?: (isEmpty: boolean) => void;
  placeholder?: string;
  onEditorReady?: (editor: Editor) => void;
  spellCheck?: boolean;
  onImportMarkdown?: () => void;
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

function getFirstStrongDir(text: string): 'ltr' | 'rtl' | null {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (
      (cp >= 0x0590 && cp <= 0x05ff) || // Hebrew
      (cp >= 0x0600 && cp <= 0x06ff) || // Arabic
      (cp >= 0x0700 && cp <= 0x074f) || // Syriac
      (cp >= 0x0750 && cp <= 0x077f) || // Arabic Supplement
      (cp >= 0xfb50 && cp <= 0xfdff) || // Arabic Presentation Forms A
      (cp >= 0xfe70 && cp <= 0xfeff) // Arabic Presentation Forms B
    )
      return 'rtl';
    if (
      (cp >= 0x0041 && cp <= 0x005a) || // A-Z
      (cp >= 0x0061 && cp <= 0x007a) || // a-z
      (cp >= 0x00c0 && cp <= 0x024f) // Latin Extended
    )
      return 'ltr';
  }
  return null;
}

const bidiPluginKey = new PluginKey<void>('bidi-autodetect');

// Adds explicit dir attributes to paragraph and heading nodes so direction
// survives save/reload cycles. Auto-detects from the first strong bidi char on
// document change, but only when dir is not already set (preserves manual
// overrides). Ctrl+Shift+D toggles direction manually.
const BidiExtension = Extension.create({
  name: 'bidi',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          dir: {
            default: null,
            parseHTML: (element) => {
              const dir = element.getAttribute('dir');
              return dir === 'ltr' || dir === 'rtl' ? dir : null;
            },
            renderHTML: (attributes) => {
              if (!attributes.dir) return {};
              return { dir: attributes.dir };
            },
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-d': () => {
        const paragraphDir = this.editor.getAttributes('paragraph').dir as
          | string
          | null
          | undefined;
        const headingDir = this.editor.getAttributes('heading').dir as string | null | undefined;
        const currentDir = paragraphDir ?? headingDir ?? null;
        const nextDir: 'rtl' | 'ltr' = currentDir === 'rtl' ? 'ltr' : 'rtl';
        return this.editor.commands.setTextDirection(nextDir);
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: bidiPluginKey,
        appendTransaction(transactions, _oldState, newState) {
          if (transactions.some((t) => t.getMeta(bidiPluginKey))) return null;
          if (!transactions.some((t) => t.docChanged)) return null;

          const { tr } = newState;
          let hasChanges = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return;
            if (node.attrs.dir !== null && node.attrs.dir !== undefined) return;

            const detected = getFirstStrongDir(node.textContent);
            if (detected !== null) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir: detected });
              hasChanges = true;
            }
          });

          if (hasChanges) {
            tr.setMeta(bidiPluginKey, true);
            tr.setMeta('addToHistory', false);
          }

          return hasChanges ? tr : null;
        },
      }),
    ];
  },
});

const TimestampMark = Mark.create({
  name: 'timestamp',
  parseHTML() {
    return [{ tag: 'span.timestamp', getAttrs: () => ({}) }];
  },
  renderHTML() {
    return ['span', { class: 'timestamp' }, 0];
  },
});

export default function DiaryEditor(props: DiaryEditorProps) {
  const t = useI18n();
  // eslint-disable-next-line no-unassigned-vars -- SolidJS assigns via ref={editorElement}; ESLint can't see the JSX assignment
  let editorElement!: HTMLDivElement;
  const [editor, setEditor] = createSignal<Editor | null>(null);
  let unlistenDragDrop: UnlistenFn | undefined;
  let unlistenDragEnter: UnlistenFn | undefined;
  let unlistenDragLeave: UnlistenFn | undefined;
  const [isDragOver, setIsDragOver] = createSignal(false);
  const [dropHint, setDropHint] = createSignal(false);
  let dropHintTimer: ReturnType<typeof setTimeout> | undefined;

  const showDropHint = () => {
    clearTimeout(dropHintTimer);
    setDropHint(true);
    dropHintTimer = setTimeout(() => setDropHint(false), 6000);
  };

  // @font-face injection: loads the selected editor font from bundled TTF files
  // as base64 data URLs so the browser can render it.
  const fontFamily = () => preferences().editorFontFamily;
  const [fontData] = createResource(fontFamily, getFontData);

  createEffect(() => {
    const existing = document.getElementById('editor-font-face');
    const data = fontData();

    if (!data) {
      existing?.remove();
      return;
    }

    const style = existing || document.createElement('style');
    style.id = 'editor-font-face';
    style.textContent = [
      `@font-face {`,
      `  font-family: "${data.family}";`,
      `  src: url(${data.regular});`,
      `  font-weight: 400;`,
      `  font-style: normal;`,
      `}`,
      `@font-face {`,
      `  font-family: "${data.family}";`,
      `  src: url(${data.bold});`,
      `  font-weight: 700;`,
      `  font-style: normal;`,
      `}`,
    ].join('\n');

    if (!existing) document.head.appendChild(style);
  });

  onCleanup(() => {
    document.getElementById('editor-font-face')?.remove();
  });

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
        Highlight.configure({ multicolor: true }),
        TextStyle,
        Color,
        AlignableImage.configure({ allowBase64: true, inline: false }),
        TextAlign.configure({ types: ['heading', 'paragraph', 'image'] }),
        BidiExtension,
        TimestampMark,
      ],
      content: props.content,
      editorProps: {
        attributes: {
          class: 'journal-editor-content focus:outline-none max-w-none',
          spellcheck: String(props.spellCheck ?? true),
          dir: 'auto',
        },
        // Fallback for when Tauri's file-drop interception is disabled or absent.
        handleDrop(_view, event) {
          const dragEvent = event as DragEvent;
          const dt = dragEvent.dataTransfer;
          if (!dt) return false;

          // Path A: File objects — covers virtual files exposed by some cross-app drags.
          const files = Array.from(dt.files ?? []).filter((f) => f.type.startsWith('image/'));
          if (files.length) {
            dragEvent.preventDefault();
            files.forEach((f) =>
              resizeAndEmbedImage(f, editorInstance).catch((err) =>
                console.error('[mini-diarium] image embed failed:', err),
              ),
            );
            return true;
          }

          // Path B: HTML payload — Electron/desktop apps (e.g. Typora) expose image drags
          // as text/html with data:image/... or file:// src values. Browsers (Brave, Chrome)
          // only expose HTTPS URLs which we skip — no network fetches. We still consume the
          // drop event when HTTPS images are detected to prevent TipTap from inserting
          // broken <img src="https://..."> nodes as rich text.
          const html = dt.getData('text/html');
          if (html && htmlHasImages(html)) {
            dragEvent.preventDefault();
            const { dataUrls, filePaths } = extractImageSourcesFromHtml(html);
            if (!dataUrls.length && !filePaths.length) {
              // Images are HTTPS URLs — can't embed without network access.
              showDropHint();
              return true;
            }
            dataUrls.forEach((url) => {
              const mime = url.split(';')[0].slice(5); // 'data:image/png;...' → 'image/png'
              resizeAndEmbedDataUrl(url, mime, editorInstance).catch((err) =>
                console.error('[mini-diarium] image embed failed:', err),
              );
            });
            filePaths.forEach((path) =>
              resizeAndEmbedPath(path, editorInstance).catch((err) =>
                console.error('[mini-diarium] image embed failed:', err),
              ),
            );
            return true;
          }

          return false;
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
      setIsDragOver(false);
      const imagePaths = event.payload.paths.filter((p) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(p));
      imagePaths.forEach((path) =>
        resizeAndEmbedPath(path, editorInstance).catch((err) =>
          console.error('[mini-diarium] image embed failed:', err),
        ),
      );
    }).then((fn) => {
      unlistenDragDrop = fn;
    });

    listen('tauri://drag-enter', () => setIsDragOver(true)).then((fn) => {
      unlistenDragEnter = fn;
    });
    listen('tauri://drag-leave', () => setIsDragOver(false)).then((fn) => {
      unlistenDragLeave = fn;
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
    unlistenDragEnter?.();
    unlistenDragLeave?.();
    clearTimeout(dropHintTimer);
  });

  return (
    <div
      class={`rounded-lg border bg-primary transition-colors duration-150 ${isDragOver() ? 'editor-drag-over' : 'border-primary'}`}
      style={{
        '--editor-font-size': `${preferences().editorFontSize}px`,
        '--editor-font-family': preferences().editorFontFamily ?? 'inherit',
      }}
      onDragOver={(e) => {
        const types = Array.from(e.dataTransfer?.types ?? []);
        if (types.includes('Files')) {
          // File drag from OS — we know we can handle it, show the ring.
          setIsDragOver(true);
          e.preventDefault();
        } else if (types.includes('text/html')) {
          // HTML payload drag — we can't read the data yet to know if it contains
          // embeddable images (getData is unavailable in dragover for security reasons),
          // so allow the drop without showing the ring to avoid a false promise.
          e.preventDefault();
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={() => setIsDragOver(false)}
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
        onImportMarkdown={props.onImportMarkdown}
      />
      <div class="p-4">
        <div ref={editorElement} />
      </div>
      <Show when={dropHint()}>
        <div class="mx-4 mb-3 rounded-md border border-primary bg-secondary p-2.5 flex items-start justify-between gap-2">
          <p class="text-xs text-secondary">{t('editor.dropRejectedWebImage')}</p>
          <button
            onClick={() => setDropHint(false)}
            class="text-xs text-tertiary hover:text-primary flex-shrink-0 leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </Show>
    </div>
  );
}
