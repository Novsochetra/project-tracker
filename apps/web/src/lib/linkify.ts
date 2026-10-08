export type LinkPart =
  { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

const CANDIDATE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TRAILING = /[.,;:!?*'"’”…]+$/;
const HAS_HOST = /^https?:\/\/[^/?#.]/i;
const OPENERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

const count = (text: string, char: string): number => text.split(char).length - 1;

// Punctuation after a link ends the sentence, not the link. A closing bracket stays only when the
// link opened it, like Wikipedia's "Swift_(programming_language)".
function trimLink(candidate: string): string {
  const link = candidate.replace(TRAILING, '');
  const last = link.at(-1) ?? '';
  const opener = OPENERS[last];
  if (opener && count(link, last) > count(link, opener)) return trimLink(link.slice(0, -1));
  return link;
}

// Splits plain text into text and http(s) links, so the text can be shown as React nodes and
// never becomes markup.
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
