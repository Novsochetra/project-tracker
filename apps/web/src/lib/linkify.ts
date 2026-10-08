export type LinkPart =
  { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

// CJK punctuation ends a link like a space does, because CJK text has no spaces around it
// ("请看https://x.dev/a。谢谢"). CJK letters stay, as in https://ja.wikipedia.org/wiki/東京. Curly
// double quotes end it like a straight one ("请看https://x.dev/a“谢谢”"), and so does an opening
// curly single quote; a closing one stays inside, where it is an apostrophe typed as ’.
const CANDIDATE = /\bhttps?:\/\/[^\s<>"“”‘`、。，．：；！？（）「」『』【】〈〉《》〔〕｡｢｣､]+/gi;
const HAS_HOST = /^https?:\/\/[^/?#.]/i;
const TRAILING = new Set('.,;:!?*\'"’”…');
const BRACKETS = [
  ['(', ')'],
  ['[', ']'],
  ['{', '}'],
] as const;

const count = (text: string, char: string): number => text.split(char).length - 1;

const unopenedClosers = (link: string): Map<string, number> =>
  new Map(BRACKETS.map(([open, close]) => [close, count(link, close) - count(link, open)]));

// Punctuation after a link ends the sentence, not the link. A closing bracket stays only when the
// link opened it, like Wikipedia's "Swift_(programming_language)". One pass from the end with the
// bracket counts taken once, so text of any length trims in linear time.
function trimLink(candidate: string): string {
  const unopened = unopenedClosers(candidate);
  let end = candidate.length;
  while (end > 0) {
    const char = candidate.charAt(end - 1);
    const closers = unopened.get(char) ?? 0;
    if (closers > 0) unopened.set(char, closers - 1);
    else if (!TRAILING.has(char)) break;
    end -= 1;
  }
  return candidate.slice(0, end);
}

// Parts rather than HTML, so the text is shown as React nodes and never becomes markup.
export function linkParts(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let start = 0;
  for (const match of text.matchAll(CANDIDATE)) {
    const link = trimLink(match[0]);
    if (!HAS_HOST.test(link)) continue;
    if (match.index > start) parts.push({ kind: 'text', text: text.slice(start, match.index) });
    parts.push({ kind: 'link', text: link, href: link });
    start = match.index + link.length;
  }
  if (start < text.length) parts.push({ kind: 'text', text: text.slice(start) });
  return parts;
}
