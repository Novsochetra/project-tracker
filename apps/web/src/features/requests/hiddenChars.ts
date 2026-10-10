export type ShownPart = { kind: 'text'; text: string } | { kind: 'hidden'; text: string };

// Characters that draw nothing or act on the text around them: controls (Cc), format characters
// such as bidi overrides and zero-width joiners (Cf), line and paragraph separators, and every
// default ignorable (variation selectors, tags, hangul fillers), so a command could show one way
// and run another. Tabs and newlines stay layout. An emoji's variation selector shows marked too.
const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/u;
const LAYOUT = new Set(['\t', '\n']);

const isHidden = (char: string): boolean => !LAYOUT.has(char) && HIDDEN.test(char);

const marked = (code: number): string => `\\u{${code.toString(16).toUpperCase()}}`;

export function markHidden(text: string): ShownPart[] {
  const parts: ShownPart[] = [];
  let plain = '';
  // By code point, so an astral tag or selector is one token.
  for (const char of text) {
    if (!isHidden(char)) {
      plain += char;
      continue;
    }
    if (plain) parts.push({ kind: 'text', text: plain });
    parts.push({ kind: 'hidden', text: marked(char.codePointAt(0) ?? 0) });
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
