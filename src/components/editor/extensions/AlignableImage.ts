import { mergeAttributes } from '@tiptap/core';
import { Image as TiptapImage } from '@tiptap/extension-image';

// AlignableImage wraps every image in a <figure> container so that TextAlign's
// style="text-align: X" is applied to the container (a block element), not to
// the <img> itself. The <img> is display:inline-block so it responds to the
// parent's text-align — the generic container model.
export const AlignableImage = TiptapImage.extend({
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
