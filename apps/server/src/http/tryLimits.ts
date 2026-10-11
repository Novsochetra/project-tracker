import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { clientAddress } from '../auth/clientAddress';
import { createRateLimiter } from '../auth/rateLimiter';
import type { AuthDeps } from './auth';
import type { AppEnv } from './env';
import { tooManyTries } from './tooManyTries';

export type TryKey = (c: Context<AppEnv>) => string;

// The same numbers as sign-in's limit per address, counted apart for each use. It runs after the
// body is validated, which looks nothing up, so a mistyped form costs no try. Every try that gets
// further counts, before it is checked: a valid link with a taken email would otherwise make the
// server hash a password as often as it is sent, and a check that succeeds must not let anyone
// start the count again.
export function limitTries({ now, options }: AuthDeps, what: string, keyOf?: TryKey) {
  const limiter = createRateLimiter(options.loginLimits.perAddress);
  const key = keyOf ?? ((c: Context<AppEnv>) => clientAddress(c, options.trustedProxies));
  return createMiddleware<AppEnv>(async (c, next) => {
    const tries = key(c);
    const at = now();
    const wait = limiter.waitFor(tries, at);
    if (wait > 0) throw tooManyTries(c, wait, what);
    limiter.fail(tries, at);
    await next();
  });
}
