import { existsSync } from 'node:fs';
import { Hono } from 'hono';
import { createClock, type Clock } from './clock';
import { REPO_ROOT } from './config';
import type { Db } from './db/schema';
import type { Broadcaster } from './events/broadcaster';
import { actorMiddleware } from './http/actor';
import { authMiddleware } from './http/auth';
import type { AppEnv } from './http/env';
import { handleError, handleNotFound } from './http/errors';
import { activityRoutes } from './http/routes/activity';
import { attachmentRoutes } from './http/routes/attachments';
import { eventRoutes } from './http/routes/events';
import { miscRoutes, testResetRoutes } from './http/routes/misc';
import { projectRoutes } from './http/routes/projects';
import { reportRoutes } from './http/routes/reports';
import { sessionRoutes } from './http/routes/session';
import { statusRoutes } from './http/routes/statuses';
import { ticketRoutes } from './http/routes/tickets';
import { workflowRoutes } from './http/routes/workflow';
import { mountWebApp } from './http/static';
import type { ServiceContext } from './services/context';
import type { FileStorage } from './storage/fileStorage';

export interface AppDeps {
  db: Db;
  storage: FileStorage;
  events: Broadcaster;
  now?: Clock;
  token?: string | null;
  webDist?: string | null;
  testReset?: boolean;
  repoRoot?: string;
  version?: string;
  publicUrl?: string | null;
  heartbeatMs?: number;
}

function createApi(ctx: ServiceContext, deps: AppDeps): Hono<AppEnv> {
  const token = deps.token ?? null;
  const api = new Hono<AppEnv>()
    .use(actorMiddleware)
    .use(authMiddleware(token))
    .route('/', sessionRoutes(token))
    .route(
      '/',
      miscRoutes(ctx, {
        version: deps.version ?? '0.0.0',
        repoRoot: deps.repoRoot ?? REPO_ROOT,
        authRequired: token !== null,
        publicUrl: deps.publicUrl ?? null,
      }),
    )
    .route('/', projectRoutes(ctx))
    .route('/', statusRoutes(ctx))
    .route('/', ticketRoutes(ctx))
    .route('/', workflowRoutes(ctx))
    .route('/', activityRoutes(ctx))
    .route('/', attachmentRoutes(ctx))
    .route('/', reportRoutes(ctx))
    .route('/', eventRoutes(deps.events, deps.heartbeatMs));
  if (deps.testReset) api.route('/', testResetRoutes(ctx));
  return api;
}

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const ctx: ServiceContext = {
    db: deps.db,
    storage: deps.storage,
    events: deps.events,
    now: deps.now ?? createClock(),
  };
  const app = new Hono<AppEnv>();
  app.onError(handleError);
  app.notFound(handleNotFound);
  app.route('/api', createApi(ctx, deps));
  if (deps.webDist && existsSync(deps.webDist)) mountWebApp(app, deps.webDist);
  return app;
}
