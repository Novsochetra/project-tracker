import { createECDH, hkdfSync, randomBytes, type ECDH } from 'node:crypto';
import { encryptContent } from './aes128gcm';

export interface ReceiverKeys {
  p256dh: string;
  auth: string;
}

// A fresh key pair and salt for each message; tests pass the RFC's own.
export interface Ephemeral {
  sender: ECDH;
  salt: Buffer;
}

export function newEphemeral(): Ephemeral {
  const sender = createECDH('prime256v1');
  sender.generateKeys();
  return { sender, salt: randomBytes(16) };
}

export function pushIkm(receiver: ReceiverKeys, sender: ECDH): Buffer {
  const receiverPublic = Buffer.from(receiver.p256dh, 'base64url');
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    receiverPublic,
    sender.getPublicKey(),
  ]);
  const secret = sender.computeSecret(receiverPublic);
  return Buffer.from(
    hkdfSync('sha256', secret, Buffer.from(receiver.auth, 'base64url'), keyInfo, 32),
  );
}

export function encryptPushPayload(
  receiver: ReceiverKeys,
  plaintext: Buffer,
  { sender, salt }: Ephemeral = newEphemeral(),
): Buffer {
  const ikm = pushIkm(receiver, sender);
  return encryptContent({ ikm, salt, keyId: sender.getPublicKey(), plaintext });
}
