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
function ownerId(c: Context<AppEnv>): string {
  const access = c.get('access');
  if (access?.kind === 'session') return access.userId;
  throw forbidden(
    access?.kind === 'open'
      ? 'Tokens need an owner account. Set one up with npm run owner:set first.'
      : 'Sign in with your email and password to manage tokens.',
  );
}

// Checked before the body, so an agent learns it may not, not what a valid body looks like.
const ownerOnly = createMiddleware<AppEnv>(async (c, next) => {
  ownerId(c);
  await next();
});

export const tokenRoutes = ({ db, now }: AuthDeps) =>
  new Hono<AppEnv>()
    .get('/tokens', async (c) => c.json(await listApiTokens(db, ownerId(c))))
    .post('/tokens', ownerOnly, jsonBody(createApiTokenInput), async (c) => {
      const { name } = c.req.valid('json');
      return c.json(await createApiToken(db, ownerId(c), name, now()), 201);
    })
    .delete('/tokens/:id', async (c) => {
      await revokeApiToken(db, ownerId(c), c.req.param('id'));
      return c.body(null, 204);
    });
