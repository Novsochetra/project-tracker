import { randomUUID } from 'node:crypto';
import type { PushMessage, PushSubscriptionInput } from '@tracker/shared';
import type { Access } from '../auth/access';
import { requireScope, type UserScope } from '../auth/scope';
import { deleteUserSubscription, saveSubscriptionRow } from '../repositories/pushSubscriptions';
import type { ServiceContext } from './context';

type MessageSource = PushMessage | (() => Promise<PushMessage | null>);

const messageOf = async (source: MessageSource) =>
  typeof source === 'function' ? source() : source;

// For any feature that tells the person something: the request that caused it neither waits for
// the push services nor fails with them, and failures are only logged.
export function pushToUser(ctx: ServiceContext, userId: UserScope, source: MessageSource): void {
  void messageOf(source)
    .then((message) => (message ? ctx.push.send(userId, message) : undefined))
    .catch((error: unknown) => console.warn('Push failed:', error));
}

export async function savePushSubscription(
  ctx: ServiceContext,
  access: Access | null,
  input: PushSubscriptionInput,
): Promise<void> {
  const userId = requireScope(access);
  await saveSubscriptionRow(ctx.db, {
    id: randomUUID(),
    userId,
    sessionId: access?.kind === 'session' ? access.sessionId : null,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    createdAt: ctx.now(),
  });
}

export const removePushSubscription = (ctx: ServiceContext, userId: UserScope, endpoint: string) =>
  deleteUserSubscription(ctx.db, userId, endpoint);
