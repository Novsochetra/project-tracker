import { createApiTokenInput } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { createApiToken, listApiTokens, revokeApiToken } from '../../auth/apiTokens';
import { forbidden } from '../../errors';
import type { AuthDeps } from '../auth';
import type { AppEnv } from '../env';
import { jsonBody } from '../validation';

// Only a person signed in with their password manages their tokens: a token that leaks can't mint
// more of itself.
function ownerId(context: Context<AppEnv>): string {
  const access = context.get('access');
  if (access?.kind === 'session') return access.userId;
  throw forbidden(
    access?.kind === 'open'
      ? 'Tokens need an owner account. Set one up with npm run owner:set first.'
      : 'Sign in with your email and password to manage tokens.',
  );
}

// Checked before the body, so an agent learns it may not, not what a valid body looks like.
const ownerOnly = createMiddleware<AppEnv>(async (context, next) => {
  ownerId(context);
  await next();
});

export const tokenRoutes = ({ db, now }: AuthDeps) =>
  new Hono<AppEnv>()
    .get('/tokens', async (context) => context.json(await listApiTokens(db, ownerId(context))))
    .post('/tokens', ownerOnly, jsonBody(createApiTokenInput), async (context) => {
      const { name } = context.req.valid('json');

      return context.json(await createApiToken(db, ownerId(context), name, now()), 201);
    })
    .delete('/tokens/:id', async (context) => {
      await revokeApiToken(db, ownerId(context), context.req.param('id'));

      return context.body(null, 204);
    });
