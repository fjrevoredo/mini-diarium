/**
 * Count words in an HTML string by stripping all tags first.
 * Mirrors the backend `count_words` which calls `strip_html_tags` before splitting.
 * Safe for entries with embedded base64 images — the regex replaces entire tags
 * (including all attributes) with a space, so base64 blobs are eliminated entirely.
 */
export function countWordsInHtml(html: string): number {
  return html
    .replace(/<[^>]*>/g, ' ') // strip tags, leave spaces
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Count words in a plain-text string (no HTML stripping needed).
 * Used with TipTap's `editor.getText()` output.
 */
export function countWordsFromText(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
