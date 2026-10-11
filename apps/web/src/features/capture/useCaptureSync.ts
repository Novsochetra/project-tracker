import { MutationObserver, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { TrackerClient } from '@tracker/client';
import { useCallback, useEffect } from 'react';
import { queryKeys, refreshProjectList, useApi } from '../../api';
import type { Reachability } from '../../app/reachability';
import { useToast, type ToastApi } from '../../components';
import { addedToast, createInputOf, droppedToast, earlierTextToast } from './captureForm';
import type { QueuedCapture } from './captureQueue';
import { queueStore } from './queueStore';
import { sendCapture } from './sendCapture';
import { syncCaptures, type SyncReport } from './syncCaptures';
import { claimCapture, runCaptureSync } from './syncRunner';

// Through the mutation cache, so an app update waits for the write and reachability hears of it.
const sendWith = (queryClient: QueryClient, client: TrackerClient) => (capture: QueuedCapture) =>
  new MutationObserver(queryClient, {
    mutationFn: () =>
      sendCapture(capture, {
        create: () => client.createTicket(capture.projectKey, createInputOf(capture)),
        update: client.updateTicket,
      }),
  }).mutate();

function refreshAfter(queryClient: QueryClient, report: SyncReport): void {
  const settled = [...report.added, ...report.dropped];
  if (settled.length === 0) return;
  refreshProjectList(queryClient);
  for (const projectKey of new Set(settled.map((capture) => capture.projectKey))) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectKey) });
  }
}

function announce(report: SyncReport, show: ToastApi['show']): void {
  const [dropped] = report.dropped;
  const [unsaved] = report.unsaved;
  if (dropped) show(droppedToast(dropped.title), { kind: 'error' });
  else if (unsaved) show(earlierTextToast(unsaved), { kind: 'error' });
  else if (report.added.length > 0) show(addedToast(report.added.length));
}

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

export function useCaptureSync(reachability: Reachability): void {
  const runSync = useSyncCaptures();
  useEffect(() => {
    const sync = () => void runSync();
    sync();
    const { tracker } = reachability;
    const stopListening = tracker.subscribe(() => {
      if (!tracker.isUnreachable()) sync();
    });
    const stopWatching = onReturn(sync);
    return () => {
      stopListening();
      stopWatching();
    };
  }, [reachability, runSync]);
}
