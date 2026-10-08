import { describe, expect, it } from 'vitest';
import { linkParts } from '../../src/lib/linkify';

// Reviewer 32 (PT-55): Chinese text quotes with “ ”, and CJK letters stay in a link, so
// "请看https://x.dev/a“谢谢”" linked https://x.dev/a“谢谢. A straight " already ended a link; its
// curly forms, which iOS types for it, didn't.

const links = (text: string) =>
  linkParts(text).flatMap((part) => (part.kind === 'link' ? [part.href] : []));

describe('regression: curly quotes end a link', () => {
  it('ends a link at an opening or closing curly double quote', () => {
    expect(links('请看https://x.dev/a“谢谢”')).toEqual(['https://x.dev/a']);
    expect(links('他说“https://x.dev/b”很好')).toEqual(['https://x.dev/b']);
    expect(links('See “https://x.dev/c”, then https://x.dev/d”more')).toEqual([
      'https://x.dev/c',
      'https://x.dev/d',
    ]);
  });

  it('ends a link at an opening curly single quote, but keeps a curly apostrophe inside', () => {
    expect(links('请看https://x.dev/e‘谢谢’')).toEqual(['https://x.dev/e']);
    expect(links('https://x.dev/rock’n’roll.')).toEqual(['https://x.dev/rock’n’roll']);
  });

  it('keeps the rest of the text as written', () => {
    const text = '请看https://x.dev/a“谢谢”';
    expect(linkParts(text)).toEqual([
      { kind: 'text', text: '请看' },
      { kind: 'link', text: 'https://x.dev/a', href: 'https://x.dev/a' },
      { kind: 'text', text: '“谢谢”' },
    ]);
  });
});
