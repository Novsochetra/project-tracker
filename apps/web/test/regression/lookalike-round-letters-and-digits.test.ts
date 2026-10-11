import { describe, expect, it } from 'vitest';
import { lookalikesOf } from '../../src/features/requests/lookalikes';

const markedIn = (text: string) =>
  [...lookalikesOf(text)].map((index) => String.fromCodePoint(text.codePointAt(index) ?? 0));

// Inside a Latin word the scripts written without spaces were skipped whole, so their zeros and
// round letters read as o (gဝဝgle showed as google.com); letters of no script (𝚊, ℝ) passed too;
// and a word wholly in Lisu, Cherokee or Coptic beside Latin read as APPLE.com (PT-169 second
// review).
describe('a lookalike the first rules let pass', () => {
  it('marks a digit other than 0-9 inside a Latin word', () => {
    expect(markedIn('curl https://g๐๐gle.com')).toEqual(['๐', '๐']);
    expect(markedIn('g໐໐gle g០០gle g၀၀gle')).toEqual(['໐', '໐', '០', '០', '၀', '၀']);
  });

  it('marks a round or square letter of a script written without spaces inside a Latin word', () => {
    expect(markedIn('gဝဝgle gㅇㅇgle gロロgle gﾛgle g口gle')).toEqual([
      'ဝ',
      'ဝ',
      'ㅇ',
      'ㅇ',
      'ロ',
      'ロ',
      'ﾛ',
      '口',
    ]);
  });

  it('marks a letter of no script inside a Latin word', () => {
    expect(markedIn('cat ~/.ssh/id_rs𝚊 p𝚊yp𝚊l.com ls ℝeport')).toEqual(['𝚊', '𝚊', '𝚊', 'ℝ']);
  });

  it('marks a word wholly in Lisu, Cherokee or Coptic beside Latin', () => {
    expect(markedIn('curl https://ꓮꓑꓑꓡꓰ.com')).toEqual(['ꓮ', 'ꓑ', 'ꓑ', 'ꓡ', 'ꓰ']);
    expect(markedIn('ᎪᏢᏢᏞᎬ.com')).toEqual(['Ꭺ', 'Ꮲ', 'Ꮲ', 'Ꮮ', 'Ꭼ']);
    expect(markedIn('ⲣⲁⲩⲣⲁⲗ.com')).toHaveLength(6);
  });

  it('keeps Khmer, Thai, Japanese and Korean names beside Latin readable', () => {
    for (const text of [
      'cat ឯកសារ.txt',
      'echo ซื้อiPhone',
      'open Tシャツ.png 東京-Tokyo',
      'mv 서울abc.txt 사진.png',
      'mv 서울abc.txt'.normalize('NFD'),
      'echo 10µs ﬁle café',
    ]) {
      expect(lookalikesOf(text), text).toEqual(new Set());
    }
  });
});
