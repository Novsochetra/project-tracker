export interface AuthConfig {
  openWithoutOwner: boolean;
  trustedProxies: number;
  secureCookies: boolean;
  // TRACKER_TOKEN is set, which the server no longer reads: main.ts says so at start.
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

// Sign-in can be skipped only when no owner is set up and nothing but this machine can reach the
// server: bound to loopback and not behind a proxy. Anything else, Railway included, needs it.
export function loadAuthConfig(env: NodeJS.ProcessEnv, host: string): AuthConfig {
  const trustedProxies = parseTrustProxy(env.TRUST_PROXY);
  return {
    openWithoutOwner: isLoopbackHost(host) && trustedProxies === 0,
    trustedProxies,
    secureCookies: env.NODE_ENV === 'production',
    legacyToken: Boolean(env.TRACKER_TOKEN),
  };
}
