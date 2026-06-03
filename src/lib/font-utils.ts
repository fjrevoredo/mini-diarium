/**
 * Extract all distinct font-family values referenced in inline style attributes
 * within an HTML string (e.g. from TipTap FontFamily extension output).
 *
 * Handles both quoted values ("Merriweather") and unquoted names (sans-serif).
 * Returns an empty array when the input is empty or contains no font-family rules.
 */
export function extractFontFamiliesFromHtml(html: string): string[] {
  const families: string[] = [];
  const regex = /font-family:\s*["']([^"']+)["']|font-family:\s*([\w\s-]+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const family = (match[1] ?? match[2] ?? '').trim();
    if (family) families.push(family);
  }
  return families;
}
