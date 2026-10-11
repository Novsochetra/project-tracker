import { acceptInviteInput, checkInviteInput } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { acceptInvite } from '../../auth/acceptInvite';
import {
  createInvite,
  listOpenInvites,
  requireUsableInvite,
  revokeInvite,
} from '../../auth/invites';
import { forbidden } from '../../errors';
import { findUserById } from '../../repositories/users';
import type { AuthDeps } from '../auth';
import type { AppEnv } from '../env';
import { limitInviteTries } from '../inviteLimits';
import { signedInState, signInAs } from '../signIn';
import { jsonBodyAsSent } from '../validation';

const OWNER_ONLY = 'Only the owner of this tracker invites people.';

// Only the owner, signed in with the password: a token that leaks can't let anyone in.
async function ownerId(c: Context<AppEnv>, deps: AuthDeps): Promise<string> {
  const access = c.get('access');
  const user = access?.kind === 'session' ? await findUserById(deps.db, access.userId) : undefined;
  if (user?.role !== 'owner') throw forbidden(OWNER_ONLY);
  return user.id;
}

// Anyone with the link may ask about it and accept it; the secret is what lets them in.
const linkRoutes = (deps: AuthDeps) => {
  const limited = limitInviteTries(deps);
  return new Hono<AppEnv>()
    .post('/invites/check', jsonBodyAsSent(checkInviteInput), limited, async (c) => {
      const invite = await requireUsableInvite(deps.db, c.req.valid('json').secret, deps.now());
      return c.json({ expiresAt: invite.expiresAt });
    })
    .post('/invites/accept', jsonBodyAsSent(acceptInviteInput), limited, async (c) => {
      const user = await acceptInvite(deps.db, c.req.valid('json'), deps.now());
      await signInAs(c, deps, user.id);
      return c.json(signedInState(user), 201);
    });
};

const ownerRoutes = (deps: AuthDeps) =>
  new Hono<AppEnv>()
    .get('/invites', async (c) =>
      c.json(await listOpenInvites(deps.db, await ownerId(c, deps), deps.now())),
    )
    .post('/invites', async (c) =>
      c.json(await createInvite(deps.db, await ownerId(c, deps), deps.now()), 201),
    )
    .delete('/invites/:id', async (c) => {
      await revokeInvite(deps.db, await ownerId(c, deps), c.req.param('id'));
      return c.body(null, 204);
    });

export const inviteRoutes = (deps: AuthDeps) =>
  new Hono<AppEnv>().route('/', linkRoutes(deps)).route('/', ownerRoutes(deps));
