import type { RunRequest } from '@tracker/shared';
import { useMemo } from 'react';
import { useRunRequests } from '../../api/hooks/runRequests';
import { useNow } from '../../lib/useNow';
import { isWaiting, shownRequests } from './requestState';

export interface RunRequests {
  shown: RunRequest[];
  waiting: boolean;
  now: number;
  loaded: boolean;
}

export function useRequests(runId: string | null): RunRequests {
  const { data: requests, isFetching } = useRunRequests(runId);
  const now = useNow();
  return useMemo(() => {
    const all = runId ? (requests ?? []) : [];
    // Requests cached from an earlier visit may be stale (a request event only marks them so);
    // they count as read once the read they get on mount is back.
    const loaded = runId !== null && requests !== undefined && !isFetching;
    return { shown: shownRequests(all, now), waiting: isWaiting(all, now), now, loaded };
  }, [runId, requests, isFetching, now]);
}
