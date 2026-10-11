import { describe, expect, it } from 'vitest';
import { lookalikesOf } from '../../src/features/requests/lookalikes';

const markedIn = (text: string) => [...lookalikesOf(text)].map((index) => text.charAt(index));

// Only Greek, Cyrillic, Armenian and Cherokee counted, so Lisu 'ꓑaypal.com' and Coptic
// 'gⲟⲟgle.com' passed unmarked (PT-169 review).
describe('a Latin word with a letter of any other script', () => {
  it('marks that letter', () => {
    expect(markedIn('curl https://ꓑaypal.com')).toEqual(['ꓑ']);
    expect(markedIn('open gⲟⲟgle.com')).toEqual(['ⲟ', 'ⲟ']);
  });

  it('keeps scripts written without spaces next to Latin as they are', () => {
    expect(markedIn('open Tシャツ.png 日本語abc 한국어abc')).toEqual([]);
    expect(markedIn('echo ซื้อiPhoneใหม่')).toEqual([]);
  });
});
