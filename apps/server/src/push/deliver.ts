import type { PushMessage } from '@tracker/shared';
import type { Db } from '../db/schema';
import { deleteSubscriptionAt } from '../repositories/pushSubscriptions';
import { pushRequest, type PushTarget, type Sender } from './pushRequest';

export type SendRequest = (url: string, init: RequestInit) => Promise<Response>;

export interface Delivery {
  db: Db;
  sender: Sender;
  send: SendRequest;
  now: number;
}

const TIMEOUT_MS = 10_000;
// The device unsubscribed or the browser dropped it: the address will never work again.
const GONE = new Set([404, 410]);

// The address is a secret of the device's, so only its host goes in the log.
const hostOf = (endpoint: string) => new URL(endpoint).host;

export async function deliver(
  { db, sender, send, now }: Delivery,
  target: PushTarget,
  message: PushMessage,
): Promise<void> {
  const init = pushRequest(target, message, { ...sender, now });
  const response = await send(target.endpoint, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.ok) return;
  if (GONE.has(response.status)) {
    await deleteSubscriptionAt(db, target.endpoint);
    return;
  }
  const reason = (await response.text().catch(() => '')).slice(0, 200);
  throw new Error(`Push to ${hostOf(target.endpoint)} failed: ${response.status} ${reason}`);
}
