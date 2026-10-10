export const SOS = 0xda;
export const EOI = 0xd9;

export interface JpegSegment {
  marker: number;
  start: number;
  end: number;
}

// libjpeg skips bytes that don't start a marker ("extraneous bytes") and shows the picture, so
// they mustn't end the walk.
function nextMarker(bytes: Buffer, from: number): number {
  let at = bytes.indexOf(0xff, from);
  while (at !== -1 && bytes[at + 1] === 0xff) at += 1;
  return at !== -1 && at + 1 < bytes.length ? at : -1;
}

// Scan data has no length to skip by. An FF in it is written FF 00, and restart markers belong to
// it, so neither ends it.
function scanEnd(bytes: Buffer, from: number): number {
  for (let at = bytes.indexOf(0xff, from); at !== -1; at = bytes.indexOf(0xff, at + 1)) {
    const next = bytes[at + 1];
    if (next === undefined) break;
    if (next !== 0x00 && next !== 0xff && (next < 0xd0 || next > 0xd7)) return at;
  }
  return bytes.length;
}

// Restart and TEM markers have no length, and FF 00 is no marker at all: none of them carries
// anything, and outside a scan they are stray.
const hasNoLength = (marker: number) =>
  marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

// libjpeg reads a length field below 2 as an empty segment and shows the picture, so it must not
// cut the length bytes off a segment that is kept (PT-146).
export const headerEnd = (bytes: Buffer, at: number) =>
  at + 2 + Math.max(2, bytes.readUInt16BE(at + 2));

// libjpeg stops at the end marker: what follows (an iPhone's depth or HDR images, an app's
// trailer) is no part of the picture.
export function* jpegSegments(bytes: Buffer): Generator<JpegSegment> {
  let at = nextMarker(bytes, 2);
  while (at !== -1) {
    const marker = bytes[at + 1]!;
    if (marker === EOI) {
      yield { marker, start: at, end: at + 2 };
      return;
    }
    if (hasNoLength(marker)) {
      at = nextMarker(bytes, at + 2);
      continue;
    }
    if (at + 4 > bytes.length) return;
    const header = headerEnd(bytes, at);
    if (header > bytes.length) return;
    const end = marker === SOS ? scanEnd(bytes, header) : header;
    yield { marker, start: at, end };
    at = nextMarker(bytes, end);
  }
}

export function countJpegScans(bytes: Uint8Array): number {
  let scans = 0;
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (const { marker } of jpegSegments(buffer)) if (marker === SOS) scans += 1;
  return scans;
}
