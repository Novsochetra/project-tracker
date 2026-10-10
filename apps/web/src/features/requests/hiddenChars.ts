import { lookalikesOf } from './lookalikes';

export type ShownPart = { kind: 'text' | 'hidden' | 'lookalike'; text: string };

// Characters that draw nothing or act on the text around them: controls (Cc), format characters
// such as bidi overrides and zero-width joiners (Cf), line and paragraph separators, and every
// default ignorable (variation selectors, tags, hangul fillers), so a command could show one way
// and run another. Tabs and newlines stay layout. An emoji's variation selector shows marked too.
const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u;
const LAYOUT = new Set(['\t', '\n']);

const isHidden = (char: string): boolean => !LAYOUT.has(char) && HIDDEN.test(char);

const marked = (code: number): string => `\\u{${code.toString(16).toUpperCase()}}`;

// A lookalike letter shows as its code too: the code tells a Cyrillic а from a Latin a, a colour
// alone can't.
export function markHidden(text: string): ShownPart[] {
  const lookalikes = lookalikesOf(text);
  const parts: ShownPart[] = [];
  let plain = '';
  let at = 0;
  // By code point, so an astral tag or selector is one token.
  for (const char of text) {
    const kind = isHidden(char) ? 'hidden' : lookalikes.has(at) ? 'lookalike' : 'text';
    at += char.length;
    if (kind === 'text') {
      plain += char;
      continue;
    }
    if (plain) parts.push({ kind: 'text', text: plain });
    parts.push({ kind, text: marked(char.codePointAt(0) ?? 0) });
    plain = '';
  }
  if (plain) parts.push({ kind: 'text', text: plain });
  return parts;
}

const holds = (text: string, kind: ShownPart['kind']): boolean =>
  markHidden(text).some((part) => part.kind === kind);

export const hasHidden = (text: string): boolean => holds(text, 'hidden');

export const hasLookalike = (text: string): boolean => holds(text, 'lookalike');

// For a name or a one-line summary, where a marked span can't go.
export const showHidden = (text: string): string =>
  markHidden(text)
    .map((part) => part.text)
    .join('');
