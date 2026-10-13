import { createCipheriv, hkdfSync } from 'node:crypto';

// RFC 8188 content coding, in one record: a push message always fits in one.
export const RECORD_SIZE = 4096;
const TAG_LENGTH = 16;
const LAST_RECORD = 0x02;

export interface ContentInput {
  ikm: Buffer;
  salt: Buffer;
  keyId: Buffer;
  plaintext: Buffer;
}

const info = (label: string) => Buffer.from(`Content-Encoding: ${label}\0`);

const derive = (ikm: Buffer, salt: Buffer, label: string, length: number): Buffer =>
  Buffer.from(hkdfSync('sha256', ikm, salt, info(label), length));

function header(salt: Buffer, keyId: Buffer): Buffer {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(RECORD_SIZE);
  return Buffer.concat([salt, size, Buffer.from([keyId.length]), keyId]);
}

export function encryptContent({ ikm, salt, keyId, plaintext }: ContentInput): Buffer {
  const record = Buffer.concat([plaintext, Buffer.from([LAST_RECORD])]);
  if (record.length + TAG_LENGTH > RECORD_SIZE) throw new Error('The push message is too long.');
  const cipher = createCipheriv(
    'aes-128-gcm',
    derive(ikm, salt, 'aes128gcm', 16),
    derive(ikm, salt, 'nonce', 12),
  );
  const sealed = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);
  return Buffer.concat([header(salt, keyId), sealed]);
}
