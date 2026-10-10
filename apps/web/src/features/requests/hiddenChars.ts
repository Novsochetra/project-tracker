export type ShownPart = { kind: 'text'; text: string } | { kind: 'hidden'; text: string };

// Characters that change the order text reads in (bidi controls), take no room (zero width) or act
// as controls, so a command could show one way and run another. Tabs and newlines stay layout.
const HIDDEN_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x08],
  [0x0b, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x61c, 0x61c],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x2069],
  [0xfeff, 0xfeff],
];

const isHidden = (code: number): boolean =>
  HIDDEN_RANGES.some(([from, to]) => code >= from && code <= to);

const marked = (code: number): string => `\\u{${code.toString(16).toUpperCase()}}`;

export function markHidden(text: string): ShownPart[] {
  const parts: ShownPart[] = [];
  let plain = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (!isHidden(code)) {
      plain += char;
      continue;
    }
    if (plain) parts.push({ kind: 'text', text: plain });
    parts.push({ kind: 'hidden', text: marked(code) });
    plain = '';
  }
  if (plain) parts.push({ kind: 'text', text: plain });
  return parts;
}

export const hasHidden = (text: string): boolean =>
  markHidden(text).some((part) => part.kind === 'hidden');

// For a name or a one-line summary, where a marked span can't go.
export const showHidden = (text: string): string =>
  markHidden(text)
    .map((part) => part.text)
    .join('');
