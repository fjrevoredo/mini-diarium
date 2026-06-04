import type { ImageData } from './tauri';

const IMAGE_REF_SRC_PATTERN = /(<img\b[^>]*\bsrc=)(["'])image-id:\/\/(\d+)\2/gi;

export function hasImageRefs(html: string): boolean {
  IMAGE_REF_SRC_PATTERN.lastIndex = 0;
  return IMAGE_REF_SRC_PATTERN.test(html);
}

export function resolveImageRefs(html: string, images: ImageData[]): string {
  if (images.length === 0) return html;

  const imagesById = new Map(images.map((img) => [String(img.id), img]));

  return html.replace(IMAGE_REF_SRC_PATTERN, (match, prefix: string, quote: string, id: string) => {
    const img = imagesById.get(id);
    if (!img) return match;

    const dataUrl = `data:${img.mime_type};base64,${img.data_base64}`;
    return `${prefix}${quote}${dataUrl}${quote}`;
  });
}
