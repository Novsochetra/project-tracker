import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AuthOptions } from './authOptions';

export const SESSION_COOKIE = 'tracker_session';

export const readSessionCookie = (context: Context): string | undefined =>
  getCookie(context, SESSION_COOKIE);

// X-Forwarded-Proto only counts behind a trusted proxy; anyone could send it otherwise.
export const isSecureRequest = (context: Context, options: AuthOptions): boolean =>
  options.secureCookies ||
  new URL(context.req.url).protocol === 'https:' ||
  (options.trustedProxies > 0 && context.req.header('x-forwarded-proto') === 'https');

export function setSessionCookie(
  context: Context,
  secret: string,
  maxAgeMs: number,
  options: AuthOptions,
): void {
  setCookie(context, SESSION_COOKIE, secret, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeMs / 1000)),
    secure: isSecureRequest(context, options),
  });
}

export function clearSessionCookie(context: Context, options: AuthOptions): void {
  deleteCookie(context, SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: isSecureRequest(context, options),
  });
}
