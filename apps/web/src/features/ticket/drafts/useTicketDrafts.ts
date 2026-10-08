import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { UpdateTicketInput } from '@tracker/shared';
import { useCallback, useEffect } from 'react';
import { useApi, useUpdateComment, useUpdateTicket } from '../../../api';
import { createReachability, watchApiTraffic } from '../../../app/reachability';
import { useToast } from '../../../components';
import { guardUnload } from '../../../lib/drafts';
import type { StoredDraft } from '../../../lib/storedDrafts';
import { useLatest } from '../../../lib/useLatest';
import { runDraftSync, syncDrafts, type DraftSyncDeps, type DraftSyncReport } from './syncDrafts';

const fieldInput = (draft: StoredDraft): UpdateTicketInput => {
  if (draft.field === 'title') return { title: draft.text };
  return draft.field === 'description' ? { description: draft.text } : { assignee: draft.text };
};

// Through the same mutations as the screen: the board and ticket caches follow, the offline
// banner hears of failures, and an app update waits for the write.
function useSyncDeps(): DraftSyncDeps {
  const client = useApi();
  const updateTicket = useUpdateTicket().mutateAsync;
  const updateComment = useUpdateComment().mutateAsync;
  return {
    fetchTicket: (ticketKey) => client.getTicket(ticketKey),
    save: (draft) =>
      draft.field === 'comment-edit'
        ? updateComment({
            ticketKey: draft.ticketKey,
            activityId: draft.activityId ?? '',
            text: draft.text,
          })
        : updateTicket({ ticketKey: draft.ticketKey, input: fieldInput(draft) }),
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
      if (changed) show(`Your edit to ${changed.ticketKey} isn't saved: it changed elsewhere.`);
    });
  }, [deps, show]);
}

export const RETRY_GAP_MS = 10_000;

// A retry that fails makes the tracker look unreachable, and the refetch after it reachable
// again (also when a service worker answers reads from its cache), which would start the next
// retry at once. So retries on that signal wait until RETRY_GAP_MS after the last one.
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

function syncOnReconnect(queryClient: QueryClient, sync: () => void): () => void {
  const runs = spacedRuns(sync);
  const reachability = createReachability();
  const stopWatching = watchApiTraffic(queryClient, reachability);
  const stopListening = reachability.subscribe(() => {
    if (!reachability.isUnreachable()) runs.soon();
  });
  window.addEventListener('online', runs.now);
  runs.now();
  return () => {
    runs.stop();
    stopWatching();
    stopListening();
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
