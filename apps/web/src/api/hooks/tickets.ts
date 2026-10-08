import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { TrackerClient } from '@tracker/client';
import type {
  CreateTicketInput,
  MarkSentInput,
  ProjectBoard,
  ProjectDetail,
  Ticket,
  TicketDetail,
} from '@tracker/shared';
import { removeBoardTicket, upsertBoardTicket } from '../cache/board';
import { withNextNum } from '../cache/projects';
import { withTicket } from '../cache/ticketDetail';
import { boardChanges, ticketChange } from '../cacheChanges';
import { useApi } from '../context';
import { markDeleted } from '../deleted';
import { isNetworkError } from '../errors';
import { changesBefore, markRead } from '../freshReads';
import { applyOptimistic, cacheChange, patchCaches, rollbackOnError } from '../optimistic';
import { queryKeys } from '../queryKeys';
import { refreshPeople, settleMutation } from '../refresh';
import type { TrackerMutation, TrackerQuery } from '../types';

export interface CreateTicketVariables {
  projectKey: string;
  input: CreateTicketInput;
}

export interface DeleteTicketVariables {
  ticketKey: string;
}

export interface MarkSentVariables {
  ticketKey: string;
  input: MarkSentInput;
}

// A ticket changed since its last fresh read is read fresh, because the service worker's copy may
// be older than the change. When that read gets no answer, a copy on screen stays; without one
// (such as after a reload), the saved copy still beats nothing while the tracker can't be reached.
async function readTicket(client: TrackerClient, queryClient: QueryClient, ticketKey: string) {
  const changes = changesBefore(queryClient, ticketKey);
  if (changes === undefined) return client.getTicket(ticketKey);
  try {
    const detail = await client.getTicket(ticketKey, { fresh: true });
    markRead(queryClient, ticketKey, changes);
    return detail;
  } catch (error) {
    const shown = queryClient.getQueryData(queryKeys.ticket(ticketKey)) !== undefined;
    if (shown || !isNetworkError(error)) throw error;
    return client.getTicket(ticketKey);
  }
}

export function useTicket(ticketKey: string): TrackerQuery<TicketDetail> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.ticket(ticketKey),
    queryFn: () => readTicket(client, queryClient, ticketKey),
  });
}

export function useCreateTicket(): TrackerMutation<Ticket, CreateTicketVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, input }: CreateTicketVariables) =>
      client.createTicket(projectKey, input),
    onSuccess: (ticket, { projectKey, input }) =>
      patchCaches(queryClient, [
        cacheChange<ProjectBoard>(queryKeys.board(projectKey), (board) =>
          upsertBoardTicket(board, ticket, { attachmentCount: input.attachmentIds?.length ?? 0 }),
        ),
        cacheChange<ProjectDetail>(queryKeys.project(projectKey), (detail) =>
          withNextNum(detail, ticket.num),
        ),
      ]),
    onSettled: (_ticket, _error, variables) => {
      settleMutation(queryClient, variables);
      if (variables.input.assignee?.trim()) refreshPeople(queryClient);
    },
  });
}

export function useDeleteTicket(): TrackerMutation<void, DeleteTicketVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketKey }: DeleteTicketVariables) => client.deleteTicket(ticketKey),
    onMutate: ({ ticketKey }) =>
      applyOptimistic(
        queryClient,
        boardChanges(ticketKey, (board) => removeBoardTicket(board, ticketKey)),
      ),
    onError: rollbackOnError,
    onSuccess: (_result, { ticketKey }) => {
      markDeleted(queryClient, ticketKey);
      queryClient.removeQueries({ queryKey: queryKeys.ticket(ticketKey), type: 'inactive' });
    },
    onSettled: (_result, _error, variables) => settleMutation(queryClient, variables),
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
