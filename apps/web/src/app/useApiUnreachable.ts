import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { lastAnswerWasSaved, subscribeSavedAnswers, watchSavedAnswers } from '../pwa/savedAnswers';
import { createReachability, watchApiTraffic, type Reachability } from './reachability';
import { useOnline } from './useOnline';

// Called once for the app, so the banner and capture sync follow the same store.
export function useReachability(): Reachability {
  const queryClient = useQueryClient();
  const [reachability] = useState(createReachability);
  // A layout effect, so it is in place before the screens' first requests start in their effects.
  useLayoutEffect(() => watchSavedAnswers(window), []);
  useEffect(() => watchApiTraffic(queryClient, reachability), [queryClient, reachability]);
  return reachability;
}

export function useApiUnreachable(reachability: Reachability): boolean {
  const online = useOnline();
  const unreachable = useSyncExternalStore(reachability.subscribe, reachability.isUnreachable);
  return !online || unreachable;
}

export const useShowsSavedData = (): boolean =>
  useSyncExternalStore(subscribeSavedAnswers, lastAnswerWasSaved, () => false);
