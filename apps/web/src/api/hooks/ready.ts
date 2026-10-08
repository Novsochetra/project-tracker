import { useQuery } from '@tanstack/react-query';
import type { TicketListItem } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerQuery } from '../types';

export function useReadyForYou(): TrackerQuery<TicketListItem[]> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.ready(),
    queryFn: () => client.listAllTickets({ category: 'reviewed' }),
  });
}
