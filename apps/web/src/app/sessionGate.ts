import type { SessionState } from '@tracker/shared';

export type Gate = 'loading' | 'login' | 'invite' | 'app';

export interface SessionSnapshot {
  data: SessionState | undefined;
  fetchStatus: 'fetching' | 'paused' | 'idle';
}

// The invite page shows whatever the session says: it tells a signed-in person to sign out first.
export function gateFor({ data, fetchStatus }: SessionSnapshot, onInvitePage = false): Gate {
  if (!data && fetchStatus === 'fetching') return 'loading';
  if (onInvitePage) return 'invite';
  if (data) return data.authRequired && !data.authenticated ? 'login' : 'app';
  // Offline the session request pauses or fails; the app still works from the offline cache.
  return 'app';
}
