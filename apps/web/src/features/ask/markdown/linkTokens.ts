import { linkParts } from '../../../lib/linkify';
import type { AtomToken, TextToken } from './tokens';

// A label can't hold brackets or a line end, and the address no spaces or brackets, so every try
// stops at the next bracket and the whole text is read in linear time.
const MARKDOWN_LINK = /\[([^[\]\n]*)\]\((https?:\/\/[^\s()<>]+)\)/g;

type LinkToken = TextToken | AtomToken;

// The address must be one linkify would link whole, so both kinds of link follow the same rules.
const isWebLink = (href: string): boolean => {
  const [part, ...rest] = linkParts(href);
  return rest.length === 0 && part?.kind === 'link' && part.href === href;
};

function bareLinks(text: string, start: number, tokens: LinkToken[]): void {
  let at = start;
  for (const part of linkParts(text)) {
    if (part.kind === 'link') tokens.push({ kind: 'atom', inline: part });
    else tokens.push({ kind: 'text', text: part.text, start: at });
    at += part.text.length;
  }
}

// Only web addresses become links, by linkify's rules, so no other kind of address is ever opened.
export function linkTokens(source: string, start: number, end: number): LinkToken[] {
  const text = source.slice(start, end);
  const tokens: LinkToken[] = [];
  let from = 0;
  for (const match of text.matchAll(MARKDOWN_LINK)) {
    const [whole, label = '', href = ''] = match;
    if (!isWebLink(href)) continue;
    bareLinks(text.slice(from, match.index), start + from, tokens);
    tokens.push({ kind: 'atom', inline: { kind: 'link', text: label.trim() || href, href } });
    from = match.index + whole.length;
  }
  bareLinks(text.slice(from), start + from, tokens);
  return tokens;
}
