import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createReachability, watchApiTraffic, type Reachability } from './reachability';
import { useOnline } from './useOnline';

/** One store for the app, watching every request; the banner and capture sync both follow it. */
export function useReachability(): Reachability {
  const queryClient = useQueryClient();
  const [reachability] = useState(createReachability);
  useEffect(() => watchApiTraffic(queryClient, reachability), [queryClient, reachability]);
  return reachability;
}

export function useApiUnreachable(reachability: Reachability): boolean {
  const online = useOnline();
  const unreachable = useSyncExternalStore(reachability.subscribe, reachability.isUnreachable);
  return !online || unreachable;
}
