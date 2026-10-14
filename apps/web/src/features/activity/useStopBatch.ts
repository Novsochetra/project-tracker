import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Run } from '@tracker/shared';
import { useApi } from '../../api/context';
import { refreshBatches } from '../../api/live/refreshBatches';
import type { TrackerMutation } from '../../api/types';

export function useStopBatch(): TrackerMutation<Run, string> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => client.cancelRun(runId),
    onSettled: () => refreshBatches(queryClient),
  });
}
