import {
  pushSubscriptionInput,
  removePushSubscriptionInput,
  viewingChatInput,
} from '@tracker/shared';
import { Hono } from 'hono';
import { requireScope } from '../../auth/scope';
import type { ServiceContext } from '../../services/context';
import { removePushSubscription, savePushSubscription, viewChat } from '../../services/push';
import type { AppEnv } from '../env';
import { personPushes } from '../personOnly';
import { jsonBody } from '../validation';

export const pushRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/push/key', async (c) => c.json({ publicKey: await ctx.push.publicKey() }))
    .put('/push/subscription', personPushes, jsonBody(pushSubscriptionInput), async (c) => {
      await savePushSubscription(ctx, c.get('access'), c.req.valid('json'));
      return c.body(null, 204);
    })
    .delete(
      '/push/subscription',
      personPushes,
      jsonBody(removePushSubscriptionInput),
      async (c) => {
        const { endpoint } = c.req.valid('json');
        await removePushSubscription(ctx, requireScope(c.get('access')), endpoint);
        return c.body(null, 204);
      },
    )
    .put('/push/viewing', personPushes, jsonBody(viewingChatInput), (c) => {
      viewChat(ctx, c.get('access'), c.req.valid('json').chatId);
      return c.body(null, 204);
    });
