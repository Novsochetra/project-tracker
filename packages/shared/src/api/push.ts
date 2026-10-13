import { z } from 'zod';
import { PUSH_ENDPOINT_MAX } from '../domain/push';
import { isPushServiceUrl } from '../logic/pushServices';

const key = z.string().trim().min(1).max(200);

const endpoint = z
  .string()
  .max(PUSH_ENDPOINT_MAX)
  .refine(isPushServiceUrl, "That isn't the address of a browser's push service.");

export const pushSubscriptionInput = z.object({
  endpoint,
  keys: z.object({ p256dh: key, auth: key }),
});
export type PushSubscriptionInput = z.input<typeof pushSubscriptionInput>;

export const removePushSubscriptionInput = z.object({ endpoint });
export type RemovePushSubscriptionInput = z.input<typeof removePushSubscriptionInput>;
