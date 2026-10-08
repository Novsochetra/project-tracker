import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createReachability, watchApiTraffic } from './reachability';
import { useOnline } from './useOnline';

export function useApiUnreachable(): boolean {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [reachability] = useState(createReachability);
  useEffect(() => watchApiTraffic(queryClient, reachability), [queryClient, reachability]);
  const unreachable = useSyncExternalStore(reachability.subscribe, reachability.isUnreachable);
  return !online || unreachable;
}
