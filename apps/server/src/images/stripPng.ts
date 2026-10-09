const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Text (where tools write a place, a camera or a name), EXIF and the time it was last changed.
const PRIVATE_CHUNKS = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

// Null when the bytes aren't a PNG. Copies every other chunk as it is, up to IEND; anything after
// it, or a chunk cut off, is dropped.
export function stripPng(bytes: Uint8Array): Uint8Array | null {
  const buffer = Buffer.from(bytes);
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) return null;
  const kept: Uint8Array[] = [buffer.subarray(0, 8)];
  let at = 8;
  while (at + 12 <= buffer.length) {
    const end = at + 12 + buffer.readUInt32BE(at);
    if (end > buffer.length) break;
    const type = buffer.toString('latin1', at + 4, at + 8);
    if (!PRIVATE_CHUNKS.has(type)) kept.push(buffer.subarray(at, end));
    at = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(kept);
}
