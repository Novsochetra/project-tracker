import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { useApi } from '../../../api';
import { createReachability, watchApiTraffic } from '../../../app/reachability';
import { useToast } from '../../../components';
import { guardUnload } from '../../../lib/drafts';
import type { StoredDraft } from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import {
  hasClosedDrafts,
  runDraftSync,
  syncDrafts,
  type DraftSyncDeps,
  type DraftSyncReport,
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

function useDraftSync(): () => void {
  const deps = useLatest(useSyncDeps());
  const { show } = useToast();
  return useCallback(() => {
    runDraftSync(async () => {
      if (navigator.onLine === false) return;
      const changed = firstNewChange(await syncDrafts(deps.current));
      if (!changed) return;
      show(`Your edit to ${changed.ticketKey} isn't saved: it changed elsewhere.`, {
        kind: 'error',
      });
    });
  }, [deps, show]);
}

export const RETRY_GAP_MS = 10_000;

// A retry that fails makes the tracker look unreachable, and the refetch after it reachable
// again, which would start the next retry at once. So retries on that signal wait until
// RETRY_GAP_MS after the last one.
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

// A change the tracker reports (a live update refreshes the cache) may be the deletion of a
// ticket with kept text, which only a run finds out. A save refreshes the cache too, from its own
// callbacks while it still counts as pending; a refused one would otherwise start a run every
// RETRY_GAP_MS.
function onReportedChange(queryClient: QueryClient, run: () => void): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'invalidate') return;
    if (queryClient.isMutating() === 0 && hasClosedDrafts()) run();
  });
}

function syncOnReconnect(queryClient: QueryClient, sync: () => void): () => void {
  const runs = spacedRuns(sync);
  const reachability = createReachability();
  const stopWatching = watchApiTraffic(queryClient, reachability);
  const stopListening = reachability.subscribe(() => {
    if (!reachability.isUnreachable()) runs.soon();
  });
  const stopChanges = onReportedChange(queryClient, runs.soon);
  window.addEventListener('online', runs.now);
  runs.now();
  return () => {
    runs.stop();
    stopWatching();
    stopListening();
    stopChanges();
    window.removeEventListener('online', runs.now);
  };
}

// App-wide, so text left in a ticket that isn't open is saved too.
export function useTicketDrafts(enabled: boolean): void {
  useEffect(guardUnload, []);
  const sync = useDraftSync();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return syncOnReconnect(queryClient, sync);
  }, [enabled, queryClient, sync]);
}
