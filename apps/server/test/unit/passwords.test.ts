import { describe, expect, it } from 'vitest';
import { DEFAULT_SCRYPT, hashPassword, verifyPassword } from '../../src/auth/passwords';
import { CHEAP_SCRYPT } from '../helpers/auth';

describe('passwords', () => {
  it('stores scrypt with its parameters and a random salt, never the password', async () => {
    const first = await hashPassword('correct horse battery', CHEAP_SCRYPT);
    const second = await hashPassword('correct horse battery', CHEAP_SCRYPT);
    expect(first).toMatch(/^scrypt\$1024\$8\$1\$[\w-]{22}\$[\w-]{86}$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain('horse');
  });

  it('accepts the right password and refuses others', async () => {
    const stored = await hashPassword('correct horse battery', CHEAP_SCRYPT);
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('correct horse batterY', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('treats the same text in another Unicode form as the same password', async () => {
    const stored = await hashPassword('café au lait 42', CHEAP_SCRYPT);
    expect(await verifyPassword('café au lait 42', stored)).toBe(true);
  });

  it('refuses a stored value it cannot read', async () => {
    for (const stored of [
      '',
      'plain',
      'bcrypt$1$2$3$a$b',
      'scrypt$x$8$1$a$b',
      'scrypt$1024$8$1$a$',
    ]) {
      expect(await verifyPassword('anything', stored), stored).toBe(false);
    }
  });

  it('uses scrypt N=2^15, r=8 by default, which needs more than Node allows unless asked', async () => {
    expect(DEFAULT_SCRYPT).toEqual({ N: 32768, r: 8, p: 1 });
    const stored = await hashPassword('correct horse battery');
    expect(stored.startsWith('scrypt$32768$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
  });
});
