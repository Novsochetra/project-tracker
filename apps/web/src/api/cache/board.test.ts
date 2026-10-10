import { describe, expect, it } from 'vitest';
import { listItem, makeBoard, STATUS } from '../test/fixtures';
import {
  findBoardTicket,
  moveBoardTicket,
  patchBoardTicket,
  removeBoardTicket,
  upsertBoardTicket,
} from './board';

const keysIn = (board: ReturnType<typeof makeBoard>, statusId: string) =>
  board.tickets.filter((ticket) => ticket.statusId === statusId).map((ticket) => ticket.key);

describe('patchBoardTicket', () => {
  it('patches fields in place without moving the ticket', () => {
    const board = patchBoardTicket(makeBoard(), 'MOB-2', { title: 'Renamed', priority: 'high' });
    const ticket = findBoardTicket(board, 'MOB-2');
    expect(ticket).toMatchObject({ title: 'Renamed', priority: 'high', rank: 1000 });
    expect(keysIn(board, STATUS.todo)).toEqual(['MOB-1', 'MOB-2']);
  });

  it('ignores fields that are undefined', () => {
    const board = patchBoardTicket(makeBoard(), 'MOB-1', { title: undefined, assignee: 'Dara' });
    expect(findBoardTicket(board, 'MOB-1')).toMatchObject({ title: 'Ticket 1', assignee: 'Dara' });
  });

  it('moves a status change to the top of the new group', () => {
    const board = patchBoardTicket(makeBoard(), 'MOB-2', { statusId: STATUS.progress });
    expect(findBoardTicket(board, 'MOB-2')).toMatchObject({
      statusId: STATUS.progress,
      rank: -1000,
    });
    expect(keysIn(board, STATUS.progress)).toEqual(['MOB-2', 'MOB-3']);
    expect(keysIn(board, STATUS.todo)).toEqual(['MOB-1']);
  });

  it('uses rank 0 when the new group is empty', () => {
    const board = patchBoardTicket(makeBoard(), 'MOB-1', { statusId: STATUS.review });
    expect(findBoardTicket(board, 'MOB-1')).toMatchObject({ statusId: STATUS.review, rank: 0 });
  });

  it('matches ticket keys case-insensitively and ignores unknown tickets', () => {
    const original = makeBoard();
    expect(
      findBoardTicket(patchBoardTicket(original, 'mob-1', { title: 'x' }), 'MOB-1')?.title,
    ).toBe('x');
    expect(patchBoardTicket(original, 'MOB-99', { title: 'x' })).toBe(original);
  });
});

describe('moveBoardTicket', () => {
  it('applies planMove across groups and renumbers the destination', () => {
    const board = moveBoardTicket(makeBoard(), 'MOB-1', {
      statusId: STATUS.progress,
      afterId: 't-3',
    });
    expect(keysIn(board, STATUS.progress)).toEqual(['MOB-3', 'MOB-1']);
    expect(findBoardTicket(board, 'MOB-3')?.rank).toBe(0);
    expect(findBoardTicket(board, 'MOB-1')).toMatchObject({
      statusId: STATUS.progress,
      rank: 1000,
    });
    expect(keysIn(board, STATUS.todo)).toEqual(['MOB-2']);
  });

  it('reorders within a group', () => {
    const board = moveBoardTicket(makeBoard(), 'MOB-2', { statusId: STATUS.todo, beforeId: 't-1' });
    expect(keysIn(board, STATUS.todo)).toEqual(['MOB-2', 'MOB-1']);
    expect(findBoardTicket(board, 'MOB-2')?.rank).toBe(0);
    expect(findBoardTicket(board, 'MOB-1')?.rank).toBe(1000);
  });

  it('returns the same board when the order would not change', () => {
    const original = makeBoard();
    expect(moveBoardTicket(original, 'MOB-1', { statusId: STATUS.todo, beforeId: 't-2' })).toBe(
      original,
    );
    expect(moveBoardTicket(original, 'MOB-9', { statusId: STATUS.todo })).toBe(original);
  });
});

describe('removeBoardTicket', () => {
  it('drops the ticket', () => {
    expect(keysIn(removeBoardTicket(makeBoard(), 'MOB-1'), STATUS.todo)).toEqual(['MOB-2']);
  });
});

describe('upsertBoardTicket', () => {
  it('inserts a new ticket with counts and bumps the next number', () => {
    const {
      commentCount: _c,
      attachmentCount: _a,
      lastReview: _r,
      waiting: _w,
      ...ticket
    } = listItem(5, STATUS.todo, -1000);
    const board = upsertBoardTicket(makeBoard(), ticket, { attachmentCount: 2 });
    expect(keysIn(board, STATUS.todo)).toEqual(['MOB-5', 'MOB-1', 'MOB-2']);
    expect(findBoardTicket(board, 'MOB-5')).toEqual({
      ...ticket,
      commentCount: 0,
      attachmentCount: 2,
      lastReview: null,
      waiting: false,
    });
    expect(board.project.nextNum).toBe(6);
  });

  it('replaces an existing ticket and keeps its counts, last review and waiting', () => {
    const lastReview = { verdict: 'approved', rating: 4 } as const;
    const original = makeBoard([
      listItem(1, STATUS.todo, 0, { commentCount: 3, lastReview, waiting: true }),
    ]);
    const {
      commentCount: _c,
      attachmentCount: _a,
      lastReview: _r,
      waiting: _w,
      ...ticket
    } = listItem(1, STATUS.progress, -1000);
    const board = upsertBoardTicket(original, ticket);
    expect(findBoardTicket(board, 'MOB-1')).toMatchObject({
      statusId: STATUS.progress,
      commentCount: 3,
      lastReview,
      waiting: true,
    });
    expect(board.tickets).toHaveLength(1);
    expect(board.project.nextNum).toBe(5);
  });
});
