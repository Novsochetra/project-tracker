import { ApiError } from '@tracker/client';
import type {
  MoveTicketInput,
  ProjectBoard,
  TicketMoves,
  TicketPlaceInput,
  UpdateTicketInput,
} from '@tracker/shared';
import { vi } from 'vitest';
import {
  findBoardTicket,
  moveBoardTicket,
  moveBoardTicketsToDone,
  patchBoardTicket,
  placeBoardTickets,
} from '../../../api/cache/board';

// What the tracker answers a move of many: each ticket that changed status, with where it was.
function movesBetween(before: ProjectBoard, after: ProjectBoard, keys: string[]): TicketMoves {
  const moved = keys.flatMap((key) => {
    const was = findBoardTicket(before, key);
    const now = findBoardTicket(after, key);
    if (!was || !now || was.statusId === now.statusId) return [];

    return [{ key: was.key, from: { statusId: was.statusId, rank: was.rank } }];
  });
  const movedKeys = new Set(moved.map(({ key }) => key));

  return { moved, skipped: keys.filter((key) => !movedKeys.has(key)) };
}

export function fakeBoardServer(initial: ProjectBoard) {
  let board = initial;
  const saved = (ticketKey: string) => {
    const ticket = findBoardTicket(board, ticketKey);

    return ticket
      ? Promise.resolve(ticket)
      : Promise.reject(new ApiError(404, 'not_found', `${ticketKey} doesn't exist.`));
  };

  const client = {
    getBoard: vi.fn(() => Promise.resolve(board)),
    updateTicket: vi.fn((ticketKey: string, input: UpdateTicketInput) => {
      board = patchBoardTicket(board, ticketKey, input);

      return saved(ticketKey);
    }),
    moveTicket: vi.fn((ticketKey: string, input: MoveTicketInput) => {
      board = moveBoardTicket(board, ticketKey, input);

      return saved(ticketKey);
    }),
    moveToDone: vi.fn((keys: string[]) => {
      const before = board;
      board = moveBoardTicketsToDone(board, keys);

      return Promise.resolve(movesBetween(before, board, keys));
    }),
    undoMoveToDone: vi.fn((places: TicketPlaceInput[]) => {
      const before = board;
      board = placeBoardTickets(board, places);

      return Promise.resolve(
        movesBetween(
          before,
          board,
          places.map(({ key }) => key),
        ),
      );
    }),
    listPeople: vi.fn(() => Promise.resolve([])),
  };

  return {
    client,
    get board() {
      return board;
    },
    // Someone else, such as an agent, changes the board.
    edit: (change: (current: ProjectBoard) => ProjectBoard) => {
      board = change(board);
    },
  };
}
