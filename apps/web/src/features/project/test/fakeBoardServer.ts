import { ApiError } from '@tracker/client';
import type { MoveTicketInput, ProjectBoard, UpdateTicketInput } from '@tracker/shared';
import { vi } from 'vitest';
import { findBoardTicket, moveBoardTicket, patchBoardTicket } from '../../../api/cache/board';

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
