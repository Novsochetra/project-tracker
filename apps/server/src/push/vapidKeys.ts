import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';

// Both base64url, as browsers take the public one: 65 bytes uncompressed P-256, 32 bytes secret.
export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

const POINT_LENGTH = 65;
const SECRET_LENGTH = 32;

export function generateVapidKeys(): VapidKeys {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x ?? '', 'base64url');
  const y = Buffer.from(jwk.y ?? '', 'base64url');
  return {
    publicKey: Buffer.concat([Buffer.from([0x04]), x, y]).toString('base64url'),
    privateKey: jwk.d ?? '',
  };
}

// Throws when the two don't make one P-256 key pair, so a pasted key fails at start, not at a push.
export function signingKeyOf(keys: VapidKeys): KeyObject {
  const point = Buffer.from(keys.publicKey, 'base64url');
  const secret = Buffer.from(keys.privateKey, 'base64url');
  if (point.length !== POINT_LENGTH || point[0] !== 0x04 || secret.length !== SECRET_LENGTH) {
    throw new Error('VAPID keys must be a P-256 key pair in base64url (65 and 32 bytes).');
  }
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: point.subarray(1, 33).toString('base64url'),
    y: point.subarray(33).toString('base64url'),
  };
  const signing = createPrivateKey({ format: 'jwk', key: { ...jwk, d: keys.privateKey } });
  const check = Buffer.from('vapid');
  const signature = sign('sha256', check, signing);
  if (!verify('sha256', check, createPublicKey({ format: 'jwk', key: jwk }), signature)) {
    throw new Error('VAPID_PUBLIC_KEY is not the public key of VAPID_PRIVATE_KEY.');
  }
  return signing;
}
