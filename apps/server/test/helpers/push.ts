import { createDecipheriv, createECDH, hkdfSync, randomBytes } from 'node:crypto';
import type { PushMessage } from '@tracker/shared';
import { vi } from 'vitest';
import type { SendRequest } from '../../src/push/deliver';

export function newDevice(path = randomBytes(8).toString('hex')) {
  const keys = createECDH('prime256v1');
  keys.generateKeys();
  const auth = randomBytes(16);
  return {
    keys,
    auth,
    subscription: {
      endpoint: `https://web.push.apple.com/${path}`,
      keys: { p256dh: keys.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
    },
  };
}

export type Device = ReturnType<typeof newDevice>;

const info = (label: string) => Buffer.from(`Content-Encoding: ${label}\0`);

// What the browser does with a push (RFC 8291), so tests read what the phone would show.
export function decryptPush(body: Uint8Array, device: Device): PushMessage {
  const data = Buffer.from(body);
  const salt = data.subarray(0, 16);
  const senderKey = data.subarray(21, 21 + data[20]!);
  const receiverKey = device.keys.getPublicKey();
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), receiverKey, senderKey]);
  const secret = device.keys.computeSecret(senderKey);
  const ikm = Buffer.from(hkdfSync('sha256', secret, device.auth, keyInfo, 32));
  const key = Buffer.from(hkdfSync('sha256', ikm, salt, info('aes128gcm'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, info('nonce'), 12));
  const sealed = data.subarray(21 + senderKey.length);
  const decipher = createDecipheriv('aes-128-gcm', key, nonce);
  decipher.setAuthTag(sealed.subarray(-16));
  const plain = Buffer.concat([decipher.update(sealed.subarray(0, -16)), decipher.final()]);
  return JSON.parse(plain.subarray(0, -1).toString()) as PushMessage;
}

export interface SentPush {
  url: string;
  init: RequestInit;
}

export function fakePushService() {
  const sent: SentPush[] = [];
  const answer: SendRequest = (url, init) => {
    sent.push({ url, init });
    return Promise.resolve(new Response(null, { status: service.status }));
  };
  const service = {
    sent,
    status: 201,
    send: vi.fn<SendRequest>(answer),
    reset() {
      sent.length = 0;
      service.status = 201;
      service.send.mockReset();
      service.send.mockImplementation(answer);
    },
    async messagesFor(device: Device, count = 1): Promise<PushMessage[]> {
      await vi.waitFor(() => {
        if (service.forDevice(device).length < count) throw new Error('No push yet.');
      });
      return service
        .forDevice(device)
        .map(({ init }) => decryptPush(init.body as Uint8Array, device));
    },
    forDevice: (device: Device) => sent.filter(({ url }) => url === device.subscription.endpoint),
  };
  return service;
}
