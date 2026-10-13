import { existsSync } from 'node:fs';
import { APP_VERSION } from '@tracker/shared';
import { Hono } from 'hono';
import { createClock, type Clock } from './clock';
import { REPO_ROOT } from './config';
import type { Db } from './db/schema';
import { createBroadcaster, type Broadcaster } from './events/broadcaster';
import type { RunBroadcaster } from './events/runNotice';
import { actorMiddleware } from './http/actor';
import { authMiddleware, stillHasAccess, type AuthDeps } from './http/auth';
import { DEFAULT_AUTH_OPTIONS, type AuthOptions } from './http/authOptions';
import { limitBodies } from './http/bodyLimits';
import type { AppEnv } from './http/env';
import { handleError, handleNotFound } from './http/errors';
import { securityHeaders, unbufferedStreams } from './http/responseHeaders';
import { activityRoutes } from './http/routes/activity';
import { attachmentRoutes } from './http/routes/attachments';
import { eventRoutes } from './http/routes/events';
import { inviteRoutes } from './http/routes/invites';
import { labelRoutes } from './http/routes/labels';
import { passwordRoutes } from './http/routes/password';
import { passwordResetRoutes } from './http/routes/passwordResets';
import { miscRoutes, testResetRoutes } from './http/routes/misc';
import { projectRoutes } from './http/routes/projects';
import { pushRoutes } from './http/routes/push';
import { questionRoutes } from './http/routes/questions';
import { reportRoutes } from './http/routes/reports';
import { runRoutes } from './http/routes/runs';
import { runRequestRoutes } from './http/routes/runRequests';
import { runStepRoutes } from './http/routes/runSteps';
import { runUsageRoutes } from './http/routes/runUsage';
import { chatRoutes } from './http/routes/chats';
import { sessionRoutes } from './http/routes/session';
import { statusRoutes } from './http/routes/statuses';
import { ticketRoutes } from './http/routes/tickets';
import { tokenRoutes } from './http/routes/tokens';
import { workflowRoutes } from './http/routes/workflow';
import { mountWebApp } from './http/static';
import { createPusher, type PushOptions } from './push/pusher';
import type { ServiceContext } from './services/context';
import type { FileStorage } from './storage/fileStorage';

export interface AppDeps {
  db: Db;
  storage: FileStorage;
  events: Broadcaster;
  runEvents?: RunBroadcaster;
  now?: Clock;
  auth?: Partial<AuthOptions>;
  webDist?: string | null;
  testReset?: boolean;
  repoRoot?: string;
  version?: string;
  commit?: string | null;
  publicUrl?: string | null;
  heartbeatMs?: number;
  push?: Partial<PushOptions>;
}

function createApi(ctx: ServiceContext, deps: AppDeps): Hono<AppEnv> {
  const auth: AuthDeps = {
    db: ctx.db,
    now: ctx.now,
    options: { ...DEFAULT_AUTH_OPTIONS, ...deps.auth },
  };
  const api = new Hono<AppEnv>()
    .use(actorMiddleware)
    .use(authMiddleware(auth))
    .use(limitBodies)
    .route('/', sessionRoutes(auth))
    .route('/', tokenRoutes(auth))
    .route('/', inviteRoutes(auth))
    .route('/', passwordResetRoutes(auth))
    .route('/', passwordRoutes(auth))
    .route(
      '/',
      miscRoutes(ctx, {
        version: deps.version ?? APP_VERSION,
        commit: deps.commit ?? null,
        repoRoot: deps.repoRoot ?? REPO_ROOT,
        publicUrl: deps.publicUrl ?? null,
      }),
    )
    .route('/', projectRoutes(ctx))
    .route('/', statusRoutes(ctx))
    .route('/', labelRoutes(ctx))
    .route('/', ticketRoutes(ctx))
    .route('/', workflowRoutes(ctx))
    .route('/', activityRoutes(ctx))
    .route('/', attachmentRoutes(ctx))
    .route('/', reportRoutes(ctx))
    .route('/', runRoutes(ctx))
    .route('/', runStepRoutes(ctx))
    .route('/', runUsageRoutes(ctx))
    .route('/', runRequestRoutes(ctx))
    .route('/', questionRoutes(ctx))
    .route('/', chatRoutes(ctx))
    .route('/', pushRoutes(ctx))
    .route(
      '/',
      eventRoutes(
        deps.events,
        deps.heartbeatMs,
        (access) => stillHasAccess(auth, access),
        ctx.runEvents,
      ),
    );
  if (deps.testReset) api.route('/', testResetRoutes(ctx));
  return api;
}

const DEFAULT_PUSH: PushOptions = { keys: null, subject: 'mailto:tracker@localhost' };

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const now = deps.now ?? createClock();
  const ctx: ServiceContext = {
    db: deps.db,
    storage: deps.storage,
    events: deps.events,
    runEvents: deps.runEvents ?? createBroadcaster(),
    now,
    push: createPusher(deps.db, now, { ...DEFAULT_PUSH, ...deps.push }),
  };
  const app = new Hono<AppEnv>();
  app.onError(handleError);
  app.notFound(handleNotFound);
  app.use(securityHeaders(), unbufferedStreams);
  app.route('/api', createApi(ctx, deps));
  if (deps.webDist && existsSync(deps.webDist)) mountWebApp(app, deps.webDist);
  return app;
}
