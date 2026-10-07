import { useQuery } from '@tanstack/react-query';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerQuery } from '../types';

export function usePeople(): TrackerQuery<string[]> {
  const client = useApi();
  return useQuery({ queryKey: queryKeys.people(), queryFn: () => client.listPeople() });
}
