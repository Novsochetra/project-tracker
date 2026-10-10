import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RunStep } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import { lastSeq, mergeSteps } from '../runSteps';
import type { TrackerQuery } from '../types';

// Steps only come after the ones the phone has, so each read on a step event, a run event or a
// reconnect (api/live) asks for those alone.
export function useRunSteps(
  runId: string,
  { enabled = true }: { enabled?: boolean } = {},
): TrackerQuery<RunStep[]> {
  const client = useApi();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.runSteps(runId);
  return useQuery({
    queryKey,
    queryFn: async () => {
      const have = queryClient.getQueryData<RunStep[]>(queryKey) ?? [];
      return mergeSteps(have, await client.listRunSteps(runId, { after: lastSeq(have) }));
    },
    enabled,
  });
}
