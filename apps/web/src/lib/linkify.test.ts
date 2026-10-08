import { describe, expect, it } from 'vitest';
import { linkParts } from './linkify';

const links = (text: string) =>
  linkParts(text).flatMap((part) => (part.kind === 'link' ? [part.href] : []));

describe('linkParts', () => {
  it('splits text into text and http(s) links', () => {
    const pr = 'https://github.com/example/mobile-app/pull/42';
    const build = 'https://preview.example.com/build/123';
    expect(linkParts(`Opened a PR: ${pr} - preview build at ${build}`)).toEqual([
      { kind: 'text', text: 'Opened a PR: ' },
      { kind: 'link', text: pr, href: pr },
      { kind: 'text', text: ' - preview build at ' },
      { kind: 'link', text: build, href: build },
    ]);
  });

  it('leaves punctuation after a link out of it', () => {
    expect(links('see https://x.dev/a.')).toEqual(['https://x.dev/a']);
    expect(links('(https://x.dev/b)')).toEqual(['https://x.dev/b']);
    expect(links('Done: https://x.dev/c, then https://x.dev/d!')).toEqual([
      'https://x.dev/c',
      'https://x.dev/d',
    ]);
    expect(links('"https://x.dev/e" and ‘https://x.dev/f’?')).toEqual([
      'https://x.dev/e',
      'https://x.dev/f',
    ]);
    expect(links('(see https://x.dev/g).')).toEqual(['https://x.dev/g']);
  });

  it('keeps parentheses that belong to the link', () => {
    const swift = 'https://en.wikipedia.org/wiki/Swift_(programming_language)';
    expect(links(swift)).toEqual([swift]);
    expect(links(`(see ${swift})`)).toEqual([swift]);
  });

  it('keeps ports, query strings and fragments', () => {
    expect(links('http://localhost:4100/p/MOB/3?tab=1&x=y#activity')).toEqual([
      'http://localhost:4100/p/MOB/3?tab=1&x=y#activity',
    ]);
  });

  it('leaves Markdown and code marks around a link out of it', () => {
    expect(links('**https://x.dev/a** and `https://x.dev/b`')).toEqual([
      'https://x.dev/a',
      'https://x.dev/b',
    ]);
    expect(links('<https://x.dev/c> [PR](https://x.dev/pr/1)')).toEqual([
      'https://x.dev/c',
      'https://x.dev/pr/1',
    ]);
  });

  it('only links http and https addresses with a host', () => {
    expect(
      links('ftp://x.dev javascript:alert(1) mailto:a@b.c file:///etc www.x.dev xhttps://x.dev'),
    ).toEqual([]);
    expect(links('https:// and https://. alone')).toEqual([]);
    expect(links('HTTPS://Example.com/A')).toEqual(['HTTPS://Example.com/A']);
  });

  it('keeps every other character of the text as written', () => {
    const text = 'a\n  https://x.dev/a.\n<b>not markup</b> &amp; (https://x.dev/b)';
    expect(
      linkParts(text)
        .map((part) => part.text)
        .join(''),
    ).toBe(text);
  });

  it('returns plain text alone', () => {
    expect(linkParts('No links here.')).toEqual([{ kind: 'text', text: 'No links here.' }]);
    expect(linkParts('')).toEqual([]);
  });
});
