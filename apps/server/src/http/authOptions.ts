import { DEFAULT_LOGIN_LIMITS, type LoginLimitOptions } from '../auth/loginLimits';

// Who may use a tracker nobody has set up an owner for: nobody (false), only requests made on this
// machine ('local', isLocalRequest), or anyone ('any': tests and scripts on throwaway databases).
export type OpenWithoutOwner = false | 'local' | 'any';

export interface AuthOptions {
  openWithoutOwner: OpenWithoutOwner;
  // How many proxies in front of the server add to X-Forwarded-For (TRUST_PROXY).
  trustedProxies: number;
  // Cookies are Secure on https anyway; this makes them Secure on every request.
  secureCookies: boolean;
  loginLimits: LoginLimitOptions;
}

// Tests and scripts build apps on throwaway databases without an owner. main.ts always passes
// the real settings from the environment (config.ts), which never open a server to anyone.
export const DEFAULT_AUTH_OPTIONS: AuthOptions = {
  openWithoutOwner: 'any',
  trustedProxies: 0,
  secureCookies: false,
  loginLimits: DEFAULT_LOGIN_LIMITS,
};
