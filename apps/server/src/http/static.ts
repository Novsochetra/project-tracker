import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono, MiddlewareHandler } from 'hono';
import type { AppEnv } from './env';

const IMMUTABLE = 'public, max-age=31536000, immutable';

// The types serveStatic looks for a .br or .gz copy of. Their plain answers say Vary too, so a
// cache never hands a stored plain or compressed copy to a client that asked otherwise.
const ENCODABLE_TYPE = /^(?:text\/|application\/(?:javascript|json|xml)|[^;\s]+\+(?:json|xml))/;

const isApiPath = (path: string): boolean => path === '/api' || path.startsWith('/api/');

const isAssetPath = (path: string): boolean => path.startsWith('/assets/');

const variesByEncoding = (contentType: string | null): boolean =>
  ENCODABLE_TYPE.test(contentType ?? '');

const unless =
  (
    skip: (path: string) => boolean,
    handler: MiddlewareHandler<AppEnv>,
  ): MiddlewareHandler<AppEnv> =>
  async (c, next) =>
    skip(c.req.path) ? next() : handler(c, next);

// serveStatic builds its response before onFound runs, so headers are set on the result instead.
const withHeaders =
  (
    handler: MiddlewareHandler<AppEnv>,
    cacheControl: (path: string) => string,
  ): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const response = await handler(c, next);
    if (!(response instanceof Response)) return response;
    response.headers.set('Cache-Control', cacheControl(c.req.path));
    if (variesByEncoding(response.headers.get('Content-Type'))) {
      response.headers.set('Vary', 'Accept-Encoding');
    }
    return response;
  };

// precompressed: the build writes .br and .gz copies of text files (apps/web/src/build), and a
// file without them is sent as it is.
export function mountWebApp(app: Hono<AppEnv>, root: string): void {
  const files = withHeaders(serveStatic<AppEnv>({ root, precompressed: true }), (path) =>
    isAssetPath(path) ? IMMUTABLE : 'no-cache',
  );
  const spaShell = withHeaders(
    serveStatic<AppEnv>({ root, path: 'index.html', precompressed: true }),
    () => 'no-cache',
  );
  app.get('*', unless(isApiPath, files));
  app.get(
    '*',
    unless((path) => isApiPath(path) || isAssetPath(path), spaShell),
  );
}
