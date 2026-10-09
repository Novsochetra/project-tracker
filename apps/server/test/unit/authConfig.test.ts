import { describe, expect, it } from 'vitest';
import { isLoopbackHost, loadAuthConfig, parseTrustProxy } from '../../src/authConfig';
import { loadConfig } from '../../src/config';

describe('auth config', () => {
  it('knows loopback hosts', () => {
    for (const host of ['127.0.0.1', 'localhost', '::1', '[::1]', '127.0.1.1', 'LOCALHOST']) {
      expect(isLoopbackHost(host), host).toBe(true);
    }
    for (const host of ['0.0.0.0', '::', '192.168.1.10', 'tracker.example.com', '']) {
      expect(isLoopbackHost(host), host).toBe(false);
    }
  });

  it('reads TRUST_PROXY as a number of proxies', () => {
    expect(parseTrustProxy(undefined)).toBe(0);
    expect(parseTrustProxy('')).toBe(0);
    expect(parseTrustProxy('false')).toBe(0);
    expect(parseTrustProxy('true')).toBe(1);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy(' 2 ')).toBe(2);
    expect(parseTrustProxy('-1')).toBe(0);
    expect(parseTrustProxy('lots')).toBe(0);
  });

  it('skips sign-in without an owner only on loopback, not behind a proxy, without a token', () => {
    expect(loadAuthConfig({}, '127.0.0.1').openWithoutOwner).toBe('local');
    expect(loadAuthConfig({}, '0.0.0.0').openWithoutOwner).toBe(false);
    expect(loadAuthConfig({ TRUST_PROXY: '1' }, '127.0.0.1').openWithoutOwner).toBe(false);
    expect(loadAuthConfig({ TRACKER_TOKEN: 'x' }, '127.0.0.1').openWithoutOwner).toBe(false);
  });

  it('makes cookies Secure in production and notes a leftover TRACKER_TOKEN', () => {
    expect(loadAuthConfig({ NODE_ENV: 'production' }, '0.0.0.0').secureCookies).toBe(true);
    expect(loadAuthConfig({}, '0.0.0.0').secureCookies).toBe(false);
    expect(loadAuthConfig({ TRACKER_TOKEN: 'x' }, '0.0.0.0').legacyToken).toBe(true);
  });

  it('is part of the server config, from HOST', () => {
    expect(loadConfig({}).auth.openWithoutOwner).toBe('local');
    expect(loadConfig({ HOST: '0.0.0.0', TRUST_PROXY: '1' }).auth).toEqual({
      openWithoutOwner: false,
      trustedProxies: 1,
      secureCookies: false,
      legacyToken: false,
    });
  });
});
