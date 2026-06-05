const ALLOWED_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel']);

export function normalizeSafeLink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const protocolMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (protocolMatch) {
    const protocol = protocolMatch[1].toLowerCase();
    return ALLOWED_PROTOCOLS.has(protocol) ? trimmed : null;
  }

  if (trimmed.includes('@') && !/\s/.test(trimmed)) {
    return `mailto:${trimmed}`;
  }

  if (/^\+?[\d\s().-]+$/.test(trimmed) && /\d/.test(trimmed)) {
    const cleaned = trimmed.replace(/[\s().-]/g, '');
    return `tel:${cleaned}`;
  }

  return `https://${trimmed}`;
}
