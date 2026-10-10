import { hashKey, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api';
import { lastAnswerWasSaved } from '../pwa/savedAnswers';
import { signalOf, type ApiSignal } from './offline';
import { recheckWhileUnreachable } from './recheck';
import type { TrackerCheck } from './trackerCheck';
import { ANSWERING, nextState, showsBanner } from './trackerState';

export interface ReachabilityFlag {
  isUnreachable: () => boolean;
  subscribe: (listener: () => void) => () => void;
  setUnreachable: (unreachable: boolean) => boolean;
}

// Reads answered from saved copies keep the banner up while checks and writes get answers at once.
// What waits for the tracker (capture sync, the live stream) follows `tracker`. Following the
// banner, it waited for a read's answer too: a capture saved during an outage stayed queued while
// reads were slow (PT-126 review).
export interface Reachability {
  banner: ReachabilityFlag;
  tracker: ReachabilityFlag;
}

function createFlag(): ReachabilityFlag {
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

export const createReachability = (): Reachability => ({
  banner: createFlag(),
  tracker: createFlag(),
});

const becameReachable = (flag: ReachabilityFlag, unreachable: boolean): boolean =>
  flag.setUnreachable(unreachable) && !unreachable;

const PROJECTS_HASH = hashKey(queryKeys.projects());

type Source = 'request' | 'projects' | 'check';

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
  let state = ANSWERING;
  // The sidebar and breadcrumb read the project list; one that failed during the outage stays empty.
  const refreshProjects = () =>
    void queryClient.invalidateQueries(
      { queryKey: queryKeys.projects(), exact: true },
      { cancelRefetch: false },
    );
  // While saved reads keep the banner up, the list's read after a check's answer is what takes it
  // down when the tracker is back and reads are quick.
  const settle = (signal: ApiSignal | null, source: Source) => {
    if (signal === null || signal === 'unsure') return;
    state = nextState(state, signal, source === 'check');
    const bannerGone = becameReachable(reachability.banner, showsBanner(state));
    const trackerBack = becameReachable(reachability.tracker, !state.answers);
    if ((bannerGone || trackerBack) && source !== 'projects') refreshProjects();
  };
  // Unreachable already, a bare 5xx changes nothing.
  const confirm = () => {
    if (checking || reachability.banner.isUnreachable()) return;
    checking = true;
    void check().then((signal) => {
      checking = false;
      if (!stopped) settle(signal, 'check');
    });
  };
  const apply = (signal: ApiSignal | null, source: Source) =>
    signal === 'unsure' ? confirm() : settle(signal, source);
  const recheck = () =>
    check().then((signal) => {
      if (!stopped) settle(signal, 'check');
    });
  const stopRechecks = options.recheck
    ? recheckWhileUnreachable(reachability.banner, recheck)
    : () => undefined;
  const stopQueries = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return;
    const signal = signalOf(event.action, lastAnswerWasSaved());
    apply(signal, event.query.queryHash === PROJECTS_HASH ? 'projects' : 'request');
  });
  // Writes never come from the service worker's cache.
  const stopMutations = queryClient.getMutationCache().subscribe((event) => {
    if (event.type === 'updated') apply(signalOf(event.action), 'request');
  });
  return () => {
    stopped = true;
    stopQueries();
    stopMutations();
    stopRechecks();
  };
}
