import { describe, expect, it } from 'vitest';
import { derivePrefix, FALLBACK_PREFIX, resolvePrefix, uniquePrefix } from '../src/logic/prefix';

describe('derivePrefix', () => {
  it('takes the first three characters of a single word', () => {
    expect(derivePrefix('Website')).toBe('WEB');
  });

  it('keeps a single word shorter than three characters whole', () => {
    expect(derivePrefix('Go')).toBe('GO');
  });

  it('takes the initials of several words', () => {
    expect(derivePrefix('Mobile app')).toBe('MA');
    expect(derivePrefix('Customer support portal')).toBe('CSP');
  });

  it('caps initials at four characters', () => {
    expect(derivePrefix('One two three four')).toBe('OTTF');
    expect(derivePrefix('One two three four five six')).toBe('OTTF');
  });

  it('turns punctuation into word breaks', () => {
    expect(derivePrefix('Hello, world!')).toBe('HW');
    expect(derivePrefix('front-end/back.office')).toBe('FEBO');
    expect(derivePrefix('my_app')).toBe('MA');
  });

  it('keeps digits', () => {
    expect(derivePrefix('2048')).toBe('204');
    expect(derivePrefix('Project 2')).toBe('P2');
    expect(derivePrefix('Web3')).toBe('WEB');
  });

  it('ignores extra whitespace', () => {
    expect(derivePrefix('   Mobile \t  app  ')).toBe('MA');
  });

  it('treats letters outside A–Z as word breaks', () => {
    expect(derivePrefix('Café')).toBe('CAF');
  });

  it('falls back to PRJ when nothing is left', () => {
    expect(FALLBACK_PREFIX).toBe('PRJ');
    expect(derivePrefix('')).toBe('PRJ');
    expect(derivePrefix('   ')).toBe('PRJ');
    expect(derivePrefix('!!! ---')).toBe('PRJ');
    expect(derivePrefix('Проект')).toBe('PRJ');
    expect(derivePrefix('项目')).toBe('PRJ');
  });
});

describe('resolvePrefix', () => {
  it('uses the derived prefix when the input is blank', () => {
    expect(resolvePrefix('', 'Mobile app')).toBe('MA');
    expect(resolvePrefix('   ', 'Website')).toBe('WEB');
  });

  it('uppercases a typed prefix', () => {
    expect(resolvePrefix('mob', 'Mobile app')).toBe('MOB');
  });

  it('strips anything that is not A–Z or 0–9', () => {
    expect(resolvePrefix('m-o.b 2', 'Mobile app')).toBe('MOB2');
    expect(resolvePrefix('Wéb', 'Website')).toBe('WB');
  });

  it('keeps at most five characters', () => {
    expect(resolvePrefix('abcdefgh', 'Alphabet')).toBe('ABCDE');
  });

  it('falls back to PRJ when nothing is left of a typed prefix', () => {
    expect(resolvePrefix('--', 'Mobile app')).toBe('PRJ');
    expect(resolvePrefix('ñ', 'Mobile app')).toBe('PRJ');
  });

  it('falls back to PRJ when the name derives nothing', () => {
    expect(resolvePrefix('', '***')).toBe('PRJ');
  });
});

describe('uniquePrefix', () => {
  it('keeps a prefix that is free', () => {
    expect(uniquePrefix('MOB', new Set(['WEB']))).toBe('MOB');
  });

  it('adds 2 when the prefix is taken', () => {
    expect(uniquePrefix('MOB', new Set(['MOB']))).toBe('MOB2');
  });

  it('counts up until it finds a free prefix', () => {
    expect(uniquePrefix('MOB', new Set(['MOB', 'MOB2']))).toBe('MOB3');
    expect(uniquePrefix('MOB', new Set(['MOB', 'MOB2', 'MOB3', 'MOB4']))).toBe('MOB5');
  });

  it('keeps the first four characters of a long prefix before the number', () => {
    expect(uniquePrefix('ABCDE', new Set(['ABCDE']))).toBe('ABCD2');
    expect(uniquePrefix('ABCDE', new Set(['ABCDE', 'ABCD2']))).toBe('ABCD3');
  });

  it('gives MOB2 to a second project typed as mob', () => {
    const taken = new Set([uniquePrefix(resolvePrefix('mob', 'Mobile app'), new Set())]);

    expect(uniquePrefix(resolvePrefix('MOB', 'Mobile web'), taken)).toBe('MOB2');
  });
});
