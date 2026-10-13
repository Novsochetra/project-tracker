import { useQuery } from '@tanstack/react-query';
import type { ProjectUsage } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerQuery } from '../types';

export function useProjectUsage(projectKey: string): TrackerQuery<ProjectUsage> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.projectUsage(projectKey),
    queryFn: () => client.getProjectUsage(projectKey),
  });
}
