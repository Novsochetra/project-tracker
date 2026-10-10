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
      // A word wholly in a lookalike script stays too, the accepted cost of a Russian name.
      'curl https://аррӏе.com',
    ]) {
      expect(lookalikesOf(text), text).toEqual(new Set());
    }
  });
});
