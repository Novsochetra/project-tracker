import { describe, expect, it } from 'vitest';
import { inviteSecretOf } from './inviteSecret';

describe('inviteSecretOf', () => {
  it('reads the secret from the fragment of the invite link', () => {
    expect(inviteSecretOf('#abc_DEF-123')).toBe('abc_DEF-123');
  });

  it('is empty for an address without one', () => {
    expect(inviteSecretOf('')).toBe('');
    expect(inviteSecretOf('#')).toBe('');
  });
});
