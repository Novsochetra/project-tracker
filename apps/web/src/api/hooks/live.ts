import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useApi } from '../context';
import { connectLiveUpdates } from '../live/eventStream';
import { refreshForChange } from '../live/refreshForChange';

export function useLiveUpdates(): void {
  const client = useApi();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      connectLiveUpdates(client.eventsUrl(), {
        onChange: (event) => refreshForChange(queryClient, event),
        onReconnect: () => refreshForChange(queryClient, null),
      }),
    [client, queryClient],
  );
}
