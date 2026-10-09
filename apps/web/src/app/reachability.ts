import { hashKey, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api';
import { lastAnswerWasSaved } from '../pwa/savedAnswers';
import { signalOf, type ApiSignal } from './offline';
import { recheckWhileUnreachable } from './recheck';
import type { TrackerCheck } from './trackerCheck';

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

export interface TrafficOptions {
  // Only the banner's watcher asks the tracker again while it can't be reached (app/recheck): a
  // schedule in each watcher would send twice the checks.
  recheck?: boolean;
}

export function watchApiTraffic(
  queryClient: QueryClient,
  reachability: Reachability,
  check: TrackerCheck,
  options: TrafficOptions = {},
): () => void {
  let stopped = false;
  let checking = false;
  // The sidebar and breadcrumb read the project list; one that failed during the outage stays empty.
  const refreshProjects = () =>
    void queryClient.invalidateQueries(
      { queryKey: queryKeys.projects(), exact: true },
      { cancelRefetch: false },
    );
  const settle = (signal: ApiSignal | null, fromProjects: boolean) => {
    if (signal === null || signal === 'unsure') return;
    if (!reachability.setUnreachable(signal === 'unreachable')) return;
    if (signal === 'reachable' && !fromProjects) refreshProjects();
  };
  // Unreachable already, a bare 5xx changes nothing.
  const confirm = () => {
    if (checking || reachability.isUnreachable()) return;
    checking = true;
    void check().then((signal) => {
      checking = false;
      if (!stopped) settle(signal, false);
    });
  };
  const apply = (signal: ApiSignal | null, fromProjects: boolean) =>
    signal === 'unsure' ? confirm() : settle(signal, fromProjects);
  const recheck = () =>
    check().then((signal) => {
      if (!stopped) settle(signal, false);
    });
  const stopRechecks = options.recheck
    ? recheckWhileUnreachable(reachability, recheck)
    : () => undefined;
  const stopQueries = queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated') {
      const signal = signalOf(event.action, lastAnswerWasSaved());
      apply(signal, event.query.queryHash === PROJECTS_HASH);
    }
  });
  // Writes never come from the service worker's cache.
  const stopMutations = queryClient.getMutationCache().subscribe((event) => {
    if (event.type === 'updated') apply(signalOf(event.action), false);
  });
  return () => {
    stopped = true;
    stopQueries();
    stopMutations();
    stopRechecks();
  };
}
