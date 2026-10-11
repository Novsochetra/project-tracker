import { checkResetLinkInput, resetPasswordInput } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { listInvitedUsers } from '../../auth/invitedUsers';
import { cancelResetLink, checkResetLink, createResetLink } from '../../auth/passwordResets';
import { resetPassword } from '../../auth/resetPassword';
import type { AuthDeps } from '../auth';
import type { AppEnv } from '../env';
import { requireOwner } from '../ownerAccess';
import { limitTries } from '../tryLimits';
import { jsonBodyAsSent } from '../validation';

const ownerId = (c: Context<AppEnv>, deps: AuthDeps) =>
  requireOwner(c, deps, 'Only the owner of this tracker resets passwords.');

// Anyone with the link may use it, like an invite. It doesn't sign in: the browser may be someone
// else's, like the owner's trying the link, and signing in with the new password lets a password
// manager save it.
const linkRoutes = (deps: AuthDeps) => {
  const limited = limitTries(deps, 'tries with reset links');
  return new Hono<AppEnv>()
    .post('/password-resets/check', jsonBodyAsSent(checkResetLinkInput), limited, async (c) =>
      c.json(await checkResetLink(deps.db, c.req.valid('json').secret, deps.now())),
    )
    .post('/password-resets/use', jsonBodyAsSent(resetPasswordInput), limited, async (c) => {
      await resetPassword(deps.db, c.req.valid('json'), deps.now());
      return c.body(null, 204);
    });
};

const ownerRoutes = (deps: AuthDeps) =>
  new Hono<AppEnv>()
    .get('/users', async (c) => {
      await ownerId(c, deps);
      return c.json(await listInvitedUsers(deps.db, deps.now()));
    })
    .post('/users/:id/reset-link', async (c) => {
      const owner = await ownerId(c, deps);
      return c.json(await createResetLink(deps.db, owner, c.req.param('id'), deps.now()), 201);
    })
    .delete('/users/:id/reset-link', async (c) => {
      await ownerId(c, deps);
      await cancelResetLink(deps.db, c.req.param('id'));
      return c.body(null, 204);
    });

export const passwordResetRoutes = (deps: AuthDeps) =>
  new Hono<AppEnv>().route('/', linkRoutes(deps)).route('/', ownerRoutes(deps));
