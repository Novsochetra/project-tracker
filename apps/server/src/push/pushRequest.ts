import type { KeyObject } from 'node:crypto';
import type { PushMessage } from '@tracker/shared';
import { vapidAuthorization, vapidToken } from './vapidJwt';
import { encryptPushPayload, type ReceiverKeys } from './webPushPayload';

export interface PushTarget extends ReceiverKeys {
  endpoint: string;
}

export interface Sender {
  publicKey: string;
  signingKey: KeyObject;
  subject: string;
}

// A day: a phone that is off longer gets nothing stale when it comes back.
const TIME_TO_LIVE_SECONDS = 24 * 60 * 60;

export function pushRequest(
  target: PushTarget,
  message: PushMessage,
  sender: Sender & { now: number },
): RequestInit {
  const token = vapidToken(sender.signingKey, {
    endpoint: target.endpoint,
    subject: sender.subject,
    now: sender.now,
  });
  return {
    method: 'POST',
    // A redirect would take the signed message past the list of push services (isPushServiceUrl).
    redirect: 'error',
    headers: {
      authorization: vapidAuthorization(token, sender.publicKey),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: String(TIME_TO_LIVE_SECONDS),
      urgency: 'high',
    },
    body: new Uint8Array(encryptPushPayload(target, Buffer.from(JSON.stringify(message)))),
  };
}
