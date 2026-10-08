import { notifyManager, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  parseTicketKey,
  type MoveTicketInput,
  type ProjectBoard,
  type ProjectDetail,
  type Status,
  type Ticket,
  type TicketDetail,
  type TicketsAcrossProjects,
} from '@tracker/shared';
import { useCallback } from 'react';
import { errorMessage, queryKeys, useApi, useMoveTicket } from '../../../api';
import { flashRows } from '../../../app/flash';
import { useToast } from '../../../components';
import { requestHandleFocus, rowHasFocus } from '../dnd/handleFocus';
import { moveMessage } from '../moveMessage';
import { restorePoint, undoTarget, type RestorePoint } from './restorePoint';

// `ticket` is the ticket as it was before the move.
export type ShowMove = (ticket: Ticket, to: Pick<Status, 'name'>, saved: Promise<boolean>) => void;

export const wasSaved = (request: Promise<unknown>): Promise<boolean> =>
  request.then(
    () => true,
    () => false,
  );

interface MoveOrigin extends RestorePoint {
  statusName: string | null;
}

interface PutBack {
  readBoard: (projectKey: string) => Promise<ProjectBoard>;
  move: (variables: { ticketKey: string; input: MoveTicketInput }) => Promise<unknown>;
}

const projectKeyOf = (ticketKey: string): string => parseTicketKey(ticketKey)?.projectKey ?? '';

// Whichever screen moved the ticket has its project's tickets or statuses cached; Ready for you
// has them in its list.
function cachedProject(queryClient: QueryClient, ticketKey: string) {
  const projectKey = projectKeyOf(ticketKey);
  const board = queryClient.getQueryData<ProjectBoard>(queryKeys.board(projectKey));
  const statuses =
    board?.statuses ??
    queryClient.getQueryData<ProjectDetail>(queryKeys.project(projectKey))?.statuses ??
    queryClient.getQueryData<TicketDetail>(queryKeys.ticket(ticketKey))?.statuses ??
    queryClient.getQueryData<TicketsAcrossProjects>(queryKeys.ready())?.statuses ??
    [];
  return { tickets: board?.tickets ?? [], statuses };
}

// A keyboard user who undid a move from the ticket's row or handle, or from Undo, which gives focus
// back to the row first, stays on the ticket's handle while it moves back: in its old group the row
// is a new element, so focus on the old one would fall to the page. Also while a refused
// move-back's rollback shows: React Query hands that to React in a batch it schedules, which runs
// before one scheduled after it.
function keepHandleFocus(ticketId: string): () => void {
  if (!rowHasFocus(ticketId)) return () => undefined;
  const release = requestHandleFocus(ticketId);
  return () => notifyManager.schedule(release);
}

// Waits for the move itself: a move that failed is already back, and a move-back sent before the
// move is saved could arrive first. The place is read from the list as it is now.
async function putBack(deps: PutBack, ticket: Ticket, from: MoveOrigin, saved: Promise<boolean>) {
  if (!(await saved)) return;
  const board = await deps.readBoard(projectKeyOf(ticket.key));
  const input = undoTarget(board.tickets, ticket.id, from);
  flashRows([ticket.key]);
  await deps.move({ ticketKey: ticket.key, input });
}

function useUndoMove() {
  const queryClient = useQueryClient();
  const client = useApi();
  const { mutateAsync } = useMoveTicket();
  const { show } = useToast();
  return useCallback(
    (ticket: Ticket, from: MoveOrigin, saved: Promise<boolean>) => {
      show(moveMessage(ticket.key, from.statusName));
      const releaseFocus = keepHandleFocus(ticket.id);
      const readBoard = (projectKey: string) =>
        queryClient.fetchQuery({
          queryKey: queryKeys.board(projectKey),
          queryFn: () => client.getBoard(projectKey),
        });
      void putBack({ readBoard, move: mutateAsync }, ticket, from, saved)
        .catch((error: unknown) => show(errorMessage(error), { kind: 'error' }))
        .finally(releaseFocus);
    },
    [queryClient, client, mutateAsync, show],
  );
}

export function useMoveToast(): ShowMove {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const undo = useUndoMove();
  return useCallback<ShowMove>(
    (ticket, to, saved) => {
      const cached = cachedProject(queryClient, ticket.key);
      const from: MoveOrigin = {
        ...restorePoint(cached.tickets, ticket),
        statusName: cached.statuses.find((status) => status.id === ticket.statusId)?.name ?? null,
      };
      show(moveMessage(ticket.key, to.name), { undo: () => undo(ticket, from, saved) });
    },
    [queryClient, show, undo],
  );
}
