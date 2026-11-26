import { LOGIN_FAILED_MESSAGE, loginInput, type SessionState } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import type { Access } from '../../auth/access';
import { clientAddress } from '../../auth/clientAddress';
import { createLoginLimits, type LoginAttempt, type LoginLimits } from '../../auth/loginLimits';
import { checkLogin } from '../../auth/login';
import { ownerExists } from '../../auth/owner';
import { endAllSessions, endSession } from '../../auth/sessions';
import { AppError, forbidden } from '../../errors';
import { findUserById } from '../../repositories/users';
import type { AuthDeps } from '../auth';
import type { AppEnv } from '../env';
import { clearSessionCookie, readSessionCookie } from '../sessionCookie';
import { signedInState, signInAs } from '../signIn';
import { tooManyTries } from '../tooManyTries';
import { jsonBodyAsSent } from '../validation';

// The browser also drops its HTTP cache for the tracker, where attachment files are kept for a
// year. The service worker's caches are the page's to clear (api/hooks/session.ts).
const CLEAR_SITE_DATA = '"cache"';

async function stateFor(deps: AuthDeps, access: Access | null): Promise<SessionState> {
  if (access?.kind === 'open') return { authRequired: false, authenticated: true };
  const user = access?.kind === 'session' ? await findUserById(deps.db, access.userId) : undefined;
  if (user) return signedInState(user);
  if (access) return { authRequired: true, authenticated: true };
  if (await ownerExists(deps.db)) return { authRequired: true, authenticated: false };

  return { authRequired: true, authenticated: false, setupRequired: true };
}

async function signIn(
  context: Context<AppEnv>,
  deps: AuthDeps,
  limits: LoginLimits,
  input: LoginAttempt & { password: string },
) {
  const at = deps.now();
  const wait = limits.waitFor(input, at);
  if (wait > 0) throw tooManyTries(context, wait, 'sign-in attempts');
  // Counted before the check, so attempts sent side by side can't all slip past the limit.
  limits.failed(input, at);
  const user = await checkLogin(deps.db, input.email, input.password);
  if (!user) throw new AppError('unauthorized', LOGIN_FAILED_MESSAGE);
  limits.succeeded(input);
  await signInAs(context, deps, user.id);

  return context.json(signedInState(user));
}

async function signOut(context: Context<AppEnv>, deps: AuthDeps) {
  const secret = readSessionCookie(context);
  if (secret) await endSession(deps.db, secret);
  clearSessionCookie(context, deps.options);
  context.header('Clear-Site-Data', CLEAR_SITE_DATA);
  const access = context.get('access');

  return context.json(await stateFor(deps, access?.kind === 'open' ? access : null));
}

async function signOutEverywhere(context: Context<AppEnv>, deps: AuthDeps) {
  const access = context.get('access');
  if (access?.kind !== 'session') {
    throw forbidden('Sign in with your email and password to sign out everywhere.');
  }

  await endAllSessions(deps.db, access.userId);
  clearSessionCookie(context, deps.options);
  context.header('Clear-Site-Data', CLEAR_SITE_DATA);

  return context.json(await stateFor(deps, null));
}

export function sessionRoutes(deps: AuthDeps) {
  const limits = createLoginLimits(deps.options.loginLimits);

  return new Hono<AppEnv>()
    .get('/session', async (context) => context.json(await stateFor(deps, context.get('access'))))
    .post('/session', jsonBodyAsSent(loginInput), async (context) => {
      const { email, password } = context.req.valid('json');
      const address = clientAddress(context, deps.options.trustedProxies);

      return signIn(context, deps, limits, { address, email, password });
    })
    .delete('/session', (context) => signOut(context, deps))
    .delete('/sessions', (context) => signOutEverywhere(context, deps));
}
