/**
 * Extract all distinct font-family values referenced in inline style attributes
 * within an HTML string (e.g. from TipTap FontFamily extension output).
 *
 * Contract: calibrated for the exact output TipTap's FontFamily extension emits —
 * single-value names, optionally quoted, without CSS fallback lists or entity-escaped
 * quotes. It does NOT parse comma-separated stacks (`Noto Serif, serif`), HTML-entity
 * quotes (`&quot;`), or multi-property attributes with a preceding property (e.g.
 * `color:red; font-family: X` — the preceding property would be consumed). For those
 * formats a DOM parser is more reliable.
 *
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
