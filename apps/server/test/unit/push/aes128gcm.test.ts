import { expect, it } from 'vitest';
import { encryptContent } from '../../../src/push/aes128gcm';

const b64 = (text: string) => Buffer.from(text, 'base64url');

// RFC 8188 §3.1, "Encryption of a Response".
it('encrypts the RFC 8188 example to the bytes the RFC gives', () => {
  const body = encryptContent({
    ikm: b64('yqdlZ-tYemfogSmv7Ws5PQ'),
    salt: b64('I1BsxtFttlv3u_Oo94xnmw'),
    keyId: Buffer.alloc(0),
    plaintext: Buffer.from('I am the walrus'),
  });
  expect(body.toString('base64url')).toBe(
    'I1BsxtFttlv3u_Oo94xnmwAAEAAA-NAVub2qFgBEuQKRapoZu-IxkIva3MEB1PD-ly8Thjg',
  );
});

it('refuses a message that does not fit in one record', () => {
  const input = {
    ikm: b64('yqdlZ-tYemfogSmv7Ws5PQ'),
    salt: Buffer.alloc(16),
    keyId: Buffer.alloc(0),
  };
  expect(() => encryptContent({ ...input, plaintext: Buffer.alloc(4080) })).toThrow('too long');
});
