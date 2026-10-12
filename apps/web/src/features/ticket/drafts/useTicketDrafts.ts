import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { projectOfQuery, useApi } from '../../../api';
import { createReachability, watchApiTraffic } from '../../../app/reachability';
import { trackerCheckOf, type TrackerCheck } from '../../../app/trackerCheck';
import { useToast } from '../../../components';
import { onDraftsNotKept } from '../../../lib/draftStorage';
import { guardUnload } from '../../../lib/drafts';
import type { StoredDraft } from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import { onOtherTabsMarks } from '../fields/saveMarks';
import {
  hasClosedDrafts,
  hasLeftSends,
  runDraftSync,
  syncDrafts,
  type DraftSyncDeps,
  type DraftSyncReport,
  type SyncScope,
} from './syncDrafts';
import { useDraftSave } from './useDraftSave';

function useSyncDeps(): DraftSyncDeps {
  const client = useApi();
  return {
    fetchTicket: (ticketKey) => client.getTicket(ticketKey, { fresh: true }),
    save: useDraftSave(),
  };
}

const announced = new Set<string>();

// Once per draft: the ticket itself says so for as long as the draft waits.
function firstNewChange(report: DraftSyncReport): StoredDraft | undefined {
  const fresh = report.changed.find(([id]) => !announced.has(id));
  report.changed.forEach(([id]) => announced.add(id));
  return fresh?.[1];
}

// The scope is taken as a run starts, so a run asked for while another goes covers what was
// asked meanwhile.
function useDraftSync(): (takeScope: () => SyncScope) => void {
  const deps = useLatest(useSyncDeps());
  const { show } = useToast();
  return useCallback(
    (takeScope) => {
      runDraftSync(async () => {
        const changed = firstNewChange(await syncDrafts(deps.current, takeScope()));
        if (!changed) return;
        show(`Your edit to ${changed.ticketKey} isn't saved: it changed elsewhere.`, {
          kind: 'error',
        });
      });
    },
    [deps, show],
  );
}

export const RETRY_GAP_MS = 10_000;

// A page that went while it saved leaves what it saved kept for this sync, which reads the ticket
// once that page's marks stop counting: as the page goes (closed or killed), or a minute on when
// nothing says so (a page the browser froze, a browser without Web Locks). A moment later, so a
// request that reached the tracker as the page went has landed.
export const LEFT_SAVE_WAIT_MS = 1_000;

function runLater(run: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    soon: () => {
      timer ??= setTimeout(() => {
        timer = undefined;
        run();
      }, ms);
    },
    stop: () => clearTimeout(timer),
  };
}

// A retry that fails makes the tracker look unreachable, and the refetch after it reachable
// again, or gets a bare 5xx that the check finds answered, which would start the next retry at
// once. So retries on those signals wait until RETRY_GAP_MS after the last one.
function spacedRuns(sync: () => void) {
  let last = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const now = () => {
    clearTimeout(timer);
    timer = undefined;
    last = Date.now();
    sync();
  };
  const soon = () => {
    timer ??= setTimeout(now, Math.max(0, last + RETRY_GAP_MS - Date.now()));
  };
  return { now, soon, stop: () => clearTimeout(timer) };
}

// What the next run reads: every closed ticket with kept text, or only those in the projects
// whose queries a reported change refreshed.
function scopeOfNextRun() {
  let next: SyncScope = new Set<string>();
  return {
    all: () => {
      next = 'all';
    },
    add: (projectKey: string) => {
      if (next !== 'all') next = new Set(next).add(projectKey);
    },
    take: (): SyncScope => {
      const taken = next;
      next = new Set<string>();
      return taken;
    },
  };
}

// A change the tracker reports (a live update refreshes the cache) may be the deletion of a
// ticket with kept text, which only a run finds out. Such a ticket's project is refreshed with
// it, so only changes in projects with closed drafts start a run, which reads only their
// tickets: an unsent comment can sit for days. A save refreshes the cache too, from its own
// callbacks while it still counts as pending; a refused one would otherwise start a run every
// RETRY_GAP_MS.
function onReportedChange(queryClient: QueryClient, touch: (projectKey: string) => void) {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'invalidate') return;
    const projectKey = projectOfQuery(event.query.queryKey as QueryKey);
    if (!projectKey || queryClient.isMutating() > 0) return;
    if (hasClosedDrafts(new Set([projectKey]))) touch(projectKey);
  });
}

type Sync = (takeScope: () => SyncScope) => void;

// A bare 5xx the tracker answers its check around may have been a kept draft's own save, through
// a proxy whose connection broke. It is retried as after an outage, not at the next start,
// `online` or change in its project (PT-109); one the tracker keeps answering that way, every
// RETRY_GAP_MS.
const retryingAfter =
  (check: TrackerCheck, retry: () => void): TrackerCheck =>
  async () => {
    const signal = await check();
    if (signal === 'reachable') retry();
    return signal;
  };

function syncOnReconnect(queryClient: QueryClient, sync: Sync, check: TrackerCheck): () => void {
  const scope = scopeOfNextRun();
  const runs = spacedRuns(() => sync(scope.take));
  const all = {
    now: () => {
      scope.all();
      runs.now();
    },
    soon: () => {
      scope.all();
      runs.soon();
    },
  };
  let stopped = false;
  const reachability = createReachability();
  const stopWatching = watchApiTraffic(
    queryClient,
    reachability,
    retryingAfter(check, () => !stopped && all.soon()),
  );
  const { tracker } = reachability;
  const stopListening = tracker.subscribe(() => {
    if (!tracker.isUnreachable()) all.soon();
  });
  const stopChanges = onReportedChange(queryClient, (projectKey) => {
    scope.add(projectKey);
    runs.soon();
  });
  const leftSaves = runLater(all.now, LEFT_SAVE_WAIT_MS);
  // Most changes are a tab's saves settling, which that tab follows up itself, so only a comment a
  // page left on its way needs this sync then. A tab that went, or a mark that ran out, may have
  // left any kept text unsent (PT-135).
  const stopMarks = onOtherTabsMarks((news) => {
    if (news === 'left' ? hasClosedDrafts() : hasLeftSends()) leftSaves.soon();
  });
  window.addEventListener('online', all.now);
  all.now();
  return () => {
    stopped = true;
    runs.stop();
    stopWatching();
    stopListening();
    stopChanges();
    stopMarks();
    leftSaves.stop();
    window.removeEventListener('online', all.now);
  };
}

// Once each time storage starts refusing drafts: the text stays only in the page's memory. iOS
// doesn't ask before closing a page, so this toast is the only warning there, and the failed
// save that follows typing offline must not replace it.
function useNotKeptNote(): void {
  const { show } = useToast();
  useEffect(
    () =>
      onDraftsNotKept(() =>
        show("Unsaved text can't be kept on this device, so it's lost if this page closes.", {
          kind: 'error',
          important: true,
        }),
      ),
    [show],
  );
}

// App-wide, so text left in a ticket that isn't open is saved too.
export function useTicketDrafts(enabled: boolean): void {
  useEffect(guardUnload, []);
  useNotKeptNote();
  const sync = useDraftSync();
  const queryClient = useQueryClient();
  const client = useApi();
  useEffect(() => {
    if (!enabled) return;
    return syncOnReconnect(queryClient, sync, trackerCheckOf(client));
  }, [client, enabled, queryClient, sync]);
}
