import type { SessionState } from '@tracker/shared';

export type Gate = 'loading' | 'token' | 'app';

export interface SessionSnapshot {
  data: SessionState | undefined;
  fetchStatus: 'fetching' | 'paused' | 'idle';
}

export function gateFor({ data, fetchStatus }: SessionSnapshot): Gate {
  if (data) return data.authRequired && !data.authenticated ? 'token' : 'app';
  // Offline the session request pauses or fails; the app still works from the offline cache.
  return fetchStatus === 'fetching' ? 'loading' : 'app';
}
