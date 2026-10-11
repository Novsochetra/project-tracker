import { describe, expect, it } from 'vitest';
import { lookalikesOf } from '../../src/features/requests/lookalikes';

// Katakana ロ and Han 口 were marked in ordinary names (プロジェクトA, 人口data), and the long-vowel
// mark ー counted as a letter of no script (PT-169 third review). A round letter is marked only
// among Latin letters, and only math and letterlike symbols count as letters of no script.
describe('a Japanese or Chinese name beside Latin', () => {
  it('stays readable', () => {
    for (const text of [
      'cp プロジェクトA.docx ブログpost.md データv2.csv',
      'open ロゴv2.png ログlog.txt iPhoneロック画面.png プロフィールv2.jpg',
      'cat 人口data.csv 入口page.html ログ ｰx',
      'echo ဝယ်iPhone',
    ]) {
      expect(lookalikesOf(text), text).toEqual(new Set());
    }
  });

  it('still marks a round letter among Latin ones', () => {
    const text = 'g口口gle gロgle gဝgle p𝚊yp𝚊l';
    expect(lookalikesOf(text).size).toBe(6);
  });
});
