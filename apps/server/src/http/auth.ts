import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { AppError } from '../errors';
import type { AppEnv } from './env';

export const SESSION_COOKIE = 'tracker_session';

const PUBLIC_ROUTES = new Set(['GET /api/session', 'POST /api/session', 'GET /api/health']);

// Hashing first gives equal-length buffers, which timingSafeEqual requires.
const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

export const safeEqual = (a: string, b: string): boolean => timingSafeEqual(digest(a), digest(b));

// Derived rather than the raw token, so the cookie never holds the token itself.
export const sessionValue = (token: string): string =>
  createHmac('sha256', token).update('tracker-session-v1').digest('base64url');

export function isAuthenticated(c: Context, token: string): boolean {
  const bearer = /^Bearer\s+(.+)$/i.exec(c.req.header('authorization') ?? '')?.[1]?.trim();
  if (bearer && safeEqual(bearer, token)) return true;
  const cookie = getCookie(c, SESSION_COOKIE);
  return cookie !== undefined && safeEqual(cookie, sessionValue(token));
}

export const unauthorized = (): AppError =>
  new AppError('unauthorized', 'Enter the access token to use this tracker.');

export function authMiddleware(token: string | null) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const route = `${c.req.method} ${c.req.path}`;
    if (token && !PUBLIC_ROUTES.has(route) && !isAuthenticated(c, token)) throw unauthorized();
    await next();
  });
}
