import {
  byRank,
  planMove,
  topRank,
  type MoveTicketInput,
  type ProjectBoard,
  type Ticket,
  type TicketListItem,
  type UpdateTicketInput,
} from '@tracker/shared';
import { ticketFields } from './fields';
import { withNextNum } from './projects';

export interface ListCounts {
  commentCount?: number;
  attachmentCount?: number;
}

const sameKey = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase();

const withTickets = (board: ProjectBoard, tickets: TicketListItem[]): ProjectBoard => ({
  ...board,
  tickets: [...tickets].sort(byRank),
});

export const findBoardTicket = (
  board: ProjectBoard,
  ticketKey: string,
): TicketListItem | undefined => board.tickets.find((ticket) => sameKey(ticket.key, ticketKey));

const groupTopRank = (
  tickets: readonly TicketListItem[],
  statusId: string,
  exceptId: string,
): number => topRank(tickets.filter((t) => t.statusId === statusId && t.id !== exceptId));

export function patchBoardTicket(
  board: ProjectBoard,
  ticketKey: string,
  input: UpdateTicketInput,
): ProjectBoard {
  const current = findBoardTicket(board, ticketKey);
  if (!current) return board;
  const next: TicketListItem = { ...current, ...ticketFields(input) };
  if (next.statusId !== current.statusId) {
    next.rank = groupTopRank(board.tickets, next.statusId, current.id);
  }
  return withTickets(
    board,
    board.tickets.map((ticket) => (ticket.id === current.id ? next : ticket)),
  );
}

export function moveBoardTicket(
  board: ProjectBoard,
  ticketKey: string,
  input: MoveTicketInput,
): ProjectBoard {
  const moved = findBoardTicket(board, ticketKey);
  const plan = moved ? planMove(board.tickets, moved.id, input) : null;
  if (!moved || !plan) return board;
  const tickets = board.tickets.map((ticket) => {
    const rank = plan.ranks.get(ticket.id) ?? ticket.rank;
    const statusId = ticket.id === moved.id ? input.statusId : ticket.statusId;
    return rank === ticket.rank && statusId === ticket.statusId
      ? ticket
      : { ...ticket, rank, statusId };
  });
  return withTickets(board, tickets);
}

export const removeBoardTicket = (board: ProjectBoard, ticketKey: string): ProjectBoard => ({
  ...board,
  tickets: board.tickets.filter((ticket) => !sameKey(ticket.key, ticketKey)),
});

export function upsertBoardTicket(
  board: ProjectBoard,
  ticket: Ticket,
  counts: ListCounts = {},
): ProjectBoard {
  const existing = board.tickets.find((item) => item.id === ticket.id);
  const base = existing ?? {
    commentCount: counts.commentCount ?? 0,
    attachmentCount: counts.attachmentCount ?? 0,
    lastReview: null,
  };
  const others = board.tickets.filter((item) => item.id !== ticket.id);
  return withTickets(withNextNum(board, ticket.num), [...others, { ...base, ...ticket }]);
}
