import { describe, expect, it } from 'vitest';
import { linkSecretOf } from './linkSecret';

describe('linkSecretOf', () => {
  it('reads the secret from the fragment of the invite link', () => {
    expect(linkSecretOf('#abc_DEF-123')).toBe('abc_DEF-123');
  });

  it('is empty for an address without one', () => {
    expect(linkSecretOf('')).toBe('');
    expect(linkSecretOf('#')).toBe('');
  });
});
