import type { SessionState } from '@tracker/shared';
import type { Context } from 'hono';
import type { SignedInUser } from '../auth/login';
import { endSession, startSession } from '../auth/sessions';
import type { AuthDeps } from './auth';
import type { AppEnv } from './env';
import { readSessionCookie, setSessionCookie } from './sessionCookie';

export const signedInState = ({ email, name, role }: SignedInUser): SessionState => ({
  authRequired: true,
  authenticated: true,
  email,
  name,
  role,
});

export async function signInAs(c: Context<AppEnv>, deps: AuthDeps, userId: string): Promise<void> {
  const at = deps.now();
  const previous = readSessionCookie(c);
  if (previous) await endSession(deps.db, previous);
  const session = await startSession(deps.db, userId, at);
  setSessionCookie(c, session.secret, session.expiresAt - at, deps.options);
}
