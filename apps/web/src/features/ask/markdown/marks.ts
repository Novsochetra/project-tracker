import type { Mark, MarkToken, TextToken } from './tokens';

// A run of one mark, or a backslash before ASCII punctuation, which shows that character as text.
const MARKS = /\*+|_+|\\[!-/:-@[-`{-~]/g;
const SPACE = /\s/;
const WORD = /[\p{L}\p{N}]/u;

const isSpace = (char: string | undefined): boolean => char === undefined || SPACE.test(char);
const isWord = (char: string | undefined): boolean => char !== undefined && WORD.test(char);

function markToken(source: string, char: Mark, start: number, length: number): MarkToken {
  const before = source[start - 1];
  const after = source[start + length];
  // "_" inside a word, as in snake_case_names, is text; "*" there still marks emphasis.
  const inWord = char === '_';
  return {
    kind: 'mark',
    char,
    start,
    left: length,
    canOpen: !isSpace(after) && !(inWord && isWord(before)),
    canClose: !isSpace(before) && !(inWord && isWord(after)),
    opens: [],
    closes: [],
  };
}

export function splitMarks(source: string, token: TextToken): Array<TextToken | MarkToken> {
  const tokens: Array<TextToken | MarkToken> = [];
  const { text, start } = token;
  let from = 0;
  for (const match of text.matchAll(MARKS)) {
    const [mark] = match;
    if (match.index > from) {
      tokens.push({ kind: 'text', text: text.slice(from, match.index), start: start + from });
    }
    const at = start + match.index;
    if (mark.startsWith('\\')) tokens.push({ kind: 'text', text: mark.slice(1), start: at + 1 });
    else tokens.push(markToken(source, mark[0] as Mark, at, mark.length));
    from = match.index + mark.length;
  }
  if (from < text.length)
    tokens.push({ kind: 'text', text: text.slice(from), start: start + from });
  return tokens;
}
