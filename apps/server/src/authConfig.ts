import type { OpenWithoutOwner } from './http/authOptions';

export interface AuthConfig {
  openWithoutOwner: OpenWithoutOwner;
  trustedProxies: number;
  secureCookies: boolean;
  // TRACKER_TOKEN is set. The server no longer reads it, but it keeps a server without an owner
  // closed, as the token did, and main.ts says so at start.
  legacyToken: boolean;
}

const LOOPBACK = /^(localhost|127(?:\.\d{1,3}){3}|::1|\[::1\])$/i;

export const isLoopbackHost = (host: string): boolean => LOOPBACK.test(host.trim());

// TRUST_PROXY is how many proxies in front add to X-Forwarded-For: 1 on Railway. "true" means 1.
export function parseTrustProxy(value: string | undefined): number {
  const text = value?.trim().toLowerCase() ?? '';
  if (text === 'true') return 1;
  const hops = Number(text);
  return Number.isInteger(hops) && hops > 0 && hops < 10 ? hops : 0;
}

// Sign-in can be skipped only while no owner is set up, on a server bound to loopback, not behind
// a proxy and not protected by TRACKER_TOKEN before, and then only for requests made on this
// machine (http/localRequest.ts). Anything else, Railway included, needs it.
export function loadAuthConfig(env: NodeJS.ProcessEnv, host: string): AuthConfig {
  const trustedProxies = parseTrustProxy(env.TRUST_PROXY);
  const legacyToken = Boolean(env.TRACKER_TOKEN);
  const local = isLoopbackHost(host) && trustedProxies === 0 && !legacyToken;
  return {
    openWithoutOwner: local ? 'local' : false,
    trustedProxies,
    secureCookies: env.NODE_ENV === 'production',
    legacyToken,
  };
}
