import { Link } from '@tiptap/extension-link';
import { openUrl } from '@tauri-apps/plugin-opener';
import { normalizeSafeLink } from '../../../lib/safe-links';

export interface LinkWithDialogStorage {
  openLinkDialog: () => void;
}

// Extends the TipTap Link mark with:
// - openOnClick: false so plain clicks position the caret (editable surface)
// - autolink + linkOnPaste left as TipTap defaults
// - `target` attribute's default overridden to null so new links do NOT
//   carry `target="_blank"` (see comment below)
// - Mod-k keyboard shortcut that opens the LinkOverlay via the storage
//   callback, which is wired up by EditorToolbar after construction
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

  // CRITICAL: TipTap's Link extension hardcodes `target: '_blank'` in its
  // default `HTMLAttributes` (see node_modules/@tiptap/extension-link/dist/
  // index.js line 241). A `configure({ HTMLAttributes: { class: null } })`
  // does a deep merge and does NOT remove the hardcoded `target`. We have
  // to override the schema's `target` attribute default to `null` directly
  // so the rendered `<a>` has no `target` attribute at all.
  //
  // Why we want no `target` attribute: in a Tauri WebView, clicking a
  // link with `target="_blank"` triggers the WebView's new-window
  // handling, which can hand the URL off to the system browser
  // (Tauri's `on_new_window: Deny` only denies the new window inside
  // the WebView — it doesn't fully prevent the external browser
  // fallback on all platforms). We want plain click to be a no-op (the
  // user can place the caret inside the link to edit it) and Ctrl/Cmd
  // click to be the explicit "open in browser" trigger via `openUrl()`.
  addAttributes() {
    const parentAttrs = this.parent?.() ?? {};
    return {
      ...parentAttrs,
      target: { default: null },
    };
  },
}).configure({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true,
  HTMLAttributes: {
    class: null,
  },
});

// If the modifier for opening links ever changes, update these two exports only.
export function isLinkOpenModifier(e: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return e.ctrlKey || e.metaKey;
}

export function getLinkOpenShortcutLabel(): string {
  const platform =
    (typeof navigator !== 'undefined'
      ? (navigator.userAgentData?.platform ?? navigator.platform)
      : '') ?? '';
  const isMac = /Mac/i.test(platform);
  return isMac ? 'Cmd+Click' : 'Ctrl+Click';
}

// Intercepts clicks on `<a>` elements inside the editor.
//
// Why this is needed even though `openOnClick: false` is set on the Link
// extension: when openOnClick is false, TipTap's own click plugin returns
// `false` from its handleClick WITHOUT calling event.preventDefault().
// The browser's default action for a click on an `<a>` is to navigate to
// its href, so without an explicit preventDefault the user would be
// navigated away every time they click a link in the editor.
//
// Behaviour:
//   - Click on a link (any modifier state): always preventDefault so the
//     browser does not navigate.
//   - Ctrl/Cmd-click on a link: open the URL in the system browser via
//     openUrl. Consume the event (return true).
//   - Plain click on a link: do NOT consume the event (return false) so
//     ProseMirror's default click handling can place the caret inside
//     the link for editing.
export function handleEditorLinkClick(event: MouseEvent): boolean {
  const target = event.target as HTMLElement | null;
  const anchor = target?.closest('a') as HTMLAnchorElement | null;
  if (!anchor) return false;

  // Always prevent the browser from following the link. Without this, even
  // an unhandled click (one that ProseMirror's default would normally
  // dismiss) would cause the WebView to navigate.
  event.preventDefault();

  if (isLinkOpenModifier(event)) {
    const href = normalizeSafeLink(anchor.getAttribute('href') ?? '');
    if (href) {
      void openUrl(href).catch((err) => {
        console.error('[mini-diarium] failed to open link in system browser:', err);
      });
    }
    return true;
  }

  // Plain click: let ProseMirror's default handling place the caret
  // inside the link so the user can edit it.
  return false;
}
