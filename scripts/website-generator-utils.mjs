import { readFileSync } from 'node:fs';

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

function readSvgDimensions(buffer) {
  const svgMatch = buffer.toString('utf8').match(/<svg\b[^>]*>/);
  if (!svgMatch) {
    return null;
  }

  const rootTag = svgMatch[0];
  const widthMatch = rootTag.match(/\bwidth="([\d.]+)/);
  const heightMatch = rootTag.match(/\bheight="([\d.]+)/);
  if (!widthMatch || !heightMatch) {
    return null;
  }

  const width = Math.round(parseFloat(widthMatch[1]));
  const height = Math.round(parseFloat(heightMatch[1]));
  if (!width || !height) {
    return null;
  }

  return { width, height };
}

function readWebpDimensions(buffer) {
  if (
    buffer.length < 16 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }

  const fourCC = buffer.toString('ascii', 12, 16);

  if (fourCC === 'VP8 ' && buffer.length >= 30) {
    // Lossy: frame tag (3 bytes) + start code (3 bytes) precede the
    // 14-bit width/height fields (top 2 bits of each 16-bit value are scale).
    const rawWidth = buffer.readUInt16LE(26);
    const rawHeight = buffer.readUInt16LE(28);
    return { width: rawWidth & 0x3fff, height: rawHeight & 0x3fff };
  }

  if (fourCC === 'VP8L' && buffer.length >= 25) {
    // Lossless: 1-byte signature (0x2F) then a 32-bit LE bitfield packing
    // 14-bit width-1, 14-bit height-1, plus alpha/version bits.
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }

  if (fourCC === 'VP8X' && buffer.length >= 30) {
    // Extended: 1-byte flags + 3 reserved, then 24-bit width-1, 24-bit height-1.
    const width = buffer.readUIntLE(24, 3) + 1;
    const height = buffer.readUIntLE(27, 3) + 1;
    return { width, height };
  }

  return null;
}

export function readImageDimensions(absoluteFilePath) {
  let buffer;
  try {
    buffer = readFileSync(absoluteFilePath);
  } catch {
    return null;
  }

  try {
    if (absoluteFilePath.toLowerCase().endsWith('.svg')) {
      return readSvgDimensions(buffer);
    }

    if (absoluteFilePath.toLowerCase().endsWith('.webp')) {
      return readWebpDimensions(buffer);
    }
  } catch {
    return null;
  }

  return null;
}
