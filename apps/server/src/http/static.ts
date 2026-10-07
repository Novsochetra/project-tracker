import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono, MiddlewareHandler } from 'hono';
import type { AppEnv } from './env';

const IMMUTABLE = 'public, max-age=31536000, immutable';

const isApiPath = (path: string): boolean => path === '/api' || path.startsWith('/api/');

const isAssetPath = (path: string): boolean => path.startsWith('/assets/');

const unless =
  (
    skip: (path: string) => boolean,
    handler: MiddlewareHandler<AppEnv>,
  ): MiddlewareHandler<AppEnv> =>
  async (c, next) =>
    skip(c.req.path) ? next() : handler(c, next);

// serveStatic builds its response before onFound runs, so headers are set on the result instead.
const withCacheControl =
  (
    handler: MiddlewareHandler<AppEnv>,
    value: (path: string) => string,
  ): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const response = await handler(c, next);
    if (response instanceof Response) response.headers.set('Cache-Control', value(c.req.path));
    return response;
  };

export function mountWebApp(app: Hono<AppEnv>, root: string): void {
  const files = withCacheControl(serveStatic<AppEnv>({ root }), (path) =>
    isAssetPath(path) ? IMMUTABLE : 'no-cache',
  );
  const spaShell = withCacheControl(
    serveStatic<AppEnv>({ root, path: 'index.html' }),
    () => 'no-cache',
  );
  app.get('*', unless(isApiPath, files));
  app.get(
    '*',
    unless((path) => isApiPath(path) || isAssetPath(path), spaShell),
  );
}
