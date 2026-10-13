import type { PushMessage } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { Clock } from '../clock';
import type { Db } from '../db/schema';
import { listUserSubscriptions } from '../repositories/pushSubscriptions';
import { deliver, type SendRequest } from './deliver';
import type { Sender } from './pushRequest';
import { loadSender, type SenderSettings } from './senderKeys';

export interface PushOptions extends SenderSettings {
  send?: SendRequest;
}

export interface Pusher {
  publicKey: () => Promise<string>;
  send: (userId: UserScope, message: PushMessage) => Promise<void>;
}

const logFailure = (result: PromiseSettledResult<void>) => {
  if (result.status === 'rejected') console.warn(String(result.reason));
};

export function createPusher(db: Db, now: Clock, options: PushOptions): Pusher {
  const send = options.send ?? fetch;
  let loading: Promise<Sender> | null = null;
  // Loaded once; a failed load is tried again next time instead of failing every push after it.
  const sender = () => {
    loading ??= loadSender(db, options, now()).catch((error: unknown) => {
      loading = null;
      throw error;
    });
    return loading;
  };
  return {
    publicKey: async () => (await sender()).publicKey,
    send: async (userId, message) => {
      const targets = await listUserSubscriptions(db, userId);
      if (targets.length === 0) return;
      const delivery = { db, sender: await sender(), send, now: now() };
      const results = await Promise.allSettled(
        targets.map((target) => deliver(delivery, target, message)),
      );
      results.forEach(logFailure);
    },
  };
}
