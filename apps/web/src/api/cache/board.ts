import {
  byRank,
  findStatusByCategory,
  isDoneCategory,
  planMove,
  topRank,
  topRanks,
  type MoveTicketInput,
  type ProjectBoard,
  type Ticket,
  type TicketListItem,
  type TicketPlaceInput,
  type UpdateTicketInput,
} from '@tracker/shared';
import { ticketFields } from './fields';
import { withNextNum } from './projects';

export interface ListCounts {
  commentCount?: number;
  attachmentCount?: number;
}

const sameKey = (left: string, right: string): boolean =>
  left.toUpperCase() === right.toUpperCase();

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
): number =>
  topRank(tickets.filter((ticket) => ticket.statusId === statusId && ticket.id !== exceptId));

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

const isDoneIn = (board: ProjectBoard, statusId: string): boolean =>
  board.statuses.some((status) => status.id === statusId && isDoneCategory(status.category));

// As the tracker moves them: to the top of the project's first done status, in the order they
// stood in, while a ticket already done stays where it is.
export function moveBoardTicketsToDone(
  board: ProjectBoard,
  ticketKeys: readonly string[],
): ProjectBoard {
  const done = findStatusByCategory(board.statuses, 'done');
  const named = new Set(ticketKeys.map((key) => key.toUpperCase()));
  const leaving = board.tickets
    .filter((ticket) => named.has(ticket.key.toUpperCase()) && !isDoneIn(board, ticket.statusId))
    .sort(byRank);
  if (!done || leaving.length === 0) return board;

  const group = board.tickets.filter((ticket) => ticket.statusId === done.id);
  const ranks = topRanks(
    group,
    leaving.map((ticket) => ticket.id),
  );
  const tickets = board.tickets.map((ticket) => {
    const rank = ranks.get(ticket.id);

    return rank === undefined ? ticket : { ...ticket, statusId: done.id, rank };
  });

  return withTickets(board, tickets);
}

// As the tracker puts them back: only a ticket still done, only into a status that is not.
export function placeBoardTickets(
  board: ProjectBoard,
  places: readonly TicketPlaceInput[],
): ProjectBoard {
  const byKey = new Map(places.map((place) => [place.key.toUpperCase(), place]));
  const tickets = board.tickets.map((ticket) => {
    const place = byKey.get(ticket.key.toUpperCase());
    const status = board.statuses.find((candidate) => candidate.id === place?.statusId);
    const back = place && status && !isDoneCategory(status.category);

    return back && isDoneIn(board, ticket.statusId)
      ? { ...ticket, statusId: status.id, rank: place.rank }
      : ticket;
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
    waitingUntil: null,
  };
  const others = board.tickets.filter((item) => item.id !== ticket.id);

  return withTickets(withNextNum(board, ticket.num), [...others, { ...base, ...ticket }]);
}
