import { useQuery } from '@tanstack/react-query';
import type { TicketsAcrossProjects } from '@tracker/shared';
import { withStatuses } from '../cache/ready';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerQuery } from '../types';

export function useReadyForYou(): TrackerQuery<TicketsAcrossProjects> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.ready(),
    queryFn: async () => withStatuses(await client.listAllTickets({ category: 'reviewed' })),
  });
}
