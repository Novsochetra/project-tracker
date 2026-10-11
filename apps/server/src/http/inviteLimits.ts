import { createMiddleware } from 'hono/factory';
import { clientAddress } from '../auth/clientAddress';
import { createRateLimiter } from '../auth/rateLimiter';
import type { AuthDeps } from './auth';
import type { AppEnv } from './env';
import { tooManyTries } from './tooManyTries';

// The same numbers as sign-in's limit per address, counted on their own. It runs after the body is
// validated, which looks nothing up, so a mistyped form costs no try. Every try that reaches the
// invite lookup counts, before it is checked: a link with a taken email would otherwise make the
// server hash a password as often as it is sent, and a check that succeeds must not let anyone
// start the count again.
export function limitInviteTries({ now, options }: AuthDeps) {
  const limiter = createRateLimiter(options.loginLimits.perAddress);
  return createMiddleware<AppEnv>(async (c, next) => {
    const address = clientAddress(c, options.trustedProxies);
    const at = now();
    const wait = limiter.waitFor(address, at);
    if (wait > 0) throw tooManyTries(c, wait, 'tries with invite links');
    limiter.fail(address, at);
    await next();
  });
}
