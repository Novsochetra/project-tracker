import { describe, expect, it } from 'vitest';
import { isPersonWord } from '../src/domain/actor';

describe('isPersonWord', () => {
  it.each(['You', 'user', ' USER ', 'yOu'])('knows %j names the person', (name) => {
    expect(isPersonWord(name)).toBe(true);
  });

  it.each([
    ['full-width letters', 'ＵＳＥＲ'],
    ['a zero-width space', 'User​'],
    ['a zero-width joiner inside', 'Y‍ou'],
    ['a soft hyphen', 'Us­er'],
    ['a byte order mark', '﻿you'],
  ])('knows it through %s', (_how, name) => {
    expect(isPersonWord(name)).toBe(true);
  });

  it.each(['Claude', 'Agent', 'Users', 'Youssef', 'Claude user', ''])('lets %j be', (name) => {
    expect(isPersonWord(name)).toBe(false);
  });

  // Accepted: catching every lookalike from another script would need a confusables table, and an
  // agent named so still shows the agent avatar in the web.
  it('lets a Cyrillic lookalike be', () => {
    expect(isPersonWord('Уser')).toBe(false);
  });
});
