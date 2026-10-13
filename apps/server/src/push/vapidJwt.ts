import { sign, type KeyObject } from 'node:crypto';

// Push services refuse a token valid for more than 24 hours; 12 leaves room for clock drift.
const VALID_SECONDS = 12 * 60 * 60;

export interface VapidClaims {
  endpoint: string;
  subject: string;
  now: number;
}

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function vapidToken(key: KeyObject, { endpoint, subject, now }: VapidClaims): string {
  const claims = {
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + VALID_SECONDS,
    sub: subject,
  };
  const unsigned = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode(claims)}`;
  // JWS wants r and s side by side, not the DER that sign() gives by default.
  const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${signature.toString('base64url')}`;
}

export const vapidAuthorization = (token: string, publicKey: string): string =>
  `vapid t=${token}, k=${publicKey}`;
