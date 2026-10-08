import { describe, expect, it } from 'vitest';
import { parseByteRange } from '../../src/http/byteRange';
import { contentDisposition } from '../../src/http/fileHeaders';

describe('parseByteRange', () => {
  it('reads the three single-range forms', () => {
    expect(parseByteRange('bytes=0-1', 10)).toEqual({ start: 0, end: 1 });
    expect(parseByteRange('bytes=7-', 10)).toEqual({ start: 7, end: 9 });
    expect(parseByteRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
    expect(parseByteRange('bytes=9-9', 10)).toEqual({ start: 9, end: 9 });
  });

  it('keeps ranges inside the file', () => {
    expect(parseByteRange('bytes=8-100', 10)).toEqual({ start: 8, end: 9 });
    expect(parseByteRange('bytes=-50', 10)).toEqual({ start: 0, end: 9 });
  });

  it('reads the unit in any case', () => {
    expect(parseByteRange('Bytes=0-1', 10)).toEqual({ start: 0, end: 1 });
  });

  it('marks ranges that start past the end, or ask for nothing, unsatisfiable', () => {
    expect(parseByteRange('bytes=10-', 10)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=10-20', 10)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=-0', 10)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=0-0', 0)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=-5', 0)).toBe('unsatisfiable');
  });

  it('ignores a missing, malformed or multi-part range, so the whole file is sent', () => {
    for (const header of [
      undefined,
      '',
      'bytes=0-1,4-5',
      'bytes=5-2',
      'items=0-1',
      'bytes=',
      'bytes=-',
      'bytes=a-b',
      'bytes=1.5-2',
      'bytes=0x1-2',
    ]) {
      expect(parseByteRange(header, 10), String(header)).toBeNull();
    }
  });
});

describe('contentDisposition', () => {
  it('shows the file inline under its own name', () => {
    expect(contentDisposition('shot.png')).toBe(
      `inline; filename="shot.png"; filename*=UTF-8''shot.png`,
    );
  });

  it('encodes other characters for filename* and replaces them in the plain fallback', () => {
    expect(contentDisposition('résumé (final).pdf')).toBe(
      `inline; filename="r_sum_ (final).pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9%20%28final%29.pdf`,
    );
    expect(contentDisposition('ការងារ 📄.txt')).toBe(
      `inline; filename="______ _.txt"; filename*=UTF-8''` +
        '%E1%9E%80%E1%9E%B6%E1%9E%9A%E1%9E%84%E1%9E%B6%E1%9E%9A%20%F0%9F%93%84.txt',
    );
  });

  it('never lets a name break out of the header', () => {
    expect(contentDisposition('say "hi"\\\r\n.txt')).toBe(
      `inline; filename="say _hi____.txt"; filename*=UTF-8''say%20%22hi%22%5C%0D%0A.txt`,
    );
    expect(contentDisposition("it's*.log")).toBe(
      `inline; filename="it's*.log"; filename*=UTF-8''it%27s%2A.log`,
    );
  });

  it('survives half of a surrogate pair', () => {
    expect(contentDisposition('cut\uD83D.txt')).toBe(
      `inline; filename="cut_.txt"; filename*=UTF-8''cut%EF%BF%BD.txt`,
    );
  });
});
