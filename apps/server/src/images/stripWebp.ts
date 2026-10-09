const EXIF_FLAG = 0x08;
const XMP_FLAG = 0x04;
const PRIVATE_CHUNKS = new Set(['EXIF', 'XMP ']);

// The extended header says which chunks follow; it can't announce the ones removed.
function withoutMetadataFlags(chunk: Buffer): Buffer {
  const copy = Buffer.from(chunk);
  copy[8] = copy[8]! & ~(EXIF_FLAG | XMP_FLAG);
  return copy;
}

// Null when the bytes aren't a WebP. Keeps every frame of an animation.
export function stripWebp(bytes: Uint8Array): Uint8Array | null {
  const buffer = Buffer.from(bytes);
  const riff = buffer.toString('latin1', 0, 4) === 'RIFF';
  if (!riff || buffer.toString('latin1', 8, 12) !== 'WEBP') return null;
  const kept: Buffer[] = [];
  let at = 12;
  while (at + 8 <= buffer.length) {
    const size = buffer.readUInt32LE(at + 4);
    const end = at + 8 + size + (size % 2);
    if (end > buffer.length) break;
    const type = buffer.toString('latin1', at, at + 4);
    const chunk = buffer.subarray(at, end);
    if (type === 'VP8X') kept.push(withoutMetadataFlags(chunk));
    else if (!PRIVATE_CHUNKS.has(type)) kept.push(chunk);
    at = end;
  }
  const body = Buffer.concat(kept);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}
