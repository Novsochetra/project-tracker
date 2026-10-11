import type { Context } from 'hono';
import { AppError } from '../errors';

export function tooManyTries(c: Context, waitMs: number, what: string): AppError {
  const minutes = Math.ceil(waitMs / 60_000);
  c.header('Retry-After', String(Math.ceil(waitMs / 1000)));
  const when = minutes === 1 ? 'a minute' : `${minutes} minutes`;
  return new AppError('rate_limited', `Too many ${what}. Try again in ${when}.`);
}
