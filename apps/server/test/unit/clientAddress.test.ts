import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { clientAddress, forwardedAddress } from '../../src/auth/clientAddress';

describe('forwardedAddress', () => {
  it('takes the entry the trusted proxies added, counting from the end', () => {
    expect(forwardedAddress('1.1.1.1, 2.2.2.2, 3.3.3.3', 1)).toBe('3.3.3.3');
    expect(forwardedAddress('1.1.1.1, 2.2.2.2, 3.3.3.3', 2)).toBe('2.2.2.2');
    expect(forwardedAddress(' 3.3.3.3 ', 1)).toBe('3.3.3.3');
  });

  it('takes the first entry when there are fewer than proxies, and none from an empty header', () => {
    expect(forwardedAddress('3.3.3.3', 2)).toBe('3.3.3.3');
    expect(forwardedAddress('', 1)).toBeNull();
    expect(forwardedAddress(undefined, 1)).toBeNull();
    expect(forwardedAddress(' , ', 1)).toBeNull();
  });
});

describe('clientAddress', () => {
  const app = (trustedProxies: number) =>
    new Hono().get('/', (c) => c.text(clientAddress(c, trustedProxies)));
  const ask = async (trustedProxies: number, forwarded?: string) =>
    (
      await app(trustedProxies).request('/', {
        headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded },
      })
    ).text();

  it('reads X-Forwarded-For only behind a trusted proxy', async () => {
    expect(await ask(1, '9.9.9.9, 3.3.3.3')).toBe('3.3.3.3');
    expect(await ask(0, '9.9.9.9, 3.3.3.3')).toBe('unknown');
  });

  it('falls back to the connection when the proxy sent no header', async () => {
    expect(await ask(1)).toBe('unknown');
  });
});
