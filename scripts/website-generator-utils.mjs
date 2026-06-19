function trimEdgeChar(value, char) {
  let start = 0;
  let end = value.length;

  while (start < end && value[start] === char) {
    start += 1;
  }

  while (end > start && value[end - 1] === char) {
    end -= 1;
  }

  return value.slice(start, end);
}

export function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function slugify(value) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return trimEdgeChar(normalized, '-');
}
