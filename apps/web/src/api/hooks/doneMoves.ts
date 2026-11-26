import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TicketMoves, TicketPlaceInput, TicketsAcrossProjects } from '@tracker/shared';
import { moveBoardTicketsToDone, placeBoardTickets } from '../cache/board';
import { withoutTickets } from '../cache/ready';
import { boardsChanges } from '../cacheChanges';
import { useApi } from '../context';
import { refreshForChange } from '../live/refreshForChange';
import { applyOptimistic, cacheChange, rollbackOnError } from '../optimistic';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation } from '../types';

// `ticketKeys` keeps each ticket and its project busy while the request is out (pending.ts), so
// a live update can't bring back what just left.
export interface MoveToDoneVariables {
  ticketKeys: string[];
}

export interface UndoMoveToDoneVariables {
  ticketKeys: string[];
  places: TicketPlaceInput[];
}

export function useMoveToDone(): TrackerMutation<TicketMoves, MoveToDoneVariables> {
  const client = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketKeys }: MoveToDoneVariables) => client.moveToDone(ticketKeys),
    onMutate: ({ ticketKeys }) =>
      applyOptimistic(queryClient, [
        cacheChange<TicketsAcrossProjects>(queryKeys.ready(), (list) =>
          withoutTickets(list, ticketKeys),
        ),
        ...boardsChanges(ticketKeys, (board) => moveBoardTicketsToDone(board, ticketKeys)),
      ]),
    onError: rollbackOnError,
    onSettled: (_moves, _error, variables) => refreshForChange(queryClient, null, variables),
  });
}

// The ready list gets its tickets back from the refetch once they are saved.
export function useUndoMoveToDone(): TrackerMutation<TicketMoves, UndoMoveToDoneVariables> {
  const client = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ places }: UndoMoveToDoneVariables) => client.undoMoveToDone(places),
    onMutate: ({ ticketKeys, places }) =>
      applyOptimistic(
        queryClient,
        boardsChanges(ticketKeys, (board) => placeBoardTickets(board, places)),
      ),
    onError: rollbackOnError,
    onSettled: (_moves, _error, variables) => refreshForChange(queryClient, null, variables),
  });
}
