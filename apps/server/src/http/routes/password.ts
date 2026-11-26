import { changePasswordInput } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { changePassword } from '../../auth/changePassword';
import { forbidden } from '../../errors';
import type { AuthDeps } from '../auth';
import type { AppEnv } from '../env';
import { limitTries } from '../tryLimits';
import { jsonBodyAsSent } from '../validation';

// Only a person signed in with their password: a token that leaks can't take the account over.
function sessionOf(context: Context<AppEnv>) {
  const access = context.get('access');
  if (access?.kind === 'session') return access;
  throw forbidden('Sign in with your email and password to change your password.');
}

// Checked before the body, like the token routes.
const passwordSession = createMiddleware<AppEnv>(async (context, next) => {
  sessionOf(context);
  await next();
});

export function passwordRoutes(deps: AuthDeps) {
  // Counted per account, not per address: whoever guesses already holds its session, and an
  // address is cheap to change.
  const limited = limitTries(
    deps,
    'tries to change the password',
    (context) => sessionOf(context).userId,
  );

  return new Hono<AppEnv>().post(
    '/password',
    passwordSession,
    jsonBodyAsSent(changePasswordInput),
    limited,
    async (context) => {
      const { userId, sessionId } = sessionOf(context);
      await changePassword(
        deps.db,
        { userId, sessionId, ...context.req.valid('json') },
        deps.now(),
      );

      return context.body(null, 204);
    },
  );
}
