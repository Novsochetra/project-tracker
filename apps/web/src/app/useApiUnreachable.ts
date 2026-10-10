import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { useApi } from '../api';
import { lastAnswerWasSaved, subscribeSavedAnswers, watchSavedAnswers } from '../pwa/savedAnswers';
import { createReachability, watchApiTraffic, type Reachability } from './reachability';
import { trackerCheckOf } from './trackerCheck';
import { useOnline } from './useOnline';

// Called once for the app, so the banner, capture sync and the live stream follow the same stores.
export function useReachability(): Reachability {
  const queryClient = useQueryClient();
  const client = useApi();
  const [reachability] = useState(createReachability);
  // A layout effect, so it is in place before the screens' first requests start in their effects.
  useLayoutEffect(() => watchSavedAnswers(window), []);
  useEffect(
    () => watchApiTraffic(queryClient, reachability, trackerCheckOf(client), { recheck: true }),
    [client, queryClient, reachability],
  );
  return reachability;
}

export function useApiUnreachable(reachability: Reachability): boolean {
  const online = useOnline();
  const { banner } = reachability;
  const unreachable = useSyncExternalStore(banner.subscribe, banner.isUnreachable);
  return !online || unreachable;
}

// For the banner, which is up only while the tracker can't be reached. Once it said saved data is
// shown, it says so until it goes: the tracker's first answer when it is back is noted a moment
// before its request reports success, and for that moment it said "Can't reach the tracker"
// (PT-109).
export function useShowsSavedData(): boolean {
  const saved = useSyncExternalStore(subscribeSavedAnswers, lastAnswerWasSaved, () => false);
  const [shown, setShown] = useState(saved);
  if (saved && !shown) setShown(true);
  return saved || shown;
}
