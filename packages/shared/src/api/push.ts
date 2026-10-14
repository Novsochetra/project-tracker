import { z } from 'zod';
import { PUSH_ENDPOINT_MAX } from '../domain/push';
import { isPushServiceUrl } from '../logic/pushServices';

// What browsers give, base64url: a P-256 public key (65 bytes, starting 0x04) and a 16-byte secret.
// Anything else would only fail later, at every push.
const p256dh = z.string().regex(/^B[\w-]{86}=?$/, "That isn't a browser's push key.");
const auth = z.string().regex(/^[\w-]{22}(==)?$/, "That isn't a browser's push secret.");

const endpoint = z
  .string()
  .max(PUSH_ENDPOINT_MAX)
  .refine(isPushServiceUrl, "That isn't the address of a browser's push service.");

export const pushSubscriptionInput = z.object({
  endpoint,
  keys: z.object({ p256dh, auth }),
});
export type PushSubscriptionInput = z.input<typeof pushSubscriptionInput>;

export const removePushSubscriptionInput = z.object({ endpoint });
export type RemovePushSubscriptionInput = z.input<typeof removePushSubscriptionInput>;

// The chat on this device's screen now, or null when none is; its pushes skip this device.
export const viewingChatInput = z.object({ chatId: z.string().min(1).max(100).nullable() });
export type ViewingChatInput = z.input<typeof viewingChatInput>;
