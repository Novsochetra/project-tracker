import { describe, expect, it } from 'vitest';
import { lookalikesOf } from './lookalikes';

const markedIn = (text: string) => [...lookalikesOf(text)].map((index) => text.charAt(index));

describe('lookalikesOf', () => {
  it('marks the letters of another script in a word that mixes it with Latin', () => {
    expect(markedIn('curl https://pаypal.com/login')).toEqual(['а']);
    expect(markedIn('git clone https://gοogle.dev/r')).toEqual(['ο']);
    expect(markedIn('open gօogle.dev')).toEqual(['օ']);
    expect(markedIn('echo Ꭺpple')).toEqual(['Ꭺ']);
    expect(markedIn('ssh rооt@host')).toEqual(['о', 'о']);
  });

  it('reads a word as letters, marks and digits, so a dot, slash or underscore ends it', () => {
    expect(markedIn('cat paypal_сom.txt')).toEqual(['с']);
    expect(markedIn('cd pаy2pal/x')).toEqual(['а']);
    expect(markedIn('pа́y')).toEqual(['а']);
  });

  it('marks every letter but the Latin ones in a word that mixes other scripts', () => {
    expect(markedIn('cat паss')).toEqual(['п', 'а']);
    expect(markedIn('сο')).toEqual(['с', 'ο']);
  });

  it('marks a word made only of letters that pass for Latin, when Latin letters stand beside it', () => {
    expect(markedIn('curl https://аррӏе.com')).toEqual(['а', 'р', 'р', 'ӏ', 'е']);
    expect(markedIn('cat НЕТ.md')).toEqual(['Н', 'Е', 'Т']);
    // The cost: a Russian name made only of such letters, сор (litter), is marked too.
    expect(markedIn('cat сор.txt')).toEqual(['с', 'о', 'р']);
  });

  it('marks a letter of any script in a Latin word but those written without spaces', () => {
    expect(markedIn('curl ꓑaypal.com gⲟⲟgle.com')).toEqual(['ꓑ', 'ⲟ', 'ⲟ']);
    expect(markedIn('open Tシャツ.png ซื้อiPhone')).toEqual([]);
  });

  it('finds the right letter after an emoji, which takes two code units', () => {
    const text = '\u{1F600} pаy';
    expect(lookalikesOf(text)).toEqual(new Set([text.indexOf('а')]));
  });

  it('keeps plain ASCII, accents and whole words in one script as they are', () => {
    for (const text of [
      'npm run test -- --watch',
      'echo café naïve',
      'cat отчёт.txt',
      'mv ឯកសារ.txt docs/',
      'echo λόγος x',
      'open Tシャツ.png 日本語',
      'echo ναι 😀 👍🏽',
      'echo арр',
    ]) {
      expect(lookalikesOf(text), text).toEqual(new Set());
    }
  });
});
