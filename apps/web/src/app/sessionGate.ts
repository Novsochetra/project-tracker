import { INVITE_PATH, RESET_PATH, type SessionState } from '@tracker/shared';

export type LinkPage = 'invite' | 'reset';

export type Gate = 'loading' | 'login' | LinkPage | 'app';

export interface SessionSnapshot {
  data: SessionState | undefined;
  fetchStatus: 'fetching' | 'paused' | 'idle';
}

export function linkPageOf(pathname: string): LinkPage | undefined {
  if (pathname === INVITE_PATH) return 'invite';
  if (pathname === RESET_PATH) return 'reset';
  return undefined;
}

// A link's page shows whatever the session says: the invite page tells a signed-in person to sign
// out first, and the reset page works signed in or not.
export function gateFor({ data, fetchStatus }: SessionSnapshot, linkPage?: LinkPage): Gate {
  if (!data && fetchStatus === 'fetching') return 'loading';
  if (linkPage) return linkPage;
  if (data) return data.authRequired && !data.authenticated ? 'login' : 'app';
  // Offline the session request pauses or fails; the app still works from the offline cache.
  return 'app';
}
