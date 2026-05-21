import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export function getFirstStrongDir(text: string): 'ltr' | 'rtl' | null {
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
export const BidiExtension = Extension.create({
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
