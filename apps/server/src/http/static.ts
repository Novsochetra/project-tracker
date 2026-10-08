import { readFile } from 'node:fs/promises';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Context, Hono, MiddlewareHandler } from 'hono';
import { acceptedEncodings } from './acceptEncoding';
import type { AppEnv } from './env';
import { etagMatches, etagOf } from './etag';

const IMMUTABLE = 'public, max-age=31536000, immutable';

// Plain answers of these types say Vary too, so a cache never hands a stored plain or compressed
// copy to a client that asked otherwise.
const ENCODABLE_TYPE = /^(?:text\/|application\/(?:javascript|json|xml)|[^;\s]+\+(?:json|xml))/;

// Asked for by name, a copy went out as application/octet-stream bytes no one could read. Any
// letter case, because a disk that ignores it (macOS) finds sw.js.br for /sw.js.BR.
const COMPRESSED_COPY = /\.(?:br|gz)$/i;

// RFC 9110, 15.4.5: a 304 carries the headers a cache refreshes its stored answer from.
const KEPT_ON_304 = ['cache-control', 'etag', 'vary'];

const isApiPath = (path: string): boolean => path === '/api' || path.startsWith('/api/');

// The Workbox runtime that sw.js imports is named by a hash of its content too. Cached for a year,
// the browser's update check reads it from its own cache instead of asking again after each sw.js.
const WORKBOX_RUNTIME = /^\/workbox-[\da-f]{8,}\.js$/;

const isHashedPath = (path: string): boolean =>
  path.startsWith('/assets/') || WORKBOX_RUNTIME.test(path);

const unless =
  (
    skip: (path: string) => boolean,
    handler: MiddlewareHandler<AppEnv>,
  ): MiddlewareHandler<AppEnv> =>
  async (c, next) =>
    skip(c.req.path) ? next() : handler(c, next);

// serveStatic matches each Accept-Encoding entry as written, so `BR` or `br;q=1` got the plain
// file and `br;q=0` got brotli. It still takes brotli over gzip whatever their weights: its copies
// are the smaller ones.
function rewriteAcceptEncoding(headers: Headers): void {
  const header = headers.get('Accept-Encoding');
  if (header !== null) headers.set('Accept-Encoding', acceptedEncodings(header).join(', '));
}

function setCacheHeaders(response: Response, path: string): void {
  response.headers.set('Cache-Control', isHashedPath(path) ? IMMUTABLE : 'no-cache');
  if (ENCODABLE_TYPE.test(response.headers.get('Content-Type') ?? '')) {
    response.headers.set('Vary', 'Accept-Encoding');
  }
}

function notModified(headers: Headers): Response {
  const kept = new Headers();
  for (const name of KEPT_ON_304) {
    const value = headers.get(name);
    if (value !== null) kept.set(name, value);
  }
  return new Response(null, { status: 304, headers: kept });
}

// The answer sends the bytes its tag was made from. Hashing the file apart from serveStatic's own
// read could pair a deploy's new tag with the old bytes, and the browser would then keep its old
// sw.js until the next deploy.
async function withETag(c: Context<AppEnv>, response: Response, file: string): Promise<Response> {
  await response.body?.cancel();
  const bytes = await readFile(file);
  const etag = etagOf(bytes);
  const headers = new Headers(response.headers);
  headers.set('ETag', etag);
  if (etagMatches(c.req.header('If-None-Match'), etag)) return notModified(headers);
  headers.set('Content-Length', String(bytes.length));
  return new Response(c.req.method === 'HEAD' ? null : bytes, { status: 200, headers });
}

// serveStatic builds its response before onFound runs, so headers are set on the result instead.
// Hashed assets keep their year-long cache and are never revalidated, so they go without a tag.
function webFiles(root: string, path?: string): MiddlewareHandler<AppEnv> {
  const served = new WeakMap<Context, string>();
  const handler = serveStatic<AppEnv>({
    root,
    path,
    precompressed: true,
    onFound: (file, c) => void served.set(c, file),
  });
  return async (c, next) => {
    if (COMPRESSED_COPY.test(c.req.path)) return c.notFound();
    rewriteAcceptEncoding(c.req.raw.headers);
    // serveStatic answers Range before the tag is checked, but a matching If-None-Match must win
    // (RFC 9110, 14.2). Tagged files are small, so they ignore Range, as a server may.
    if (!isHashedPath(c.req.path)) c.req.raw.headers.delete('Range');
    const response = await handler(c, next);
    if (!(response instanceof Response)) return response;
    setCacheHeaders(response, c.req.path);
    const file = served.get(c);
    if (!file || response.status !== 200 || isHashedPath(c.req.path)) return response;
    return withETag(c, response, file);
  };
}

export function mountWebApp(app: Hono<AppEnv>, root: string): void {
  app.get('*', unless(isApiPath, webFiles(root)));
  app.get(
    '*',
    unless((path) => isApiPath(path) || isHashedPath(path), webFiles(root, 'index.html')),
  );
}
