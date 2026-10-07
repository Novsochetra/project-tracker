import { useQuery } from '@tanstack/react-query';
import type { ServerMeta } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerQuery } from '../types';

export function useMeta(): TrackerQuery<ServerMeta> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.meta(),
    queryFn: () => client.getMeta(),
    staleTime: Infinity,
  });
}
