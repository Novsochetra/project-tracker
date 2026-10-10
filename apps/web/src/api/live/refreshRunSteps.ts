import type { QueryClient } from '@tanstack/react-query';
import type { RunStep } from '@tracker/shared';
import { queryKeys } from '../queryKeys';
import { lastSeq } from '../runSteps';

// A read on its way is left to land: cancelled by each step event, none landed on a slow network
// (test/regression/step-reads-starve). It may have started before the steps an event tells of, so
// once it lands the phone reads again while it is still behind. With no count (a run's end), the
// steps it brought are unknown, so a read that was on its way is followed by one more.
export async function refreshRunSteps(
  queryClient: QueryClient,
  runId: string,
  count?: number,
): Promise<void> {
  const queryKey = queryKeys.runSteps(runId);
  const have = () => lastSeq(queryClient.getQueryData<RunStep[]>(queryKey) ?? []);
  if (count !== undefined && have() >= count) return;
  const before = have();
  const wasReading = queryClient.getQueryState(queryKey)?.fetchStatus === 'fetching';
  await queryClient.invalidateQueries({ queryKey, exact: true }, { cancelRefetch: false });
  const behind = count === undefined ? wasReading : have() < count;
  // A read of its own that brought nothing (it failed, or nobody shows the steps) ends the catching up.
  if (behind && (wasReading || have() > before)) await refreshRunSteps(queryClient, runId, count);
}
