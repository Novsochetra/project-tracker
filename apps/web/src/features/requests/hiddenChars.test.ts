import { describe, expect, it } from 'vitest';
import { hasHidden, hasLookalike, markHidden, showHidden } from './hiddenChars';

describe('markHidden', () => {
  it('marks a bidi override, so the command reads in the order it runs', () => {
    expect(markHidden('echo A‮B')).toEqual([
      { kind: 'text', text: 'echo A' },
      { kind: 'hidden', text: '\\u{202E}' },
      { kind: 'text', text: 'B' },
    ]);
  });

  it('marks zero-width, control and line separator characters, and a carriage return', () => {
    const chars = ['⁦', '⁩', '​', '‍', '⁠', '﻿', '\u001B', '\u0000'];
    for (const char of [...chars, '\u000B', '\u0085', ' ', ' ', '\r', '؜']) {
      expect(hasHidden(`a${char}b`), JSON.stringify(char)).toBe(true);
    }
    expect(showHidden('a\r\nb\u001B[31m')).toBe('a\\u{D}\nb\\u{1B}[31m');
  });

  it('keeps tabs, newlines, emoji and other scripts as they are', () => {
    const text = 'echo\t"é 😀 日本"\nls';
    expect(markHidden(text)).toEqual([{ kind: 'text', text }]);
    expect(hasHidden(text)).toBe(false);
  });

  it('marks each of several in a row', () => {
    expect(showHidden('‮‮')).toBe('\\u{202E}\\u{202E}');
  });

  it('marks every character that draws nothing, one token per code point', () => {
    const zeroWidth = {
      'combining grapheme joiner': '͏',
      'hangul fillers': 'ᅟᅠㅤﾠ',
      'deprecated format characters': '⁪⁯',
      'variation selectors': '︀️',
      'interlinear annotation': '￹￻',
      'musical format characters': '\u{1D173}\u{1D17A}',
    };
    for (const [name, chars] of Object.entries(zeroWidth)) {
      const marks = markHidden(`a${chars}b`).filter((part) => part.kind === 'hidden');
      expect(marks, name).toHaveLength([...chars].length);
    }
    expect(showHidden('a\u{E0001}\u{E0041}\u{E007F}b')).toBe('a\\u{E0001}\\u{E0041}\\u{E007F}b');
    expect(showHidden('x\u{E0100}\u{E01EF}')).toBe('x\\u{E0100}\\u{E01EF}');
  });

  it('marks nothing in plain text, accents, CJK, Cyrillic or emoji without a selector', () => {
    for (const text of [
      'npm run test',
      'café naïve',
      '日本語のファイル',
      'привет мир',
      '😀 🚀 👍🏽',
    ]) {
      expect(hasHidden(text), text).toBe(false);
    }
  });

  it('marks the variation selector of an emoji that has one, as it does a joiner', () => {
    expect(showHidden('❤️')).toBe('❤\\u{FE0F}');
  });
});

describe('lookalike letters', () => {
  it('marks a letter of another script in a Latin word as its code', () => {
    expect(markHidden('curl p\u0430ypal.com')).toEqual([
      { kind: 'text', text: 'curl p' },
      { kind: 'lookalike', text: '\\u{430}' },
      { kind: 'text', text: 'ypal.com' },
    ]);
    expect(showHidden('g\u03BFogle')).toBe('g\\u{3BF}ogle');
    expect(hasLookalike('p\u0430ypal')).toBe(true);
    expect(hasHidden('p\u0430ypal')).toBe(false);
  });

  it('marks a hidden character as hidden, also inside a mixed word', () => {
    expect(markHidden('p\u0430\u200Bypal').map((part) => part.kind)).toEqual([
      'text',
      'lookalike',
      'hidden',
      'text',
    ]);
  });

  it('keeps a name in one script as it is', () => {
    expect(hasLookalike('cat отчёт.txt ឯកសារ.txt')).toBe(false);
  });
});
