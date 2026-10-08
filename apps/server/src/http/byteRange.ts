import type { ByteRange } from '../storage/fileStorage';

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/i;

function suffixRange(length: number, size: number): ByteRange | 'unsatisfiable' {
  if (length === 0 || size === 0) return 'unsatisfiable';
  return { start: Math.max(0, size - length), end: size - 1 };
}

// Null sends the whole file: RFC 9110 lets a server ignore ranges it doesn't serve, and players
// only ask for one range at a time.
export function parseByteRange(
  header: string | undefined,
  size: number,
): ByteRange | 'unsatisfiable' | null {
  const match = SINGLE_RANGE.exec(header?.trim() ?? '');
  const [, first = '', last = ''] = match ?? [];
  if (!match || (first === '' && last === '')) return null;
  if (first === '') return suffixRange(Number(last), size);
  const start = Number(first);
  const end = last === '' ? Infinity : Number(last);
  if (end < start) return null;
  if (start >= size) return 'unsatisfiable';
  return { start, end: Math.min(end, size - 1) };
}
