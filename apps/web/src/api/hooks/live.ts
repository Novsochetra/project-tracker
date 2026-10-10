import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useApi } from '../context';
import { connectLiveUpdates, type TrackerReachability } from '../live/eventStream';
import { refreshForChange } from '../live/refreshForChange';
import { refreshForRun, refreshForRunRequest } from '../live/refreshForRun';
import { refreshRunSteps } from '../live/refreshRunSteps';
import { setLiveRefreshPending } from '../live/refreshPending';
import { recheckSession } from './session';

export function useLiveUpdates(tracker?: TrackerReachability): void {
  const client = useApi();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      connectLiveUpdates(
        client.eventsUrl(),
        {
          onChange: (event) => refreshForChange(queryClient, event),
          onRun: (event) => refreshForRun(queryClient, event),
          onRunStep: (event) => void refreshRunSteps(queryClient, event.runId, event.count),
          onRunRequest: (event) => refreshForRunRequest(queryClient, event),
          onReconnect: () => refreshForChange(queryClient, null),
          onRefreshPending: (pending) => setLiveRefreshPending(queryClient, pending),
          // Signing out shows the token screen, which ends the stream's retries.
          onRefused: () => void recheckSession(client, queryClient),
        },
        tracker,
      ),
    [client, queryClient, tracker],
  );
}
