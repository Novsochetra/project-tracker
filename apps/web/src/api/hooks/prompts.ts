import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MarkSentInput, PromptResult, Ticket } from '@tracker/shared';
import { upsertBoardTicket } from '../cache/board';
import { withTicket } from '../cache/ticketDetail';
import { boardChanges, ticketChange } from '../cacheChanges';
import { useApi } from '../context';
import { patchCaches } from '../optimistic';
import { queryKeys } from '../queryKeys';
import { settleMutation } from '../refresh';
import type { TrackerMutation, TrackerQuery } from '../types';

export interface MarkSentVariables {
  ticketKey: string;
  input: MarkSentInput;
}

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

export function useMarkSent(): TrackerMutation<Ticket, MarkSentVariables> {
  const client = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketKey, input }: MarkSentVariables) => client.markSent(ticketKey, input),
    onSuccess: (ticket, { ticketKey }) =>
      patchCaches(queryClient, [
        ...boardChanges(ticketKey, (board) => upsertBoardTicket(board, ticket)),
        ticketChange(ticketKey, (detail) => withTicket(detail, ticket)),
      ]),
    onSettled: (_ticket, _error, variables) => settleMutation(queryClient, variables),
  });
}
