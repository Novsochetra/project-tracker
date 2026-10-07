import { describe, expect, it } from 'vitest';
import { initials } from '../../src/logic/avatar';

describe('initials', () => {
  it('never cuts an emoji second initial in half', () => {
    expect(initials('Dara 😀')).toBe('D😀');
  });

  it('keeps the second initial after an emoji first initial', () => {
    expect(initials('😀 Dara')).toBe('😀D');
  });

  it('keeps two astral-plane initials whole', () => {
    expect(initials('𝒜lice 𝒝ob')).toBe('𝒜𝒝');
  });
});
