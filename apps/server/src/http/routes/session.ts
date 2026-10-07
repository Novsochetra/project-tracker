import type { SessionState } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { z } from 'zod';
import { AppError } from '../../errors';
import { SESSION_COOKIE, isAuthenticated, safeEqual, sessionValue } from '../auth';
import type { AppEnv } from '../env';
import { jsonBody } from '../validation';

const SESSION_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

const sessionInput = z.object({ token: z.string().max(1000) });

const isHttps = (c: Context): boolean =>
  new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https';

export const sessionRoutes = (token: string | null) =>
  new Hono<AppEnv>()
    .get('/session', (c) =>
      c.json<SessionState>({
        authRequired: token !== null,
        authenticated: token === null || isAuthenticated(c, token),
      }),
    )
    .post('/session', jsonBody(sessionInput), (c) => {
      if (token === null) return c.json<SessionState>({ authRequired: false, authenticated: true });
      if (!safeEqual(c.req.valid('json').token.trim(), token)) {
        throw new AppError('unauthorized', 'That access token is not right.');
      }
      setCookie(c, SESSION_COOKIE, sessionValue(token), {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
        secure: isHttps(c),
      });
      return c.json<SessionState>({ authRequired: true, authenticated: true });
    });
