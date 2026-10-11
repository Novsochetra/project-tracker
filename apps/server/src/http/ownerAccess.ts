import type { Context } from 'hono';
import { forbidden } from '../errors';
import { findUserById } from '../repositories/users';
import type { AuthDeps } from './auth';
import type { AppEnv } from './env';

// Only the owner, signed in with the password: a token that leaks can't let anyone in.
export async function requireOwner(
  c: Context<AppEnv>,
  deps: AuthDeps,
  refusal: string,
): Promise<string> {
  const access = c.get('access');
  const user = access?.kind === 'session' ? await findUserById(deps.db, access.userId) : undefined;
  if (user?.role !== 'owner') throw forbidden(refusal);
  return user.id;
}
