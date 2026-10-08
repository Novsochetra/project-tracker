import { hashKey, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api';
import { signalOf, type ApiSignal } from './offline';

export interface Reachability {
  isUnreachable: () => boolean;
  subscribe: (listener: () => void) => () => void;
  setUnreachable: (unreachable: boolean) => boolean;
}

export function createReachability(): Reachability {
  let unreachable = false;
  const listeners = new Set<() => void>();
  return {
    isUnreachable: () => unreachable,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setUnreachable: (next) => {
      if (next === unreachable) return false;
      unreachable = next;
      listeners.forEach((listener) => listener());
      return true;
    },
  };
}

const PROJECTS_HASH = hashKey(queryKeys.projects());

export function watchApiTraffic(queryClient: QueryClient, reachability: Reachability): () => void {
  // The sidebar and breadcrumb read the project list; one that failed during the outage stays empty.
  const refreshProjects = () =>
    void queryClient.invalidateQueries(
      { queryKey: queryKeys.projects(), exact: true },
      { cancelRefetch: false },
    );
  const apply = (signal: ApiSignal | null, fromProjects: boolean) => {
    if (signal === null || !reachability.setUnreachable(signal === 'unreachable')) return;
    if (signal === 'reachable' && !fromProjects) refreshProjects();
  };
  const stopQueries = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated') {
      apply(signalOf(event.action), event.query.queryHash === PROJECTS_HASH);
    }
  });
  const stopMutations = queryClient.getMutationCache().subscribe((event) => {
    if (event.type === 'updated') apply(signalOf(event.action), false);
  });
  return () => {
    stopQueries();
    stopMutations();
  };
}
