import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import { AppError } from '../errors';
import type { AppEnv } from './env';

const KB = 1024;

// An email, a password and a name at their longest, every character escaped (\u0001 is 6 bytes).
export const LOGIN_BODY_MAX = 16 * KB;
// The longest real edit, escaped the same way: a 100,000-character report, or a 50,000-character
// description with the text it was typed over.
export const JSON_BODY_MAX = 1024 * KB;

const SMALL_BODY_PATHS = new Set([
  '/api/session',
  '/api/invites/check',
  '/api/invites/accept',
  '/api/password-resets/check',
  '/api/password-resets/use',
  '/api/password',
]);
// Uploads stream to storage, with a limit per kind of file (checkAttachment).
const UPLOAD_PATH = '/api/attachments';

const tooLarge = (): never => {
  throw new AppError('too_large', 'This request is too big.');
};

const LIMITS = {
  login: bodyLimit({ maxSize: LOGIN_BODY_MAX, onError: tooLarge }),
  json: bodyLimit({ maxSize: JSON_BODY_MAX, onError: tooLarge }),
};

// Runs after the access check, so only sign-in, invites and reset links read a body from someone
// not signed in, and those are small. A body with a length over the limit is refused unread.
export const limitBodies = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method === 'POST' && c.req.path === UPLOAD_PATH) return next();
  const limit = SMALL_BODY_PATHS.has(c.req.path) ? LIMITS.login : LIMITS.json;
  return limit(c, next);
});
