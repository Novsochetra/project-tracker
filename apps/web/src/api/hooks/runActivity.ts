import { useQuery } from '@tanstack/react-query';
import type { RunActivity } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerQuery } from '../types';
import { WORKING_RUN_REFRESH_MS } from '../workingRun';

// Events refresh the list as runs start and end; the timer is for a helper that went silent, which
// the tracker only ends when asked.
export function useRunActivity(): TrackerQuery<RunActivity> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.runActivity(),
    queryFn: () => client.listRunActivity(),
    refetchInterval: ({ state: { data } }) =>
      data?.runs.length || data?.batches.length ? WORKING_RUN_REFRESH_MS : false,
  });
}
