import { Node, mergeAttributes } from '@tiptap/core';
import { createRoot, createEffect } from 'solid-js';
import {
  entryAttachments,
  attachmentsLoaded,
  requestSaveAttachmentCopy,
} from '../../../state/entryAttachments';

export interface AttachmentRefOptions {
  /** Label for a ref whose attachment is no longer linked to the entry. */
  missingLabel: () => string;
  /** Tooltip for a resolved ref. */
  titleFor: (name: string) => string;
  /** Accessible name for a resolved ref (it acts as a "save a copy" button). */
  ariaLabelFor: (name: string) => string;
  /** Accessible name for a ref while the entry's attachment list is still loading. */
  loadingLabel: () => string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachmentRef: {
      /** Inserts an inline reference to one of the entry's attachments. No-op when read-only. */
      insertAttachmentRef: (attachmentId: number) => ReturnType;
    };
  }
}

/** Parses a positive integer id from the attribute, or null. */
export function parseAttachmentRefId(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  const id = Number(value.trim());
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Inline pointer to an attachment of the same entry (TODO-0114). Serialized as
 * `<span data-attachment-ref="N"></span>` — the id only. The name is resolved at render
 * time from the entry's attachment list, so the node never owns the attachment: removing
 * the attachment leaves the ref in place, rendered as "missing".
 */
export const AttachmentRef = Node.create<AttachmentRefOptions>({
  name: 'attachmentRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      missingLabel: () => 'Missing attachment',
      titleFor: (name: string) => name,
      ariaLabelFor: (name: string) => `Save a copy of ${name}`,
      loadingLabel: () => 'Loading attachment',
    };
  },

  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          parseAttachmentRefId(el.getAttribute('data-attachment-ref')),
        renderHTML: (attrs: { attachmentId: number | null }) =>
          attrs.attachmentId === null ? {} : { 'data-attachment-ref': String(attrs.attachmentId) },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-attachment-ref]',
        // Above the TextStyle span rule, so a ref span never parses as a styled text run.
        priority: 100,
        getAttrs: (el) =>
          parseAttachmentRefId((el as HTMLElement).getAttribute('data-attachment-ref')) === null
            ? false
            : null,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Keep only the id attribute: names are resolved at render time, never stored.
    return ['span', mergeAttributes(HTMLAttributes)];
  },

  renderText() {
    // Contributes no words to getText() (word count, empty check).
    return '';
  },

  addCommands() {
    return {
      insertAttachmentRef:
        (attachmentId: number) =>
        ({ editor, commands }) => {
          // setEditable(false) blocks typing only; a programmatic insert would still
          // change a locked entry, so refuse it here.
          if (!editor.isEditable) return false;
          return commands.insertContent({ type: this.name, attrs: { attachmentId } });
        },
    };
  },

  addNodeView() {
    return ({ node }) => {
      const id = node.attrs.attachmentId as number | null;
      const dom = document.createElement('span');
      dom.className = 'attachment-ref';
      dom.contentEditable = 'false';
      dom.setAttribute('data-attachment-ref', String(id ?? ''));

      const dispose = createRoot((disposeRoot) => {
        createEffect(() => {
          const attachment = entryAttachments().find((a) => a.id === id);
          const missing = !attachment && attachmentsLoaded();
          dom.classList.toggle('attachment-ref--missing', missing);
          dom.textContent = `📎 ${attachment ? attachment.name : missing ? this.options.missingLabel() : '…'}`;
          dom.title = attachment ? this.options.titleFor(attachment.name) : '';
          // Only a resolved ref is a control: it is a focusable button. A missing or
          // still-loading ref is a non-interactive image and leaves the tab order.
          dom.setAttribute('role', attachment ? 'button' : 'img');
          if (attachment) {
            dom.tabIndex = 0;
          } else {
            // Removing the tab stop does not move focus that is already here. A key on a
            // focused, now-inert ref would reach ProseMirror and edit at its old selection,
            // so drop focus to the page. Only when this ref owns it: focus elsewhere stays,
            // and the editor is not focused for the user. Blur first: an element that is
            // no longer focusable can ignore blur().
            if (dom.ownerDocument.activeElement === dom) dom.blur();
            dom.removeAttribute('tabindex');
          }
          // role="img" takes no name from its content, so every state sets one explicitly.
          dom.setAttribute(
            'aria-label',
            attachment
              ? this.options.ariaLabelFor(attachment.name)
              : missing
                ? this.options.missingLabel()
                : this.options.loadingLabel(),
          );
        });
        return disposeRoot;
      });

      // The id when it resolves to one of the entry's attachments, else null.
      const resolvedId = (): number | null =>
        id !== null && entryAttachments().some((a) => a.id === id) ? id : null;

      const handleClick = (event: MouseEvent) => {
        const target = resolvedId();
        if (target === null) return;
        event.preventDefault();
        requestSaveAttachmentCopy(target);
      };

      // Enter and Space activate the button on keydown (a native <button> activates on
      // Space at keyup; keydown lets one handler also stop the key). They stop here so
      // ProseMirror does not split the paragraph or type a space, and the document-level
      // shortcut handler never sees them. Saving a copy does not edit the entry, so it
      // also works when the editor is read-only (locked entry).
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.target !== dom || event.isComposing) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        // Combos with Ctrl/Cmd/Alt belong to the editor and app shortcuts.
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const target = resolvedId();
        if (target === null) return;
        event.preventDefault();
        event.stopPropagation();
        // A held key auto-repeats; open one save dialog, not one per repeat.
        if (event.repeat) return;
        requestSaveAttachmentCopy(target);
      };

      dom.addEventListener('click', handleClick);
      dom.addEventListener('keydown', handleKeyDown);

      return {
        dom,
        // Atom: ProseMirror must not try to reconcile our DOM content.
        ignoreMutation: () => true,
        destroy: () => {
          dom.removeEventListener('click', handleClick);
          dom.removeEventListener('keydown', handleKeyDown);
          dispose();
        },
      };
    };
  },
});
