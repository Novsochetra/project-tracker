import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';

const UNKNOWN = 'unknown';

// Each proxy appends the address it got the request from, so with N trusted proxies in front the
// client is the Nth entry from the end. Entries before it came from the client and can be forged.
export function forwardedAddress(
  header: string | undefined,
  trustedProxies: number,
): string | null {
  const entries = (header ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.at(-Math.min(trustedProxies, entries.length)) ?? null;
}

function socketAddress(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? UNKNOWN;
  } catch {
    // Requests made in tests with app.request() have no socket.
    return UNKNOWN;
  }
}

export function clientAddress(c: Context, trustedProxies: number): string {
  const forwarded =
    trustedProxies > 0 ? forwardedAddress(c.req.header('x-forwarded-for'), trustedProxies) : null;
  return forwarded ?? socketAddress(c);
}
