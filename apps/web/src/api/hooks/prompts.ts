import { useQuery } from '@tanstack/react-query';
import type { PromptResult } from '@tracker/shared';
import { useApi } from '../context';
import { queryKeys } from '../queryKeys';
import type { TrackerQuery } from '../types';

export interface PromptOptions {
  enabled?: boolean;
}

// The sheet copies the prompt into an editable box, so never start it from an old cached copy.
const FRESH_ONLY = { staleTime: 0, gcTime: 0, refetchOnWindowFocus: false } as const;

export function useTicketPrompt(
  ticketKey: string,
  { enabled = true }: PromptOptions = {},
): TrackerQuery<PromptResult> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.ticketPrompt(ticketKey),
    queryFn: () => client.getTicketPrompt(ticketKey),
    enabled,
    ...FRESH_ONLY,
  });
}

export function useProjectPrompt(
  projectKey: string,
  { enabled = true }: PromptOptions = {},
): TrackerQuery<PromptResult> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.projectPrompt(projectKey),
    queryFn: () => client.getProjectPrompt(projectKey),
    enabled,
    ...FRESH_ONLY,
  });
}
