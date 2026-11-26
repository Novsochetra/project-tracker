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

const ownerId = (context: Context<AppEnv>, deps: AuthDeps) =>
  requireOwner(context, deps, 'Only the owner of this tracker resets passwords.');

// Anyone with the link may use it, like an invite. It doesn't sign in: the browser may be someone
// else's, like the owner's trying the link, and signing in with the new password lets a password
// manager save it.
const linkRoutes = (deps: AuthDeps) => {
  const limited = limitTries(deps, 'tries with reset links');

  return new Hono<AppEnv>()
    .post('/password-resets/check', jsonBodyAsSent(checkResetLinkInput), limited, async (context) =>
      context.json(await checkResetLink(deps.db, context.req.valid('json').secret, deps.now())),
    )
    .post('/password-resets/use', jsonBodyAsSent(resetPasswordInput), limited, async (context) => {
      await resetPassword(deps.db, context.req.valid('json'), deps.now());

      return context.body(null, 204);
    });
};

const ownerRoutes = (deps: AuthDeps) =>
  new Hono<AppEnv>()
    .get('/users', async (context) => {
      await ownerId(context, deps);

      return context.json(await listInvitedUsers(deps.db, deps.now()));
    })
    .post('/users/:id/reset-link', async (context) => {
      const owner = await ownerId(context, deps);

      return context.json(
        await createResetLink(deps.db, owner, context.req.param('id'), deps.now()),
        201,
      );
    })
    .delete('/users/:id/reset-link', async (context) => {
      await ownerId(context, deps);
      await cancelResetLink(deps.db, context.req.param('id'));

      return context.body(null, 204);
    });

export const passwordResetRoutes = (deps: AuthDeps) =>
  new Hono<AppEnv>().route('/', linkRoutes(deps)).route('/', ownerRoutes(deps));
