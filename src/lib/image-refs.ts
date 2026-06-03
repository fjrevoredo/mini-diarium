import type { ImageData } from './tauri';

export function hasImageRefs(html: string): boolean {
  return /image-id:\/\/\d+/.test(html);
}

export function resolveImageRefs(html: string, images: ImageData[]): string {
  let resolved = html;
  for (const img of images) {
    // Match exact IDs by requiring the closing quote after the ID,
    // so `image-id://5` does not match inside `image-id://50`.
    const pattern = new RegExp(`image-id://${img.id}(?=")`, 'g');
    const dataUrl = `data:${img.mime_type};base64,${img.data_base64}`;
    resolved = resolved.replace(pattern, dataUrl);
  }
  return resolved;
}
