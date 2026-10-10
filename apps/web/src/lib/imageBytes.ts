export const HEAD_BYTES = 12;

const textAt = (head: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...head.subarray(from, to));

// Known by the same bytes as on the server (apps/server/src/images/sniffImage.ts), so both sides
// agree on which originals the server reads as JPEG or WebP and strips.
export function isJpegOrWebp(head: Uint8Array): boolean {
  if (head[0] === 0xff && head[1] === 0xd8) return true;
  return textAt(head, 0, 4) === 'RIFF' && textAt(head, 8, 12) === 'WEBP';
}
