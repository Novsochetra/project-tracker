import { describe, expect, it } from 'vitest';
import { avatarColor, initials } from '../../src/logic/avatar';

describe('regression: initials use letters and digits only', () => {
  it.each([
    ['Claude (lead)', 'CL'],
    ['Claude (project screen)', 'CP'],
    ['@sam o', 'SO'],
    ['Dara', 'D'],
    ['( ) Vanna', 'V'],
    ['R2 d2', 'RD'],
    ['--', ''],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('keeps avatar colors unchanged', () => {
    expect(avatarColor('Claude (lead)')).toBe(avatarColor(' Claude (lead) '));
  });
});
