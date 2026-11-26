import { notifyManager, type QueryClient } from '@tanstack/react-query';
import type { ProjectBoard } from '@tracker/shared';
import { projectOfTicket, queryKeys } from '../../api';
import { findBoardTicket } from '../../api/cache/board';
import { focusBefore } from '../../lib/focusBefore';
import { requestHandleFocus, rowHasFocus } from './dnd/handleFocus';

// Held until React Query's own updates of the settled request are out, as a move's Undo does
// (useMoveToast).
const holdHandleFocus = (ticketId: string, settled: Promise<unknown>): void => {
  const release = requestHandleFocus(ticketId);
  const later = () => notifyManager.schedule(release);
  void settled.then(later, later);
};

// The group leaves with its tickets, and the button with focus in it. Focus goes to what comes
// before the group at once, then to the first ticket's handle once its row shows in Done, where a
// keyboard move would have left it; a filter that hides Done leaves it before the group.
export function followMovedTickets(
  group: Element | null,
  ticketId: string | undefined,
  moving: Promise<unknown>,
): void {
  if (group) focusBefore(group);
  if (ticketId) holdHandleFocus(ticketId, moving);
}

const boardTicketId = (queryClient: QueryClient, ticketKey: string): string | undefined => {
  const projectKey = projectOfTicket(ticketKey);
  const board = projectKey
    ? queryClient.getQueryData<ProjectBoard>(queryKeys.board(projectKey))
    : undefined;

  return board ? findBoardTicket(board, ticketKey)?.id : undefined;
};

// Undo moves the rows back to another group, where each is a new element: a keyboard user on one
// of them stays on its handle, as after a single move's Undo.
export function keepMovedRowFocus(
  queryClient: QueryClient,
  ticketKeys: readonly string[],
  settled: Promise<unknown>,
): void {
  const focused = ticketKeys
    .map((key) => boardTicketId(queryClient, key))
    .find((ticketId) => ticketId !== undefined && rowHasFocus(ticketId));
  if (focused) holdHandleFocus(focused, settled);
}
