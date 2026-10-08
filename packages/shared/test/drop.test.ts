import { describe, expect, it } from 'vitest';
import {
  keyboardMoveTarget,
  planMove,
  type MoveDirection,
  type MovePlan,
  type Placeable,
} from '../src/logic/drop';

const ticket = (id: string, statusId: string, rank: number, num: number): Placeable => ({
  id,
  statusId,
  rank,
  num,
});

const board: Placeable[] = [
  ticket('A', 'todo', 0, 1),
  ticket('B', 'todo', 1000, 2),
  ticket('C', 'todo', 2000, 3),
  ticket('D', 'doing', 0, 4),
  ticket('E', 'doing', 1000, 5),
];

const ORDER = ['todo', 'doing', 'done'];

const orderOf = (plan: MovePlan | null): string[] | null =>
  plan && [...plan.ranks.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);

const longGroup = (): Placeable[] =>
  Array.from({ length: 7 }, (_, index) => ticket(`T${index + 1}`, 'todo', index * 1000, index + 1));

function keyboardMove(
  tickets: Placeable[],
  id: string,
  direction: MoveDirection,
  order: string[] = ORDER,
) {
  const target = keyboardMoveTarget(tickets, id, direction, order);
  if (!target) return null;
  return { statusId: target.statusId, order: orderOf(planMove(tickets, id, target)) };
}

describe('planMove', () => {
  it('reorders within a group and renumbers it 0, 1000, 2000', () => {
    expect(planMove(board, 'C', { statusId: 'todo', beforeId: 'A' })).toEqual({
      statusChanged: false,
      ranks: new Map([
        ['C', 0],
        ['A', 1000],
        ['B', 2000],
      ]),
    });
  });

  it('returns null when the order does not change', () => {
    expect(planMove(board, 'A', { statusId: 'todo', beforeId: 'B' })).toBeNull();
    expect(planMove(board, 'B', { statusId: 'todo', afterId: 'A' })).toBeNull();
    expect(planMove(board, 'B', { statusId: 'todo', beforeId: 'C', afterId: 'A' })).toBeNull();
    expect(planMove(board, 'C', { statusId: 'todo' })).toBeNull();
  });

  it('moves a ticket to another group and marks the status as changed', () => {
    expect(planMove(board, 'A', { statusId: 'done' })).toEqual({
      statusChanged: true,
      ranks: new Map([['A', 0]]),
    });
  });

  it('never treats a move to another group as a no-op', () => {
    const lone = [ticket('A', 'todo', 0, 1)];

    expect(planMove(lone, 'A', { statusId: 'doing' })?.statusChanged).toBe(true);
  });

  it('inserts before beforeId', () => {
    expect(orderOf(planMove(board, 'A', { statusId: 'doing', beforeId: 'D' }))).toEqual([
      'A',
      'D',
      'E',
    ]);
    expect(orderOf(planMove(board, 'A', { statusId: 'doing', beforeId: 'E' }))).toEqual([
      'D',
      'A',
      'E',
    ]);
  });

  it('inserts after afterId', () => {
    expect(orderOf(planMove(board, 'A', { statusId: 'doing', afterId: 'D' }))).toEqual([
      'D',
      'A',
      'E',
    ]);
    expect(orderOf(planMove(board, 'A', { statusId: 'doing', afterId: 'E' }))).toEqual([
      'D',
      'E',
      'A',
    ]);
  });

  it('prefers beforeId over afterId', () => {
    const target = { statusId: 'doing', beforeId: 'D', afterId: 'E' };

    expect(orderOf(planMove(board, 'A', target))).toEqual(['A', 'D', 'E']);
  });

  it('adds the ticket at the end of the group without beforeId or afterId', () => {
    expect(orderOf(planMove(board, 'A', { statusId: 'doing' }))).toEqual(['D', 'E', 'A']);
    expect(
      orderOf(planMove(board, 'A', { statusId: 'doing', beforeId: null, afterId: null })),
    ).toEqual(['D', 'E', 'A']);
  });

  it('adds the ticket at the end of the group when beforeId or afterId is unknown', () => {
    expect(orderOf(planMove(board, 'A', { statusId: 'doing', beforeId: 'nope' }))).toEqual([
      'D',
      'E',
      'A',
    ]);
    expect(orderOf(planMove(board, 'A', { statusId: 'doing', afterId: 'nope' }))).toEqual([
      'D',
      'E',
      'A',
    ]);
  });

  it('treats an id from another group as unknown', () => {
    expect(orderOf(planMove(board, 'A', { statusId: 'doing', beforeId: 'B' }))).toEqual([
      'D',
      'E',
      'A',
    ]);
  });

  it('returns null for an unknown ticket', () => {
    expect(planMove(board, 'nope', { statusId: 'todo' })).toBeNull();
  });

  it('renumbers only the destination group', () => {
    const plan = planMove(board, 'A', { statusId: 'doing', beforeId: 'D' });

    expect([...(plan?.ranks.keys() ?? [])].sort()).toEqual(['A', 'D', 'E']);
  });

  it('evens out uneven ranks in the destination group', () => {
    const uneven = [
      ticket('P', 'todo', -2500, 1),
      ticket('Q', 'todo', 7, 2),
      ticket('R', 'todo', 9000, 3),
    ];

    expect(planMove(uneven, 'R', { statusId: 'todo', beforeId: 'Q' })?.ranks).toEqual(
      new Map([
        ['P', 0],
        ['R', 1000],
        ['Q', 2000],
      ]),
    );
  });

  it('reads the destination group in rank order, ties to the higher number first', () => {
    const tied = [ticket('P', 'todo', 0, 1), ticket('Q', 'todo', 0, 2), ticket('X', 'doing', 0, 3)];

    expect(orderOf(planMove(tied, 'X', { statusId: 'todo', afterId: 'Q' }))).toEqual([
      'Q',
      'X',
      'P',
    ]);
  });

  it('drops right after the last visible row of a collapsed group, not after the hidden rows', () => {
    const tickets = [...longGroup(), ticket('X', 'doing', 0, 8)];

    expect(
      orderOf(planMove(tickets, 'X', { statusId: 'todo', beforeId: null, afterId: 'T5' })),
    ).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'X', 'T6', 'T7']);
  });

  it('reorders inside a collapsed group to right after the last visible row', () => {
    expect(
      orderOf(planMove(longGroup(), 'T1', { statusId: 'todo', beforeId: null, afterId: 'T5' })),
    ).toEqual(['T2', 'T3', 'T4', 'T5', 'T1', 'T6', 'T7']);
  });
});

