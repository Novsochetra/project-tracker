import { DEFAULT_LOGIN_LIMITS, type LoginLimitOptions } from '../auth/loginLimits';

export interface AuthOptions {
  // No sign-in while nobody has set up the owner, for a tracker only this machine can reach.
  openWithoutOwner: boolean;
  // How many proxies in front of the server add to X-Forwarded-For (TRUST_PROXY).
  trustedProxies: number;
  // Cookies are Secure on https anyway; this makes them Secure on every request.
  secureCookies: boolean;
  loginLimits: LoginLimitOptions;
}

// Tests and scripts build apps on throwaway databases without an owner. main.ts always passes
// the real settings from the environment (config.ts), which leave a public server closed.
export const DEFAULT_AUTH_OPTIONS: AuthOptions = {
  openWithoutOwner: true,
  trustedProxies: 0,
  secureCookies: false,
  loginLimits: DEFAULT_LOGIN_LIMITS,
};
