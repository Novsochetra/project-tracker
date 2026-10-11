const HEADER_BYTES = 128;
const TAG_ENTRY_BYTES = 12;
const ACSP = Buffer.from('acsp', 'latin1');

interface Span {
  start: number;
  end: number;
}

function tagSpans(profile: Buffer): Span[] | null {
  if (profile.length < HEADER_BYTES + 4) return null;
  const tableEnd = HEADER_BYTES + 4 + profile.readUInt32BE(HEADER_BYTES) * TAG_ENTRY_BYTES;
  if (tableEnd > profile.length) return null;
  const spans: Span[] = [{ start: 0, end: tableEnd }];
  for (let at = HEADER_BYTES + 4; at < tableEnd; at += TAG_ENTRY_BYTES) {
    const start = profile.readUInt32BE(at + 4);
    const end = start + profile.readUInt32BE(at + 8);
    if (start < tableEnd || end > profile.length) return null;
    spans.push({ start, end });
  }
  return spans.sort((a, b) => a.start - b.start);
}

// The spec pads each tag with up to 3 zero bytes; anything more is read by no one.
const isPadding = (gap: Buffer) => gap.length < 4 && gap.every((byte) => byte === 0);

// Tags may share their data, so spans can overlap; only bytes no span covers are checked.
function hasOnlyPaddingOutside(profile: Buffer, spans: Span[]): boolean {
  let covered = 0;
  for (const { start, end } of spans) {
    if (start > covered && !isPadding(profile.subarray(covered, start))) return false;
    covered = Math.max(covered, end);
  }
  return isPadding(profile.subarray(covered));
}

// A profile kept as it came must hold nothing but what a color reader reads: a header that says
// its size, a tag table, and tags.
export function isWellFormedIccProfile(profile: Buffer): boolean {
  if (profile.length < HEADER_BYTES || profile.readUInt32BE(0) !== profile.length) return false;
  if (!profile.subarray(36, 40).equals(ACSP)) return false;
  const spans = tagSpans(profile);
  return spans !== null && hasOnlyPaddingOutside(profile, spans);
}
