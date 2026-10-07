import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MoveTicketInput, Ticket, UpdateTicketInput } from '@tracker/shared';
import { moveBoardTicket, patchBoardTicket } from '../cache/board';
import { patchTicketDetail } from '../cache/ticketDetail';
import { boardChanges, ticketChange } from '../cacheChanges';
import { useApi } from '../context';
import { applyOptimistic, rollbackOnError } from '../optimistic';
import { refreshPeople, settleMutation } from '../refresh';
import type { TrackerMutation } from '../types';

export interface UpdateTicketVariables {
  ticketKey: string;
  input: UpdateTicketInput;
}

export interface MoveTicketVariables {
  ticketKey: string;
  input: MoveTicketInput;
}

export function useUpdateTicket(): TrackerMutation<Ticket, UpdateTicketVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketKey, input }: UpdateTicketVariables) =>
      client.updateTicket(ticketKey, input),
    onMutate: ({ ticketKey, input }) =>
      applyOptimistic(queryClient, [
        ...boardChanges(ticketKey, (board) => patchBoardTicket(board, ticketKey, input)),
        ticketChange(ticketKey, (detail) => patchTicketDetail(detail, input)),
      ]),
    onError: rollbackOnError,
    onSettled: (_ticket, _error, variables) => {
      settleMutation(queryClient, variables);
      if (variables.input.assignee !== undefined) refreshPeople(queryClient);
    },
  });
}

export function useMoveTicket(): TrackerMutation<Ticket, MoveTicketVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketKey, input }: MoveTicketVariables) => client.moveTicket(ticketKey, input),
    onMutate: ({ ticketKey, input }) =>
      applyOptimistic(queryClient, [
        ...boardChanges(ticketKey, (board) => moveBoardTicket(board, ticketKey, input)),
        ticketChange(ticketKey, (detail) =>
          patchTicketDetail(detail, { statusId: input.statusId }),
        ),
      ]),
    onError: rollbackOnError,
    onSettled: (_ticket, _error, variables) => settleMutation(queryClient, variables),
  });
}
