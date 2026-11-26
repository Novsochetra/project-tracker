import { z } from 'zod';
import { RANK_LIMIT } from '../logic/rank';

// Ready for you holds every reviewed ticket, 259 in PT when this came; the cap only bounds the
// work one request asks for.
export const DONE_MOVE_MAX = 500;

export const TOO_MANY_DONE_MOVES = `Move up to ${DONE_MOVE_MAX} tickets at a time.`;

const ticketKey = z.string().trim().min(1).max(40);
const id = z.string().min(1).max(64);
const rank = z.number().int().min(-RANK_LIMIT).max(RANK_LIMIT);

export const moveToDoneInput = z.object({
  keys: z.array(ticketKey).min(1).max(DONE_MOVE_MAX, TOO_MANY_DONE_MOVES),
});
export type MoveToDoneInput = z.input<typeof moveToDoneInput>;

export const ticketPlaceInput = z.object({ key: ticketKey, statusId: id, rank });
export type TicketPlaceInput = z.input<typeof ticketPlaceInput>;

export const undoMoveToDoneInput = z.object({
  tickets: z.array(ticketPlaceInput).min(1).max(DONE_MOVE_MAX, TOO_MANY_DONE_MOVES),
});
export type UndoMoveToDoneInput = z.input<typeof undoMoveToDoneInput>;

export interface TicketPlace {
  statusId: string;
  rank: number;
}

export interface MovedTicket {
  key: string;
  // Where the ticket was, so an undo can put it back in its place.
  from: TicketPlace;
}

// In the order the request named them. A key that names no ticket the caller can see, or one
// already where the request would put it, is skipped and the rest still move.
export interface TicketMoves {
  moved: MovedTicket[];
  skipped: string[];
}