describe('keyboardMoveTarget', () => {
  it('moves up one slot within the group', () => {
    expect(keyboardMove(board, 'B', 'up')).toEqual({ statusId: 'todo', order: ['B', 'A', 'C'] });
    expect(keyboardMove(board, 'C', 'up')).toEqual({ statusId: 'todo', order: ['A', 'C', 'B'] });
  });

  it('moves down one slot within the group', () => {
    expect(keyboardMove(board, 'A', 'down')).toEqual({
      statusId: 'todo',
      order: ['B', 'A', 'C'],
    });
    expect(keyboardMove(board, 'B', 'down')).toEqual({
      statusId: 'todo',
      order: ['A', 'C', 'B'],
    });
  });

  it('moves up from the top of a group to the end of the previous status', () => {
    expect(keyboardMoveTarget(board, 'D', 'up', ORDER)).toEqual({
      statusId: 'todo',
      beforeId: null,
      afterId: 'C',
    });
    expect(keyboardMove(board, 'D', 'up')).toEqual({
      statusId: 'todo',
      order: ['A', 'B', 'C', 'D'],
    });
  });

  it('moves down from the bottom of a group to the start of the next status', () => {
    expect(keyboardMoveTarget(board, 'C', 'down', ORDER)).toEqual({
      statusId: 'doing',
      beforeId: 'D',
      afterId: null,
    });
    expect(keyboardMove(board, 'C', 'down')).toEqual({
      statusId: 'doing',
      order: ['C', 'D', 'E'],
    });
  });

  it('moves into an empty neighbor group', () => {
    expect(keyboardMoveTarget(board, 'E', 'down', ORDER)).toEqual({
      statusId: 'done',
      beforeId: null,
      afterId: null,
    });
    expect(keyboardMove(board, 'E', 'down')).toEqual({ statusId: 'done', order: ['E'] });

    const noTodo = board.filter((t) => t.statusId !== 'todo');
    expect(keyboardMove(noTodo, 'D', 'up')).toEqual({ statusId: 'todo', order: ['D'] });
  });

  it('crosses from a single-ticket group in either direction', () => {
    const tickets = [ticket('A', 'todo', 0, 1), ticket('D', 'doing', 0, 4)];

    expect(keyboardMove(tickets, 'D', 'up')).toEqual({ statusId: 'todo', order: ['A', 'D'] });
    expect(keyboardMove(tickets, 'D', 'down')).toEqual({ statusId: 'done', order: ['D'] });
  });

  it('returns null when there is no neighbor status in that direction', () => {
    expect(keyboardMoveTarget(board, 'A', 'up', ORDER)).toBeNull();

    const finished = [...board, ticket('F', 'done', 0, 6)];
    expect(keyboardMoveTarget(finished, 'F', 'down', ORDER)).toBeNull();
  });

  it('returns null for an unknown ticket', () => {
    expect(keyboardMoveTarget(board, 'nope', 'up', ORDER)).toBeNull();
    expect(keyboardMoveTarget(board, 'nope', 'down', ORDER)).toBeNull();
  });

  it('crosses groups in the given status order', () => {
    const order = ['doing', 'todo', 'done'];

    expect(keyboardMove(board, 'A', 'up', order)).toEqual({
      statusId: 'doing',
      order: ['D', 'E', 'A'],
    });
    expect(keyboardMove(board, 'E', 'down', order)).toEqual({
      statusId: 'todo',
      order: ['E', 'A', 'B', 'C'],
    });
    expect(keyboardMoveTarget(board, 'D', 'up', order)).toBeNull();
  });

  it('skips statuses the current filter hides', () => {
    expect(keyboardMoveTarget(board, 'E', 'down', ['todo', 'doing'])).toBeNull();
    expect(keyboardMove(board, 'C', 'down', ['todo', 'done'])).toEqual({
      statusId: 'done',
      order: ['C'],
    });
  });

  it('moves within a group outside the order but never across', () => {
    const tickets = [...board, ticket('F', 'done', 0, 6), ticket('G', 'done', 1000, 7)];
    const active = ['todo', 'doing'];

    expect(keyboardMove(tickets, 'G', 'up', active)).toEqual({
      statusId: 'done',
      order: ['G', 'F'],
    });
    expect(keyboardMoveTarget(tickets, 'F', 'up', active)).toBeNull();
    expect(keyboardMoveTarget(tickets, 'G', 'down', active)).toBeNull();
  });
});
