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
  const requests = useRunRequests(runId).data;
  const now = useNow();
  return useMemo(() => {
    const all = runId ? (requests ?? []) : [];
    const loaded = runId !== null && requests !== undefined;
    return { shown: shownRequests(all, now), waiting: isWaiting(all, now), now, loaded };
  }, [runId, requests, now]);
}
