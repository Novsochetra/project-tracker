import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { OPEN_ACCESS, type Access } from '../auth/access';
import { accessStillValid } from '../auth/accessCheck';
import { authenticateApiToken } from '../auth/apiTokens';
import { ownerExists } from '../auth/owner';
import { resumeSession } from '../auth/sessions';
import type { Clock } from '../clock';
import type { Db } from '../db/schema';
import { AppError, forbidden } from '../errors';
import { asAgent, refusePersonName } from './actor';
import type { AuthOptions } from './authOptions';
import type { AppEnv } from './env';
import { isLocalRequest } from './localRequest';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './sessionCookie';

export const HEALTH_PATH = '/api/health';

// Signing in and out, asking whether one is signed in, and using an invite or reset link work
// without a session.
const PUBLIC_ROUTES = new Set([
  'GET /api/session',
  'POST /api/session',
  'DELETE /api/session',
  'POST /api/invites/check',
  'POST /api/invites/accept',
  'POST /api/password-resets/check',
  'POST /api/password-resets/use',
]);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface AuthDeps {
  db: Db;
  now: Clock;
  options: AuthOptions;
}

export const unauthorized = (): AppError =>
  new AppError('unauthorized', 'Sign in to use this tracker.');

const bearerToken = (c: Context): string | null =>
  /^Bearer\s+(\S+)\s*$/i.exec(c.req.header('authorization') ?? '')?.[1] ?? null;

// SameSite=Lax already keeps the cookie off other sites' form posts. Browsers also say where a
// request came from, which covers sites that count as the same site, like another subdomain.
function rejectCrossSiteWrite(c: Context): void {
  if (SAFE_METHODS.has(c.req.method)) return;
  const site = c.req.header('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    throw forbidden('This request came from another site.');
  }
}

async function sessionAccess(c: Context, { db, now, options }: AuthDeps, secret: string) {
  const at = now();
  const session = await resumeSession(db, secret, at);
  if (!session) {
    clearSessionCookie(c, options);
    return null;
  }
  if (session.renewed) setSessionCookie(c, secret, session.expiresAt - at, options);
  const { userId, sessionId, email } = session;
  return { kind: 'session', userId, sessionId, email } satisfies Access;
}

async function tokenAccess({ db, now }: AuthDeps, secret: string): Promise<Access | null> {
  const owner = await authenticateApiToken(db, secret, now());
  return owner && { kind: 'token', ...owner };
}

async function openAccess(c: Context, { db, options }: AuthDeps): Promise<Access | null> {
  const { openWithoutOwner } = options;
  const open = openWithoutOwner === 'any' || (openWithoutOwner === 'local' && isLocalRequest(c));
  return open && !(await ownerExists(db)) ? OPEN_ACCESS : null;
}

// A token that isn't known gets no further than no token at all: a local tracker without an owner
// stays open to agents still configured with an old TRACKER_TOKEN.
export async function resolveAccess(c: Context, deps: AuthDeps): Promise<Access | null> {
  const bearer = bearerToken(c);
  const token = bearer !== null ? await tokenAccess(deps, bearer) : null;
  if (token) return token;
  const secret = readSessionCookie(c);
  const session = secret ? await sessionAccess(c, deps, secret) : null;
  return session ?? openAccess(c, deps);
}

export const stillHasAccess = ({ db, now }: AuthDeps, access: Access | null | undefined) =>
  accessStillValid(db, access, now());

export function authMiddleware(deps: AuthDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (c.req.path === HEALTH_PATH) return next();
    rejectCrossSiteWrite(c);
    const access = await resolveAccess(c, deps);
    if (!access && !PUBLIC_ROUTES.has(`${c.req.method} ${c.req.path}`)) throw unauthorized();
    c.set('access', access);
    // Only the owner's own session acts as the person; a token is an agent whatever it says, so it
    // can never move a ticket to Done.
    if (access?.kind === 'token') c.set('actor', asAgent(c.get('actor')));
    refusePersonName(c.get('actor'));
    await next();
  });
}
