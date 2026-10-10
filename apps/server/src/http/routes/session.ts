import { LOGIN_FAILED_MESSAGE, loginInput, type SessionState } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import type { Access } from '../../auth/access';
import { clientAddress } from '../../auth/clientAddress';
import { createLoginLimits, type LoginAttempt, type LoginLimits } from '../../auth/loginLimits';
import { checkLogin, ownerExists } from '../../auth/owner';
import { endAllSessions, endSession, startSession } from '../../auth/sessions';
import { AppError, forbidden } from '../../errors';
import type { AuthDeps } from '../auth';
import type { AppEnv } from '../env';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from '../sessionCookie';
import { jsonBodyAsSent } from '../validation';

// The browser also drops its HTTP cache for the tracker, where attachment files are kept for a
// year. The service worker's caches are the page's to clear (api/hooks/session.ts).
const CLEAR_SITE_DATA = '"cache"';

async function stateFor(deps: AuthDeps, access: Access | null): Promise<SessionState> {
  if (access?.kind === 'open') return { authRequired: false, authenticated: true };
  if (access?.kind === 'session')
    return { authRequired: true, authenticated: true, email: access.email };
  if (access) return { authRequired: true, authenticated: true };
  if (await ownerExists(deps.db)) return { authRequired: true, authenticated: false };
  return { authRequired: true, authenticated: false, setupRequired: true };
}

function tooManyAttempts(c: Context, waitMs: number): AppError {
  const minutes = Math.ceil(waitMs / 60_000);
  c.header('Retry-After', String(Math.ceil(waitMs / 1000)));
  const when = minutes === 1 ? 'a minute' : `${minutes} minutes`;
  return new AppError('rate_limited', `Too many sign-in attempts. Try again in ${when}.`);
}

async function signIn(
  c: Context<AppEnv>,
  deps: AuthDeps,
  limits: LoginLimits,
  input: LoginAttempt & { password: string },
) {
  const at = deps.now();
  const wait = limits.waitFor(input, at);
  if (wait > 0) throw tooManyAttempts(c, wait);
  // Counted before the check, so attempts sent side by side can't all slip past the limit.
  limits.failed(input, at);
  const owner = await checkLogin(deps.db, input.email, input.password);
  if (!owner) throw new AppError('unauthorized', LOGIN_FAILED_MESSAGE);
  limits.succeeded(input);
  const previous = readSessionCookie(c);
  if (previous) await endSession(deps.db, previous);
  const session = await startSession(deps.db, owner.id, deps.now());
  setSessionCookie(c, session.secret, session.expiresAt - at, deps.options);
  return c.json<SessionState>({ authRequired: true, authenticated: true, email: owner.email });
}

async function signOut(c: Context<AppEnv>, deps: AuthDeps) {
  const secret = readSessionCookie(c);
  if (secret) await endSession(deps.db, secret);
  clearSessionCookie(c, deps.options);
  c.header('Clear-Site-Data', CLEAR_SITE_DATA);
  const access = c.get('access');
  return c.json(await stateFor(deps, access?.kind === 'open' ? access : null));
}

async function signOutEverywhere(c: Context<AppEnv>, deps: AuthDeps) {
  const access = c.get('access');
  if (access?.kind !== 'session') {
    throw forbidden('Sign in with your email and password to sign out everywhere.');
  }
  await endAllSessions(deps.db, access.userId);
  clearSessionCookie(c, deps.options);
  c.header('Clear-Site-Data', CLEAR_SITE_DATA);
  return c.json(await stateFor(deps, null));
}

export function sessionRoutes(deps: AuthDeps) {
  const limits = createLoginLimits(deps.options.loginLimits);
  return new Hono<AppEnv>()
    .get('/session', async (c) => c.json(await stateFor(deps, c.get('access'))))
    .post('/session', jsonBodyAsSent(loginInput), async (c) => {
      const { email, password } = c.req.valid('json');
      const address = clientAddress(c, deps.options.trustedProxies);
      return signIn(c, deps, limits, { address, email, password });
    })
    .delete('/session', (c) => signOut(c, deps))
    .delete('/sessions', (c) => signOutEverywhere(c, deps));
}
