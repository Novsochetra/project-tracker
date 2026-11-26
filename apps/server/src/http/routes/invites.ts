import { acceptInviteInput, checkInviteInput } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { acceptInvite } from '../../auth/acceptInvite';
import {
  createInvite,
  listOpenInvites,
  requireUsableInvite,
  revokeInvite,
} from '../../auth/invites';
import type { AuthDeps } from '../auth';
import type { AppEnv } from '../env';
import { requireOwner } from '../ownerAccess';
import { signedInState, signInAs } from '../signIn';
import { limitTries } from '../tryLimits';
import { jsonBodyAsSent } from '../validation';

const ownerId = (context: Context<AppEnv>, deps: AuthDeps) =>
  requireOwner(context, deps, 'Only the owner of this tracker invites people.');

// Anyone with the link may ask about it and accept it; the secret is what lets them in.
const linkRoutes = (deps: AuthDeps) => {
  const limited = limitTries(deps, 'tries with invite links');

  return new Hono<AppEnv>()
    .post('/invites/check', jsonBodyAsSent(checkInviteInput), limited, async (context) => {
      const invite = await requireUsableInvite(
        deps.db,
        context.req.valid('json').secret,
        deps.now(),
      );

      return context.json({ expiresAt: invite.expiresAt });
    })
    .post('/invites/accept', jsonBodyAsSent(acceptInviteInput), limited, async (context) => {
      const user = await acceptInvite(deps.db, context.req.valid('json'), deps.now());
      await signInAs(context, deps, user.id);

      return context.json(signedInState(user), 201);
    });
};

const ownerRoutes = (deps: AuthDeps) =>
  new Hono<AppEnv>()
    .get('/invites', async (context) =>
      context.json(await listOpenInvites(deps.db, await ownerId(context, deps), deps.now())),
    )
    .post('/invites', async (context) =>
      context.json(await createInvite(deps.db, await ownerId(context, deps), deps.now()), 201),
    )
    .delete('/invites/:id', async (context) => {
      await revokeInvite(deps.db, await ownerId(context, deps), context.req.param('id'));

      return context.body(null, 204);
    });

export const inviteRoutes = (deps: AuthDeps) =>
  new Hono<AppEnv>().route('/', linkRoutes(deps)).route('/', ownerRoutes(deps));
