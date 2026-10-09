import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AuthOptions } from './authOptions';

export const SESSION_COOKIE = 'tracker_session';

export const readSessionCookie = (c: Context): string | undefined => getCookie(c, SESSION_COOKIE);

// X-Forwarded-Proto only counts behind a trusted proxy; anyone could send it otherwise.
export const isSecureRequest = (c: Context, options: AuthOptions): boolean =>
  options.secureCookies ||
  new URL(c.req.url).protocol === 'https:' ||
  (options.trustedProxies > 0 && c.req.header('x-forwarded-proto') === 'https');

export function setSessionCookie(
  c: Context,
  secret: string,
  maxAgeMs: number,
  options: AuthOptions,
): void {
  setCookie(c, SESSION_COOKIE, secret, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeMs / 1000)),
    secure: isSecureRequest(c, options),
  });
}

export function clearSessionCookie(c: Context, options: AuthOptions): void {
  deleteCookie(c, SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: isSecureRequest(c, options),
  });
}
