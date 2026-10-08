import { MutationObserver, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { TrackerClient } from '@tracker/client';
import { useCallback, useEffect } from 'react';
import { queryKeys, useApi } from '../../api';
import type { Reachability } from '../../app/reachability';
import { useToast, type ToastApi } from '../../components';
import { addedToast, createInputOf, droppedToast } from './captureForm';
import { matchesCapture, searchTextFor } from './captureLookup';
import type { QueuedCapture } from './captureQueue';
import { queueStore } from './queueStore';
import { syncCaptures, type SyncReport } from './syncCaptures';
import { claimCapture, runCaptureSync } from './syncRunner';

// Through the mutation cache, so an app update waits for the write and reachability hears of it.
const sendWith = (queryClient: QueryClient, client: TrackerClient) => (capture: QueuedCapture) =>
  new MutationObserver(queryClient, {
    mutationFn: () => client.createTicket(capture.projectKey, createInputOf(capture)),
  }).mutate();

const existsWith = (client: TrackerClient) => async (capture: QueuedCapture) => {
  const q = searchTextFor(capture.title);
  const tickets = await client.listTickets(capture.projectKey, { q });
  return tickets.some((ticket) => matchesCapture(ticket, capture));
};

function refreshAfter(queryClient: QueryClient, report: SyncReport): void {
  const settled = [...report.added, ...report.dropped];
  if (settled.length === 0) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects(), exact: true });
  for (const projectKey of new Set(settled.map((capture) => capture.projectKey))) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectKey) });
  }
}

function announce(report: SyncReport, show: ToastApi['show']): void {
  const [dropped] = report.dropped;
  if (dropped) show(droppedToast(dropped.title));
  else if (report.added.length > 0) show(addedToast(report.added.length));
}

// Sends the captures waiting on this device; calls while one runs join it.
function useSyncCaptures(): () => Promise<void> {
  const client = useApi();
  const queryClient = useQueryClient();
  const { show } = useToast();
  return useCallback(async () => {
    if (navigator.onLine === false) return;
    await runCaptureSync(async () => {
      const report = await syncCaptures({
        queue: queueStore,
        send: sendWith(queryClient, client),
        exists: existsWith(client),
        claim: claimCapture,
      });
      refreshAfter(queryClient, report);
      announce(report, show);
      return report;
    });
  }, [client, queryClient, show]);
}

function onReturn(sync: () => void): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') sync();
  };
  window.addEventListener('online', sync);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener('online', sync);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

// Syncs on start, when the tracker can be reached again, and when the device or app returns.
export function useCaptureSync(reachability: Reachability): void {
  const runSync = useSyncCaptures();
  useEffect(() => {
    const sync = () => void runSync();
    sync();
    const stopListening = reachability.subscribe(() => {
      if (!reachability.isUnreachable()) sync();
    });
    const stopWatching = onReturn(sync);
    return () => {
      stopListening();
      stopWatching();
    };
  }, [reachability, runSync]);
}
