import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColor, initials } from '../src/logic/avatar';

// The prototype's `hue` from init-design/design/Main.dc.html, kept as the reference.
const AV = ['#5B5BD6', '#B4540A', '#18794E', '#C2298A', '#0B68CB', '#6E56CF'];
const prototypeHue = (name: string): string => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % AV.length;
  return AV[h] ?? '';
};

describe('initials', () => {
  it('takes the first letter of a single word', () => {
    expect(initials('Dara')).toBe('D');
  });

  it('takes the first letters of two words', () => {
    expect(initials('Sophea Chan')).toBe('SC');
  });

  it('stops at two letters for three or more words', () => {
    expect(initials('Mary Jane Watson')).toBe('MJ');
    expect(initials('a b c d')).toBe('AB');
  });

  it('ignores extra spaces', () => {
    expect(initials('   dara \t  chan  ')).toBe('DC');
  });

  it('uppercases lowercase names', () => {
    expect(initials('vanna')).toBe('V');
    expect(initials('zoë émile')).toBe('ZÉ');
  });

  it('returns an empty string for a blank name', () => {
    expect(initials('')).toBe('');
    expect(initials('   ')).toBe('');
  });

  it('keeps emoji and other surrogate pairs whole', () => {
    expect(initials('😀')).toBe('😀');
    expect(initials('😀 Dara')).toBe('😀D');
    expect(initials('Dara 😀')).toBe('D😀');
    expect(initials('𝒜lice 𝒝ob')).toBe('𝒜𝒝');
  });

  it('keeps letters of other scripts', () => {
    expect(initials('李 雷')).toBe('李雷');
  });
});

describe('avatarColor', () => {
  it.each([
    ['Max', '#5B5BD6'],
    ['Kim', '#B4540A'],
    ['Sophea', '#18794E'],
    ['Bo', '#C2298A'],
    ['Dara', '#0B68CB'],
    ['李雷', '#6E56CF'],
  ])('gives %s the color %s', (name, color) => {
    expect(avatarColor(name)).toBe(color);
  });

  it.each(['Dara', 'Sophea', 'Vanna', 'Claude Code', 'Zoë', '😀 Dara', 'a', 'x'.repeat(500)])(
    'matches the prototype hue (sum of UTF-16 char codes % 6) for %j',
    (name) => {
      expect(avatarColor(name)).toBe(prototypeHue(name));
    },
  );

  it('ignores spaces around the name, like the prototype', () => {
    expect(avatarColor('  Dara ')).toBe(avatarColor('Dara'));
  });

  it('always returns a palette color', () => {
    expect(AVATAR_COLORS).toEqual(AV);
    expect(AVATAR_COLORS).toContain(avatarColor(''));
  });
});
