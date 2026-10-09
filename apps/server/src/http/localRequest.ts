import type { Context } from 'hono';
import { isLoopbackHost } from '../authConfig';

const hostnameOf = (host: string): string =>
  URL.canParse(`http://${host}`) ? new URL(`http://${host}`).hostname : '';

// Node writes an IPv4 address on a dual-stack socket as ::ffff:127.0.0.1.
const isLoopbackAddress = (address: string): boolean =>
  isLoopbackHost(address.trim().replace(/^::ffff:/i, ''));

const allLoopback = (header: string | undefined, isLoopback: (entry: string) => boolean) =>
  header === undefined || header.split(',').every(isLoopback);

// Made on this machine, to a name that means this machine. A Host that isn't loopback is a page
// reaching it by DNS rebinding or another device on the network. The dev server (Vite, xfwd in
// vite.config.ts) passes on requests from every device on the LAN, and says whose they are in
// X-Forwarded-For and X-Forwarded-Host.
export function isLocalRequest(c: Context): boolean {
  return (
    isLoopbackHost(new URL(c.req.url).hostname) &&
    allLoopback(c.req.header('x-forwarded-host'), (host) =>
      isLoopbackHost(hostnameOf(host.trim())),
    ) &&
    allLoopback(c.req.header('x-forwarded-for'), isLoopbackAddress)
  );
}
