import { describe, expect, it } from 'vitest';
import { hasHidden, markHidden, showHidden } from './hiddenChars';

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
});
