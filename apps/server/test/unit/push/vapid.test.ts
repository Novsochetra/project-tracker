import { createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { vapidAuthorization, vapidToken } from '../../../src/push/vapidJwt';
import { generateVapidKeys, signingKeyOf } from '../../../src/push/vapidKeys';

const NOW = Date.UTC(2026, 9, 13, 12);
const ENDPOINT = 'https://web.push.apple.com/QK1-abc?x=1';

const decode = (part: string): unknown => JSON.parse(Buffer.from(part, 'base64url').toString());

function publicKeyOf(raw: string) {
  const point = Buffer.from(raw, 'base64url');
  return createPublicKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: point.subarray(1, 33).toString('base64url'),
      y: point.subarray(33).toString('base64url'),
    },
  });
}

describe('VAPID', () => {
  it('signs an ES256 token for the push service the public key verifies', () => {
    const keys = generateVapidKeys();
    const token = vapidToken(signingKeyOf(keys), {
      endpoint: ENDPOINT,
      subject: 'mailto:me@example.com',
      now: NOW,
    });
    const [header = '', claims = '', signature = ''] = token.split('.');
    expect(decode(header)).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(decode(claims)).toEqual({
      aud: 'https://web.push.apple.com',
      exp: NOW / 1000 + 12 * 60 * 60,
      sub: 'mailto:me@example.com',
    });
    const signed = Buffer.from(`${header}.${claims}`);
    const raw = Buffer.from(signature, 'base64url');
    expect(raw).toHaveLength(64);
    const key = { key: publicKeyOf(keys.publicKey), dsaEncoding: 'ieee-p1363' as const };
    expect(verify('sha256', signed, key, raw)).toBe(true);
    expect(vapidAuthorization(token, keys.publicKey)).toBe(`vapid t=${token}, k=${keys.publicKey}`);
  });

  it('makes keys in the form browsers take', () => {
    const { publicKey, privateKey } = generateVapidKeys();
    expect(Buffer.from(publicKey, 'base64url')).toHaveLength(65);
    expect(Buffer.from(publicKey, 'base64url')[0]).toBe(4);
    expect(Buffer.from(privateKey, 'base64url')).toHaveLength(32);
  });

  it('refuses keys that are not one P-256 pair', () => {
    const one = generateVapidKeys();
    const other = generateVapidKeys();
    expect(() => signingKeyOf({ ...one, privateKey: other.privateKey })).toThrow(
      'not the public key',
    );
    expect(() => signingKeyOf({ ...one, publicKey: 'abc' })).toThrow('P-256');
  });
});
