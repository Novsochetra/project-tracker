import { useQuery } from '@tanstack/react-query';
import type { HelperPlanUsage } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerQuery } from '../types';

// Read each time Account opens: the figures change only when a run ends.
export function usePlanUsage(): TrackerQuery<HelperPlanUsage[]> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.planUsage(),
    queryFn: () => client.listPlanUsage(),
    staleTime: 0,
  });
}
