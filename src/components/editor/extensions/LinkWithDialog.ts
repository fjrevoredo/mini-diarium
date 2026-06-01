import { Link } from '@tiptap/extension-link';
import { openUrl } from '@tauri-apps/plugin-opener';

export interface LinkWithDialogStorage {
  openLinkDialog: () => void;
}

// Extends the TipTap Link mark with:
// - openOnClick: false so plain clicks position the caret (editable surface)
// - autolink + linkOnPaste left as TipTap defaults
// - HTMLAttributes adds rel/target so links emitted from setLink are still safe
// - Mod-k keyboard shortcut that opens the LinkOverlay via the storage callback,
//   which is wired up by EditorToolbar after construction
export const LinkWithDialog = Link.extend({
  addStorage() {
    return {
      openLinkDialog: () => {},
    } as LinkWithDialogStorage;
  },

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        const storage = this.storage as LinkWithDialogStorage;
        storage.openLinkDialog();
        return true;
      },
    };
  },
}).configure({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true,
  HTMLAttributes: {
    rel: 'noopener noreferrer nofollow',
    target: '_blank',
    class: null,
  },
});

// Opens the link's href in the system browser when the user Ctrl/Cmd-clicks
// a link inside the editor. Returns true to consume the event so ProseMirror's
// default click handling does not place the caret.
export function handleEditorLinkClick(event: MouseEvent): boolean {
  if (!(event.metaKey || event.ctrlKey)) return false;
  const target = event.target as HTMLElement | null;
  const anchor = target?.closest('a') as HTMLAnchorElement | null;
  if (!anchor) return false;
  const href = anchor.getAttribute('href');
  if (!href) return false;
  event.preventDefault();
  void openUrl(href).catch((err) => {
    console.error('[mini-diarium] failed to open link in system browser:', err);
  });
  return true;
}
