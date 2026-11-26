import { pushSubscriptionInput, removePushSubscriptionInput } from '@tracker/shared';
import { Hono } from 'hono';
import { requireScope } from '../../auth/scope';
import type { ServiceContext } from '../../services/context';
import { removePushSubscription, savePushSubscription } from '../../services/push';
import type { AppEnv } from '../env';
import { personPushes } from '../personOnly';
import { jsonBody } from '../validation';

export const pushRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/push/key', async (context) => context.json({ publicKey: await ctx.push.publicKey() }))
    .put('/push/subscription', personPushes, jsonBody(pushSubscriptionInput), async (context) => {
      await savePushSubscription(ctx, context.get('access'), context.req.valid('json'));

      return context.body(null, 204);
    })
    .delete(
      '/push/subscription',
      personPushes,
      jsonBody(removePushSubscriptionInput),
      async (context) => {
        const { endpoint } = context.req.valid('json');
        await removePushSubscription(ctx, requireScope(context.get('access')), endpoint);

        return context.body(null, 204);
      },
    );
