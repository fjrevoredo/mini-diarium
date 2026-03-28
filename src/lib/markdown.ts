import { Marked } from 'marked';
import DOMPurify from 'dompurify';

// Isolated Marked instance — avoids global state mutations from marked.use() calls.
// gfm defaults to true in marked; listed explicitly for clarity.
// breaks: false — single line breaks stay as text; paragraph breaks produce <p> tags.
//   This is the correct default for diary markdown (not line-ending <br> per Slack/GH style).
const markedInstance = new Marked({
  gfm: true,
  breaks: false,
});

// Sanitization baked into the postprocess hook — the officially recommended pattern from
// marked.js docs. This ensures DOMPurify runs on every parse and cannot be bypassed.
markedInstance.use({
  hooks: {
    postprocess(html: string): string {
      // Layer 1: DOMPurify strips <script>, event handlers, and unsafe attributes that
      //          marked may pass through from raw HTML embedded in the .md source.
      // Layer 2: TipTap's ProseMirror schema drops any remaining unknown nodes.
      return DOMPurify.sanitize(html);
    },
  },
});

/**
 * Converts a Markdown string to sanitized HTML suitable for insertion into TipTap.
 * Returns synchronously — async:false is the default; do not set async:true here.
 */
export function parseMarkdownToHtml(markdown: string): string {
  return markedInstance.parse(markdown) as string;
}
